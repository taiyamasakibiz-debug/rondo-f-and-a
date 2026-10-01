import { findTemplate } from '@/problems'
import type { Attempt } from './types'

/**
 * 経験値（XP）。レベルとは別の「積み上げた努力量」（docs/COURSE.md §7）。
 * 簡単な問題の周回で稼げないように、同じ型の連続正解には上限をつけ、
 * 間を空けた復習や難しい問題にはボーナスをつける。
 */
export const XP_RULES = {
  /** 同じ型で全問正解がこれだけ続いたあとの正解は、XP が半分 */
  halfAfterStreak: 5,
  /** さらにこれだけ続いたあとは 0（間を空けたときは数えない） */
  zeroAfterStreak: 8,
  /** 前回から何日以上空けたら「間を空けた」か。全問正解でボーナス */
  spacedDays: 7,
  spacedBonus: 1.5,
  longSpacedDays: 14,
  longSpacedBonus: 2,
  difficultyBonus: { 1: 1, 2: 1.5, 3: 2.5 },
} as const

const DAY_MS = 24 * 60 * 60 * 1000

type XpInput = Pick<Attempt, 'templateId' | 'earned' | 'total' | 'allCorrect' | 'answeredAt'>

/** 1 問で得られる基本の XP：得点率 × 10、全問正解ならボーナス +5 */
export function xpForAttempt(attempt: Pick<Attempt, 'earned' | 'total' | 'allCorrect'>): number {
  return Math.round((attempt.earned / attempt.total) * 10) + (attempt.allCorrect ? 5 : 0)
}

/** 型ごとの、直前の解答の日時と、全問正解の連続回数 */
type TemplateState = { lastAt: number; streak: number }

function xpWith(input: XpInput, state: TemplateState | undefined): number {
  const difficulty = findTemplate(input.templateId)?.difficulty ?? 1
  let multiplier: number = XP_RULES.difficultyBonus[difficulty]
  const gapDays = state ? (Date.parse(input.answeredAt) - state.lastAt) / DAY_MS : 0
  const spaced = state !== undefined && gapDays >= XP_RULES.spacedDays

  if (spaced) {
    if (input.allCorrect) {
      multiplier *=
        gapDays >= XP_RULES.longSpacedDays ? XP_RULES.longSpacedBonus : XP_RULES.spacedBonus
    }
  } else {
    const streak = state?.streak ?? 0
    if (streak >= XP_RULES.zeroAfterStreak) multiplier = 0
    else if (streak >= XP_RULES.halfAfterStreak) multiplier *= 0.5
  }
  return Math.round(xpForAttempt(input) * multiplier)
}

function advance(state: TemplateState | undefined, input: XpInput): TemplateState {
  return {
    lastAt: Date.parse(input.answeredAt),
    streak: input.allCorrect ? (state?.streak ?? 0) + 1 : 0,
  }
}

/** 解答記録（古い順）の 1 件ごとの XP */
export function attemptXps(attempts: readonly XpInput[]): number[] {
  const states = new Map<string, TemplateState>()
  return attempts.map((attempt) => {
    const state = states.get(attempt.templateId)
    states.set(attempt.templateId, advance(state, attempt))
    return xpWith(attempt, state)
  })
}

/** これから記録する 1 件の XP（採点の直後のごほうびの表示用） */
export function nextAttemptXp(history: readonly Attempt[], next: XpInput): number {
  const state = history
    .filter((attempt) => attempt.templateId === next.templateId && !attempt.deletedAt)
    .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))
    .reduce<TemplateState | undefined>((current, attempt) => advance(current, attempt), undefined)
  return xpWith(next, state)
}
