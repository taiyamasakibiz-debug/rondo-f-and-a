import type { BalanceSheet, IncomeStatement } from '../statements'

/** 大区分 */
export type MajorCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

type CategoryDefinition = {
  label: string
  major: MajorCategory
  /** B/S のどの項目に集計するか */
  balanceSheetField?: keyof BalanceSheet
  /** P/L のどの項目に集計するか */
  incomeStatementField?: keyof IncomeStatement
  /** P/L で、上の項目に加えて内訳としても集計する項目 */
  incomeStatementDetailField?: keyof IncomeStatement
}

/**
 * 小区分。科目を作るときに必ずどれかを選ぶ（docs/DESIGN.md §9.4）。
 * v1 は科目名のキーワードから区分を推測していたため、「売上原価」が売上に、
 * 「未払法人税等」が法人税に集計されるなどの誤りが起きた。
 */
export const CATEGORIES = {
  // 資産
  cash: { label: '現金預金', major: 'asset', balanceSheetField: 'cashAndDeposits' },
  receivable: { label: '売上債権', major: 'asset', balanceSheetField: 'receivables' },
  allowance: {
    label: '貸倒引当金（資産の控除）',
    major: 'asset',
    balanceSheetField: 'allowanceForDoubtfulAccounts',
  },
  securities: { label: '有価証券', major: 'asset', balanceSheetField: 'securities' },
  inventory: { label: '棚卸資産', major: 'asset', balanceSheetField: 'inventories' },
  otherCurrentAsset: {
    label: 'その他の流動資産',
    major: 'asset',
    balanceSheetField: 'otherCurrentAssets',
  },
  tangibleFixedAsset: {
    label: '有形固定資産',
    major: 'asset',
    balanceSheetField: 'tangibleFixedAssets',
  },
  accumulatedDepreciation: {
    label: '減価償却累計額（資産の控除）',
    major: 'asset',
    balanceSheetField: 'tangibleFixedAssets',
  },
  intangibleFixedAsset: {
    label: '無形固定資産',
    major: 'asset',
    balanceSheetField: 'intangibleFixedAssets',
  },
  investmentAsset: {
    label: '投資その他の資産',
    major: 'asset',
    balanceSheetField: 'investmentsAndOtherAssets',
  },
  deferredAsset: { label: '繰延資産', major: 'asset', balanceSheetField: 'deferredAssets' },

  // 負債
  payable: { label: '仕入債務', major: 'liability', balanceSheetField: 'payables' },
  shortTermBorrowing: {
    label: '短期借入金',
    major: 'liability',
    balanceSheetField: 'shortTermBorrowings',
  },
  otherCurrentLiability: {
    label: 'その他の流動負債',
    major: 'liability',
    balanceSheetField: 'otherCurrentLiabilities',
  },
  longTermBorrowing: {
    label: '長期借入金',
    major: 'liability',
    balanceSheetField: 'longTermBorrowings',
  },
  otherFixedLiability: {
    label: 'その他の固定負債',
    major: 'liability',
    balanceSheetField: 'otherFixedLiabilities',
  },

  // 純資産
  capitalStock: { label: '資本金', major: 'equity', balanceSheetField: 'capitalStock' },
  capitalSurplus: { label: '資本剰余金', major: 'equity', balanceSheetField: 'capitalSurplus' },
  retainedEarnings: {
    label: '利益剰余金',
    major: 'equity',
    balanceSheetField: 'retainedEarnings',
  },
  otherEquity: { label: 'その他の純資産', major: 'equity', balanceSheetField: 'otherNetAssets' },

  // 収益
  sales: { label: '売上高', major: 'revenue', incomeStatementField: 'sales' },
  interestAndDividendIncome: {
    label: '受取利息・配当金',
    major: 'revenue',
    incomeStatementField: 'nonOperatingIncome',
    incomeStatementDetailField: 'interestAndDividendIncome',
  },
  otherNonOperatingIncome: {
    label: 'その他の営業外収益',
    major: 'revenue',
    incomeStatementField: 'nonOperatingIncome',
  },
  extraordinaryIncome: {
    label: '特別利益',
    major: 'revenue',
    incomeStatementField: 'extraordinaryIncome',
  },

  // 費用
  costOfSales: { label: '売上原価', major: 'expense', incomeStatementField: 'costOfSales' },
  sga: {
    label: '販売費及び一般管理費',
    major: 'expense',
    incomeStatementField: 'sellingGeneralAndAdministrativeExpenses',
  },
  interestExpense: {
    label: '支払利息',
    major: 'expense',
    incomeStatementField: 'nonOperatingExpenses',
    incomeStatementDetailField: 'interestExpense',
  },
  otherNonOperatingExpense: {
    label: 'その他の営業外費用',
    major: 'expense',
    incomeStatementField: 'nonOperatingExpenses',
  },
  extraordinaryLoss: {
    label: '特別損失',
    major: 'expense',
    incomeStatementField: 'extraordinaryLosses',
  },
  incomeTax: { label: '法人税等', major: 'expense', incomeStatementField: 'incomeTaxes' },
} as const satisfies Record<string, CategoryDefinition>

