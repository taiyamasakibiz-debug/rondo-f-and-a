import type { Category } from '../accounting/categories'
import type { Account, JournalEntry } from '../accounting/ledger'

export type Activity = 'operating' | 'investing' | 'financing'

export const ACTIVITY_LABELS: Record<Activity, string> = {
  operating: '営業活動',
  investing: '投資活動',
  financing: '財務活動',
}

/** 現金以外の科目が、どの活動のキャッシュフローになるか（区分を追加すると、ここが型エラーになる） */
const ACTIVITY_BY_CATEGORY: Record<Exclude<Category, 'cash'>, Activity> = {
  receivable: 'operating',
  allowance: 'operating',
  securities: 'investing',
  inventory: 'operating',
  otherCurrentAsset: 'operating',
  tangibleFixedAsset: 'investing',
  accumulatedDepreciation: 'investing',
  intangibleFixedAsset: 'investing',
  investmentAsset: 'investing',
  deferredAsset: 'investing',
  payable: 'operating',
  shortTermBorrowing: 'financing',
  otherCurrentLiability: 'operating',
  longTermBorrowing: 'financing',
  otherFixedLiability: 'financing',
  capitalStock: 'financing',
  capitalSurplus: 'financing',
  retainedEarnings: 'financing',
  otherEquity: 'financing',
  sales: 'operating',
  interestAndDividendIncome: 'operating',
  otherNonOperatingIncome: 'operating',
  extraordinaryIncome: 'operating',
  costOfSales: 'operating',
  sga: 'operating',
  interestExpense: 'operating',
  otherNonOperatingExpense: 'operating',
  extraordinaryLoss: 'operating',
  incomeTax: 'operating',
}

export function activityOf(category: Category): Activity | null {
  return category === 'cash' ? null : ACTIVITY_BY_CATEGORY[category]
}

export type CashFlowItem = {
  accountId: string
  accountName: string
  /** 現金が増える向きをプラスにした金額 */
  amount: number
}

export type CashFlowByActivity = {
  activities: Record<Activity, { items: CashFlowItem[]; total: number }>
  netChange: number
  /** 現金の科目の残高（期首は 0）。netChange と一致すれば、すべての現金の動きを振り分けられている */
  cashBalance: number
  reconciles: boolean
}

/**
 * 仕訳の現金の動きを、相手の科目で営業・投資・財務に振り分ける（フリーモード用）。
 * 期首の B/S がないフリーモードでは、間接法より仕訳 1 本ずつと結びつくこの形の方が確かめやすい。
 * 相手の科目が複数の活動にまたがるときは、金額の割合で按分する。
 * ただし固定資産などの売却で出た売却益・売却損は、売却の収入の一部なので投資活動に含める
 * （売却益の分だけ営業活動に入ってしまわないように）。
 */
export function cashFlowByActivity(
  accounts: readonly Account[],
  entries: readonly JournalEntry[],
): CashFlowByActivity {
  const byId = new Map(accounts.map((account) => [account.id, account]))
  const isCash = (accountId: string) => byId.get(accountId)?.category === 'cash'
  const totals = new Map<string, number>()
  let cashBalance = 0

  for (const entry of entries) {
    const cashIn =
      sum(entry.debits.filter((l) => isCash(l.accountId))) -
      sum(entry.credits.filter((l) => isCash(l.accountId)))
    cashBalance += cashIn
    if (cashIn === 0) continue

    // 現金が増えた仕訳なら貸方の、減った仕訳なら借方の、現金以外の行が相手
    const counterparts = (cashIn > 0 ? entry.credits : entry.debits).filter(
      (line) => !isCash(line.accountId) && byId.has(line.accountId),
    )
    const base = sum(counterparts)
    if (base === 0) continue
    const investingAccount = counterparts.find(
      (line) => activityOf(byId.get(line.accountId)!.category) === 'investing',
    )?.accountId
    for (const line of counterparts) {
      const share = (cashIn * line.amount) / base
      const category = byId.get(line.accountId)!.category
      const target = investingAccount && isGainOrLoss(category) ? investingAccount : line.accountId
      totals.set(target, (totals.get(target) ?? 0) + share)
    }
  }

  const activities: CashFlowByActivity['activities'] = {
    operating: { items: [], total: 0 },
    investing: { items: [], total: 0 },
    financing: { items: [], total: 0 },
  }
  for (const [accountId, amount] of totals) {
    const account = byId.get(accountId)!
    const activity = activityOf(account.category)
    if (!activity || amount === 0) continue
    activities[activity].items.push({ accountId, accountName: account.name, amount })
    activities[activity].total += amount
  }
  const netChange =
    activities.operating.total + activities.investing.total + activities.financing.total
  return {
    activities,
    netChange,
    cashBalance,
    reconciles: Math.abs(netChange - cashBalance) < 1e-6,
  }
}

function isGainOrLoss(category: Category): boolean {
  return category === 'extraordinaryIncome' || category === 'extraordinaryLoss'
}

function sum(lines: readonly { amount: number }[]): number {
  return lines.reduce((total, line) => total + line.amount, 0)
}
