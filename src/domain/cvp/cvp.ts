/**
 * CVP 分析（損益分岐点分析）。
 * 比率（〜Ratio）は小数で扱う（40% なら 0.4）。% で答える設問では、問題の側で 100 倍する。
 */

export type CostStructure = {
  sales: number
  variableCosts: number
  fixedCosts: number
}

/** 変動費率 = 変動費 ÷ 売上高 */
export function variableCostRatio({ sales, variableCosts }: CostStructure): number {
  return variableCosts / sales
}

/** 限界利益率 = 1 − 変動費率 */
export function contributionMarginRatio(cost: CostStructure): number {
  return 1 - variableCostRatio(cost)
}

/** 限界利益 = 売上高 − 変動費 */
export function contributionMargin({ sales, variableCosts }: CostStructure): number {
  return sales - variableCosts
}

/** 営業利益 = 限界利益 − 固定費 */
export function operatingProfit(cost: CostStructure): number {
  return contributionMargin(cost) - cost.fixedCosts
}

/** 損益分岐点売上高 = 固定費 ÷ 限界利益率 */
export function breakEvenSales(cost: CostStructure): number {
  return cost.fixedCosts / contributionMarginRatio(cost)
}

/** 損益分岐点比率 = 損益分岐点売上高 ÷ 売上高 */
export function breakEvenPointRatio(cost: CostStructure): number {
  return breakEvenSales(cost) / cost.sales
}

/** 安全余裕率 = (売上高 − 損益分岐点売上高) ÷ 売上高 = 1 − 損益分岐点比率 */
export function marginOfSafetyRatio(cost: CostStructure): number {
  return 1 - breakEvenPointRatio(cost)
}

/** 目標利益を達成する売上高 = (固定費 + 目標利益) ÷ 限界利益率 */
export function salesForTargetProfit(cost: CostStructure, targetProfit: number): number {
  return (cost.fixedCosts + targetProfit) / contributionMarginRatio(cost)
}

/** 営業レバレッジ = 限界利益 ÷ 営業利益 */
export function operatingLeverage(cost: CostStructure): number {
  return contributionMargin(cost) / operatingProfit(cost)
}

export type SalesCostPoint = {
  sales: number
  totalCosts: number
}

/**
 * 高低点法による費用の分解。売上高が最大と最小の 2 点から
 * 変動費率 = 総費用の差 ÷ 売上高の差、固定費 = 総費用 − 売上高 × 変動費率。
 */
export function highLowMethod(points: readonly SalesCostPoint[]): {
  variableCostRatio: number
  fixedCosts: number
} {
  if (points.length < 2) throw new Error('高低点法には 2 期以上のデータが必要です')
  const sorted = [...points].sort((a, b) => a.sales - b.sales)
  const low = sorted[0]!
  const high = sorted[sorted.length - 1]!
  if (high.sales === low.sales) throw new Error('売上高が同じデータだけでは分解できません')

  const ratio = (high.totalCosts - low.totalCosts) / (high.sales - low.sales)
  return { variableCostRatio: ratio, fixedCosts: high.totalCosts - high.sales * ratio }
}
