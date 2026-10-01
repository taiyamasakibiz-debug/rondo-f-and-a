import type { Category } from '../accounting/categories'
import { type Account, type JournalEntry, buildStatements } from '../accounting/ledger'
import { incomeStatementProfits } from '../statements'
import { type CashFlowByActivity, activityOf, cashFlowByActivity } from './byActivity'

export type IndirectLine = {
  id: string
  label: string
  /** 現金が増える向きをプラスにした金額 */
  amount: number
}

export type LedgerIndirectCashFlow = {
  /** 小計より上の行（利益からの調整）。0 円の行は省く（税引前当期純利益は必ず出す） */
  adjustments: IndirectLine[]
  subtotal: number
  /** 小計より下の行（利息・法人税等の実際の受払い） */
  payments: IndirectLine[]
  operating: number
  /** 投資・財務は直接法と同じ（現金の動きを相手の科目で振り分けたもの） */
  investing: CashFlowByActivity['activities']['investing']
  financing: CashFlowByActivity['activities']['financing']
  netChange: number
  cashBalance: number
  reconciles: boolean
}

const FIXED_ASSETS = new Set<Category>([
  'tangibleFixedAsset',
  'intangibleFixedAsset',
  'investmentAsset',
  'securities',
])
const EXPENSES = new Set<Category>([
  'costOfSales',
  'sga',
  'otherNonOperatingExpense',
  'extraordinaryLoss',
])

/**
 * フリーモードの仕訳から、間接法のキャッシュフロー計算書を作る（期首の残高は 0）。
 *
 * - 営業活動：税引前当期純利益から、現金が動かない損益（減価償却費・引当金・売却損益）と
 *   運転資本の増減で調整し、小計の下に利息・法人税等の実際の受払いを並べる
 * - 投資・財務：直接法と同じ
 *
 * 未払法人税等・未収利息・未払利息のように、利息・法人税等と一緒に使われた「その他の流動資産・負債」は
 * 運転資本の増減に入れず、小計の下の受払いの方で数える（教科書どおりの形）。
 * 非資金取引（固定資産を未払金で買うなど）で合わない分は「その他の調整」の行に出し、
 * 営業活動の合計は必ず直接法と一致させる。
 */
