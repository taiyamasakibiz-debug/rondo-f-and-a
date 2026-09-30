import { describe, expect, it } from 'vitest'
import { type Attempt, DEFAULT_SETTINGS } from '../progress/types'
import {
  SYNC_KEY_LENGTH,
  createMemorySyncStorage,
  formatSyncKey,
  generateSyncKey,
  handleSync,
  normalizeSyncKey,
} from './protocol'

function attempt(id: string, updatedAt = '2026-10-01T01:00:00.000Z', extra: Partial<Attempt> = {}) {
  return {
    id,
    templateId: 'cvp.break-even.basic',
    topic: 'cvp' as const,
    seed: 1,
    earned: 5,
    total: 5,
    allCorrect: true,
    steps: [],
    durationMs: 1,
    answeredAt: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt,
    ...extra,
  }
}

describe('handleSync', () => {
  it('PC が送った記録を、スマホが受け取れる', async () => {
    const storage = createMemorySyncStorage()
    const pc = await handleSync(storage, {
      attempts: [attempt('pc-1')],
      settings: DEFAULT_SETTINGS,
      since: 0,
    })
    expect(pc.cursor).toBe(1)

    const phone = await handleSync(storage, { attempts: [], settings: DEFAULT_SETTINGS, since: 0 })
    expect(phone.attempts.map((a) => a.id)).toEqual(['pc-1'])
  })

  it('前回受け取ったあとに変わった記録だけを返す', async () => {
    const storage = createMemorySyncStorage()
    const first = await handleSync(storage, {
      attempts: [attempt('a'), attempt('b')],
      settings: DEFAULT_SETTINGS,
      since: 0,
    })
    const second = await handleSync(storage, {
      attempts: [attempt('c')],
      settings: DEFAULT_SETTINGS,
      since: first.cursor,
    })
    expect(second.attempts.map((a) => a.id)).toEqual(['c'])
    expect(second.cursor).toBe(3)
  })

  it('同じ記録を何度送っても、通し番号は進まない（古いものでは上書きしない）', async () => {
    const storage = createMemorySyncStorage()
    await handleSync(storage, {
      attempts: [attempt('a', '2026-10-01T02:00:00.000Z')],
      settings: DEFAULT_SETTINGS,
      since: 0,
    })
    const again = await handleSync(storage, {
      attempts: [attempt('a', '2026-10-01T01:00:00.000Z', { earned: 0 })],
      settings: DEFAULT_SETTINGS,
      since: 1,
    })
    expect(again).toMatchObject({ attempts: [], cursor: 1 })
    const all = await handleSync(storage, { attempts: [], settings: DEFAULT_SETTINGS, since: 0 })
    expect(all.attempts[0]!.earned).toBe(5)
  })

  it('削除の印（deletedAt）も、ほかの端末に届く', async () => {
    const storage = createMemorySyncStorage()
    await handleSync(storage, { attempts: [attempt('a')], settings: DEFAULT_SETTINGS, since: 0 })
    const deleted = attempt('a', '2026-10-02T00:00:00.000Z', {
      deletedAt: '2026-10-02T00:00:00.000Z',
    })
    await handleSync(storage, { attempts: [deleted], settings: DEFAULT_SETTINGS, since: 1 })
    const phone = await handleSync(storage, { attempts: [], settings: DEFAULT_SETTINGS, since: 1 })
    expect(phone.attempts).toEqual([deleted])
  })

  it('設定は新しく変えた方を返す', async () => {
    const storage = createMemorySyncStorage()
    const newer = { ...DEFAULT_SETTINGS, dailyGoal: 6, updatedAt: '2026-10-02T00:00:00.000Z' }
    await handleSync(storage, { attempts: [], settings: newer, since: 0 })
    const phone = await handleSync(storage, { attempts: [], settings: DEFAULT_SETTINGS, since: 0 })
    expect(phone.settings).toEqual(newer)
  })
})

describe('同期キー', () => {
  it('32 文字のランダムなキーを作り、毎回違う', () => {
    const a = generateSyncKey()
    const b = generateSyncKey()
    expect(a).toHaveLength(SYNC_KEY_LENGTH)
    expect(a).not.toBe(b)
    expect(normalizeSyncKey(a)).toBe(a)
  })

  it('区切り・小文字・読み間違えやすい文字を直して読む', () => {
    const key = generateSyncKey()
    expect(normalizeSyncKey(formatSyncKey(key).toLowerCase())).toBe(key)
    expect(normalizeSyncKey('O'.repeat(32))).toBe('0'.repeat(32))
    expect(normalizeSyncKey('il'.repeat(16))).toBe('1'.repeat(32))
  })

  it('長さや文字がおかしいキーは読まない', () => {
    expect(normalizeSyncKey('ABC')).toBeNull()
    expect(normalizeSyncKey('!'.repeat(32))).toBeNull()
    expect(normalizeSyncKey('U'.repeat(32))).toBeNull()
  })
})
