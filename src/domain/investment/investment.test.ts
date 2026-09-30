import { describe, expect, it } from 'vitest'
import {
  afterTaxDisposalProceeds,
  afterTaxOperatingCashFlow,
  annuityFactor,
  depreciationTaxShield,
  differentialCashFlows,
  discountFactors,
  netPresentValue,
  paybackPeriod,
  presentValueFactor,
  straightLineDepreciation,
} from './investment'

describe('減価償却と税引後 CF', () => {
  it('定額法の減価償却費', () => {
    expect(straightLineDepreciation(1_000, 0, 5)).toBe(200)
    expect(straightLineDepreciation(1_000, 100, 5)).toBe(180)
    expect(() => straightLineDepreciation(1_000, 0, 0)).toThrow()
  })

  it('税引後 CF = 税引後営業利益 + 減価償却費', () => {
    // (500 − 200 − 100) × 0.7 + 100 = 240
    expect(
      afterTaxOperatingCashFlow({
        revenue: 500,
        cashExpenses: 200,
        depreciation: 100,
        taxRate: 0.3,
      }),
    ).toBeCloseTo(240)
  })

  it('税引後 CF = 税引後の現金収支 + 減価償却費の節税効果（別の式でも同じ値）', () => {
    const input = { revenue: 500, cashExpenses: 200, depreciation: 100, taxRate: 0.3 }
    const other = (500 - 200) * (1 - 0.3) + depreciationTaxShield(100, 0.3)
    expect(afterTaxOperatingCashFlow(input)).toBeCloseTo(other)
  })

  it('営業利益がマイナスの年も節税効果を見込む', () => {
    // (100 − 50 − 100) × 0.7 + 100 = 65
    expect(
      afterTaxOperatingCashFlow({
        revenue: 100,
        cashExpenses: 50,
        depreciation: 100,
        taxRate: 0.3,
      }),
    ).toBeCloseTo(65)
  })
})

describe('設備の売却', () => {
  it('売却益には税金がかかる', () => {
    // 300 − (300 − 200) × 0.3 = 270
    expect(afterTaxDisposalProceeds(300, 200, 0.3)).toBeCloseTo(270)
  })

  it('売却損は節税効果で収入が増える', () => {
    // 100 − (100 − 200) × 0.3 = 130
    expect(afterTaxDisposalProceeds(100, 200, 0.3)).toBeCloseTo(130)
  })
})

describe('現価係数', () => {
  it('複利現価係数（試験の表と同じく小数第 3 位まで）', () => {
    expect(presentValueFactor(0.1, 1, 3)).toBe(0.909)
    expect(presentValueFactor(0.1, 2, 3)).toBe(0.826)
    expect(presentValueFactor(0.1, 3, 3)).toBe(0.751)
    expect(presentValueFactor(0.05, 5, 3)).toBe(0.784)
  })

  it('年金現価係数', () => {
    expect(annuityFactor(0.1, 3, 3)).toBe(2.487)
    expect(annuityFactor(0.05, 5, 3)).toBe(4.329)
  })

  it('係数表を渡すとそのまま使い、足りなければエラーにする', () => {
    expect(discountFactors({ factors: [0.9, 0.8, 0.7] }, 2)).toEqual([0.9, 0.8])
    expect(() => discountFactors({ factors: [0.9] }, 2)).toThrow()
  })
})

describe('netPresentValue', () => {
  const cashFlows = [400, 400, 400]

  it('問題で与えられた係数表で計算する', () => {
    // 400 × (0.909 + 0.826 + 0.751) − 1,000 = −5.6
    expect(netPresentValue(1_000, cashFlows, { factors: [0.909, 0.826, 0.751] })).toBeCloseTo(-5.6)
  })

  it('割引率から計算する（丸めない係数）', () => {
    expect(netPresentValue(1_000, cashFlows, { rate: 0.1 })).toBeCloseTo(-5.2592, 4)
  })

  it('割引率から、係数を丸めて計算する', () => {
    expect(netPresentValue(1_000, cashFlows, { rate: 0.1, decimals: 3 })).toBeCloseTo(-5.6)
  })
})

describe('paybackPeriod', () => {
  it('年の途中は均等に回収する前提で求める', () => {
    expect(paybackPeriod(1_000, [400, 400, 400])).toBeCloseTo(2.5)
    expect(paybackPeriod(1_000, [500, 500])).toBe(2)
  })

  it('期間内に回収できなければ null', () => {
    expect(paybackPeriod(1_000, [300, 300])).toBeNull()
  })

  it('途中でマイナスの年があっても累計で判定する', () => {
    // 600 → 400（−200）→ 1,000 で回収：2 年目の終わりで残り 600、3 年目に 600 / 800
    expect(paybackPeriod(1_000, [600, -200, 800])).toBeCloseTo(2.75)
  })
})

describe('differentialCashFlows', () => {
  it('新しい案から今の案を差し引く（長さが違えば 0 とみなす）', () => {
    expect(differentialCashFlows([500, 500, 600], [300, 300])).toEqual([200, 200, 600])
  })
})
