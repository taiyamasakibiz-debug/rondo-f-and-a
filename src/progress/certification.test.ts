import { describe, expect, it } from 'vitest'
import type { ProblemTemplate } from '@/engine/types'
import {
  EXAM_SIZE,
  TIER_RULES,
  type Tier,
  buildExam,
  certificationOf,
  examEligibility,
  examResults,
} from './certification'
import { LEVEL_THRESHOLDS } from './level'
import type { Attempt } from './types'

let nextId = 0
function attempt(overrides: Partial<Attempt> = {}): Attempt {
  nextId += 1
  const at = '2026-10-01T03:00:00.000Z'
  return {
    id: `a${nextId}`,
    templateId: 'cvp.x',
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

/** 認定テスト 1 回分の記録。scores は各問の得点（満点 5） */
function exam(tier: Tier, scores: number[], id = `exam-${tier}-${(nextId += 1)}`, minutes = 1) {
  return scores.map((earned, index) =>
    attempt({
      earned,
      allCorrect: earned === 5,
      answeredAt: minutesAfter(minutes),
      exam: { id, tier, index, startedAt: START },
    }),
  )
}

/** Lv.n に届くだけの練習の記録（全問正解 1 回で 15 XP。型を変えて、XP の上限に当たらないようにする） */
function practiceToLevel(level: number) {
  const xp = LEVEL_THRESHOLDS[level - 1]!
  return Array.from({ length: Math.ceil(xp / 15) }, (_, i) =>
    attempt({ templateId: `practice.${i}` }),
  )
}

describe('examResults', () => {
  it('合格ライン以上なら合格', () => {
    const [result] = examResults(exam('bronze', [3, 3, 3, 3, 3])) // 60%
    expect(result).toMatchObject({ answered: 5, earned: 15, total: 25, passed: true })
    expect(result!.ratio).toBeCloseTo(0.6)
  })

  it('合格ラインに届かなければ不合格', () => {
    const [result] = examResults(exam('silver', [5, 5, 5, 3, 0])) // 72%
    expect(result!.passed).toBe(false)
  })

  it('途中でやめた問題は 0 点として数える', () => {
    const [result] = examResults(exam('bronze', [5, 5])) // 10 / 25
    expect(result).toMatchObject({ answered: 2, earned: 10, total: 25, passed: false })
  })

  it('制限時間を過ぎてから解いた問題は 0 点', () => {
    const limit = TIER_RULES.bronze.timeLimitMs / 60_000
    const late = exam('bronze', [5, 5, 5, 5, 5], 'late', limit + 1)
    const [result] = examResults(late)
    expect(result).toMatchObject({ earned: 0, passed: false })
  })

  it('練習の記録は認定テストとして数えない', () => {
    expect(examResults([attempt(), attempt()])).toEqual([])
  })
})

describe('certificationOf と examEligibility', () => {
  it('合格したいちばん上の認定を返す', () => {
    const attempts = [...exam('bronze', [5, 5, 5, 5, 5]), ...exam('silver', [5, 5, 5, 5, 5])]
    expect(certificationOf(attempts, 'cvp')).toBe('silver')
    expect(certificationOf(attempts, 'npv')).toBeNull()
  })

  it('レベルが足りなければ受けられない', () => {
    const result = examEligibility([], 'cvp', 'bronze')
    expect(result).toMatchObject({ eligible: false, reason: expect.stringContaining('Lv.2') })
    expect(examEligibility(practiceToLevel(2), 'cvp', 'bronze')).toEqual({ eligible: true })
  })

  it('1 つ下の認定がなければ受けられない', () => {
    const levelled = practiceToLevel(4)
    expect(examEligibility(levelled, 'cvp', 'silver')).toMatchObject({ eligible: false })
    const withBronze = [...levelled, ...exam('bronze', [5, 5, 5, 5, 5])]
    expect(examEligibility(withBronze, 'cvp', 'silver')).toEqual({ eligible: true })
  })
})

describe('buildExam', () => {
  const template = (id: string) => ({ id, topic: 'cf' }) as ProblemTemplate

  it(`${EXAM_SIZE} 問を、テンプレートが偏らないように選ぶ`, () => {
    const items = buildExam([template('a'), template('b')], 1)
    expect(items).toHaveLength(EXAM_SIZE)
    const counts = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.templateId] = (acc[item.templateId] ?? 0) + 1
      return acc
    }, {})
    expect(Object.values(counts).sort()).toEqual([2, 3])
    // 同じテンプレートでも数値（シード）は違う
    expect(new Set(items.map((item) => item.seed)).size).toBe(EXAM_SIZE)
  })

  it('同じシードなら同じ問題になる', () => {
    const templates = [template('a'), template('b'), template('c')]
    expect(buildExam(templates, 7)).toEqual(buildExam(templates, 7))
  })
})
