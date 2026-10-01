import { describe, expect, it } from 'vitest'
import { UNITS, findUnit } from '@/course/units'
import type { ProblemTemplate } from '@/engine/types'
import { PROBLEM_TEMPLATES } from '@/problems'
import {
  TIERS,
  TIER_RULES,
  type Tier,
  buildExam,
  certificationOf,
  examEligibility,
  examResults,
} from './certification'
import { type Attempt, DEFAULT_SETTINGS } from './types'

let nextId = 0
function attempt(overrides: Partial<Attempt> = {}): Attempt {
  nextId += 1
  const at = '2026-10-01T03:00:00.000Z'
  return {
    id: `a${nextId}`,
    templateId: 'cvp.break-even.basic',
    topic: 'cvp',
    seed: nextId,
    earned: 5,
    total: 5,
    allCorrect: true,
    steps: [],
    durationMs: 1,
    answeredAt: at,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  }
}

const START = '2026-10-01T03:00:00.000Z'
const minutesAfter = (minutes: number) =>
  new Date(Date.parse(START) + minutes * 60_000).toISOString()

/** 認定テスト 1 回分の記録。scores は各問の得点（満点 5）。制限時間と合格ラインは、受けたときの値を記録する */
function exam(
  tier: Tier,
  scores: number[],
  { id = `exam-${tier}-${(nextId += 1)}`, minutes = 1, timeLimitMin = 25, passRatio = 0.8 } = {},
) {
  return scores.map((earned, index) =>
    attempt({
      earned,
      allCorrect: earned === 5,
      answeredAt: minutesAfter(minutes),
      exam: {
        id,
        tier,
        index,
        startedAt: START,
        timeLimitMs: timeLimitMin * 60_000,
        passRatio,
        size: 5,
      },
    }),
  )
}

/** 単元のどの型も 1 回ずつ解いた記録 */
function touched(...unitIds: string[]): Attempt[] {
  return unitIds.flatMap((id) =>
    findUnit(id)!.templateIds.map((templateId) => attempt({ templateId })),
  )
}

const now = new Date('2026-10-02T03:00:00.000Z')

describe('examResults', () => {
  it('受けたときの合格ライン以上なら合格', () => {
    const [result] = examResults(exam('bronze', [4, 4, 4, 4, 4])) // 80%
    expect(result).toMatchObject({ answered: 5, earned: 20, total: 25, passed: true })
    expect(result!.ratio).toBeCloseTo(0.8)
  })

  it('合格ラインに届かなければ不合格', () => {
    const [result] = examResults(exam('silver', [5, 5, 5, 3, 0], { passRatio: 0.7 })) // 72%
    expect(result!.passed).toBe(true)
    const [fail] = examResults(exam('silver', [5, 5, 5, 0, 0], { passRatio: 0.7 })) // 60%
    expect(fail!.passed).toBe(false)
  })

  it('合格ラインは、受けたときの値で判定する（あとで設計を変えても、過去の合否は変わらない）', () => {
    const [lenient] = examResults(exam('bronze', [3, 3, 3, 3, 3], { passRatio: 0.6 }))
    expect(lenient!.passed).toBe(true)
    const [strict] = examResults(exam('bronze', [3, 3, 3, 3, 3], { passRatio: 0.8 }))
    expect(strict!.passed).toBe(false)
  })

  it('途中でやめたとき、残りは 0 点として数える', () => {
    const [result] = examResults(exam('bronze', [5, 5, 5]))
    expect(result).toMatchObject({ answered: 3, size: 5, total: 25, earned: 15 })
    expect(result!.passed).toBe(false)
  })

  it('制限時間を過ぎてから解いた問題は 0 点', () => {
    const late = exam('bronze', [5, 5, 5, 5, 5], { minutes: 26, timeLimitMin: 25 })
    const [result] = examResults(late)
    expect(result).toMatchObject({ earned: 0, passed: false })
  })

  it('練習の記録は認定テストとして数えない', () => {
    expect(examResults([attempt(), attempt()])).toEqual([])
  })

  it('論点ごとのテストだった旧形式の記録は、認定に数えない', () => {
    const legacy = [0, 1, 2, 3, 4].map((index) =>
      attempt({ exam: { id: 'old', tier: 'bronze', index, startedAt: START } }),
    )
    expect(examResults(legacy)).toEqual([])
    expect(certificationOf(legacy)).toBeNull()
  })
})

describe('certificationOf', () => {
  it('合格したいちばん上の認定を返す', () => {
    const attempts = [
      ...exam('bronze', [5, 5, 5, 5, 5]),
      ...exam('silver', [5, 5, 5, 5, 5], { passRatio: 0.7 }),
    ]
    expect(certificationOf(attempts)).toBe('silver')
    expect(certificationOf(exam('bronze', [5, 5, 5, 5, 5]))).toBe('bronze')
    expect(certificationOf([])).toBeNull()
  })
})

