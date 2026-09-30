import { describe, expect, it } from 'vitest'
import { type Account, type JournalEntry, buildStatements } from '../accounting/ledger'
import { indirectCashFlowStatement } from './indirect'

const accounts: Account[] = [
  { id: 'cash', name: '現金預金', category: 'cash' },
  { id: 'ar', name: '売掛金', category: 'receivable' },
  { id: 'allowance', name: '貸倒引当金', category: 'allowance' },
  { id: 'inventory', name: '商品', category: 'inventory' },
  { id: 'equipment', name: '備品', category: 'tangibleFixedAsset' },
  { id: 'accDep', name: '減価償却累計額', category: 'accumulatedDepreciation' },
  { id: 'ap', name: '買掛金', category: 'payable' },
  { id: 'loan', name: '長期借入金', category: 'longTermBorrowing' },
  { id: 'capital', name: '資本金', category: 'capitalStock' },
  { id: 'sales', name: '売上高', category: 'sales' },
  { id: 'interestIncome', name: '受取利息', category: 'interestAndDividendIncome' },
  { id: 'cogs', name: '売上原価', category: 'costOfSales' },
  { id: 'wages', name: '給料', category: 'sga' },
  { id: 'dep', name: '減価償却費', category: 'sga' },
  { id: 'badDebt', name: '貸倒引当金繰入', category: 'sga' },
  { id: 'interest', name: '支払利息', category: 'interestExpense' },
  { id: 'tax', name: '法人税等', category: 'incomeTax' },
]

let nextId = 0
function entry(debit: string, credit: string, amount: number): JournalEntry {
  nextId += 1
  return {
    id: `e${nextId}`,
    description: '',
    debits: [{ accountId: debit, amount }],
    credits: [{ accountId: credit, amount }],
  }
}

// 期首残高（B/S の科目だけ）
const opening: JournalEntry[] = [
  entry('cash', 'capital', 1000),
  entry('ar', 'capital', 200),
  entry('capital', 'allowance', 4),
  entry('inventory', 'capital', 100),
  entry('equipment', 'capital', 800),
  entry('capital', 'ap', 150),
]

// 当期の取引。営業による現金の動きは +2,800 −1,900 −500 −10 +5 −100 = 295
const period: JournalEntry[] = [
  entry('ar', 'sales', 3000), // 掛売上
  entry('cash', 'ar', 2800), // 売掛金の回収
  entry('inventory', 'ap', 2000), // 掛仕入
  entry('ap', 'cash', 1900), // 買掛金の支払
  entry('cogs', 'inventory', 1950), // 売上原価の計上
  entry('wages', 'cash', 500),
  entry('dep', 'accDep', 80),
  entry('badDebt', 'allowance', 6),
  entry('interest', 'cash', 10),
  entry('cash', 'interestIncome', 5),
  entry('tax', 'cash', 100),
  entry('equipment', 'cash', 300), // 設備投資（投資 CF）
  entry('cash', 'loan', 400), // 借入（財務 CF）
]

const openingStatements = buildStatements(accounts, opening)
const closingStatements = buildStatements(accounts, [...opening, ...period])
const periodIncomeStatement = buildStatements(accounts, period).incomeStatement

const statement = indirectCashFlowStatement({
  incomeStatement: periodIncomeStatement,
  openingBalanceSheet: openingStatements.balanceSheet,
  closingBalanceSheet: closingStatements.balanceSheet,
  depreciation: 80,
  investingActivities: [{ label: '有形固定資産の取得による支出', amount: -300 }],
  financingActivities: [{ label: '長期借入れによる収入', amount: 400 }],
})

const amountOf = (id: string) =>
  [...statement.operatingAdjustments, ...statement.operatingPayments].find((line) => line.id === id)
    ?.amount

describe('indirectCashFlowStatement', () => {
  it('利益からの調整項目を B/S の増減で計算する', () => {
    expect(amountOf('profitBeforeTax')).toBe(459)
    expect(amountOf('depreciation')).toBe(80)
    expect(amountOf('receivablesChange')).toBe(-200)
    expect(amountOf('inventoriesChange')).toBe(-50)
    expect(amountOf('payablesChange')).toBe(100)
    expect(statement.subtotal).toBe(400)
  })

  it('v1 の再現：貸倒引当金は増加額を 1 回だけ足す（繰入額と残高の二重計上をしない）', () => {
    expect(amountOf('allowanceIncrease')).toBe(6)
  })

  it('営業 CF が、仕訳上の営業による現金の動きと一致する', () => {
    expect(statement.operatingCashFlow).toBe(295)
  })

  it('投資 CF・財務 CF を足した増減が、B/S の現金の増減と一致する', () => {
    expect(statement.investingCashFlow).toBe(-300)
    expect(statement.financingCashFlow).toBe(400)
    expect(statement.netChangeInCash).toBe(395)
    expect(statement.balanceSheetCashChange).toBe(395)
    expect(statement.reconciles).toBe(true)
  })

  it('固定資産売却益は差し引き、売却損は足し戻す', () => {
    const base = {
      incomeStatement: periodIncomeStatement,
      openingBalanceSheet: openingStatements.balanceSheet,
      closingBalanceSheet: closingStatements.balanceSheet,
      depreciation: 80,
    }
    const withGain = indirectCashFlowStatement({ ...base, gainOnSaleOfFixedAssets: 30 })
    const withLoss = indirectCashFlowStatement({ ...base, gainOnSaleOfFixedAssets: -30 })
    expect(withGain.subtotal).toBe(statement.subtotal - 30)
    expect(withLoss.subtotal).toBe(statement.subtotal + 30)
  })

  it('受払額を指定すると、P/L の額の代わりに使う', () => {
    const custom = indirectCashFlowStatement({
      incomeStatement: periodIncomeStatement,
      openingBalanceSheet: openingStatements.balanceSheet,
      closingBalanceSheet: closingStatements.balanceSheet,
      depreciation: 80,
      incomeTaxesPaid: 70,
    })
    expect(custom.operatingCashFlow).toBe(statement.operatingCashFlow + 30)
  })
})
