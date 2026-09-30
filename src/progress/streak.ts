import { type DayKey, addDays, dayKey } from './day'
import type { Attempt, Settings } from './types'

/** 7 日続けるごとにフリーズが 1 つもらえる */
export const FREEZE_EVERY_DAYS = 7
export const MAX_FREEZES = 2

export type StreakState = {
  /** 今の連続日数（今日がまだ未達でも、昨日までの分は数える） */
  current: number
  best: number
  /** 手持ちのフリーズ */
  freezes: number
  /** 今日解いた問題数 */
  todayCount: number
  todayGoalMet: boolean
  /** フリーズが使われた日 */
  frozenDays: DayKey[]
}

/**
 * 解答記録を最初の日から今日まで 1 日ずつたどって、ストリークを計算する。
 * - ノルマを達成した日：連続日数 +1。7 日ごとにフリーズ +1（最大 2）
 * - 達成しなかった日：フリーズがあれば 1 つ使って連続を保つ。なければ 0 に戻る
 * - 今日：まだ終わっていないので、未達でも連続は切らない
 * ノルマは今の設定の値で判定する（過去にノルマを変えても、今の値でたどり直す）。
 */
export function computeStreak(
  attempts: readonly Attempt[],
  settings: Settings,
  now: Date,
): StreakState {
  const today = dayKey(now, settings.dayStartHour)
  const countByDay = new Map<DayKey, number>()
  for (const attempt of attempts) {
    if (attempt.deletedAt) continue
    const day = dayKey(new Date(attempt.answeredAt), settings.dayStartHour)
    countByDay.set(day, (countByDay.get(day) ?? 0) + 1)
  }
  const todayCount = countByDay.get(today) ?? 0
  const todayGoalMet = todayCount >= settings.dailyGoal

  const days = [...countByDay.keys()].filter((day) => day <= today).sort()
  let current = 0
  let best = 0
  let freezes = 0
  const frozenDays: DayKey[] = []

  if (days.length > 0) {
    for (let day = days[0]!; day <= today; day = addDays(day, 1)) {
      const met = (countByDay.get(day) ?? 0) >= settings.dailyGoal
      if (met) {
        current += 1
        if (current % FREEZE_EVERY_DAYS === 0) freezes = Math.min(MAX_FREEZES, freezes + 1)
      } else if (day !== today) {
        if (current > 0 && freezes > 0) {
          freezes -= 1
          frozenDays.push(day)
        } else {
          current = 0
        }
      }
      best = Math.max(best, current)
    }
  }

  return { current, best, freezes, todayCount, todayGoalMet, frozenDays }
}
