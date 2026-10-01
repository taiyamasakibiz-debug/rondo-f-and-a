import { type DayKey, addDays, dayKey, daysBetween } from './day'
import { type Phase, phaseOf } from './phase'
import type { Attempt, Settings } from './types'

/**
 * 復習スケジュール。問題テンプレートごとに「次に出す日」を決める（docs/COURSE.md §9.2）。
 * - 全問正解：連続で正解した回数に応じて、局面ごとの間隔表の次の間隔に伸ばす
 * - 6 割以上：間隔を少しだけ伸ばし、易しさを下げる
 * - 6 割未満：翌日にもう一度。易しさを下げ、連続正解の回数をリセットする
 *
 * 間隔表は、その解答をした日の局面で決まる。解答記録を古い順にたどるので、
 * 局面が変わっても、過去の解答の間隔は変わらない。
 */
export const REVIEW_STEPS: Record<Phase, readonly number[]> = {
  mastery: [1, 3, 7, 14, 30],
  // ほかの科目を優先する期間。忘れない最小限の間隔で、少ない量にする
  maintenance: [14, 30, 45],
  // 直前期の出題は日数ではなく、直近のミスと本番形式で決める。間隔表はマスター期間と同じ
  final: [1, 3, 7, 14, 30],
}

export type ReviewCard = {
  templateId: string
  /** 連続で全問正解した回数 */
  streak: number
  intervalDays: number
  ease: number
  lapses: number
  lastDay: DayKey
  dueDay: DayKey
}

const INITIAL_EASE = 2.5
const MIN_EASE = 1.3
const HARD_THRESHOLD = 0.6

export function nextCard(
  card: ReviewCard | undefined,
  attempt: Pick<Attempt, 'templateId' | 'earned' | 'total' | 'allCorrect'>,
  day: DayKey,
  phase: Phase = 'mastery',
): ReviewCard {
  const previous = card ?? {
    templateId: attempt.templateId,
    streak: 0,
    intervalDays: 0,
    ease: INITIAL_EASE,
    lapses: 0,
    lastDay: day,
    dueDay: day,
  }
  const score = attempt.earned / attempt.total
  let { streak, intervalDays, ease, lapses } = previous

  if (attempt.allCorrect) {
    streak += 1
    const steps = REVIEW_STEPS[phase]
    intervalDays = steps[Math.min(streak, steps.length) - 1]!
  } else if (score >= HARD_THRESHOLD) {
    intervalDays = Math.max(1, Math.round(intervalDays * 1.2))
    ease = Math.max(MIN_EASE, ease - 0.15)
  } else {
    streak = 0
    intervalDays = 1
    ease = Math.max(MIN_EASE, ease - 0.2)
    lapses += 1
  }

  return {
    templateId: attempt.templateId,
    streak,
    intervalDays,
    ease,
    lapses,
    lastDay: day,
    dueDay: addDays(day, intervalDays),
  }
}

/** 解答記録を古い順にたどって、テンプレートごとの復習カードを作る */
export function buildReviewCards(
  attempts: readonly Attempt[],
  settings: Pick<Settings, 'dayStartHour' | 'masteryMonth' | 'firstExamDate' | 'secondExamDate'>,
): Map<string, ReviewCard> {
  const cards = new Map<string, ReviewCard>()
  const sorted = attempts
    .filter((attempt) => !attempt.deletedAt)
    .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))
  for (const attempt of sorted) {
    const day = dayKey(new Date(attempt.answeredAt), settings.dayStartHour)
    cards.set(
      attempt.templateId,
      nextCard(cards.get(attempt.templateId), attempt, day, phaseOf(day, settings)),
    )
  }
  return cards
}

/** 今日が期日（または期日を過ぎた）のカード。期日を過ぎた日数が多い順 */
export function dueCards(cards: Map<string, ReviewCard>, today: DayKey): ReviewCard[] {
  return [...cards.values()]
    .filter((card) => card.dueDay <= today)
    .sort((a, b) => daysBetween(b.dueDay, today) - daysBetween(a.dueDay, today) || a.ease - b.ease)
}
