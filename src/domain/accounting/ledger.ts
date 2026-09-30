import {
  type BalanceSheet,
  type IncomeStatement,
  balanceSheetTotals,
  emptyBalanceSheet,
  emptyIncomeStatement,
  incomeStatementProfits,
} from '../statements'
import { type Category, categoryDefinition, isDebitNormal } from './categories'

export type Account = {
  id: string
  name: string
  category: Category
}

export type EntryLine = {
  accountId: string
  amount: number
}

export type JournalEntry = {
  id: string
  description: string
  debits: EntryLine[]
  credits: EntryLine[]
}

export type EntryError =
  | { kind: 'noLines' }
  | { kind: 'invalidAmount'; accountId: string }
  | { kind: 'unknownAccount'; accountId: string }
  | { kind: 'unbalanced'; debitTotal: number; creditTotal: number }

/** 金額は正の整数（円）。単位を千円で扱う場合も整数にそろえる */
function isValidAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0
}

export function validateEntry(entry: JournalEntry, accounts: readonly Account[]): EntryError[] {
  const errors: EntryError[] = []
  if (entry.debits.length === 0 || entry.credits.length === 0) errors.push({ kind: 'noLines' })

  const accountIds = new Set(accounts.map((account) => account.id))
  for (const line of [...entry.debits, ...entry.credits]) {
    if (!accountIds.has(line.accountId)) {
      errors.push({ kind: 'unknownAccount', accountId: line.accountId })
    }
    if (!isValidAmount(line.amount))
      errors.push({ kind: 'invalidAmount', accountId: line.accountId })
  }

  const debitTotal = sum(entry.debits.map((line) => line.amount))
  const creditTotal = sum(entry.credits.map((line) => line.amount))
  if (debitTotal !== creditTotal) errors.push({ kind: 'unbalanced', debitTotal, creditTotal })
  return errors
}

/**
 * 科目ごとの残高。大区分の通常の側をプラスにする
 * （資産・費用は借方残、負債・純資産・収益は貸方残がプラス）。
 * 控除科目（貸倒引当金・減価償却累計額）は資産なので、残高はマイナスになる。
 */
export function computeBalances(
  accounts: readonly Account[],
  entries: readonly JournalEntry[],
): Map<string, number> {
  const debitMinusCredit = new Map<string, number>(accounts.map((account) => [account.id, 0]))
  for (const entry of entries) {
    for (const line of entry.debits) add(debitMinusCredit, line.accountId, line.amount)
    for (const line of entry.credits) add(debitMinusCredit, line.accountId, -line.amount)
  }

  const balances = new Map<string, number>()
  for (const account of accounts) {
    const raw = debitMinusCredit.get(account.id) ?? 0
    const { major } = categoryDefinition(account.category)
    balances.set(account.id, normalize(isDebitNormal(major) ? raw : -raw))
  }
  return balances
}

export type Statements = {
  balanceSheet: BalanceSheet
  incomeStatement: IncomeStatement
  /** 貸借が一致しているか（仕訳がすべて貸借一致なら必ず true になる） */
  isBalanced: boolean
}

/**
 * 仕訳から B/S と P/L を組み立てる。
 * 決算振替の前でも B/S が一致するように、当期純利益を利益剰余金に足して表示する。
 */
export function buildStatements(
  accounts: readonly Account[],
  entries: readonly JournalEntry[],
): Statements {
  const balances = computeBalances(accounts, entries)
  const balanceSheet = emptyBalanceSheet()
  const incomeStatement = emptyIncomeStatement()

  for (const account of accounts) {
    const balance = balances.get(account.id) ?? 0
    const definition = categoryDefinition(account.category)
    if ('balanceSheetField' in definition && definition.balanceSheetField) {
      balanceSheet[definition.balanceSheetField] += balance
    }
    if ('incomeStatementField' in definition && definition.incomeStatementField) {
      incomeStatement[definition.incomeStatementField] += balance
    }
    if ('incomeStatementDetailField' in definition && definition.incomeStatementDetailField) {
      incomeStatement[definition.incomeStatementDetailField] += balance
    }
  }

  balanceSheet.retainedEarnings += incomeStatementProfits(incomeStatement).netIncome
  const totals = balanceSheetTotals(balanceSheet)
  return {
    balanceSheet,
    incomeStatement,
    isBalanced: totals.totalAssets === totals.totalLiabilitiesAndNetAssets,
  }
}

export type ClosingResult =
  | { ok: true; entry: JournalEntry }
  | { ok: false; reason: 'missingRetainedEarnings' | 'nothingToClose' }

/**
 * 決算振替仕訳。収益・費用の残高をゼロにして、差額（当期純利益）を利益剰余金へ振り替える。
 */
export function createClosingEntry(
  accounts: readonly Account[],
  entries: readonly JournalEntry[],
  id: string,
): ClosingResult {
  const retainedEarnings = accounts.find((account) => account.category === 'retainedEarnings')
  if (!retainedEarnings) return { ok: false, reason: 'missingRetainedEarnings' }

  const balances = computeBalances(accounts, entries)
  const debits: EntryLine[] = []
  const credits: EntryLine[] = []
  for (const account of accounts) {
    const balance = balances.get(account.id) ?? 0
    if (balance === 0) continue
    const { major } = categoryDefinition(account.category)
    // 収益は貸方残なので借方で、費用は借方残なので貸方で消す（残高がマイナスなら逆側）
    if (major === 'revenue') pushLine(balance > 0 ? debits : credits, account.id, balance)
    if (major === 'expense') pushLine(balance > 0 ? credits : debits, account.id, balance)
  }
  if (debits.length === 0 && credits.length === 0) return { ok: false, reason: 'nothingToClose' }

  const netIncome = sum(debits.map((line) => line.amount)) - sum(credits.map((line) => line.amount))
  if (netIncome > 0) credits.push({ accountId: retainedEarnings.id, amount: netIncome })
  if (netIncome < 0) debits.push({ accountId: retainedEarnings.id, amount: -netIncome })

  return { ok: true, entry: { id, description: '決算振替', debits, credits } }
}

function pushLine(lines: EntryLine[], accountId: string, balance: number) {
  lines.push({ accountId, amount: Math.abs(balance) })
}

function add(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount)
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function normalize(value: number): number {
  return value === 0 ? 0 : value
}
