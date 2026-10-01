import { describe, expect, it } from 'vitest'
import type { Attempt } from './types'
import { attemptXps, nextAttemptXp, xpForAttempt } from './xp'

const DAY = 86_400_000
const base = Date.parse('2026-10-01T03:00:00.000Z')

/** day 日目に解いた記録。難度 1 の cvp.break-even.basic、難度 2 の cvp.high-low、難度 3 の cvp.price-cut を使う */
function attempt(day: number, overrides: Partial<Attempt> = {}): Attempt {
  const at = new Date(base + day * DAY).toISOString()
  return {
    id: `a${day}-${Math.random()}`,
    templateId: 'cvp.break-even.basic',
    topic: 'cvp',
    seed: 1,
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

describe('xpForAttempt（基本）', () => {
  it('得点率 × 10、全問正解で +5', () => {
    expect(xpForAttempt({ earned: 5, total: 5, allCorrect: true })).toBe(15)
    expect(xpForAttempt({ earned: 3, total: 5, allCorrect: false })).toBe(6)
  })
})

describe('同じ型の連続正解の上限', () => {
  const sameDay = (n: number) => Array.from({ length: n }, (_, i) => attempt(0, { seed: i }))

  it('5 回続いたあとの正解は半分、8 回続いたあとは 0', () => {
    const xps = attemptXps(sameDay(10))
    expect(xps.slice(0, 5)).toEqual([15, 15, 15, 15, 15])
    expect(xps.slice(5, 8)).toEqual([8, 8, 8])
    expect(xps.slice(8)).toEqual([0, 0])
  })

  it('間違えると連続が途切れて、また満額に戻る', () => {
    const history = [...sameDay(6), attempt(0, { earned: 2, allCorrect: false }), attempt(0)]
    const xps = attemptXps(history)
    expect(xps[5]).toBe(8)
    expect(xps[7]).toBe(15)
  })

  it('型が違えば数えない', () => {
    const history = [...sameDay(5), attempt(0, { templateId: 'analysis.safety' })]
    expect(attemptXps(history)[5]).toBe(15)
  })

  it('7 日以上空けて解いたときは、上限を数えずボーナスがつく', () => {
    const history = [...sameDay(9), attempt(7)]
    expect(attemptXps(history)[9]).toBe(Math.round(15 * 1.5))
  })
})

describe('ボーナス', () => {
  it('間を空けた復習：7 日以上で ×1.5、14 日以上で ×2', () => {
    expect(attemptXps([attempt(0), attempt(6)])[1]).toBe(15)
    expect(attemptXps([attempt(0), attempt(7)])[1]).toBe(23)
    expect(attemptXps([attempt(0), attempt(14)])[1]).toBe(30)
  })

  it('間を空けても、全問正解でなければボーナスはつかない', () => {
    const partial = attempt(14, { earned: 3, allCorrect: false })
    expect(attemptXps([attempt(0), partial])[1]).toBe(6)
  })

  it('難易度 2 は ×1.5、難易度 3 は ×2.5', () => {
    expect(attemptXps([attempt(0, { templateId: 'cvp.high-low' })])[0]).toBe(23)
    expect(attemptXps([attempt(0, { templateId: 'cvp.price-cut' })])[0]).toBe(38)
  })

  it('テンプレートが見つからなければ、難易度 1 として数える', () => {
    expect(attemptXps([attempt(0, { templateId: 'gone.template' })])[0]).toBe(15)
  })
})

describe('nextAttemptXp', () => {
  it('これから記録する 1 件の XP を、記録済みの履歴から出す', () => {
    const history = Array.from({ length: 5 }, (_, i) => attempt(0, { seed: i }))
    const next = {
      templateId: 'cvp.break-even.basic',
      earned: 5,
      total: 5,
      allCorrect: true,
      answeredAt: new Date(base).toISOString(),
    }
    expect(nextAttemptXp(history, next)).toBe(8)
    expect(nextAttemptXp([], next)).toBe(15)
  })

  it('削除した記録は数えない', () => {
    const deleted = Array.from({ length: 5 }, (_, i) =>
      attempt(0, { seed: i, deletedAt: new Date(base).toISOString() }),
    )
    const next = {
      templateId: 'cvp.break-even.basic',
      earned: 5,
      total: 5,
      allCorrect: true,
      answeredAt: new Date(base).toISOString(),
    }
    expect(nextAttemptXp(deleted, next)).toBe(15)
  })
})
