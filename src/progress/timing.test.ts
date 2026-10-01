import { describe, expect, it } from 'vitest'
import { findUnit } from '@/course/units'
import { buildExam } from './certification'
import { expectedMinutesFor, studyForecast, unitTiming } from './timing'
import { type Attempt, DEFAULT_SETTINGS } from './types'
import { computeCourse } from './units'

let nextId = 0
function attempt(templateId: string, minutes: number): Attempt {
  nextId += 1
  const at = new Date(Date.UTC(2026, 9, 1, 3, 0, nextId)).toISOString()
  return {
    id: `a${nextId}`,
    templateId,
    topic: 'cvp',
    seed: nextId,
    earned: 5,
    total: 5,
    allCorrect: true,
    steps: [],
    durationMs: minutes * 60_000,
    answeredAt: at,
    createdAt: at,
    updatedAt: at,
  }
}

const cvp = findUnit('mgt-cvp')! // 設計値 5 分
const solved = (minutes: number, times = 10) =>
  Array.from({ length: times }, () => attempt('cvp.break-even.basic', minutes))

describe('想定時間の補正', () => {
  it('10 回未満なら設計値のまま', () => {
    expect(unitTiming(cvp, solved(9, 9))).toMatchObject({ design: 5, measured: null, minutes: 5 })
  })

  it('10 回以上なら、実測の中央値と設計値の平均', () => {
    // 実測 6 分 → (5 + 6) ÷ 2 = 5.5 分
    expect(unitTiming(cvp, solved(6))).toMatchObject({ measured: 6, minutes: 5.5 })
  })

  it('設計値の ±30% に収める', () => {
    // 実測 20 分 → 平均 12.5 分だが、上限は 6.5 分
    expect(unitTiming(cvp, solved(20)).minutes).toBe(6.5)
    // 実測 0.5 分 → 平均 2.75 分だが、下限は 3.5 分
    expect(unitTiming(cvp, solved(0.5)).minutes).toBe(3.5)
  })

  it('60 分を超える記録（席を外していたもの）は数えない', () => {
    const attempts = [...solved(6, 9), attempt('cvp.break-even.basic', 120)]
    // 数えられるのは 9 回なので、まだ補正しない
    expect(unitTiming(cvp, attempts).measured).toBeNull()
  })

  it('ほかの単元の記録は数えない', () => {
    const attempts = Array.from({ length: 10 }, () => attempt('journal.credit-sale', 10))
    expect(unitTiming(cvp, attempts).measured).toBeNull()
  })

  it('認定テストの制限時間に、補正後の想定時間を使う', () => {
    // 設計値なら 20 分 × 1.3 ≒ 25 分。すべての単元が 1.3 倍かかるとすると 26 分 × 1.3 ≒ 35 分
    expect(buildExam('bronze', 1).timeLimitMs).toBe(25 * 60_000)
    const slower = (unit: { expectedMinutes: number }) => unit.expectedMinutes * 1.3
    expect(buildExam('bronze', 1, undefined, slower).timeLimitMs).toBe(35 * 60_000)
    // 記録から作った関数も使える
    const fromRecords = expectedMinutesFor(solved(6))
    expect(fromRecords(cvp)).toBe(5.5)
  })
})

describe('学習時間の見込み', () => {
  const now = new Date(2026, 9, 1, 12)

  it('何も解いていなければ、必須・推奨の単元を目安の回数まで解く時間（復習・解説・分散反復・認定テストを含む）', () => {
    const course = computeCourse([], DEFAULT_SETTINGS, now)
    const forecast = studyForecast(course, [], DEFAULT_SETTINGS, now)
    // 解答の合計 987 分（後回しの為替は除く）× 2（復習と解説）× 1.8（分散反復と認定テスト）≒ 3,553 分
    // （docs/COURSE.md §3.2 の合計 約 60 時間）
    expect(forecast.remainingMinutes).toBe(3_553)
    // 2027-03-31 まで 181 日 → 約 26 週 → 週に約 2 時間 17 分
    expect(forecast.daysLeft).toBe(181)
    expect(forecast.minutesPerWeek).toBe(137)
  })

  it('解いた回数のぶん、残りが減る', () => {
    const attempts = solved(5, 10)
    const course = computeCourse(attempts, DEFAULT_SETTINGS, now)
    const forecast = studyForecast(course, attempts, DEFAULT_SETTINGS, now)
    // CVP を 10 回解いた（5 分 × 10 回 × 2 × 1.8 = 180 分減る）
    expect(forecast.remainingMinutes).toBe(3_373)
  })

  it('マスターしたい月を過ぎたら、1 週間あたりは出さない', () => {
    const settings = { ...DEFAULT_SETTINGS, masteryMonth: '2026-09' }
    const course = computeCourse([], settings, now)
    expect(studyForecast(course, [], settings, now)).toMatchObject({
      daysLeft: null,
      minutesPerWeek: null,
    })
  })
})
