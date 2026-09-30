import { type BalanceSheet, type IncomeStatement, incomeStatementProfits } from '../statements'

export type CashFlowItem = {
  label: string
  /** 現金が増える向きをプラスにした金額 */
  amount: number
}

export type OperatingLineId =
  | 'profitBeforeTax'
  | 'depreciation'
  | 'allowanceIncrease'
  | 'interestAndDividendIncome'
  | 'interestExpense'
  | 'gainOnSaleOfFixedAssets'
  | 'receivablesChange'
  | 'inventoriesChange'
  | 'payablesChange'
  | 'interestAndDividendsReceived'
  | 'interestPaid'
  | 'incomeTaxesPaid'

export type OperatingLine = {
  id: OperatingLineId
  label: string
  amount: number
}

export type IndirectCashFlowInput = {
  incomeStatement: IncomeStatement
  /** 期首（前期末）の B/S */
  openingBalanceSheet: BalanceSheet
  /** 期末の B/S */
  closingBalanceSheet: BalanceSheet
  /** 減価償却費（P/L の費用に含まれている額） */
  depreciation: number
  /** 固定資産売却損益。益はプラス、損はマイナス。P/L の損益に含まれている前提 */
  gainOnSaleOfFixedAssets?: number
  /** 利息及び配当金の受取額。省略すると P/L の受取利息・配当金と同じとみなす */
  interestAndDividendsReceived?: number
  /** 利息の支払額。省略すると P/L の支払利息と同じとみなす */
  interestPaid?: number
  /** 法人税等の支払額。省略すると P/L の法人税等と同じとみなす */
  incomeTaxesPaid?: number
  investingActivities?: readonly CashFlowItem[]
  financingActivities?: readonly CashFlowItem[]
}

export type CashFlowStatement = {
  /** 小計より上の行（利益からの調整） */
  operatingAdjustments: OperatingLine[]
  subtotal: number
  /** 小計より下の行（利息・法人税等の実際の受払い） */
  operatingPayments: OperatingLine[]
  operatingCashFlow: number
  investingCashFlow: number
  financingCashFlow: number
  /** 現金及び現金同等物の増減額 */
  netChangeInCash: number
  /** B/S の現金預金の増減。netChangeInCash と一致すれば計算書が正しく組めている */
  balanceSheetCashChange: number
  reconciles: boolean
}

/**
 * 間接法のキャッシュフロー計算書。
 * 運転資本や引当金は B/S の「増減」から計算する（v1 は残高を使っていたため、
 * 貸倒引当金が繰入額と残高の両方で二重に足されていた）。
 */
export function indirectCashFlowStatement(input: IndirectCashFlowInput): CashFlowStatement {
  const { incomeStatement: pl, openingBalanceSheet: open, closingBalanceSheet: close } = input
  const gainOnSale = input.gainOnSaleOfFixedAssets ?? 0

  const operatingAdjustments: OperatingLine[] = [
    {
      id: 'profitBeforeTax',
      label: '税引前当期純利益',
      amount: incomeStatementProfits(pl).profitBeforeTax,
    },
    { id: 'depreciation', label: '減価償却費', amount: input.depreciation },
    {
      id: 'allowanceIncrease',
      label: '貸倒引当金の増減額',
      // 引当金はマイナスで持っているので、残高（絶対値）の増加は期首 − 期末
      amount: open.allowanceForDoubtfulAccounts - close.allowanceForDoubtfulAccounts,
    },
    {
      id: 'interestAndDividendIncome',
      label: '受取利息及び受取配当金',
      amount: -pl.interestAndDividendIncome,
    },
    { id: 'interestExpense', label: '支払利息', amount: pl.interestExpense },
    { id: 'gainOnSaleOfFixedAssets', label: '固定資産売却損益', amount: -gainOnSale },
    {
      id: 'receivablesChange',
      label: '売上債権の増減額',
      amount: -(close.receivables - open.receivables),
    },
    {
      id: 'inventoriesChange',
      label: '棚卸資産の増減額',
      amount: -(close.inventories - open.inventories),
    },
    { id: 'payablesChange', label: '仕入債務の増減額', amount: close.payables - open.payables },
  ]
  const subtotal = sum(operatingAdjustments)

  const operatingPayments: OperatingLine[] = [
    {
      id: 'interestAndDividendsReceived',
      label: '利息及び配当金の受取額',
      amount: input.interestAndDividendsReceived ?? pl.interestAndDividendIncome,
    },
    {
      id: 'interestPaid',
      label: '利息の支払額',
      amount: -(input.interestPaid ?? pl.interestExpense),
    },
    {
      id: 'incomeTaxesPaid',
      label: '法人税等の支払額',
      amount: -(input.incomeTaxesPaid ?? pl.incomeTaxes),
    },
  ]
  const operatingCashFlow = subtotal + sum(operatingPayments)
  const investingCashFlow = sum(input.investingActivities ?? [])
  const financingCashFlow = sum(input.financingActivities ?? [])
  const netChangeInCash = operatingCashFlow + investingCashFlow + financingCashFlow
  const balanceSheetCashChange = close.cashAndDeposits - open.cashAndDeposits

  return {
    operatingAdjustments,
    subtotal,
    operatingPayments,
    operatingCashFlow,
    investingCashFlow,
    financingCashFlow,
    netChangeInCash,
    balanceSheetCashChange,
    reconciles: netChangeInCash === balanceSheetCashChange,
  }
}

function sum(items: readonly { amount: number }[]): number {
  return items.reduce((total, item) => total + item.amount, 0)
}