export type Category = keyof typeof CATEGORIES

export function categoryDefinition(category: Category): CategoryDefinition {
  return CATEGORIES[category]
}

export const MAJOR_CATEGORY_LABELS: Record<MajorCategory, string> = {
  asset: '資産',
  liability: '負債',
  equity: '純資産',
  revenue: '収益',
  expense: '費用',
}

/** 借方に残高が出るのが通常の大区分 */
export function isDebitNormal(major: MajorCategory): boolean {
  return major === 'asset' || major === 'expense'
}

/**
 * 科目名から小区分の「初期値」を提案する。あくまで提案で、確定はユーザーが選ぶ。
 * より具体的なキーワードから順に調べる（「売上原価」を「売上」より先に、など）。
 */
const SUGGESTIONS: readonly [keyword: string, category: Category][] = [
  // 控除科目・誤解しやすい複合語を先に
  ['貸倒引当金繰入', 'sga'],
  ['貸倒引当金', 'allowance'],
  ['減価償却累計額', 'accumulatedDepreciation'],
  ['減価償却費', 'sga'],
  ['売上原価', 'costOfSales'],
  ['売上債権', 'receivable'],
  ['未払法人税', 'otherCurrentLiability'],
  ['法人税', 'incomeTax'],
  ['売却益', 'extraordinaryIncome'],
  ['売却損', 'extraordinaryLoss'],
  ['受取利息', 'interestAndDividendIncome'],
  ['受取配当', 'interestAndDividendIncome'],
  ['支払利息', 'interestExpense'],
  ['短期借入', 'shortTermBorrowing'],
  ['長期借入', 'longTermBorrowing'],
  ['利益剰余金', 'retainedEarnings'],
  ['繰越利益', 'retainedEarnings'],
  ['資本剰余金', 'capitalSurplus'],
  ['資本金', 'capitalStock'],
  // 一般的な科目
  ['現金', 'cash'],
  ['預金', 'cash'],
  ['売掛', 'receivable'],
  ['受取手形', 'receivable'],
  ['有価証券', 'securities'],
  ['商品', 'inventory'],
  ['製品', 'inventory'],
  ['仕掛品', 'inventory'],
  ['原材料', 'inventory'],
  ['貯蔵品', 'inventory'],
  ['前払', 'otherCurrentAsset'],
  ['未収', 'otherCurrentAsset'],
  ['建物', 'tangibleFixedAsset'],
  ['機械', 'tangibleFixedAsset'],
  ['車両', 'tangibleFixedAsset'],
  ['備品', 'tangibleFixedAsset'],
  ['土地', 'tangibleFixedAsset'],
  ['ソフトウェア', 'intangibleFixedAsset'],
  ['のれん', 'intangibleFixedAsset'],
  ['買掛', 'payable'],
  ['支払手形', 'payable'],
  ['未払', 'otherCurrentLiability'],
  ['前受', 'otherCurrentLiability'],
  ['預り', 'otherCurrentLiability'],
  ['社債', 'otherFixedLiability'],
  ['売上', 'sales'],
  ['仕入', 'costOfSales'],
]

export function suggestCategory(accountName: string): Category | undefined {
  return SUGGESTIONS.find(([keyword]) => accountName.includes(keyword))?.[1]
}
