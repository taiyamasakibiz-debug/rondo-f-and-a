import { describe, expect, it } from 'vitest'
import { balanceSheetTotals, incomeStatementProfits } from '../statements'
import { suggestCategory } from './categories'
import {
  type Account,
  type JournalEntry,
  buildStatements,
  computeBalances,
  createClosingEntry,
  validateEntry,
} from './ledger'

const accounts: Account[] = [
  { id: 'cash', name: '現金', category: 'cash' },
  { id: 'ar', name: '売掛金', category: 'receivable' },
  { id: 'allowance', name: '貸倒引当金', category: 'allowance' },
  { id: 'supplies', name: '消耗品', category: 'otherCurrentAsset' },
  { id: 'equipment', name: '備品', category: 'tangibleFixedAsset' },
  { id: 'accDep', name: '減価償却累計額', category: 'accumulatedDepreciation' },
  { id: 'taxPayable', name: '未払法人税等', category: 'otherCurrentLiability' },
  { id: 'wagesPayable', name: '未払給料', category: 'otherCurrentLiability' },
  { id: 'capital', name: '資本金', category: 'capitalStock' },
  { id: 're', name: '利益剰余金', category: 'retainedEarnings' },
  { id: 'sales', name: '売上高', category: 'sales' },
  { id: 'fee', name: '受取手数料', category: 'otherNonOperatingIncome' },
  { id: 'cogs', name: '売上原価', category: 'costOfSales' },
  { id: 'officer', name: '役員報酬', category: 'sga' },
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

describe('validateEntry', () => {
  it('貸借が一致した仕訳はエラーなし', () => {
    expect(validateEntry(entry('cash', 'capital', 1000), accounts)).toEqual([])
  })

  it('貸借の不一致を検出する', () => {
    const e: JournalEntry = {
      id: 'x',
      description: '',
      debits: [{ accountId: 'cash', amount: 1000 }],
      credits: [{ accountId: 'capital', amount: 900 }],
    }
    expect(validateEntry(e, accounts)).toContainEqual({
      kind: 'unbalanced',
      debitTotal: 1000,
      creditTotal: 900,
    })
  })

  it('明細がない仕訳、存在しない科目、0 以下や小数の金額を検出する', () => {
    const empty: JournalEntry = { id: 'x', description: '説明だけ', debits: [], credits: [] }
    expect(validateEntry(empty, accounts)).toContainEqual({ kind: 'noLines' })

    const bad: JournalEntry = {
      id: 'y',
      description: '',
      debits: [{ accountId: 'ghost', amount: 0 }],
      credits: [{ accountId: 'cash', amount: 1.5 }],
    }
    const errors = validateEntry(bad, accounts)
    expect(errors).toContainEqual({ kind: 'unknownAccount', accountId: 'ghost' })
    expect(errors).toContainEqual({ kind: 'invalidAmount', accountId: 'ghost' })
    expect(errors).toContainEqual({ kind: 'invalidAmount', accountId: 'cash' })
  })
})

describe('buildStatements', () => {
  // v1 の再現ケース：v1 は当期純利益を 900、B/S を不均衡と表示していた
  it('v1 の再現：売上原価・役員報酬を正しく費用として集計する', () => {
    const entries = [
      entry('cash', 'capital', 1000),
      entry('cash', 'sales', 500),
      entry('cogs', 'cash', 300),
      entry('officer', 'cash', 100),
    ]
    const { incomeStatement, balanceSheet, isBalanced } = buildStatements(accounts, entries)
    const profits = incomeStatementProfits(incomeStatement)

    expect(incomeStatement.sales).toBe(500)
    expect(incomeStatement.costOfSales).toBe(300)
    expect(incomeStatement.sellingGeneralAndAdministrativeExpenses).toBe(100)
    expect(profits.netIncome).toBe(100)
    expect(isBalanced).toBe(true)
    expect(balanceSheetTotals(balanceSheet).totalAssets).toBe(1100)
  })

  it('v1 の再現：資産・負債の科目が名前につられて損益に入らない', () => {
    const entries = [
      entry('cash', 'capital', 1000),
      entry('supplies', 'cash', 50), // 消耗品（資産）
      entry('tax', 'taxPayable', 30), // 未払法人税等（負債）
      entry('wages', 'wagesPayable', 20), // 未払給料（負債）
      entry('cash', 'fee', 40), // 受取手数料（収益）
    ]
    const { incomeStatement, balanceSheet, isBalanced } = buildStatements(accounts, entries)
    const profits = incomeStatementProfits(incomeStatement)

    expect(incomeStatement.incomeTaxes).toBe(30) // 法人税等の 30 だけ（未払の 30 を足さない）
    expect(incomeStatement.sellingGeneralAndAdministrativeExpenses).toBe(20) // 給料だけ
    expect(incomeStatement.nonOperatingIncome).toBe(40)
    expect(profits.netIncome).toBe(40 - 20 - 30)
    expect(balanceSheet.otherCurrentAssets).toBe(50)
    expect(balanceSheet.otherCurrentLiabilities).toBe(50)
    expect(isBalanced).toBe(true)
  })

  it('控除科目は資産からマイナスする', () => {
    const entries = [
      entry('cash', 'capital', 1000),
      entry('equipment', 'cash', 600),
      entry('dep', 'accDep', 100),
      entry('ar', 'sales', 400),
      entry('badDebt', 'allowance', 8),
    ]
    const { balanceSheet, isBalanced } = buildStatements(accounts, entries)
    expect(balanceSheet.tangibleFixedAssets).toBe(500)
    expect(balanceSheet.allowanceForDoubtfulAccounts).toBe(-8)
    expect(balanceSheetTotals(balanceSheet).quickAssets).toBe(400 + 400 - 8)
    expect(isBalanced).toBe(true)
  })

  it('支払利息は営業外費用とその内訳の両方に集計する', () => {
    const { incomeStatement } = buildStatements(accounts, [entry('interest', 'cash', 12)])
    expect(incomeStatement.nonOperatingExpenses).toBe(12)
    expect(incomeStatement.interestExpense).toBe(12)
  })

  it('複数行の仕訳を集計する', () => {
    const compound: JournalEntry = {
      id: 'c',
      description: '掛けと現金での売上',
      debits: [
        { accountId: 'cash', amount: 300 },
        { accountId: 'ar', amount: 700 },
      ],
      credits: [{ accountId: 'sales', amount: 1000 }],
    }
    const balances = computeBalances(accounts, [compound])
    expect(balances.get('cash')).toBe(300)
    expect(balances.get('ar')).toBe(700)
    expect(balances.get('sales')).toBe(1000)
  })
})

describe('createClosingEntry', () => {
  it('収益・費用をゼロにして当期純利益を利益剰余金へ振り替える', () => {
    const entries = [
      entry('cash', 'capital', 1000),
      entry('cash', 'sales', 500),
      entry('cogs', 'cash', 300),
      entry('officer', 'cash', 100),
    ]
    const result = createClosingEntry(accounts, entries, 'close')
    if (!result.ok) throw new Error(result.reason)

    const after = [...entries, result.entry]
    const balances = computeBalances(accounts, after)
    expect(balances.get('sales')).toBe(0)
    expect(balances.get('cogs')).toBe(0)
    expect(balances.get('officer')).toBe(0)
    expect(balances.get('re')).toBe(100)
    expect(validateEntry(result.entry, accounts)).toEqual([])
    expect(buildStatements(accounts, after).isBalanced).toBe(true)
  })

  it('損失のときは利益剰余金を借方にする', () => {
    const entries = [entry('cash', 'capital', 1000), entry('officer', 'cash', 100)]
    const result = createClosingEntry(accounts, entries, 'close')
    if (!result.ok) throw new Error(result.reason)
    expect(result.entry.debits).toContainEqual({ accountId: 're', amount: 100 })
  })

  it('利益剰余金の科目がなければ失敗する', () => {
    const withoutRe = accounts.filter((account) => account.category !== 'retainedEarnings')
    expect(createClosingEntry(withoutRe, [entry('cash', 'sales', 1)], 'close')).toEqual({
      ok: false,
      reason: 'missingRetainedEarnings',
    })
  })

  it('振り替える残高がなければ失敗する', () => {
    expect(createClosingEntry(accounts, [entry('cash', 'capital', 1)], 'close')).toEqual({
      ok: false,
      reason: 'nothingToClose',
    })
  })
})

describe('suggestCategory', () => {
  it.each([
    ['売上原価', 'costOfSales'],
    ['役員報酬', undefined], // 推測できないものは提案しない（v1 は「売上」と判定していた）
    ['受取手数料', undefined],
    ['消耗品', undefined],
    ['原材料', 'inventory'],
    ['未払法人税等', 'otherCurrentLiability'],
    ['未払給料', 'otherCurrentLiability'],
    ['前払家賃', 'otherCurrentAsset'],
    ['貸倒引当金', 'allowance'],
    ['貸倒引当金繰入', 'sga'],
    ['減価償却累計額', 'accumulatedDepreciation'],
    ['固定資産売却益', 'extraordinaryIncome'],
    ['売上高', 'sales'],
  ] as const)('%s → %s', (name, expected) => {
    expect(suggestCategory(name)).toBe(expected)
  })
})