describe('examEligibility', () => {
  const stage1 = ['acc-bs-pl', 'acc-ca', 'acc-cf', 'mgt-cvp', 'fin-tvm']

  it('Stage 1 の単元を 1 回ずつ解くまで、ブロンズは受けられない', () => {
    const result = examEligibility(touched('mgt-cvp'), 'bronze', DEFAULT_SETTINGS, now)
    expect(result).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('経営分析'),
    })
    expect(examEligibility(touched(...stage1), 'bronze', DEFAULT_SETTINGS, now)).toEqual({
      eligible: true,
    })
  })

  it('1 つ下の認定がなければ受けられない', () => {
    const practised = touched(...stage1, 'fin-npv')
    expect(examEligibility(practised, 'silver', DEFAULT_SETTINGS, now)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('ブロンズ'),
    })
    const withBronze = [...practised, ...exam('bronze', [5, 5, 5, 5, 5])]
    expect(examEligibility(withBronze, 'silver', DEFAULT_SETTINGS, now)).toEqual({
      eligible: true,
    })
  })

  it('ゴールドは、シルバーのあと、事例Ⅳ総合の問題を 1 回以上解くと受けられる', () => {
    const certified = [
      ...touched(...stage1, 'fin-npv'),
      ...exam('bronze', [5, 5, 5, 5, 5]),
      ...exam('silver', [5, 5, 5, 5, 5], { passRatio: 0.7 }),
    ]
    expect(examEligibility(certified, 'gold', DEFAULT_SETTINGS, now)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('事例Ⅳ総合'),
    })
    const withCase4 = [...certified, ...touched('case4-int')]
    expect(examEligibility(withCase4, 'gold', DEFAULT_SETTINGS, now)).toEqual({ eligible: true })
  })
})

describe('buildExam', () => {
  const unitOf = (templateId: string) =>
    UNITS.find((unit) => unit.templateIds.includes(templateId))!.id

  it('ブロンズは、仕訳・経営分析・CVP・CF・時間価値の単元から 1 問ずつ出す', () => {
    const { items } = buildExam('bronze', 1)
    expect(items).toHaveLength(TIER_RULES.bronze.size)
    expect(items.map((item) => unitOf(item.templateId))).toEqual([
      'acc-bs-pl',
      'acc-ca',
      'mgt-cvp',
      'acc-cf',
      'fin-tvm',
    ])
  })

  it('問題がない単元の枠は飛ばし、足りない問題は最初の枠から使い回す', () => {
    // シルバーの最後の枠（セグメント／企業価値）は、まだ問題がない
    const units = buildExam('silver', 1).items.map((item) => unitOf(item.templateId))
    expect(units).toEqual(['acc-ca', 'mgt-cvp', 'acc-cf', 'fin-npv', 'acc-ca'])
  })

  it('同じ単元から続けて出すときは、別の型を選ぶ', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const analysis = buildExam('silver', seed).items.filter((item) =>
        item.templateId.startsWith('analysis.'),
      )
      expect(new Set(analysis.map((item) => item.templateId)).size).toBe(analysis.length)
    }
  })

  it('数値（シード）は問題ごとに違い、同じシードなら同じ問題になる', () => {
    const plan = buildExam('silver', 7)
    expect(new Set(plan.items.map((item) => item.seed)).size).toBe(TIER_RULES.silver.size)
    expect(buildExam('silver', 7)).toEqual(plan)
  })

  it('難易度が目安に近い型を選ぶ（ブロンズなら、その単元でいちばん易しい型）', () => {
    const { items } = buildExam('bronze', 5)
    const analysis = items.find((item) => item.templateId.startsWith('analysis.'))!
    const template = PROBLEM_TEMPLATES.find((t) => t.id === analysis.templateId)!
    expect(template.difficulty).toBe(1)
  })

  it('制限時間は、出題した問題の想定時間の合計 × 係数（5 分単位）', () => {
    // 仕訳 3 + 分析 4 + CVP 5 + CF 5 + 時間価値 3 = 20 分 → ×1.3 = 26 分 → 25 分
    expect(buildExam('bronze', 1).timeLimitMs).toBe(25 * 60_000)
    // 分析 4 + CVP 5 + CF 5 + NPV 7 + 分析 4 = 25 分 → ×1.0 = 25 分
    expect(buildExam('silver', 1).timeLimitMs).toBe(25 * 60_000)
  })

  it('ゴールドは、事例Ⅳ総合の大問 1 問を 20 分で解く', () => {
    const { items, timeLimitMs } = buildExam('gold', 1)
    expect(items).toHaveLength(1)
    expect(unitOf(items[0]!.templateId)).toBe('case4-int')
    expect(timeLimitMs).toBe(20 * 60_000)
  })

  it('出題できる問題がない認定は、出題が空になる', () => {
    expect(buildExam('gold', 1, [])).toEqual({ items: [], timeLimitMs: 0 })
  })

  it('テンプレートを渡して、出題の元を差し替えられる', () => {
    const only = PROBLEM_TEMPLATES.filter(
      (t) => t.id === 'cvp.break-even.basic',
    ) as ProblemTemplate[]
    const { items } = buildExam('bronze', 1, only)
    expect(items.every((item) => item.templateId === 'cvp.break-even.basic')).toBe(true)
  })

  it('3 つの認定は、Stage と合格ラインが順に上がる／下がる設計どおり', () => {
    expect(TIERS.map((tier) => TIER_RULES[tier].stage)).toEqual([1, 2, 3])
    expect(TIERS.map((tier) => TIER_RULES[tier].passRatio)).toEqual([0.8, 0.7, 0.6])
  })
})
