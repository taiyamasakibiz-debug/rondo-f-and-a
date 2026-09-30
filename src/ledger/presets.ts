import type { Category } from '@/domain/accounting/categories'

/** はじめて使うときの標準の勘定科目（事例Ⅳ・財務会計でよく使うもの） */
export const STARTER_ACCOUNTS: readonly [name: string, category: Category][] = [
  ['現金預金', 'cash'],
  ['売掛金', 'receivable'],
  ['貸倒引当金', 'allowance'],
  ['商品', 'inventory'],
  ['備品', 'tangibleFixedAsset'],
  ['減価償却累計額', 'accumulatedDepreciation'],
  ['買掛金', 'payable'],
  ['未払法人税等', 'otherCurrentLiability'],
  ['短期借入金', 'shortTermBorrowing'],
  ['長期借入金', 'longTermBorrowing'],
  ['資本金', 'capitalStock'],
  ['利益剰余金', 'retainedEarnings'],
  ['売上高', 'sales'],
  ['受取利息', 'interestAndDividendIncome'],
  ['売上原価', 'costOfSales'],
  ['給料', 'sga'],
  ['減価償却費', 'sga'],
  ['貸倒引当金繰入', 'sga'],
  ['支払利息', 'interestExpense'],
  ['法人税等', 'incomeTax'],
]
