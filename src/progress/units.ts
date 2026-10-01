import { STAGES, type Stage, type StageId, UNITS, type Unit } from '@/course/units'
import { type DayKey, dayKey, daysBetween } from './day'
import { median, recentWeightedRatio } from './scoring'
import { type Attempt, type Settings, liveAttempts } from './types'

/**
 * 単元の状態（docs/COURSE.md §4）。解答記録から毎回計算する。保存はしない。
 * - 準備中：問題の型がまだない
 * - 未着手：まだ 1 回も解いていない
 * - 学習中：解いたが、定着の条件を満たしていない
 * - 定着：全型を解き、正確さと、間を空けたあとの得点率がともに基準以上
 * - 要復習：定着したあと、間を空けて解いたら崩れた、または長く解いていない
 */
export type UnitState = 'preparing' | 'untouched' | 'learning' | 'consolidated' | 'review'

/** 基準の数値（docs/COURSE.md §4）。学習効果を見ながら変える */
export const UNIT_RULES = {
  /** 正確さ：直近何回の得点率を見るか */
  accuracyWindow: 3,
  /** 正確さ：新しい解答から 1 つ古くなるごとの重みの減り方 */
  accuracyDecay: 0.85,
  accuracyThreshold: 0.85,
  /** 定着：前回から何日以上空けたら「間を空けた」とみなすか */
  spacedDays: 7,
  /** 定着：間を空けて解いた直近何回の得点率を見るか */
  retentionWindow: 3,
  retentionThreshold: 0.8,
  /** 要復習：このくらい空けて解いて、得点率が基準を下回ったら */
  lapseDays: 14,
  lapseThreshold: 0.6,
  /** 要復習：定着したあと、これだけ解かないと */
  idleDays: 30,
  /** 速さ：直近何回の所要時間の中央値を見るか */
  speedWindow: 5,
} as const

/**
 * コースレベル（docs/COURSE.md §7）。定着した単元の点（Stage 1 は 1 点、Stage 2 は 2 点、Stage 3 は 3 点）の
 * 合計から決める。一度定着した単元は、要復習になっても点が残るので、レベルは下がらない。
 */
export const COURSE_LEVEL_THRESHOLDS = [0, 1, 2, 3, 4, 5, 7, 9, 12, 16] as const

export type CourseLevel = {
  level: number
  points: number
  /** 次のレベルに必要な点（最大レベルなら null） */
  nextPoints: number | null
  maxPoints: number
}

export function courseLevel(points: number): CourseLevel {
  let index = 0
  while (
    index + 1 < COURSE_LEVEL_THRESHOLDS.length &&
    points >= COURSE_LEVEL_THRESHOLDS[index + 1]!
  ) {
    index += 1
  }
  return {
    level: index + 1,
    points,
    nextPoints: COURSE_LEVEL_THRESHOLDS[index + 1] ?? null,
    maxPoints: COURSE_LEVEL_THRESHOLDS[COURSE_LEVEL_THRESHOLDS.length - 1]!,
  }
}

export type UnitProgress = {
  unit: Unit
  state: UnitState
  templateCount: number
  /** 解いたことのある型の数 */
  attemptedCount: number
  attempts: number
  /** 正確さ（0〜1）。まだ解いていなければ null */
  accuracy: number | null
  /** 間を空けたあとの得点率（0〜1）。間を空けて解いたことがなければ null */
  retention: number | null
  /** 速さ：直近 5 回の所要時間の中央値 ÷ 想定時間（1.0 以下が目標）。まだ解いていなければ null */
  speed: number | null
  /** 一度でも定着したことがあるか（要復習になっても残る。コースレベルの点に使う） */
  achieved: boolean
  /** 前提の単元がすべて定着（または準備中）か */
  prerequisitesMet: boolean
}

type Spaced = { earned: number; total: number }

function ratio(items: readonly { earned: number; total: number }[]): number {
  const total = items.reduce((sum, item) => sum + item.total, 0)
  return total === 0 ? 0 : items.reduce((sum, item) => sum + item.earned, 0) / total
}

/** 速さ：直近 5 回の所要時間の中央値を、想定時間で割る */
function speedOf(unit: Unit, own: readonly Attempt[]): number | null {
  const recent = own.slice(-UNIT_RULES.speedWindow).map((attempt) => attempt.durationMs)
  if (recent.length === 0) return null
  return median(recent) / (unit.expectedMinutes * 60_000)
}

type Evaluation = {
  state: Exclude<UnitState, 'preparing'>
  achieved: boolean
  attemptedCount: number
  accuracy: number | null
  retention: number | null
}

