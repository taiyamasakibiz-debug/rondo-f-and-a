import { create } from 'zustand'
import { type Repository, createIndexedDbRepository } from '@/data/repository'
import { type SyncChannel, createBroadcastSync, createNoopSync } from '@/data/sync'
import type { Topic } from '@/engine/types'
import {
  type Attempt,
  DEFAULT_SETTINGS,
  type ExportData,
  type Settings,
  exportSchema,
} from './types'

export type NewAttempt = Pick<
  Attempt,
  'templateId' | 'seed' | 'earned' | 'total' | 'allCorrect' | 'steps' | 'durationMs'
> & { topic: Topic }

export type ImportResult = { ok: true; attempts: number } | { ok: false; message: string }

type ProgressState = {
  status: 'loading' | 'ready' | 'error'
  attempts: Attempt[]
  settings: Settings
  load(): Promise<void>
  recordAttempt(attempt: NewAttempt, now?: Date): Promise<Attempt>
  updateSettings(patch: Partial<Pick<Settings, 'dailyGoal' | 'dayStartHour'>>): Promise<void>
  exportData(now?: Date): ExportData
  importData(json: string): Promise<ImportResult>
  resetAll(): Promise<void>
}

/**
 * 解答記録と設定の状態。保存するのはこの 2 つだけで、レベル・ストリーク・復習は
 * 画面側で計算する（docs/DESIGN.md §9.4：派生する値は二重に持たない）。
 *
 * 複数ウィンドウの同期（§2）：保存し終わったら sync でほかのウィンドウに知らせ、
 * 知らせを受けたら保存先から読み直す。保存と読み直しは 1 列に並べて順番に行い、
 * 保存の途中で古いデータを読み直して記録が消える、ということが起きないようにする。
 */
export function createProgressStore(repository: Repository, sync: SyncChannel = createNoopSync()) {
  let queue: Promise<unknown> = Promise.resolve()
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task)
    queue = run.catch(() => {})
    return run
  }
  // まだ保存し終わっていない変更。読み直しのときに消さないよう、画面の値を残す
  const unsavedAttemptIds = new Set<string>()
  let unsavedSettings = 0

  const store = create<ProgressState>()((set, get) => {
    /** 保存先から読み直す。保存がまだの変更は画面の値を残す */
    const reload = () =>
      enqueue(async () => {
        const data = await repository.load()
        const loadedIds = new Set(data.attempts.map((attempt) => attempt.id))
        const unsaved = get().attempts.filter(
          (attempt) => unsavedAttemptIds.has(attempt.id) && !loadedIds.has(attempt.id),
        )
        set({
          status: 'ready',
          attempts: [...data.attempts, ...unsaved],
          settings: unsavedSettings > 0 ? get().settings : data.settings,
        })
      })

    sync.subscribe((message) => {
      if (message.scope !== 'progress') return
      reload().catch((error: unknown) => console.error('記録の読み直しに失敗しました', error))
    })

    return {
      status: 'loading',
      attempts: [],
      settings: DEFAULT_SETTINGS,

      async load() {
        try {
          await reload()
        } catch (error) {
          console.error('記録の読み込みに失敗しました', error)
          set({ status: 'error' })
        }
      },

      async recordAttempt(input, now = new Date()) {
        const timestamp = now.toISOString()
        const attempt: Attempt = {
          ...input,
          id: crypto.randomUUID(),
          answeredAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        // 画面にはすぐ反映し、保存は順番に行う
        unsavedAttemptIds.add(attempt.id)
        set({ attempts: [...get().attempts, attempt] })
        try {
          await enqueue(() => repository.putAttempt(attempt))
        } finally {
          unsavedAttemptIds.delete(attempt.id)
        }
        sync.notify('progress')
        return attempt
      },

      async updateSettings(patch) {
        const settings = { ...get().settings, ...patch, updatedAt: new Date().toISOString() }
        unsavedSettings += 1
        set({ settings })
        try {
          await enqueue(() => repository.putSettings(settings))
        } finally {
          unsavedSettings -= 1
        }
        sync.notify('progress')
      },

      exportData(now = new Date()) {
        return {
          app: 'luminous-insight',
          version: 1,
          exportedAt: now.toISOString(),
          attempts: get().attempts,
          settings: get().settings,
        }
      },

      async importData(json) {
        let raw: unknown
        try {
          raw = JSON.parse(json)
        } catch {
          return { ok: false, message: 'JSON として読み取れませんでした。' }
        }
        const parsed = exportSchema.safeParse(raw)
        if (!parsed.success) {
          return {
            ok: false,
            message: 'このアプリで書き出したデータではないか、形式が壊れています。',
          }
        }
        const { attempts, settings } = parsed.data
        await enqueue(async () => {
          await repository.replaceAll({ attempts, settings })
          set({ attempts, settings })
        })
        sync.notify('progress')
        return { ok: true, attempts: attempts.length }
      },

      async resetAll() {
        await enqueue(async () => {
          await repository.replaceAll({ attempts: [], settings: DEFAULT_SETTINGS })
          set({ attempts: [], settings: DEFAULT_SETTINGS })
        })
        sync.notify('progress')
      },
    }
  })
  return store
}

export const useProgressStore = createProgressStore(
  createIndexedDbRepository(),
  createBroadcastSync(),
)
