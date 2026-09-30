import { describe, expect, it } from 'vitest'
import {
  type CostStructure,
  breakEvenPointRatio,
  breakEvenSales,
  contributionMargin,
  contributionMarginRatio,
  highLowMethod,
  marginOfSafetyRatio,
  operatingLeverage,
  operatingProfit,
  salesForTargetProfit,
  variableCostRatio,
} from './cvp'

// 売上高 10,000、変動費 6,000、固定費 3,000（単位：千円）
const cost: CostStructure = { sales: 10_000, variableCosts: 6_000, fixedCosts: 3_000 }

describe('CVP 分析', () => {
  it('変動費率と限界利益率', () => {
    expect(variableCostRatio(cost)).toBeCloseTo(0.6)
    expect(contributionMarginRatio(cost)).toBeCloseTo(0.4)
    expect(contributionMargin(cost)).toBe(4_000)
    expect(operatingProfit(cost)).toBe(1_000)
  })

  it('損益分岐点売上高、損益分岐点比率、安全余裕率', () => {
    expect(breakEvenSales(cost)).toBeCloseTo(7_500)
    expect(breakEvenPointRatio(cost)).toBeCloseTo(0.75)
    expect(marginOfSafetyRatio(cost)).toBeCloseTo(0.25)
  })

  it('損益分岐点では営業利益がゼロになる', () => {
    const atBreakEven: CostStructure = {
      sales: breakEvenSales(cost),
      variableCosts: breakEvenSales(cost) * variableCostRatio(cost),
      fixedCosts: cost.fixedCosts,
    }
    expect(operatingProfit(atBreakEven)).toBeCloseTo(0)
  })

  it('目標利益を達成する売上高', () => {
    expect(salesForTargetProfit(cost, 2_000)).toBeCloseTo(12_500)
    // 目標利益 0 なら損益分岐点売上高と同じ
    expect(salesForTargetProfit(cost, 0)).toBeCloseTo(breakEvenSales(cost))
  })

  it('営業レバレッジ', () => {
    expect(operatingLeverage(cost)).toBeCloseTo(4)
    // 営業レバレッジ = 1 ÷ 安全余裕率
    expect(operatingLeverage(cost)).toBeCloseTo(1 / marginOfSafetyRatio(cost))
  })
})

describe('highLowMethod', () => {
  it('最大と最小の売上高の 2 点から費用を分解する', () => {
    const result = highLowMethod([
      { sales: 8_000, totalCosts: 7_800 },
      { sales: 12_000, totalCosts: 10_200 }, // 最大
      { sales: 10_000, totalCosts: 9_050 }, // 中間の点は使わない
      { sales: 6_000, totalCosts: 6_600 }, // 最小
    ])
    expect(result.variableCostRatio).toBeCloseTo(0.6)
    expect(result.fixedCosts).toBeCloseTo(3_000)
  })

  it('データが足りない・売上高が同じなら分解できない', () => {
    expect(() => highLowMethod([{ sales: 1, totalCosts: 1 }])).toThrow()
    expect(() =>
      highLowMethod([
        { sales: 1, totalCosts: 1 },
        { sales: 1, totalCosts: 2 },
      ]),
    ).toThrow()
  })
})
