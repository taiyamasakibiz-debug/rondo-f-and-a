import type { Attempt, Settings } from '../progress/types'

/**
 * 端末間の同期で、2 つの記録をまとめるルール（端末とサーバーの両方で使う）。
 * - 解答記録：id ごとにまとめ、同じ id なら updatedAt が新しい方（削除の印 deletedAt も更新として扱う）
 * - 設定：updatedAt が新しい方
 * 記録を消すときは、行を消さずに deletedAt を付ける（消したことをほかの端末にも伝えるため）。
 */

/** b の方が新しければ true（同じ時刻なら、削除の印がある方を優先して、消した記録が戻らないようにする） */
function isNewer(a: Attempt, b: Attempt): boolean {
  if (b.updatedAt !== a.updatedAt) return b.updatedAt > a.updatedAt
  return Boolean(b.deletedAt) && !a.deletedAt
}

/** 2 つの解答記録の集まりをまとめる。結果は解答日時の順 */
export function mergeAttempts(local: readonly Attempt[], remote: readonly Attempt[]): Attempt[] {
  const byId = new Map<string, Attempt>()
  for (const attempt of [...local, ...remote]) {
    const current = byId.get(attempt.id)
    if (!current || isNewer(current, attempt)) byId.set(attempt.id, attempt)
  }
  return [...byId.values()].sort(
    (a, b) => a.answeredAt.localeCompare(b.answeredAt) || a.id.localeCompare(b.id),
  )
}

/** remote のうち、local より新しいもの（端末が取り込む必要がある記録） */
export function newerAttempts(local: readonly Attempt[], remote: readonly Attempt[]): Attempt[] {
  const byId = new Map(local.map((attempt) => [attempt.id, attempt]))
  return remote.filter((attempt) => {
    const current = byId.get(attempt.id)
    return !current || isNewer(current, attempt)
  })
}

export function mergeSettings(local: Settings, remote: Settings | null): Settings {
  if (!remote) return local
  return remote.updatedAt > local.updatedAt ? remote : local
}
