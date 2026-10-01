import { afterEach, describe, expect, it } from 'vitest'
import {
  SPLASH_DURATION_MS,
  markSplashHandled,
  resetSplash,
  shouldShowSplash,
  syncStatusLabel,
} from './splashState'

type Snapshot = Parameters<typeof syncStatusLabel>[0]

const since = Date.parse('2026-10-01T09:00:00Z')
const before = '2026-10-01T08:00:00.000Z'
const after = '2026-10-01T09:00:05.000Z'

function snapshot(partial: Partial<Snapshot>): Snapshot {
  return { status: 'idle', key: 'k', lastSyncedAt: null, ...partial }
}

afterEach(() => {
  markSplashHandled()
})

describe('起動画面を出すか', () => {
  it('開き直したトップでは出す', () => {
    resetSplash()
    expect(shouldShowSplash('/', false)).toBe(true)
  })

  it('トップ以外・別ウィンドウ用のパネルでは出さない', () => {
    resetSplash()
    expect(shouldShowSplash('/labs', false)).toBe(false)
    expect(shouldShowSplash('/', true)).toBe(false)
  })

  it('一度決まったら、あとでトップに戻っても出さない', () => {
    resetSplash()
    markSplashHandled()
    expect(shouldShowSplash('/', false)).toBe(false)
  })
})

describe('起動画面を出している長さ', () => {
  it('1.5 秒', () => {
    expect(SPLASH_DURATION_MS).toBe(1500)
  })
})

describe('同期の状態の表示', () => {
  it('同期を使っていない端末では何も出さない', () => {
    expect(syncStatusLabel(snapshot({ status: 'off', key: null }), since)).toBeNull()
    expect(syncStatusLabel(snapshot({ status: 'loading', key: null }), since)).toBeNull()
  })

  it('開いたあとにまだ同期できていなければ「同期中」（前回の同期の時刻は数えない）', () => {
    expect(syncStatusLabel(snapshot({ status: 'syncing' }), since)).toBe('同期中…')
    expect(syncStatusLabel(snapshot({ lastSyncedAt: before }), since)).toBe('同期中…')
  })

  it('開いたあとに同期できたら「最新です」', () => {
    expect(syncStatusLabel(snapshot({ lastSyncedAt: after }), since)).toBe('最新です')
  })

  it('失敗したら、あとでやり直すと伝える', () => {
    expect(syncStatusLabel(snapshot({ status: 'error' }), since)).toContain(
      'あとで自動でやり直します',
    )
  })
})
