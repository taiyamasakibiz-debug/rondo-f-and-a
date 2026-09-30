import { z } from 'zod'
import { type Attempt, type Settings, attemptSchema, settingsSchema } from '../progress/types'
import { mergeSettings, newerAttempts } from './merge'

/**
 * 端末とサーバーの同期のやりとり（端末とサーバーの両方で使う）。
 * 端末は「前回送ったあとに変わった記録」と今の設定を送り、
 * サーバーは「その端末が前回受け取ったあとに変わった記録」と設定を返す。
 */
export const MAX_ATTEMPTS_PER_REQUEST = 5_000

export const syncRequestSchema = z.object({
  attempts: z.array(attemptSchema).max(MAX_ATTEMPTS_PER_REQUEST),
  settings: settingsSchema,
  /** 前回受け取ったときのサーバーの通し番号（はじめては 0） */
  since: z.number().int().nonnegative(),
})
export type SyncRequest = z.infer<typeof syncRequestSchema>

export const syncResponseSchema = z.object({
  attempts: z.array(attemptSchema),
  settings: settingsSchema.nullable(),
  /** 次回の since に使う通し番号 */
  cursor: z.number().int().nonnegative(),
})
export type SyncResponse = {
  attempts: Attempt[]
  settings: Settings | null
  cursor: number
}

/** サーバー側の保存先（Durable Objects のストレージと同じ形。テストではメモリで置き換える） */
export type SyncStorage = {
  get<T>(key: string): Promise<T | undefined>
  put(entries: Record<string, unknown>): Promise<void>
  list<T>(options: { prefix: string }): Promise<Map<string, T>>
}

type StoredAttempt = { attempt: Attempt; seq: number }

const ATTEMPT_PREFIX = 'a:'
const SEQ_KEY = 'seq'
const SETTINGS_KEY = 'settings'

/**
 * 1 回の同期。届いた記録のうち新しいものだけを保存して通し番号を振り、
 * since より後に変わった記録を返す。
 */
export async function handleSync(
  storage: SyncStorage,
  request: SyncRequest,
): Promise<SyncResponse> {
  let seq = (await storage.get<number>(SEQ_KEY)) ?? 0
  const stored = await storage.list<StoredAttempt>({ prefix: ATTEMPT_PREFIX })
  const current = [...stored.values()].map((item) => item.attempt)

  const updates: Record<string, unknown> = {}
  for (const attempt of newerAttempts(current, request.attempts)) {
    seq += 1
    const item: StoredAttempt = { attempt, seq }
    updates[ATTEMPT_PREFIX + attempt.id] = item
    stored.set(ATTEMPT_PREFIX + attempt.id, item)
  }

  const savedSettings = (await storage.get<Settings>(SETTINGS_KEY)) ?? null
  const settings = savedSettings ? mergeSettings(savedSettings, request.settings) : request.settings
  if (settings !== savedSettings) updates[SETTINGS_KEY] = settings

  if (Object.keys(updates).length > 0) {
    updates[SEQ_KEY] = seq
    await storage.put(updates)
  }

  return {
    attempts: [...stored.values()]
      .filter((item) => item.seq > request.since)
      .map((item) => item.attempt),
    settings,
    cursor: seq,
  }
}

/** メモリ上の保存先（テスト用） */
export function createMemorySyncStorage(): SyncStorage {
  const data = new Map<string, unknown>()
  return {
    get: async <T>(key: string) => structuredClone(data.get(key)) as T | undefined,
    put: async (entries) => {
      for (const [key, value] of Object.entries(entries)) data.set(key, structuredClone(value))
    },
    list: async <T>({ prefix }: { prefix: string }) =>
      new Map(
        [...data]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => [key, structuredClone(value) as T]),
      ),
  }
}

// ---------------------------------------------------------------------------
// 同期キー

/** 読み間違えやすい I・L・O・U を除いた 32 文字（Crockford Base32） */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const SYNC_KEY_LENGTH = 32

/** 160 ビットのランダムな同期キー（推測できない長さにする） */
export function generateSyncKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SYNC_KEY_LENGTH))
  return [...bytes].map((byte) => ALPHABET[byte & 31]).join('')
}

/** 入力されたキーを正規化する（小文字・区切り・読み間違えやすい文字を直す）。形がおかしければ null */
export function normalizeSyncKey(input: string): string | null {
  const key = input
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
  return key.length === SYNC_KEY_LENGTH && [...key].every((char) => ALPHABET.includes(char))
    ? key
    : null
}

/** 表示用：4 文字ごとに区切る */
export function formatSyncKey(key: string): string {
  return key.match(/.{1,4}/g)?.join('-') ?? key
}
