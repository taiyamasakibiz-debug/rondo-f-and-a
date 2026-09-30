import {
  type BalanceSheet,
  type IncomeStatement,
  balanceSheetTotals,
  emptyBalanceSheet,
  incomeStatementProfits,
} from '@/domain/statements'
import type { Block, Params, ParamSpec } from '@/engine/types'
import { amountTable } from '../helpers'

/**
 * 分析ラボの問題で使う会社の財務諸表（単位：千円）。
 * 利益剰余金を差額で決めて、B/S の貸借を必ず一致させる。
 */
export const companyParams = {
  cash: { kind: 'int', min: 500, max: 4_000, step: 100 },
  receivables: { kind: 'int', min: 800, max: 5_000, step: 100 },
  inventories: { kind: 'int', min: 300, max: 3_000, step: 100 },
  tangibleFixedAssets: { kind: 'int', min: 2_000, max: 12_000, step: 100 },
  investments: { kind: 'int', min: 200, max: 2_000, step: 100 },
  payables: { kind: 'int', min: 400, max: 3_500, step: 100 },
  shortTermBorrowings: { kind: 'int', min: 200, max: 3_000, step: 100 },
  longTermBorrowings: { kind: 'int', min: 500, max: 7_000, step: 100 },
  capitalStock: { kind: 'int', min: 500, max: 3_000, step: 100 },
  sales: { kind: 'int', min: 8_000, max: 40_000, step: 500 },
  costOfSalesPercent: { kind: 'int', min: 55, max: 80 },
  sgaPercent: { kind: 'int', min: 10, max: 30 },
  interestExpense: { kind: 'int', min: 20, max: 300, step: 10 },
  // 0 だと「受取利息の足し忘れ」と正解が同じ値になるので、必ず少しはある
  interestIncome: { kind: 'int', min: 5, max: 80, step: 5 },
} as const satisfies ParamSpec

export type Company = {
  balanceSheet: BalanceSheet
  incomeStatement: IncomeStatement
}

export function companyOf(p: Params): Company {
  const assets = p.cash! + p.receivables! + p.inventories! + p.tangibleFixedAssets! + p.investments!
  const liabilities = p.payables! + p.shortTermBorrowings! + p.longTermBorrowings!
  const balanceSheet: BalanceSheet = {
    ...emptyBalanceSheet(),
    cashAndDeposits: p.cash!,
    receivables: p.receivables!,
    inventories: p.inventories!,
    tangibleFixedAssets: p.tangibleFixedAssets!,
    investmentsAndOtherAssets: p.investments!,
    payables: p.payables!,
    shortTermBorrowings: p.shortTermBorrowings!,
    longTermBorrowings: p.longTermBorrowings!,
    capitalStock: p.capitalStock!,
    retainedEarnings: assets - liabilities - p.capitalStock!,
  }
  const sales = p.sales!
  const incomeStatement: IncomeStatement = {
    sales,
    costOfSales: Math.round((sales * p.costOfSalesPercent!) / 100),
    sellingGeneralAndAdministrativeExpenses: Math.round((sales * p.sgaPercent!) / 100),
    nonOperatingIncome: p.interestIncome!,
    interestAndDividendIncome: p.interestIncome!,
    nonOperatingExpenses: p.interestExpense!,
    interestExpense: p.interestExpense!,
    extraordinaryIncome: 0,
    extraordinaryLosses: 0,
    incomeTaxes: 0,
  }
  return { balanceSheet, incomeStatement }
}

/** 財務諸表として自然か：純資産・利益剰余金・営業利益・経常利益がプラス */
export function isReasonableCompany(p: Params): boolean {
  const { balanceSheet, incomeStatement } = companyOf(p)
  const totals = balanceSheetTotals(balanceSheet)
  const profits = incomeStatementProfits(incomeStatement)
  return (
    balanceSheet.retainedEarnings > 0 &&
    totals.netAssets / totals.totalAssets >= 0.1 &&
    profits.operatingProfit > 0 &&
    profits.ordinaryProfit > 0 &&
    // 流動比率がちょうど 100% だと、分子と分母を逆にしても同じ値になり、誤答と区別できない
    totals.currentAssets !== totals.currentLiabilities
  )
}

export function companyBlocks({ balanceSheet: bs, incomeStatement: pl }: Company): Block[] {
  const t = balanceSheetTotals(bs)
  const profits = incomeStatementProfits(pl)
  return [
    amountTable('貸借対照表（単位：千円）', [
      ['現金預金', bs.cashAndDeposits],
      ['売上債権', bs.receivables],
      ['棚卸資産', bs.inventories],
      ['流動資産合計', t.currentAssets],
      ['有形固定資産', bs.tangibleFixedAssets],
      ['投資その他の資産', bs.investmentsAndOtherAssets],
      ['固定資産合計', t.fixedAssets],
      ['資産合計', t.totalAssets],
      ['仕入債務', bs.payables],
      ['短期借入金', bs.shortTermBorrowings],
      ['流動負債合計', t.currentLiabilities],
      ['長期借入金', bs.longTermBorrowings],
      ['固定負債合計', t.fixedLiabilities],
      ['負債合計', t.totalLiabilities],
      ['資本金', bs.capitalStock],
      ['利益剰余金', bs.retainedEarnings],
      ['純資産合計', t.netAssets],
      ['負債・純資産合計', t.totalLiabilitiesAndNetAssets],
    ]),
    amountTable('損益計算書（単位：千円）', [
      ['売上高', pl.sales],
      ['売上原価', pl.costOfSales],
      ['売上総利益', profits.grossProfit],
      ['販売費及び一般管理費', pl.sellingGeneralAndAdministrativeExpenses],
      ['営業利益', profits.operatingProfit],
      ['受取利息・配当金', pl.interestAndDividendIncome],
      ['支払利息', pl.interestExpense],
      ['経常利益', profits.ordinaryProfit],
    ]),
  ]
}
