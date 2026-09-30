import {
  type BalanceSheet,
  type IncomeStatement,
  balanceSheetTotals,
  incomeStatementProfits,
} from '../statements'

export type IndicatorId =
  // 収益性
  | 'grossProfitMargin'
  | 'operatingProfitMargin'
  | 'ordinaryProfitMargin'
  | 'sgaRatio'
  // 効率性
  | 'totalAssetTurnover'
  | 'tangibleFixedAssetTurnover'
  | 'receivablesTurnover'
  | 'inventoryTurnover'
  // 安全性
  | 'currentRatio'
  | 'quickRatio'
  | 'equityRatio'
  | 'debtEquityRatio'
  | 'fixedRatio'
  | 'fixedLongTermSuitabilityRatio'
  | 'interestCoverageRatio'

export type IndicatorGroup = 'profitability' | 'efficiency' | 'safety'

export type IndicatorDefinition = {
  id: IndicatorId
  label: string
  group: IndicatorGroup
  unit: '%' | '回' | '倍'
  formula: string
  /** 高いほど良い指標か（販管費比率・負債比率などは低いほど良い） */
  higherIsBetter: boolean
  /** B/S の値を使うか（期首と期末の平均を使うかどうかに影響する） */
  usesBalanceSheet: boolean
}

// 並びと式は事例Ⅳでよく使われるものに合わせる。総資本 = 総資産として扱う
export const INDICATORS: readonly IndicatorDefinition[] = [
  {
    id: 'grossProfitMargin',
    label: '売上高総利益率',
    group: 'profitability',
    unit: '%',
    formula: '売上総利益 ÷ 売上高 × 100',
    higherIsBetter: true,
    usesBalanceSheet: false,
  },
  {
    id: 'operatingProfitMargin',
    label: '売上高営業利益率',
    group: 'profitability',
    unit: '%',
    formula: '営業利益 ÷ 売上高 × 100',
    higherIsBetter: true,
    usesBalanceSheet: false,
  },
  {
    id: 'ordinaryProfitMargin',
    label: '売上高経常利益率',
    group: 'profitability',
    unit: '%',
    formula: '経常利益 ÷ 売上高 × 100',
    higherIsBetter: true,
    usesBalanceSheet: false,
  },
  {
    id: 'sgaRatio',
    label: '売上高販管費比率',
    group: 'profitability',
    unit: '%',
    formula: '販売費及び一般管理費 ÷ 売上高 × 100',
    higherIsBetter: false,
    usesBalanceSheet: false,
  },
  {
    id: 'totalAssetTurnover',
    label: '総資本回転率',
    group: 'efficiency',
    unit: '回',
    formula: '売上高 ÷ 総資本',
    higherIsBetter: true,
    usesBalanceSheet: true,
  },
  {
    id: 'tangibleFixedAssetTurnover',
    label: '有形固定資産回転率',
    group: 'efficiency',
    unit: '回',
    formula: '売上高 ÷ 有形固定資産',
    higherIsBetter: true,
    usesBalanceSheet: true,
  },
  {
    id: 'receivablesTurnover',
    label: '売上債権回転率',
    group: 'efficiency',
    unit: '回',
    formula: '売上高 ÷ 売上債権',
    higherIsBetter: true,
    usesBalanceSheet: true,
  },
  {
    id: 'inventoryTurnover',
    label: '棚卸資産回転率',
    group: 'efficiency',
    unit: '回',
    formula: '売上高 ÷ 棚卸資産',
    higherIsBetter: true,
    usesBalanceSheet: true,
  },
  {
    id: 'currentRatio',
    label: '流動比率',
    group: 'safety',
    unit: '%',
    formula: '流動資産 ÷ 流動負債 × 100',
    higherIsBetter: true,
    usesBalanceSheet: true,
  },
  {
    id: 'quickRatio',
    label: '当座比率',
    group: 'safety',
    unit: '%',
    formula: '当座資産 ÷ 流動負債 × 100',
    higherIsBetter: true,
    usesBalanceSheet: true,
  },
  {
    id: 'equityRatio',
    label: '自己資本比率',
    group: 'safety',
    unit: '%',
    formula: '純資産 ÷ 総資本 × 100',
    higherIsBetter: true,
    usesBalanceSheet: true,
  },
  {
    id: 'debtEquityRatio',
    label: '負債比率',
    group: 'safety',
    unit: '%',
    formula: '負債 ÷ 純資産 × 100',
    higherIsBetter: false,
    usesBalanceSheet: true,
  },
  {
    id: 'fixedRatio',
    label: '固定比率',
    group: 'safety',
    unit: '%',
    formula: '固定資産 ÷ 純資産 × 100',
    higherIsBetter: false,
    usesBalanceSheet: true,
  },
  {
    id: 'fixedLongTermSuitabilityRatio',
    label: '固定長期適合率',
    group: 'safety',
    unit: '%',
    formula: '固定資産 ÷ (純資産 + 固定負債) × 100',
    higherIsBetter: false,
    usesBalanceSheet: true,
  },
  {
    id: 'interestCoverageRatio',
    label: 'インタレスト・カバレッジ・レシオ',
    group: 'safety',
    unit: '倍',
    formula: '(営業利益 + 受取利息・配当金) ÷ 支払利息',
    higherIsBetter: true,
    usesBalanceSheet: false,
  },
]

