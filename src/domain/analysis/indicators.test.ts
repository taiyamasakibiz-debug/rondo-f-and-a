import { describe, expect, it } from 'vitest'
import { applyRounding } from '../rounding'
import {
  type BalanceSheet,
  type IncomeStatement,
  balanceSheetTotals,
  emptyBalanceSheet,
} from '../statements'
import { INDICATORS, computeIndicators } from './indicators'

// 単位：千円
const bs: BalanceSheet = {
  ...emptyBalanceSheet(),
  cashAndDeposits: 200,
  receivables: 300,
  allowanceForDoubtfulAccounts: -10,
  securities: 10,
  inventories: 250,
  otherCurrentAssets: 50,
  tangibleFixedAssets: 900,
  intangibleFixedAssets: 50,
  investmentsAndOtherAssets: 250,
  payables: 200,
  shortTermBorrowings: 300,
  otherCurrentLiabilities: 100,
  longTermBorrowings: 700,
  otherFixedLiabilities: 100,
  capitalStock: 300,
  capitalSurplus: 100,
  retainedEarnings: 200,
}
// 流動資産 800、当座資産 500、固定資産 1,200、総資産 2,000
// 流動負債 600、固定負債 800、負債 1,400、純資産 600（貸借一致）

it('テスト用の B/S は貸借が一致している', () => {
  const totals = balanceSheetTotals(bs)
  expect(totals.totalAssets).toBe(2000)
  expect(totals.totalLiabilitiesAndNetAssets).toBe(2000)
})

const pl: IncomeStatement = {
  sales: 3000,
  costOfSales: 2100,
  sellingGeneralAndAdministrativeExpenses: 750,
  nonOperatingIncome: 30,
  interestAndDividendIncome: 20,
  nonOperatingExpenses: 50,
  interestExpense: 40,
  extraordinaryIncome: 0,
  extraordinaryLosses: 10,
  incomeTaxes: 50,
}
// 売上総利益 900、営業利益 150、経常利益 130

const round2 = (value: number | null) =>
  value === null ? null : applyRounding(value, { mode: 'halfUp', digits: 2 })

describe('computeIndicators（期末）', () => {
  const values = computeIndicators({ balanceSheet: bs, incomeStatement: pl })

  it.each([
    ['grossProfitMargin', 30],
    ['operatingProfitMargin', 5],
    ['ordinaryProfitMargin', 4.33],
    ['sgaRatio', 25],
    ['totalAssetTurnover', 1.5],
    ['tangibleFixedAssetTurnover', 3.33],
    ['receivablesTurnover', 10],
    ['inventoryTurnover', 12],
    ['currentRatio', 133.33],
    ['quickRatio', 83.33],
    ['equityRatio', 30],
    ['debtEquityRatio', 233.33],
    ['fixedRatio', 200],
    ['fixedLongTermSuitabilityRatio', 85.71],
    ['interestCoverageRatio', 4.25],
  ] as const)('%s = %s', (id, expected) => {
    expect(round2(values[id])).toBe(expected)
  })

  it('すべての指標の定義がある', () => {
    expect(new Set(INDICATORS.map((indicator) => indicator.id))).toEqual(
      new Set(Object.keys(values)),
    )
  })
})

describe('computeIndicators（期首と期末の平均）', () => {
  const previous: BalanceSheet = { ...bs, receivables: 200, inventories: 150, cashAndDeposits: 400 }

  it('B/S の値を平均してから計算する', () => {
    const values = computeIndicators({
      balanceSheet: bs,
      incomeStatement: pl,
      previousBalanceSheet: previous,
      basis: 'average',
    })
    expect(values.receivablesTurnover).toBe(3000 / 250)
    expect(values.inventoryTurnover).toBe(3000 / 200)
    // P/L だけを使う指標は変わらない
    expect(values.grossProfitMargin).toBe(30)
  })

  it('期首の B/S がないとエラーにする', () => {
    expect(() =>
      computeIndicators({ balanceSheet: bs, incomeStatement: pl, basis: 'average' }),
    ).toThrow()
  })
})

describe('computeIndicators（計算できない場合）', () => {
  it('分母が 0 の指標は null を返す', () => {
    const values = computeIndicators({
      balanceSheet: { ...bs, inventories: 0 },
      incomeStatement: { ...pl, sales: 0, interestExpense: 0 },
    })
    expect(values.grossProfitMargin).toBeNull()
    expect(values.inventoryTurnover).toBeNull()
    expect(values.interestCoverageRatio).toBeNull()
  })
})
