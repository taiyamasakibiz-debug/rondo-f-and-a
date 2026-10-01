import { type StageId, type Unit, findUnit } from '@/course/units'
import { createRandom } from '@/engine/random'
import type { ProblemTemplate } from '@/engine/types'
import { PROBLEM_TEMPLATES } from '@/problems'
import type { Attempt, Settings } from './types'
import { computeCourse } from './units'

/**
 * 認定（docs/COURSE.md §8）。Stage の修了テストに合格したときだけもらえる。
 * 認定テストは単元をまたぐ混合セット。合否は保存せず、解答記録の exam（どのテストの何問目か）から毎回計算する。
 */
export type Tier = 'bronze' | 'silver' | 'gold'

export const TIERS: readonly Tier[] = ['bronze', 'silver', 'gold']

export type TierRule = {
  label: string
  labelEn: string
  /** この認定に対応する Stage */
  stage: StageId
  /** 受けるのに必要な、1 つ下の認定 */
  requires: Tier | null
  /** 合格に必要な得点率 */
  passRatio: number
  /** 問題数 */
  size: number
  /** 出題の枠。枠ごとに、問題のある単元を先に見つかった順に 1 つ選ぶ */
  slots: readonly (readonly string[])[]
  /** 出題する問題の難易度の目安 */
  difficulty: 1 | 2 | 3
  /** 制限時間 ＝ 出題した問題の想定時間の合計 × この係数（5 分単位に丸める） */
  timeFactor: number
  /** 決まった制限時間（分）。あれば timeFactor より優先 */
  fixedMinutes?: number
}

export const TIER_RULES: Record<Tier, TierRule> = {
  bronze: {
    label: 'ブロンズ',
    labelEn: 'BRONZE',
    stage: 1,
    requires: null,
    passRatio: 0.8,
    size: 5,
    slots: [['acc-bs-pl'], ['acc-ca'], ['mgt-cvp'], ['acc-cf'], ['fin-tvm']],
    difficulty: 1,
    timeFactor: 1.3,
  },
  silver: {
    label: 'シルバー',
    labelEn: 'SILVER',
    stage: 2,
    requires: 'bronze',
    passRatio: 0.7,
    size: 5,
    slots: [['acc-ca'], ['mgt-cvp'], ['acc-cf'], ['fin-npv'], ['mgt-seg', 'fin-val']],
    difficulty: 2,
    timeFactor: 1.0,
  },
  gold: {
    label: 'ゴールド',
    labelEn: 'GOLD',
    stage: 3,
    requires: 'silver',
    // 本番（80 分・100 点、ボーダーは概ね 60 点）の 1/4 スケール
    passRatio: 0.6,
    size: 1,
    slots: [['case4-int']],
    difficulty: 3,
    timeFactor: 1,
    fixedMinutes: 20,
  },
}

/** 時間切れの判定の余裕（採点と保存にかかる時間の分） */
const GRACE_MS = 5_000

export type ExamItem = { templateId: string; seed: number }

export type ExamPlan = {
  items: ExamItem[]
  timeLimitMs: number
}

/**
 * テストの問題と制限時間を決める。同じシードなら同じ問題になる。
 * 枠ごとに単元を決め、その単元の問題から、まだ使っていないもの・難易度が目安に近いものを選ぶ。
 * 制限時間は、出題した単元の想定時間の合計 × 係数（5 分単位）。
 * 問題のある単元が枠より少ないときは、最初の枠から順に使い回す（数値は変わる）。
 */
export function buildExam(
  tier: Tier,
  examSeed: number,
  templates: readonly ProblemTemplate[] = PROBLEM_TEMPLATES,
  /** 単元ごとの想定時間（分）。実測で補正した値を渡す（src/progress/timing.ts）。省略すると設計値 */
  minutesOf: (unit: Unit) => number = (unit) => unit.expectedMinutes,
): ExamPlan {
  const rule = TIER_RULES[tier]
  const random = createRandom(examSeed)
  const poolOf = (unitId: string) => {
    const unit = findUnit(unitId)
    return unit ? templates.filter((template) => unit.templateIds.includes(template.id)) : []
  }
  const slotUnits = rule.slots
    .map((alternatives) => alternatives.find((id) => poolOf(id).length > 0))
    .filter((id): id is string => id !== undefined)
  if (slotUnits.length === 0) return { items: [], timeLimitMs: 0 }

  const used = new Map<string, number>()
  let minutes = 0
  const items = Array.from({ length: rule.size }, (_, i): ExamItem => {
    const unitId = slotUnits[i % slotUnits.length]!
    const pool = [...poolOf(unitId)]
    for (let j = pool.length - 1; j > 0; j -= 1) {
      const k = Math.floor(random.next() * (j + 1))
      ;[pool[j], pool[k]] = [pool[k]!, pool[j]!]
    }
    pool.sort(
      (a, b) =>
        (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0) ||
        Math.abs(a.difficulty - rule.difficulty) - Math.abs(b.difficulty - rule.difficulty),
    )
    const template = pool[0]!
    used.set(template.id, (used.get(template.id) ?? 0) + 1)
    minutes += minutesOf(findUnit(unitId)!)
    return { templateId: template.id, seed: Math.floor(random.next() * 4294967296) }
  })

  const limitMinutes =
    rule.fixedMinutes ?? Math.max(5, Math.round((minutes * rule.timeFactor) / 5) * 5)
  return { items, timeLimitMs: limitMinutes * 60_000 }
}

