import { clear, createStore, entries, set, setMany } from 'idb-keyval'
import {
  type Attempt,
  DEFAULT_SETTINGS,
  type Settings,
  attemptSchema,
  settingsSchema,
} from '@/progress/types'

export type ProgressData = {
  attempts: Attempt[]
  settings: Settings
}

/**
 * 保存先とのやりとり（docs/DESIGN.md §9.3）。画面や状態管理はこれ経由でだけ読み書きする。
 * 今はブラウザの IndexedDB。将来同期するときは、この実装を差し替える。
 */
export type Repository = {
  load(): Promise<ProgressData>
  putAttempt(attempt: Attempt): Promise<void>
  /** まとめて保存する（ほかの端末から届いた記録の取り込み用） */
  putAttempts(attempts: readonly Attempt[]): Promise<void>
  putSettings(settings: Settings): Promise<void>
  /** すべて置き換える（読み込み・初期化用） */
  replaceAll(data: ProgressData): Promise<void>
}

const ATTEMPT_PREFIX = 'attempt:'
const SETTINGS_KEY = 'settings'

export function createIndexedDbRepository(dbName = 'luminous-insight'): Repository {
  const store = createStore(dbName, 'progress')
  return {
    async load() {
      const attempts: Attempt[] = []
      let settings = DEFAULT_SETTINGS
      for (const [key, value] of await entries<string, unknown>(store)) {
        if (key === SETTINGS_KEY) {
          const parsed = settingsSchema.safeParse(value)
          if (parsed.success) settings = parsed.data
        } else if (key.startsWith(ATTEMPT_PREFIX)) {
          // 形が壊れた記録は読み飛ばす（アプリ全体を止めない）
          const parsed = attemptSchema.safeParse(value)
          if (parsed.success) attempts.push(parsed.data)
        }
      }
      attempts.sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))
      return { attempts, settings }
    },
    putAttempt: (attempt) => set(ATTEMPT_PREFIX + attempt.id, attempt, store),
    putAttempts: (attempts) =>
      setMany(
        attempts.map((attempt): [string, Attempt] => [ATTEMPT_PREFIX + attempt.id, attempt]),
        store,
      ),
    putSettings: (settings) => set(SETTINGS_KEY, settings, store),
    async replaceAll({ attempts, settings }) {
      await clear(store)
      await setMany(
        [
          [SETTINGS_KEY, settings],
          ...attempts.map((attempt): [string, Attempt] => [ATTEMPT_PREFIX + attempt.id, attempt]),
        ],
        store,
      )
    },
  }
}

/** テストや保存できない環境で使う、メモリ上だけの保存先 */
export function createMemoryRepository(initial?: Partial<ProgressData>): Repository {
  let data: ProgressData = {
    attempts: [...(initial?.attempts ?? [])],
    settings: initial?.settings ?? DEFAULT_SETTINGS,
  }
  return {
    load: async () => ({ attempts: [...data.attempts], settings: data.settings }),
    putAttempt: async (attempt) => {
      data = { ...data, attempts: [...data.attempts.filter((a) => a.id !== attempt.id), attempt] }
    },
    putAttempts: async (attempts) => {
      const ids = new Set(attempts.map((attempt) => attempt.id))
      data = { ...data, attempts: [...data.attempts.filter((a) => !ids.has(a.id)), ...attempts] }
    },
    putSettings: async (settings) => {
      data = { ...data, settings }
    },
    replaceAll: async (next) => {
      data = { attempts: [...next.attempts], settings: next.settings }
    },
  }
}
