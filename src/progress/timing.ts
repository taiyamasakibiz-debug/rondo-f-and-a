import type { Unit } from '@/course/units'
import { dayKey, daysBetween } from './day'
import { masteryDeadline } from './phase'
import { type Attempt, type Settings, liveAttempts } from './types'
import type { CourseProgress } from './units'

/**
 * 想定時間の補正と、学習時間の見込み（docs/COURSE.md §6）。
 * 想定時間は単元ごとの設計値から始め、10 回以上解いたら、実測の中央値と設計値の平均にする。
 * ただし設計値の ±30% に収める（席を外したままの記録や、速すぎる記録に引っぱられないように）。
 */
export const TIMING_RULES = {
  /** 補正を始める、その単元の解答回数 */
  minAttempts: 10,
  /** 中央値に使う、直近の解答の数 */
  window: 20,
  /** 設計値から動かしてよい幅 */
  maxShift: 0.3,
  /** これより長い記録は、席を外していたものとして外す（分） */
  idleMinutes: 60,
  /** 1 問を解いたあとの、復習と解説を読む時間の割合（解答時間 × この値を足す） */
  reviewFactor: 1,
  /** 間を空けた復習（分散反復）と認定テストの分（上の合計 × この値を足す。docs/COURSE.md §3.2 の +80%） */
  spacedFactor: 0.8,
} as const

export type UnitTiming = {
  unit: Unit
  /** 設計値（分） */
  design: number
  /** 実測の中央値（分）。記録が足りなければ null */
  measured: number | null
  /** 補正後の想定時間（分） */
  minutes: number
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function unitTiming(unit: Unit, attempts: readonly Attempt[]): UnitTiming {
  const design = unit.expectedMinutes
  const minutes = liveAttempts(attempts)
    .filter((attempt) => unit.templateIds.includes(attempt.templateId))
    .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))
    .map((attempt) => attempt.durationMs / 60_000)
    .filter((value) => value > 0 && value <= TIMING_RULES.idleMinutes)
    .slice(-TIMING_RULES.window)
  if (minutes.length < TIMING_RULES.minAttempts)
    return { unit, design, measured: null, minutes: design }
  const measured = median(minutes)
  const blended = (design + measured) / 2
  const clamped = Math.min(
    design * (1 + TIMING_RULES.maxShift),
    Math.max(design * (1 - TIMING_RULES.maxShift), blended),
  )
  return { unit, design, measured, minutes: Math.round(clamped * 10) / 10 }
}

/** 単元ごとの補正後の想定時間（分）を返す関数。認定テストの制限時間に使う */
export function expectedMinutesFor(attempts: readonly Attempt[]): (unit: Unit) => number {
  const cache = new Map<string, number>()
  return (unit) => {
    if (!cache.has(unit.id)) cache.set(unit.id, unitTiming(unit, attempts).minutes)
    return cache.get(unit.id)!
  }
}

export type StudyForecast = {
  /** 定着していない単元（必須・推奨）を、目安の回数まで解くのにかかる時間（分） */
  remainingMinutes: number
  /** マスター期間の最後の日までの日数（過ぎていれば null） */
  daysLeft: number | null
  /** 残りの時間を、マスター期間の残りの週で割った、1 週間あたりの時間（分） */
  minutesPerWeek: number | null
}

/**
 * 学習時間の見込み。定着していない単元を、目安の解答回数まで解くとして、
 * 残りの回数 × 補正後の想定時間 ×（1 + 復習と解説の分）×（1 + 分散反復と認定テストの分）で見積もる。
 */
export function studyForecast(
  course: CourseProgress,
  attempts: readonly Attempt[],
  settings: Pick<Settings, 'dayStartHour' | 'masteryMonth'>,
  now: Date,
): StudyForecast {
  const minutesOf = expectedMinutesFor(attempts)
  const remainingMinutes = course.stages
    .flatMap((stage) => stage.gateUnits)
    .filter((progress) => progress.state !== 'consolidated')
    .reduce((sum, progress) => {
      const remaining = Math.max(0, progress.unit.targetAttempts - progress.attempts)
      return (
        sum +
        remaining *
          minutesOf(progress.unit) *
          (1 + TIMING_RULES.reviewFactor) *
          (1 + TIMING_RULES.spacedFactor)
      )
    }, 0)
  const today = dayKey(now, settings.dayStartHour)
  const days = daysBetween(today, masteryDeadline(settings.masteryMonth))
  const daysLeft = days >= 0 ? days : null
  const minutesPerWeek =
    daysLeft === null ? null : Math.round(remainingMinutes / Math.max(1, (daysLeft + 1) / 7))
  return { remainingMinutes: Math.round(remainingMinutes), daysLeft, minutesPerWeek }
}
