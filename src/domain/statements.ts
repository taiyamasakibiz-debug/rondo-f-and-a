/**
 * 財務諸表の形。仕訳から組み立てたものも、問題で与えられるものも、この形にそろえる。
 * 金額の単位は問わない（円でも千円でもよい）が、1 つの財務諸表の中ではそろえる。
 */

/** 貸借対照表（B/S）。内訳の値は、控除項目（貸倒引当金など）をマイナスで持つ */
export type BalanceSheet = {
  // 流動資産
  cashAndDeposits: number // 現金預金
  receivables: number // 売上債権（受取手形・売掛金）
  allowanceForDoubtfulAccounts: number // 貸倒引当金（マイナスの値）
  securities: number // 有価証券
  inventories: number // 棚卸資産
  otherCurrentAssets: number
  // 固定資産
  tangibleFixedAssets: number // 有形固定資産（減価償却累計額を差し引いた額）
  intangibleFixedAssets: number
  investmentsAndOtherAssets: number
  deferredAssets: number // 繰延資産
  // 流動負債
  payables: number // 仕入債務（支払手形・買掛金）
  shortTermBorrowings: number
  otherCurrentLiabilities: number
  // 固定負債
  longTermBorrowings: number
  otherFixedLiabilities: number
  // 純資産
  capitalStock: number
  capitalSurplus: number
  retainedEarnings: number
  otherNetAssets: number
}

export type BalanceSheetTotals = {
  currentAssets: number
  quickAssets: number // 当座資産：現金預金 + 売上債権（引当金控除後）+ 有価証券
  fixedAssets: number
  totalAssets: number
  currentLiabilities: number
  fixedLiabilities: number
  totalLiabilities: number
  netAssets: number
  totalLiabilitiesAndNetAssets: number
}

export function emptyBalanceSheet(): BalanceSheet {
  return {
    cashAndDeposits: 0,
    receivables: 0,
    allowanceForDoubtfulAccounts: 0,
    securities: 0,
    inventories: 0,
    otherCurrentAssets: 0,
    tangibleFixedAssets: 0,
    intangibleFixedAssets: 0,
    investmentsAndOtherAssets: 0,
    deferredAssets: 0,
    payables: 0,
    shortTermBorrowings: 0,
    otherCurrentLiabilities: 0,
    longTermBorrowings: 0,
    otherFixedLiabilities: 0,
    capitalStock: 0,
    capitalSurplus: 0,
    retainedEarnings: 0,
    otherNetAssets: 0,
  }
}

export function balanceSheetTotals(bs: BalanceSheet): BalanceSheetTotals {
  const quickAssets =
    bs.cashAndDeposits + bs.receivables + bs.allowanceForDoubtfulAccounts + bs.securities
  const currentAssets = quickAssets + bs.inventories + bs.otherCurrentAssets
  const fixedAssets =
    bs.tangibleFixedAssets + bs.intangibleFixedAssets + bs.investmentsAndOtherAssets
  const totalAssets = currentAssets + fixedAssets + bs.deferredAssets
  const currentLiabilities = bs.payables + bs.shortTermBorrowings + bs.otherCurrentLiabilities
  const fixedLiabilities = bs.longTermBorrowings + bs.otherFixedLiabilities
  const totalLiabilities = currentLiabilities + fixedLiabilities
  const netAssets = bs.capitalStock + bs.capitalSurplus + bs.retainedEarnings + bs.otherNetAssets
  return {
    currentAssets,
    quickAssets,
    fixedAssets,
    totalAssets,
    currentLiabilities,
    fixedLiabilities,
    totalLiabilities,
    netAssets,
    totalLiabilitiesAndNetAssets: totalLiabilities + netAssets,
  }
}

/** 損益計算書（P/L）の元になる項目。段階利益は incomeStatementProfits で出す */
export type IncomeStatement = {
  sales: number // 売上高
  costOfSales: number // 売上原価
  sellingGeneralAndAdministrativeExpenses: number // 販売費及び一般管理費
  nonOperatingIncome: number // 営業外収益（受取利息・配当金を含む）
  interestAndDividendIncome: number // うち受取利息・配当金
  nonOperatingExpenses: number // 営業外費用（支払利息を含む）
  interestExpense: number // うち支払利息
  extraordinaryIncome: number // 特別利益
  extraordinaryLosses: number // 特別損失
  incomeTaxes: number // 法人税等
}

export type IncomeStatementProfits = {
  grossProfit: number // 売上総利益
  operatingProfit: number // 営業利益
  ordinaryProfit: number // 経常利益
  profitBeforeTax: number // 税引前当期純利益
  netIncome: number // 当期純利益
}

export function emptyIncomeStatement(): IncomeStatement {
  return {
    sales: 0,
    costOfSales: 0,
    sellingGeneralAndAdministrativeExpenses: 0,
    nonOperatingIncome: 0,
    interestAndDividendIncome: 0,
    nonOperatingExpenses: 0,
    interestExpense: 0,
    extraordinaryIncome: 0,
    extraordinaryLosses: 0,
    incomeTaxes: 0,
  }
}

export function incomeStatementProfits(pl: IncomeStatement): IncomeStatementProfits {
  const grossProfit = pl.sales - pl.costOfSales
  const operatingProfit = grossProfit - pl.sellingGeneralAndAdministrativeExpenses
  const ordinaryProfit = operatingProfit + pl.nonOperatingIncome - pl.nonOperatingExpenses
  const profitBeforeTax = ordinaryProfit + pl.extraordinaryIncome - pl.extraordinaryLosses
  return {
    grossProfit,
    operatingProfit,
    ordinaryProfit,
    profitBeforeTax,
    netIncome: profitBeforeTax - pl.incomeTaxes,
  }
}
