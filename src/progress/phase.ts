import { type DayKey, addDays, daysBetween } from './day'
import type { Settings } from './types'

/**
 * 学習の局面（docs/COURSE.md §1、§9）。今日がどの局面かで、復習の間隔とデイリーの出し方が変わる。
 * - マスター期間：目標の月の末日まで。新しい単元を進める
 * - 維持期間：マスターのあと。ほかの科目を優先するので、少ない量で忘れないようにする
 * - 直前期：1 次試験の 30 日前から 2 次試験まで。本番形式と弱点の復習
 */
export type Phase = 'mastery' | 'maintenance' | 'final'

export const PHASE_LABELS: Record<Phase, { name: string; description: string }> = {
  mastery: { name: 'マスター期間', description: '新しい単元を進めて、定着させる' },
  maintenance: { name: '維持期間', description: '少ない量で、忘れないようにする' },
  final: { name: '直前期', description: '本番形式の問題と、弱点の復習' },
}

/** 1 次試験の何日前から直前期にするか */
export const FINAL_DAYS_BEFORE_FIRST_EXAM = 30

type PhaseSettings = Pick<Settings, 'masteryMonth' | 'firstExamDate' | 'secondExamDate'>

/** マスター期間の最後の日（目標の月の末日） */
export function masteryDeadline(masteryMonth: string): DayKey {
  const [year, month] = masteryMonth.split('-').map(Number)
  // 翌月の 0 日 ＝ その月の末日
  const last = new Date(Date.UTC(year!, month!, 0))
  return last.toISOString().slice(0, 10)
}

/** 直前期の最初の日 */
export function finalStart(settings: PhaseSettings): DayKey {
  return addDays(settings.firstExamDate, -FINAL_DAYS_BEFORE_FIRST_EXAM)
}

export function phaseOf(day: DayKey, settings: PhaseSettings): Phase {
  if (day > settings.secondExamDate) return 'maintenance'
  if (day >= finalStart(settings)) return 'final'
  if (day <= masteryDeadline(settings.masteryMonth)) return 'mastery'
  return 'maintenance'
}

export type PhaseSummary = {
  phase: Phase
  /** この局面が終わる日（次の局面に変わる前日）。最後の局面なら null */
  endsOn: DayKey | null
  /** 今日から数えて、この局面が終わるまでの日数 */
  daysLeft: number | null
}

export function phaseSummary(day: DayKey, settings: PhaseSettings): PhaseSummary {
  const phase = phaseOf(day, settings)
  let endsOn: DayKey | null = null
  if (phase === 'mastery') {
    const deadline = masteryDeadline(settings.masteryMonth)
    const before = addDays(finalStart(settings), -1)
    endsOn = deadline < before ? deadline : before
  } else if (phase === 'maintenance' && day <= settings.secondExamDate) {
    endsOn = addDays(finalStart(settings), -1)
  } else if (phase === 'final') {
    endsOn = settings.secondExamDate
  }
  return { phase, endsOn, daysLeft: endsOn === null ? null : daysBetween(day, endsOn) }
}