export const INDICATOR_GROUP_LABELS: Record<IndicatorGroup, string> = {
  profitability: '収益性',
  efficiency: '効率性',
  safety: '安全性',
}

export type AnalysisInput = {
  balanceSheet: BalanceSheet
  incomeStatement: IncomeStatement
  /** 期首（前期末）の B/S。basis が 'average' のときに使う */
  previousBalanceSheet?: BalanceSheet
  /** B/S の値に期末を使うか、期首と期末の平均を使うか。事例Ⅳは期末が多い */
  basis?: 'end' | 'average'
}

/** 分母が 0 などで計算できない指標は null */
export type IndicatorValues = Record<IndicatorId, number | null>

export function computeIndicators(input: AnalysisInput): IndicatorValues {
  const { incomeStatement: pl } = input
  const bs = balanceSheetBasis(input)
  const t = balanceSheetTotals(bs)
  const profits = incomeStatementProfits(pl)

  return {
    grossProfitMargin: percent(profits.grossProfit, pl.sales),
    operatingProfitMargin: percent(profits.operatingProfit, pl.sales),
    ordinaryProfitMargin: percent(profits.ordinaryProfit, pl.sales),
    sgaRatio: percent(pl.sellingGeneralAndAdministrativeExpenses, pl.sales),
    totalAssetTurnover: divide(pl.sales, t.totalAssets),
    tangibleFixedAssetTurnover: divide(pl.sales, bs.tangibleFixedAssets),
    receivablesTurnover: divide(pl.sales, bs.receivables),
    inventoryTurnover: divide(pl.sales, bs.inventories),
    currentRatio: percent(t.currentAssets, t.currentLiabilities),
    quickRatio: percent(t.quickAssets, t.currentLiabilities),
    equityRatio: percent(t.netAssets, t.totalAssets),
    debtEquityRatio: percent(t.totalLiabilities, t.netAssets),
    fixedRatio: percent(t.fixedAssets, t.netAssets),
    fixedLongTermSuitabilityRatio: percent(t.fixedAssets, t.netAssets + t.fixedLiabilities),
    interestCoverageRatio: divide(
      profits.operatingProfit + pl.interestAndDividendIncome,
      pl.interestExpense,
    ),
  }
}

/** basis が 'average' なら、B/S の各項目を期首と期末の平均にする */
function balanceSheetBasis(input: AnalysisInput): BalanceSheet {
  const { balanceSheet, previousBalanceSheet, basis = 'end' } = input
  if (basis === 'end') return balanceSheet
  if (!previousBalanceSheet) {
    throw new Error('期首と期末の平均を使うには、期首（前期末）の B/S が必要です')
  }
  const averaged = { ...balanceSheet }
  for (const key of Object.keys(balanceSheet) as (keyof BalanceSheet)[]) {
    averaged[key] = (balanceSheet[key] + previousBalanceSheet[key]) / 2
  }
  return averaged
}

function divide(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

function percent(numerator: number, denominator: number): number | null {
  const ratio = divide(numerator, denominator)
  return ratio === null ? null : ratio * 100
}