export function indirectCashFlowFromLedger(
  accounts: readonly Account[],
  entries: readonly JournalEntry[],
): LedgerIndirectCashFlow {
  const byId = new Map(accounts.map((account) => [account.id, account]))
  const categoryOf = (accountId: string) => byId.get(accountId)?.category
  const has = (lines: JournalEntry['debits'], test: (category: Category) => boolean) =>
    lines.some((line) => {
      const category = categoryOf(line.accountId)
      return category !== undefined && test(category)
    })

  // 決算振替は損益を利益剰余金に移すだけなので、利益の計算から外す
  const isClosing = (entry: JournalEntry) => {
    const lines = [...entry.debits, ...entry.credits]
    return (
      has(lines, (c) => c === 'retainedEarnings') &&
      lines.every((line) => {
        const category = categoryOf(line.accountId)
        if (!category || category === 'retainedEarnings') return true
        return activityOf(category) === 'operating' && isProfitOrLoss(category)
      })
    )
  }
  const operatingEntries = entries.filter((entry) => !isClosing(entry))
  const { incomeStatement: pl } = buildStatements(accounts, operatingEntries)

  // 利息・法人税等と一緒に使われた、その他の流動資産・負債（未収利息・未払利息・未払法人税等など）
  const relatedTo = new Map<string, 'interestIncome' | 'interestExpense' | 'tax'>()
  for (const entry of operatingEntries) {
    const lines = [...entry.debits, ...entry.credits]
    const kind = has(lines, (c) => c === 'incomeTax')
      ? 'tax'
      : has(lines, (c) => c === 'interestAndDividendIncome')
        ? 'interestIncome'
        : has(lines, (c) => c === 'interestExpense')
          ? 'interestExpense'
          : null
    if (!kind) continue
    for (const line of lines) {
      const category = categoryOf(line.accountId)
      if (category === 'otherCurrentAsset' || category === 'otherCurrentLiability') {
        relatedTo.set(line.accountId, kind)
      }
    }
  }

  // 科目の区分ごとの増減（借方 − 貸方。期首は 0 なので期末残高と同じ）
  const debitMinusCredit = new Map<Category, number>()
  let depreciation = 0
  let gainOnSale = 0
  for (const entry of operatingEntries) {
    for (const [lines, sign] of [
      [entry.debits, 1],
      [entry.credits, -1],
    ] as const) {
      for (const line of lines) {
        const category = categoryOf(line.accountId)
        if (!category || relatedTo.has(line.accountId)) continue
        debitMinusCredit.set(category, (debitMinusCredit.get(category) ?? 0) + sign * line.amount)
      }
    }
    // 減価償却：費用を計上して、減価償却累計額（または無形固定資産）を減らす仕訳
    if (has(entry.debits, (c) => EXPENSES.has(c))) {
      for (const line of entry.credits) {
        const category = categoryOf(line.accountId)
        if (category === 'accumulatedDepreciation' || category === 'intangibleFixedAsset') {
          if (!has(entry.debits, (c) => c === 'cash') && !has(entry.credits, (c) => c === 'cash')) {
            depreciation += line.amount
          }
        }
      }
    }
    // 固定資産などの売却・除却で出た損益
    if (has(entry.credits, (c) => FIXED_ASSETS.has(c))) {
      for (const line of entry.credits) {
        if (categoryOf(line.accountId) === 'extraordinaryIncome') gainOnSale += line.amount
      }
      for (const line of entry.debits) {
        if (categoryOf(line.accountId) === 'extraordinaryLoss') gainOnSale -= line.amount
      }
    }
  }
  const change = (category: Category) => debitMinusCredit.get(category) ?? 0

  const direct = cashFlowByActivity(accounts, entries)
  const operating = direct.activities.operating.total

  // 小計の下：利息・法人税等の実際の受払い（関係する未収・未払の科目を通したものも含める）
  const paidFor = { interestIncome: 0, interestExpense: 0, tax: 0 }
  for (const item of direct.activities.operating.items) {
    const category = categoryOf(item.accountId)
    const related = relatedTo.get(item.accountId)
    if (category === 'interestAndDividendIncome' || related === 'interestIncome') {
      paidFor.interestIncome += item.amount
    } else if (category === 'interestExpense' || related === 'interestExpense') {
      paidFor.interestExpense += item.amount
    } else if (category === 'incomeTax' || related === 'tax') {
      paidFor.tax += item.amount
    }
  }
  const payments: IndirectLine[] = [
    { id: 'interestReceived', label: '利息及び配当金の受取額', amount: paidFor.interestIncome },
    { id: 'interestPaid', label: '利息の支払額', amount: paidFor.interestExpense },
    { id: 'taxesPaid', label: '法人税等の支払額', amount: paidFor.tax },
  ].filter((line) => line.amount !== 0)

  const adjustments: IndirectLine[] = [
    {
      id: 'profitBeforeTax',
      label: '税引前当期純利益',
      amount: incomeStatementProfits(pl).profitBeforeTax,
    },
    { id: 'depreciation', label: '減価償却費', amount: depreciation },
    // 引当金は貸方に増えるので、増えた分（貸方 − 借方）だけ現金が出ていかない費用
    { id: 'allowance', label: '貸倒引当金の増減額', amount: -change('allowance') },
    {
      id: 'interestIncome',
      label: '受取利息及び受取配当金',
      amount: -pl.interestAndDividendIncome,
    },
    { id: 'interestExpense', label: '支払利息', amount: pl.interestExpense },
    { id: 'gainOnSale', label: '固定資産売却損益', amount: -gainOnSale },
    { id: 'receivables', label: '売上債権の増減額', amount: -change('receivable') },
    { id: 'inventories', label: '棚卸資産の増減額', amount: -change('inventory') },
    {
      id: 'otherCurrentAssets',
      label: 'その他の流動資産の増減額',
      amount: -change('otherCurrentAsset'),
    },
    { id: 'payables', label: '仕入債務の増減額', amount: -change('payable') },
    {
      id: 'otherCurrentLiabilities',
      label: 'その他の流動負債の増減額',
      amount: -change('otherCurrentLiability'),
    },
  ].filter((line) => line.id === 'profitBeforeTax' || line.amount !== 0)

  const listed = sum(adjustments) + sum(payments)
  const rest = operating - listed
  if (Math.abs(rest) > 1e-6) {
    adjustments.push({ id: 'other', label: 'その他の調整（非資金取引など）', amount: rest })
  }

  return {
    adjustments,
    subtotal: sum(adjustments),
    payments,
    operating,
    investing: direct.activities.investing,
    financing: direct.activities.financing,
    netChange: direct.netChange,
    cashBalance: direct.cashBalance,
    reconciles: direct.reconciles,
  }
}

function isProfitOrLoss(category: Category): boolean {
  return [
    'sales',
    'interestAndDividendIncome',
    'otherNonOperatingIncome',
    'extraordinaryIncome',
    'costOfSales',
    'sga',
    'interestExpense',
    'otherNonOperatingExpense',
    'extraordinaryLoss',
    'incomeTax',
  ].includes(category)
}

function sum(lines: readonly { amount: number }[]): number {
  return lines.reduce((total, line) => total + line.amount, 0)
}
