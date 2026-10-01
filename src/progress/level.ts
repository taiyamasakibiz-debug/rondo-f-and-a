import type { Topic } from '@/engine/types'
import type { Attempt } from './types'

/**
 * レベルと熟練度。
 * - レベル：解答で貯まる経験値（XP）で上がり、下がらない。続けた量が見える
 * - 熟練度：直近 10 問の得点率を、新しい解答ほど重く数えた平均。間違えると下がる。
 *   時間がたつだけでは下がらない（忘れかけは復習スケジュールの期日で表す）
 */

/** Lv.n になるのに必要な累計 XP（index 0 が Lv.1） */
export const LEVEL_THRESHOLDS = [0, 30, 80, 150, 240, 350, 480, 630, 800, 1000] as const

/** 1 問で得られる XP：得点率 × 10、全問正解ならボーナス +5 */
export function xpForAttempt(attempt: Pick<Attempt, 'earned' | 'total' | 'allCorrect'>): number {
  return Math.round((attempt.earned / attempt.total) * 10) + (attempt.allCorrect ? 5 : 0)
}

export type LevelState = {
  level: number
  xp: number
  /** 今のレベルに必要だった XP */
  currentLevelXp: number
  /** 次のレベルに必要な XP（最大レベルなら null） */
  nextLevelXp: number | null
  /** 次のレベルまでの進み具合（0〜1） */
  progress: number
}

export function levelFromXp(xp: number): LevelState {
  let index = 0
  while (index + 1 < LEVEL_THRESHOLDS.length && xp >= LEVEL_THRESHOLDS[index + 1]!) index += 1
  const currentLevelXp = LEVEL_THRESHOLDS[index]!
  const nextLevelXp = LEVEL_THRESHOLDS[index + 1] ?? null
  return {
    level: index + 1,
    xp,
    currentLevelXp,
    nextLevelXp,
    progress: nextLevelXp === null ? 1 : (xp - currentLevelXp) / (nextLevelXp - currentLevelXp),
  }
}

/** 熟練度に使う直近の解答数と、1 つ古くなるごとの重みの減り方 */
const MASTERY_WINDOW = 10
const MASTERY_DECAY = 0.85

export type TopicProgress = LevelState & {
  topic: Topic
  attempts: number
  /** 熟練度（0〜1）。まだ解いていなければ null */
  mastery: number | null
}

export function topicProgress(attempts: readonly Attempt[], topic: Topic): TopicProgress {
  const own = attempts
    .filter((attempt) => attempt.topic === topic && !attempt.deletedAt)
    .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))
  const xp = own.reduce((total, attempt) => total + xpForAttempt(attempt), 0)

  const recent = own.slice(-MASTERY_WINDOW).reverse()
  let weighted = 0
  let weights = 0
  recent.forEach((attempt, i) => {
    const weight = MASTERY_DECAY ** i
    weighted += (attempt.earned / attempt.total) * weight
    weights += weight
  })

  return {
    topic,
    attempts: own.length,
    mastery: weights === 0 ? null : weighted / weights,
    ...levelFromXp(xp),
  }
}
