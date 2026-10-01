import type { Attempt } from './types'

/** 中央値（空の配列は渡さない） */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * 直近の解答の得点率。新しい解答ほど重く数える（1 つ古くなるごとに重みを decay 倍にする）。
 * attempts は古い順。解答がなければ null
 */
export function recentWeightedRatio(
  attempts: readonly Pick<Attempt, 'earned' | 'total'>[],
  window: number,
  decay: number,
): number | null {
  let weighted = 0
  let weights = 0
  attempts
    .slice(-window)
    .reverse()
    .forEach((attempt, i) => {
      const weight = decay ** i
      weighted += (attempt.earned / attempt.total) * weight
      weights += weight
    })
  return weights === 0 ? null : weighted / weights
}
