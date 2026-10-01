import type { Topic } from '@/engine/types'
import type { Attempt } from './types'
import { attemptXps, xpForAttempt } from './xp'

export { xpForAttempt }

/**
 * ラボ（論点）ごとの XP と熟練度。
 * - XP：解答で貯まる、積み上げた努力量（src/progress/xp.ts）。レベルはない。
 *   実力の目安は src/progress/units.ts のコースレベル（定着した単元から出す）
 * - 熟練度：直近 10 問の得点率を、新しい解答ほど重く数えた平均。間違えると下がる。
 *   時間がたつだけでは下がらない（忘れかけは復習スケジュールの期日で表す）
 */

/** 熟練度に使う直近の解答数と、1 つ古くなるごとの重みの減り方 */
const MASTERY_WINDOW = 10
const MASTERY_DECAY = 0.85

export type TopicProgress = {
  topic: Topic
  attempts: number
  /** このラボで積み上げた XP（努力量） */
  xp: number
  /** 熟練度（0〜1）。まだ解いていなければ null */
  mastery: number | null
}

export function topicProgress(attempts: readonly Attempt[], topic: Topic): TopicProgress {
  const own = attempts
    .filter((attempt) => attempt.topic === topic && !attempt.deletedAt)
    .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))
  const xp = attemptXps(own).reduce((total, value) => total + value, 0)

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
    xp,
  }
}
