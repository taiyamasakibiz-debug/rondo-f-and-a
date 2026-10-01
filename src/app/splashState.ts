import { useSyncStore } from '@/sync/client'

/**
 * 起動画面（ロゴとアイコンだけの画面）まわりの決まりごと。
 * アプリを開き直したときの 1 回だけ、トップ（/）で出す。画面の中の移動や、ほかの画面から入ったときは出さない。
 */

/** この起動での起動画面の扱いが決まったか（出した・出さないと決めた、のどちらでも true） */
let handled = false

export function shouldShowSplash(pathname: string, windowMode: boolean): boolean {
  return !handled && pathname === '/' && !windowMode
}

export function markSplashHandled(): void {
  handled = true
}

/** テスト用：まだ決まっていない状態に戻す */
export function resetSplash(): void {
  handled = false
}

/** 起動画面を出している長さ。同期が終わっていなくても、これだけ経ったらホームに切り替える */
export const SPLASH_DURATION_MS = 1500

/** このアプリを開いた時刻。これ以降に同期できていれば「最新」とみなす */
const startedAt = Date.now()

type SyncSnapshot = Pick<
  ReturnType<typeof useSyncStore.getState>,
  'status' | 'key' | 'lastSyncedAt'
>

/** 同期の結果が出た（終わった・失敗した・同期を使っていない）か */
export function isSyncSettled(
  { status, key, lastSyncedAt }: SyncSnapshot,
  since = startedAt,
): boolean {
  if (status === 'off' || status === 'error') return true
  if (status !== 'idle') return false
  return !key || (lastSyncedAt !== null && Date.parse(lastSyncedAt) >= since)
}

/** 「始める」の下に出す小さな文字。同期を使っていない端末では出さない */
export function syncStatusLabel(state: SyncSnapshot, since = startedAt): string | null {
  if (state.status === 'loading' || state.status === 'off') return null
  if (state.status === 'error') return '同期できませんでした。あとで自動でやり直します'
  return isSyncSettled(state, since) ? '最新です' : '同期中…'
}
