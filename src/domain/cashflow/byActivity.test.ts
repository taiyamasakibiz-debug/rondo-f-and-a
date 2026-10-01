import { describe, expect, it } from 'vitest'
import type { Account, JournalEntry } from '../accounting/ledger'
import { cashFlowByActivity } from './byActivity'

const accounts: Account[] = [
  { id: 'cash', name: '現金預金', category: 'cash' },
  { id: 'ar', name: '売掛金', category: 'receivable' },
  { id: 'equipment', name: '備品', category: 'tangibleFixedAsset' },
  { id: 'loan', name: '長期借入金', category: 'longTermBorrowing' },
  { id: 'capital', name: '資本金', category: 'capitalStock' },
  { id: 'sales', name: '売上高', category: 'sales' },
  { id: 'wages', name: '給料', category: 'sga' },
  { id: 'interest', name: '支払利息', category: 'interestExpense' },
]

let nextId = 0
function entry(debits: [string, number][], credits: [string, number][]): JournalEntry {
  nextId += 1
  return {
    id: `e${nextId}`,
    description: '',
    debits: debits.map(([accountId, amount]) => ({ accountId, amount })),
    credits: credits.map(([accountId, amount]) => ({ accountId, amount })),
  }
}

describe('cashFlowByActivity', () => {
  const entries = [
    entry([['cash', 1000]], [['capital', 1000]]), // 財務 +1,000
    entry(
      [
        ['cash', 300],
        ['ar', 700],
      ],
      [['sales', 1000]],
    ), // 営業 +300（掛けの 700 は現金でない）
    entry([['cash', 500]], [['ar', 500]]), // 営業 +500（売掛金の回収）
    entry([['equipment', 600]], [['cash', 600]]), // 投資 −600
    entry([['wages', 200]], [['cash', 200]]), // 営業 −200
    entry([['cash', 800]], [['loan', 800]]), // 財務 +800
    entry(
      [
        ['loan', 400],
        ['interest', 20],
      ],
      [['cash', 420]],
    ), // 財務 −400、営業 −20
  ]
  const result = cashFlowByActivity(accounts, entries)

  it('相手の科目で営業・投資・財務に振り分ける', () => {
    expect(result.activities.operating.total).toBe(300 + 500 - 200 - 20)
    expect(result.activities.investing.total).toBe(-600)
    expect(result.activities.financing.total).toBe(1000 + 800 - 400)
  })

  it('科目ごとの内訳を持つ', () => {
    expect(result.activities.operating.items).toEqual(
      expect.arrayContaining([
        { accountId: 'sales', accountName: '売上高', amount: 300 },
        { accountId: 'ar', accountName: '売掛金', amount: 500 },
        { accountId: 'interest', accountName: '支払利息', amount: -20 },
      ]),
    )
  })

  it('振り分けた合計が現金の残高と一致する', () => {
    // 1,000 + 300 + 500 − 600 − 200 + 800 − 420
    expect(result.netChange).toBe(1380)
    expect(result.cashBalance).toBe(1380)
    expect(result.reconciles).toBe(true)
  })

  it('現金が動かない仕訳は数えない', () => {
    const none = cashFlowByActivity(accounts, [entry([['ar', 100]], [['sales', 100]])])
    expect(none.netChange).toBe(0)
    expect(none.activities.operating.items).toEqual([])
  })

  it('相手が複数の活動にまたがるときは金額の割合で按分する', () => {
    // 備品の購入と給料の支払いを、1 本の仕訳でまとめて現金で払った場合
    const mixed = cashFlowByActivity(accounts, [
      entry(
        [
          ['equipment', 750],
          ['wages', 250],
        ],
        [['cash', 1000]],
      ),
    ])
    expect(mixed.activities.investing.total).toBe(-750)
    expect(mixed.activities.operating.total).toBe(-250)
    expect(mixed.reconciles).toBe(true)
  })
})

describe('cashFlowByActivity（固定資産の売却）', () => {
  it('売却益の分も含めて、売却の収入はすべて投資活動に入れる', () => {
    const saleAccounts: Account[] = [
      ...accounts,
      { id: 'accumulated', name: '減価償却累計額', category: 'accumulatedDepreciation' },
      { id: 'gain', name: '固定資産売却益', category: 'extraordinaryIncome' },
    ]
    const result = cashFlowByActivity(saleAccounts, [
      entry(
        [
          ['cash', 500],
          ['accumulated', 300],
        ],
        [
          ['equipment', 700],
          ['gain', 100],
        ],
      ),
    ])
    expect(result.activities.investing.total).toBe(500)
    expect(result.activities.operating.total).toBe(0)
  })
})
