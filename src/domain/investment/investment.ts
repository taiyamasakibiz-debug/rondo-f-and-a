import { applyRounding } from '../rounding'

/**
 * 投資の意思決定。税率・割引率は小数で扱う（30% なら 0.3）。
 * キャッシュフローの配列は 1 年目から順に並べる（0 年目の初期投資は別に渡す）。
 */

/** 定額法の減価償却費 = (取得原価 − 残存価額) ÷ 耐用年数 */
export function straightLineDepreciation(
  cost: number,
  residualValue: number,
  usefulLife: number,
): number {
  if (usefulLife <= 0) throw new Error('耐用年数は 1 年以上にしてください')
  return (cost - residualValue) / usefulLife
}

export type OperatingCashFlowInput = {
  /** 売上高（取替投資なら売上の増加額） */
  revenue: number
  /** 現金支出費用（減価償却費を除く費用） */
  cashExpenses: number
  depreciation: number
  taxRate: number
}

/**
 * 毎年の税引後キャッシュフロー
 * = (売上高 − 現金支出費用 − 減価償却費) × (1 − 税率) + 減価償却費
 * = 税引後営業利益 + 減価償却費
 * 営業利益がマイナスの年も、他の事業の利益と相殺して節税できる前提で計算する（事例Ⅳの通常の前提）。
 */
export function afterTaxOperatingCashFlow(input: OperatingCashFlowInput): number {
  const operatingProfit = input.revenue - input.cashExpenses - input.depreciation
  return operatingProfit * (1 - input.taxRate) + input.depreciation
}

/** 減価償却費による節税効果 = 減価償却費 × 税率 */
export function depreciationTaxShield(depreciation: number, taxRate: number): number {
  return depreciation * taxRate
}

/**
 * 設備を売却したときの税引後の収入
 * = 売却額 − (売却額 − 帳簿価額) × 税率
 * 売却損が出る場合は、その分の節税効果で収入が増える。
 */
export function afterTaxDisposalProceeds(
  proceeds: number,
  bookValue: number,
  taxRate: number,
): number {
  return proceeds - (proceeds - bookValue) * taxRate
}

/** 複利現価係数 = 1 ÷ (1 + r)^n。decimals を指定すると試験の係数表と同じ桁に丸める */
export function presentValueFactor(rate: number, year: number, decimals?: number): number {
  return roundTo(1 / (1 + rate) ** year, decimals)
}

/** 年金現価係数 = 1〜n 年目の複利現価係数の合計 */
export function annuityFactor(rate: number, years: number, decimals?: number): number {
  let total = 0
  for (let year = 1; year <= years; year += 1) total += 1 / (1 + rate) ** year
  return roundTo(total, decimals)
}

export type Discounting =
  /** 割引率から係数を計算する */
  | { rate: number; decimals?: number }
  /** 問題で与えられた係数表をそのまま使う（1 年目から順） */
  | { factors: readonly number[] }

export function discountFactors(discounting: Discounting, years: number): number[] {
  if ('factors' in discounting) {
    if (discounting.factors.length < years) {
      throw new Error(`係数が足りません（${years} 年分必要）`)
    }
    return discounting.factors.slice(0, years)
  }
  return Array.from({ length: years }, (_, i) =>
    presentValueFactor(discounting.rate, i + 1, discounting.decimals),
  )
}

/** 各年のキャッシュフローの現在価値 */
export function presentValues(cashFlows: readonly number[], discounting: Discounting): number[] {
  const factors = discountFactors(discounting, cashFlows.length)
  return cashFlows.map((cashFlow, i) => cashFlow * factors[i]!)
}

/** 正味現在価値（NPV）= 各年の CF の現在価値の合計 − 初期投資 */
export function netPresentValue(
  initialInvestment: number,
  cashFlows: readonly number[],
  discounting: Discounting,
): number {
  return presentValues(cashFlows, discounting).reduce((a, b) => a + b, 0) - initialInvestment
}

/**
 * 回収期間（割引なし）。累計 CF が初期投資に届く年を、年の途中は均等に回収する前提で求める。
 * 期間内に回収できなければ null。
 */
export function paybackPeriod(
  initialInvestment: number,
  cashFlows: readonly number[],
): number | null {
  if (initialInvestment <= 0) return 0
  let remaining = initialInvestment
  for (const [i, cashFlow] of cashFlows.entries()) {
    if (cashFlow > 0 && cashFlow >= remaining) return i + remaining / cashFlow
    remaining -= cashFlow
  }
  return null
}

/** 取替投資などの差額キャッシュフロー（新 − 旧） */
export function differentialCashFlows(
  proposed: readonly number[],
  current: readonly number[],
): number[] {
  const length = Math.max(proposed.length, current.length)
  return Array.from({ length }, (_, i) => (proposed[i] ?? 0) - (current[i] ?? 0))
}

function roundTo(value: number, decimals: number | undefined): number {
  if (decimals === undefined) return value
  return applyRounding(value, { mode: 'halfUp', digits: decimals })
}