export type ExamResult = {
  examId: string
  tier: Tier
  startedAt: string
  /** 解いた問題数（途中でやめたり時間切れになったりすると、出題数未満） */
  answered: number
  /** 出題数 */
  size: number
  earned: number
  /** 未解答の問題も含めた満点。未解答の問題の配点がわからないときは、解いた問題の平均で見積もる */
  total: number
  /** 得点率。制限時間を過ぎてから解いた問題は 0 点として数える */
  ratio: number
  passed: boolean
}

/**
 * 解答記録を認定テストごとにまとめて、合否を出す（古い順）。
 * 制限時間・合格ライン・問題数は、受けたときに記録したものを使う。
 * それがない記録（論点ごとのテストだった旧形式）は、認定の判定に使わない。
 */
export function examResults(attempts: readonly Attempt[]): ExamResult[] {
  const groups = new Map<string, Attempt[]>()
  for (const attempt of attempts) {
    if (!attempt.exam || attempt.deletedAt) continue
    groups.set(attempt.exam.id, [...(groups.get(attempt.exam.id) ?? []), attempt])
  }
  const results: ExamResult[] = []
  for (const group of groups.values()) {
    const { exam } = group[0]!
    if (!exam || exam.timeLimitMs === undefined || exam.passRatio === undefined) continue
    const size = exam.size ?? TIER_RULES[exam.tier].size
    const deadline = Date.parse(exam.startedAt) + exam.timeLimitMs + GRACE_MS
    // 同じ問題番号の記録が 2 つあれば最初のものだけを数える
    const byIndex = new Map<number, Attempt>()
    for (const attempt of group) {
      if (!byIndex.has(attempt.exam!.index)) byIndex.set(attempt.exam!.index, attempt)
    }
    const answered = [...byIndex.values()]
    const inTime = answered.filter((attempt) => Date.parse(attempt.answeredAt) <= deadline)
    const earned = inTime.reduce((sum, attempt) => sum + attempt.earned, 0)
    const averageTotal = answered.reduce((sum, a) => sum + a.total, 0) / answered.length
    const total =
      answered.reduce((sum, attempt) => sum + attempt.total, 0) +
      Math.max(0, size - answered.length) * averageTotal
    const ratio = total === 0 ? 0 : earned / total
    results.push({
      examId: exam.id,
      tier: exam.tier,
      startedAt: exam.startedAt,
      answered: answered.length,
      size,
      earned,
      total,
      ratio,
      // 小数の誤差で、ちょうど合格ラインの点が不合格にならないようにする
      passed: ratio >= exam.passRatio - 1e-9,
    })
  }
  return results.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

/** 合格したいちばん上の認定 */
export function certificationOf(attempts: readonly Attempt[]): Tier | null {
  const passed = new Set(
    examResults(attempts)
      .filter((result) => result.passed)
      .map((result) => result.tier),
  )
  return [...TIERS].reverse().find((tier) => passed.has(tier)) ?? null
}

export type Eligibility = { eligible: true } | { eligible: false; reason: string }

/**
 * 認定テストを受けられるか。1 つ下の認定と、その Stage の単元（必須と推奨）を 1 回ずつ以上解いていること。
 * 問題がまだない Stage は、準備中として受けられない。
 */
export function examEligibility(
  attempts: readonly Attempt[],
  tier: Tier,
  settings: Pick<Settings, 'dayStartHour'>,
  now: Date,
): Eligibility {
  const rule = TIER_RULES[tier]
  if (rule.requires) {
    const current = certificationOf(attempts)
    const has = current !== null && TIERS.indexOf(current) >= TIERS.indexOf(rule.requires)
    if (!has) {
      return {
        eligible: false,
        reason: `${TIER_RULES[rule.requires].label}認定のあとに受けられます`,
      }
    }
  }
  const stage = computeCourse(attempts, settings, now).stages.find(
    (entry) => entry.stage.id === rule.stage,
  )
  if (!stage || stage.gateUnits.length === 0) {
    return { eligible: false, reason: 'このテストの問題は準備中です' }
  }
  const missing = stage.gateUnits.filter((progress) => progress.attempts === 0)
  if (missing.length > 0) {
    const names = missing.map((progress) => `「${progress.unit.name}」`).join('')
    return { eligible: false, reason: `${names}の問題を 1 回以上解くと受けられます` }
  }
  return { eligible: true }
}
