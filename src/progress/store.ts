import { create } from 'zustand'
import { type Repository, createIndexedDbRepository } from '@/data/repository'
import { type SyncChannel, createBroadcastSync, createNoopSync } from '@/data/sync'
import type { Topic } from '@/engine/types'
import type { ProgressData } from '@/data/repository'
import { mergeAttempts, mergeSettings, newerAttempts } from '@/sync/merge'
import { type Attempt, DEFAULT_SETTINGS, type Settings } from './types'

export type NewAttempt = Pick<
  Attempt,
  'templateId' | 'seed' | 'earned' | 'total' | 'allCorrect' | 'steps' | 'durationMs' | 'exam'
> & { topic: Topic }

type ProgressState = {
  status: 'loading' | 'ready' | 'error'
  attempts: Attempt[]
  settings: Settings
  load(): Promise<void>
  recordAttempt(attempt: NewAttempt, now?: Date): Promise<Attempt>
  /**
   * 記録した解答の採点を直す（記述の自己採点など）。更新日時を今にするので、端末間の同期でも新しい方として伝わる。
   * 見つからない（削除された）記録なら何もしない
   */
  updateAttemptScore(
    id: string,
    patch: Pick<Attempt, 'earned' | 'total' | 'allCorrect' | 'steps'>,
    now?: Date,
  ): Promise<void>
  updateSettings(patch: Partial<Omit<Settings, 'updatedAt'>>): Promise<void>
  /**
   * すべて置き換える（バックアップの読み込み用。形式の確認は src/data/backup.ts で行う）。
   * 置き換えで無くなる記録は消さずに削除の印（deletedAt）を付ける（ほかの端末に削除を伝えるため）
   */
  replaceAll(data: ProgressData, now?: Date): Promise<void>
  resetAll(now?: Date): Promise<void>
  /** ほかの端末から届いた記録と設定を取り込む。変わったものがあれば true */
  mergeRemote(remote: { attempts: readonly Attempt[]; settings: Settings | null }): Promise<boolean>
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
        const current = new Map(get().attempts.map((attempt) => [attempt.id, attempt]))
        // 保存がまだの記録は、新しく足したものも、更新したもの（自己採点など）も画面の値を残す
        const unsaved = get().attempts.filter(
          (attempt) => unsavedAttemptIds.has(attempt.id) && !loadedIds.has(attempt.id),
        )
        const loaded = data.attempts.map((attempt) =>
          unsavedAttemptIds.has(attempt.id) ? (current.get(attempt.id) ?? attempt) : attempt,
        )
        set({
          status: 'ready',
          attempts: [...loaded, ...unsaved],
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

      async updateAttemptScore(id, patch, now = new Date()) {
        const current = get().attempts.find((attempt) => attempt.id === id && !attempt.deletedAt)
        if (!current) return
        const attempt: Attempt = { ...current, ...patch, updatedAt: now.toISOString() }
        unsavedAttemptIds.add(id)
        set({ attempts: get().attempts.map((a) => (a.id === id ? attempt : a)) })
        try {
          await enqueue(() => repository.putAttempt(attempt))
        } finally {
          unsavedAttemptIds.delete(id)
        }
        sync.notify('progress')
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

      async replaceAll(data, now = new Date()) {
        const timestamp = now.toISOString()
        const keep = new Set(data.attempts.map((attempt) => attempt.id))
        const tombstones = get()
          .attempts.filter((attempt) => !keep.has(attempt.id) && !attempt.deletedAt)
          .map((attempt) => ({ ...attempt, deletedAt: timestamp, updatedAt: timestamp }))
        const attempts = mergeAttempts(data.attempts, tombstones)
        // 置き換えた設定がほかの端末の設定より新しいものとして扱われるよう、更新日時を今にする
        const settings = { ...data.settings, updatedAt: timestamp }
        await enqueue(async () => {
          await repository.replaceAll({ attempts, settings })
          set({ attempts, settings })
        })
        sync.notify('progress')
      },

      resetAll: (now = new Date()) =>
        get().replaceAll({ attempts: [], settings: DEFAULT_SETTINGS }, now),

      async mergeRemote(remote) {
        const changed = await enqueue(async () => {
          const current = get()
          const incoming = newerAttempts(current.attempts, remote.attempts)
          const settings = mergeSettings(current.settings, remote.settings)
          const settingsChanged = settings !== current.settings
          if (incoming.length === 0 && !settingsChanged) return false
          if (incoming.length > 0) await repository.putAttempts(incoming)
          if (settingsChanged) await repository.putSettings(settings)
          set({ attempts: mergeAttempts(get().attempts, incoming), settings })
          return true
        })
        if (changed) sync.notify('progress')
        return changed
      },
    }
  })
  return store
}

export const useProgressStore = createProgressStore(
  createIndexedDbRepository(),
  createBroadcastSync(),
)