/** 単元の解答記録（古い順）をたどって、今の状態を決める */
function evaluateUnit(
  unit: Unit,
  own: readonly Attempt[],
  dayStartHour: number,
  today: DayKey,
): Evaluation {
  if (own.length === 0) {
    return {
      state: 'untouched',
      achieved: false,
      attemptedCount: 0,
      accuracy: null,
      retention: null,
    }
  }

  const lastDayByTemplate = new Map<string, DayKey>()
  const spaced: Spaced[] = []
  const soFar: Attempt[] = []
  let achieved = false
  let review = false
  let accuracy: number | null = null
  let retention: number | null = null
  let meets = false
  let lastDay: DayKey = today

  for (const attempt of own) {
    const day = dayKey(new Date(attempt.answeredAt), dayStartHour)
    const previous = lastDayByTemplate.get(attempt.templateId)
    const gap = previous === undefined ? null : daysBetween(previous, day)
    lastDayByTemplate.set(attempt.templateId, day)
    lastDay = day
    soFar.push(attempt)
    if (gap !== null && gap >= UNIT_RULES.spacedDays) spaced.push(attempt)

    accuracy = recentWeightedRatio(soFar, UNIT_RULES.accuracyWindow, UNIT_RULES.accuracyDecay)
    retention = spaced.length === 0 ? null : ratio(spaced.slice(-UNIT_RULES.retentionWindow))
    meets =
      lastDayByTemplate.size === unit.templateIds.length &&
      accuracy !== null &&
      accuracy >= UNIT_RULES.accuracyThreshold &&
      retention !== null &&
      retention >= UNIT_RULES.retentionThreshold

    const wasAchieved = achieved
    if (meets) {
      achieved = true
      review = false
    }
    // 定着したあとに、14 日以上空けて解いて崩れた
    if (
      wasAchieved &&
      gap !== null &&
      gap >= UNIT_RULES.lapseDays &&
      attempt.earned / attempt.total < UNIT_RULES.lapseThreshold
    ) {
      review = true
    }
  }

  const idle = daysBetween(lastDay, today) >= UNIT_RULES.idleDays
  const state: Evaluation['state'] =
    review || (achieved && idle) ? 'review' : meets ? 'consolidated' : 'learning'
  return { state, achieved, attemptedCount: lastDayByTemplate.size, accuracy, retention }
}

export type StageProgress = {
  stage: Stage
  units: UnitProgress[]
  /** 修了に数える単元（必須と推奨。準備中は除く） */
  gateUnits: UnitProgress[]
  consolidatedCount: number
  /** 修了に数える単元があり、そのすべてが定着 */
  cleared: boolean
}

export type CourseProgress = {
  stages: StageProgress[]
  /** いま取り組む Stage。すべて修了した（または準備中）なら null */
  currentStage: StageId | null
  /** 次に取り組む単元（現在の Stage の中で、前提が済んだ学習中 → 未着手の順） */
  nextUnit: UnitProgress | null
  level: CourseLevel
}

export function computeCourse(
  attempts: readonly Attempt[],
  settings: Pick<Settings, 'dayStartHour'>,
  now: Date,
  /** 単元の一覧（テストで、準備中の単元などを差し込むため） */
  units: readonly Unit[] = UNITS,
): CourseProgress {
  const today = dayKey(now, settings.dayStartHour)
  const live = liveAttempts(attempts).sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))

  const byUnit = new Map<string, UnitProgress>()
  for (const unit of units) {
    const own = live.filter((attempt) => unit.templateIds.includes(attempt.templateId))
    const evaluation =
      unit.templateIds.length === 0
        ? undefined
        : evaluateUnit(unit, own, settings.dayStartHour, today)
    byUnit.set(unit.id, {
      unit,
      state: evaluation?.state ?? 'preparing',
      templateCount: unit.templateIds.length,
      attemptedCount: evaluation?.attemptedCount ?? 0,
      attempts: own.length,
      accuracy: evaluation?.accuracy ?? null,
      retention: evaluation?.retention ?? null,
      speed: speedOf(unit, own),
      achieved: evaluation?.achieved ?? false,
      prerequisitesMet: true,
    })
  }
  // 前提は、定着した（または一度定着して要復習になった・準備中の）単元だけを済んだとみなす
  const settled = (state: UnitState) =>
    state === 'consolidated' || state === 'review' || state === 'preparing'
  for (const progress of byUnit.values()) {
    progress.prerequisitesMet = progress.unit.prerequisites.every((id) =>
      settled(byUnit.get(id)!.state),
    )
  }

  const stages: StageProgress[] = STAGES.map((stage) => {
    const stageUnits = units
      .filter((unit) => unit.stage === stage.id)
      .map((unit) => byUnit.get(unit.id)!)
    const gateUnits = stageUnits.filter(
      (progress) => progress.unit.priority !== 'later' && progress.state !== 'preparing',
    )
    const consolidatedCount = gateUnits.filter((p) => p.state === 'consolidated').length
    return {
      stage,
      units: stageUnits,
      gateUnits,
      consolidatedCount,
      cleared: gateUnits.length > 0 && consolidatedCount === gateUnits.length,
    }
  })

  const current = stages.find((entry) => entry.gateUnits.length > 0 && !entry.cleared)
  const rank = (state: UnitState) => (state === 'learning' ? 0 : 1)
  const nextUnit =
    current?.units
      .filter(
        (progress) =>
          progress.unit.priority !== 'later' &&
          (progress.state === 'untouched' || progress.state === 'learning') &&
          progress.prerequisitesMet,
      )
      .sort((a, b) => rank(a.state) - rank(b.state))[0] ?? null

  const points = [...byUnit.values()]
    .filter((progress) => progress.achieved)
    .reduce((sum, progress) => sum + progress.unit.stage, 0)

  return { stages, currentStage: current?.stage.id ?? null, nextUnit, level: courseLevel(points) }
}
