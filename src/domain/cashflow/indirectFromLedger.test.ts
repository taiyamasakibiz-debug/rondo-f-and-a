import { describe, expect, it } from 'vitest'
import { type Account, type JournalEntry, createClosingEntry } from '../accounting/ledger'
import { cashFlowByActivity } from './byActivity'
import { indirectCashFlowFromLedger } from './indirectFromLedger'

const accounts: Account[] = [
  { id: 'cash', name: '現金預金', category: 'cash' },
  { id: 'ar', name: '売掛金', category: 'receivable' },
  { id: 'allowance', name: '貸倒引当金', category: 'allowance' },
  { id: 'goods', name: '商品', category: 'inventory' },
  { id: 'prepaid', name: '前払費用', category: 'otherCurrentAsset' },
  { id: 'accruedInterest', name: '未収利息', category: 'otherCurrentAsset' },
  { id: 'equipment', name: '備品', category: 'tangibleFixedAsset' },
  { id: 'accumulated', name: '減価償却累計額', category: 'accumulatedDepreciation' },
  { id: 'ap', name: '買掛金', category: 'payable' },
  { id: 'accrued', name: '未払金', category: 'otherCurrentLiability' },
  { id: 'taxPayable', name: '未払法人税等', category: 'otherCurrentLiability' },
  { id: 'loan', name: '長期借入金', category: 'longTermBorrowing' },
  { id: 'capital', name: '資本金', category: 'capitalStock' },
  { id: 'retained', name: '利益剰余金', category: 'retainedEarnings' },
  { id: 'sales', name: '売上高', category: 'sales' },
  { id: 'cogs', name: '売上原価', category: 'costOfSales' },
  { id: 'wages', name: '給料', category: 'sga' },
  { id: 'rent', name: '支払家賃', category: 'sga' },
  { id: 'depreciation', name: '減価償却費', category: 'sga' },
  { id: 'badDebt', name: '貸倒引当金繰入', category: 'sga' },
  { id: 'interestIncome', name: '受取利息', category: 'interestAndDividendIncome' },
  { id: 'interest', name: '支払利息', category: 'interestExpense' },
  { id: 'gain', name: '固定資産売却益', category: 'extraordinaryIncome' },
  { id: 'loss', name: '固定資産売却損', category: 'extraordinaryLoss' },
  { id: 'tax', name: '法人税等', category: 'incomeTax' },
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

const line = (result: ReturnType<typeof indirectCashFlowFromLedger>, id: string) =>
  [...result.adjustments, ...result.payments].find((l) => l.id === id)?.amount

/** 1 年分のよくある取引 */
const year: JournalEntry[] = [
  entry([['cash', 5000]], [['capital', 5000]]), // 出資
  entry([['cash', 2000]], [['loan', 2000]]), // 借入
  entry([['equipment', 1200]], [['cash', 1200]]), // 備品を現金で購入
  entry([['goods', 3000]], [['ap', 3000]]), // 商品を掛けで仕入れ
  entry([['ap', 2000]], [['cash', 2000]]), // 買掛金の支払い
  entry([['ar', 4000]], [['sales', 4000]]), // 掛けで販売
  entry([['cogs', 2400]], [['goods', 2400]]), // 売上原価
  entry([['cash', 3000]], [['ar', 3000]]), // 売掛金の回収
  entry([['wages', 600]], [['cash', 600]]), // 給料
  entry([['prepaid', 120]], [['cash', 120]]), // 家賃の前払い
  entry([['rent', 80]], [['prepaid', 80]]), // うち当期分
  entry([['depreciation', 200]], [['accumulated', 200]]), // 減価償却
  entry([['badDebt', 20]], [['allowance', 20]]), // 貸倒引当金の繰入
  entry([['interest', 50]], [['cash', 50]]), // 利息の支払い
  entry([['accruedInterest', 10]], [['interestIncome', 10]]), // 受取利息の見越し
  entry([['tax', 150]], [['taxPayable', 150]]), // 法人税等の計上
  entry([['taxPayable', 100]], [['cash', 100]]), // 法人税等の一部を支払い
]

describe('indirectCashFlowFromLedger', () => {
  const result = indirectCashFlowFromLedger(accounts, year)
  const direct = cashFlowByActivity(accounts, year)

  it('営業活動の合計は直接法と一致し、「その他の調整」は出ない', () => {
    expect(result.operating).toBe(direct.activities.operating.total)
    expect(result.subtotal + result.payments.reduce((s, l) => s + l.amount, 0)).toBe(
      result.operating,
    )
    expect(line(result, 'other')).toBeUndefined()
  })

  it('利益から、現金が動かない損益と運転資本の増減で調整する', () => {
    // 売上 4,000 − 原価 2,400 − 給料 600 − 家賃 80 − 償却 200 − 繰入 20 + 受取利息 10 − 支払利息 50
    expect(line(result, 'profitBeforeTax')).toBe(660)
    expect(line(result, 'depreciation')).toBe(200)
    expect(line(result, 'allowance')).toBe(20)
    expect(line(result, 'interestIncome')).toBe(-10)
    expect(line(result, 'interestExpense')).toBe(50)
    expect(line(result, 'receivables')).toBe(-1000)
    expect(line(result, 'inventories')).toBe(-600)
    expect(line(result, 'otherCurrentAssets')).toBe(-40) // 前払費用だけ（未収利息は入れない）
    expect(line(result, 'payables')).toBe(1000)
    expect(line(result, 'otherCurrentLiabilities')).toBeUndefined() // 未払法人税等は入れない
  })

  it('小計の下に、利息・法人税等の実際の受払いを並べる', () => {
    expect(line(result, 'interestReceived')).toBeUndefined() // まだ受け取っていない
    expect(line(result, 'interestPaid')).toBe(-50)
    expect(line(result, 'taxesPaid')).toBe(-100)
  })

  it('投資・財務は直接法と同じで、全体で現金の残高と一致する', () => {
    expect(result.investing.total).toBe(-1200)
    expect(result.financing.total).toBe(7000)
    expect(result.netChange).toBe(result.cashBalance)
    expect(result.reconciles).toBe(true)
  })

  it('決算振替をしても、利益は振替前と同じに数える', () => {
    const closing = createClosingEntry(accounts, year, 'closing')
    if (!closing.ok) throw new Error('決算振替を作れない')
    const closed = indirectCashFlowFromLedger(accounts, [...year, closing.entry])
    expect(closed.adjustments).toEqual(result.adjustments)
  })

  it('固定資産の売却：売却益は営業から引き、売却の収入はすべて投資に入れる', () => {
    const sale = [
      entry([['cash', 1000]], [['capital', 1000]]),
      entry([['equipment', 700]], [['cash', 700]]),
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
    ]
    const withGain = indirectCashFlowFromLedger(accounts, sale)
    expect(line(withGain, 'profitBeforeTax')).toBe(100)
    expect(line(withGain, 'gainOnSale')).toBe(-100)
    expect(withGain.operating).toBe(0)
    expect(withGain.investing.total).toBe(-700 + 500)
    expect(line(withGain, 'other')).toBeUndefined()
  })

  it('固定資産の売却損は、営業に足し戻す', () => {
    const sale = [
      entry([['cash', 1000]], [['capital', 1000]]),
      entry([['equipment', 700]], [['cash', 700]]),
      entry(
        [
          ['cash', 300],
          ['accumulated', 300],
          ['loss', 100],
        ],
        [['equipment', 700]],
      ),
    ]
    const withLoss = indirectCashFlowFromLedger(accounts, sale)
    expect(line(withLoss, 'gainOnSale')).toBe(100)
    expect(withLoss.operating).toBe(0)
    expect(withLoss.investing.total).toBe(-400)
  })

  it('非資金取引（備品を未払金で購入）で合わない分は「その他の調整」に出し、合計は合わせる', () => {
    const credit = [entry([['equipment', 500]], [['accrued', 500]])]
    const result = indirectCashFlowFromLedger(accounts, credit)
    expect(line(result, 'otherCurrentLiabilities')).toBe(500)
    expect(line(result, 'other')).toBe(-500)
    expect(result.operating).toBe(0)
  })
})
