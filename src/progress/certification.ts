import { createRandom } from '@/engine/random'
import type { ProblemTemplate, Topic } from '@/engine/types'
import { topicProgress } from './level'
import type { Attempt } from './types'

/**
 * 認定（docs/DESIGN.md §5.2）。認定テストに合格したときだけもらえる。
 * 合否は保存せず、解答記録の exam（どのテストの何問目か）から毎回計算する。
 */
export type Tier = 'bronze' | 'silver' | 'gold'

export const TIERS: readonly Tier[] = ['bronze', 'silver', 'gold']

export type TierRule = {
  label: string
  labelEn: string
  /** 受けるのに必要なレベル */
  minLevel: number
  /** 受けるのに必要な、1 つ下の認定 */
  requires: Tier | null
  /** 合格に必要な得点率 */
  passRatio: number
  timeLimitMs: number
}

export const TIER_RULES: Record<Tier, TierRule> = {
  bronze: {
    label: 'ブロンズ',
    labelEn: 'BRONZE',
    minLevel: 2,
    requires: null,
    passRatio: 0.6,
    timeLimitMs: 15 * 60_000,
  },
  silver: {
    label: 'シルバー',
    labelEn: 'SILVER',
    minLevel: 4,
    requires: 'bronze',
    passRatio: 0.75,
    timeLimitMs: 12 * 60_000,
  },
  gold: {
    label: 'ゴールド',
    labelEn: 'GOLD',
    minLevel: 6,
    requires: 'silver',
    passRatio: 0.9,
    timeLimitMs: 10 * 60_000,
  },
}

/** 1 回の認定テストの問題数 */
export const EXAM_SIZE = 5

/** 時間切れの判定の余裕（採点と保存にかかる時間の分） */
const GRACE_MS = 5_000

export type ExamItem = { templateId: string; seed: number }

/**
 * テストの問題を決める。同じシードなら同じ問題になる。
 * 論点のテンプレートを偏りなく順に使い、足りなければ数値を変えて繰り返す。
 */
export function buildExam(templates: readonly ProblemTemplate[], examSeed: number): ExamItem[] {
  if (templates.length === 0) return []
  const random = createRandom(examSeed)
  const order = [...templates]
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  return Array.from({ length: EXAM_SIZE }, (_, i) => ({
    templateId: order[i % order.length]!.id,
    seed: Math.floor(random.next() * 4294967296),
  }))
}

export type ExamResult = {
  examId: string
  topic: Topic
  tier: Tier
  startedAt: string
  /** 解いた問題数（途中でやめたり時間切れになったりすると EXAM_SIZE 未満） */
  answered: number
  earned: number
  /** 未解答の問題も含めた満点。未解答の問題の配点がわからないときは、解いた問題の平均で見積もる */
  total: number
  /** 得点率。制限時間を過ぎてから解いた問題は 0 点として数える */
  ratio: number
  passed: boolean
}

/** 解答記録を認定テストごとにまとめて、合否を出す（古い順） */
export function examResults(attempts: readonly Attempt[]): ExamResult[] {
  const groups = new Map<string, Attempt[]>()
  for (const attempt of attempts) {
    if (!attempt.exam || attempt.deletedAt) continue
    groups.set(attempt.exam.id, [...(groups.get(attempt.exam.id) ?? []), attempt])
  }
  return [...groups.values()]
    .map((group) => {
      const { exam, topic } = group[0]!
      const rule = TIER_RULES[exam!.tier]
      const deadline = Date.parse(exam!.startedAt) + rule.timeLimitMs + GRACE_MS
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
        Math.max(0, EXAM_SIZE - answered.length) * averageTotal
      const ratio = total === 0 ? 0 : earned / total
      return {
        examId: exam!.id,
        topic,
        tier: exam!.tier,
        startedAt: exam!.startedAt,
        answered: answered.length,
        earned,
        total,
        ratio,
        passed: ratio >= rule.passRatio,
      }
    })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

/** 論点ごとに、合格したいちばん上の認定 */
export function certificationOf(attempts: readonly Attempt[], topic: Topic): Tier | null {
  const passed = new Set(
    examResults(attempts)
      .filter((result) => result.topic === topic && result.passed)
      .map((result) => result.tier),
  )
  return [...TIERS].reverse().find((tier) => passed.has(tier)) ?? null
}

export type Eligibility = { eligible: true } | { eligible: false; reason: string }

export function examEligibility(
  attempts: readonly Attempt[],
  topic: Topic,
  tier: Tier,
): Eligibility {
  const rule = TIER_RULES[tier]
  const level = topicProgress(attempts, topic).level
  if (level < rule.minLevel) {
    return { eligible: false, reason: `Lv.${rule.minLevel} から受けられます（今は Lv.${level}）` }
  }
  if (rule.requires) {
    const current = certificationOf(attempts, topic)
    const has = current !== null && TIERS.indexOf(current) >= TIERS.indexOf(rule.requires)
    if (!has) {
      return {
        eligible: false,
        reason: `${TIER_RULES[rule.requires].label}認定のあとに受けられます`,
      }
    }
  }
  return { eligible: true }
}
