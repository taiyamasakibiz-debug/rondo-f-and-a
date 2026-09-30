import { create } from 'zustand'
import { type Repository, createIndexedDbRepository } from '@/data/repository'
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
 */
export function createProgressStore(repository: Repository) {
  return create<ProgressState>()((set, get) => ({
    status: 'loading',
    attempts: [],
    settings: DEFAULT_SETTINGS,

    async load() {
      try {
        const data = await repository.load()
        set({ status: 'ready', ...data })
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
      set({ attempts: [...get().attempts, attempt] })
      await repository.putAttempt(attempt)
      return attempt
    },

    async updateSettings(patch) {
      const settings = { ...get().settings, ...patch, updatedAt: new Date().toISOString() }
      set({ settings })
      await repository.putSettings(settings)
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
      await repository.replaceAll({ attempts, settings })
      set({ attempts, settings })
      return { ok: true, attempts: attempts.length }
    },

    async resetAll() {
      await repository.replaceAll({ attempts: [], settings: DEFAULT_SETTINGS })
      set({ attempts: [], settings: DEFAULT_SETTINGS })
    },
  }))
}

export const useProgressStore = createProgressStore(createIndexedDbRepository())
