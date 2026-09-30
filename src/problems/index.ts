import type { ProblemTemplate, Topic } from '@/engine/types'
import { compareWithPeer } from './analysis/compare'
import { efficiency, profitability, safety } from './analysis/indicators'
import { receivableTurnoverDays } from './analysis/turnover-days'
import { adjustments, workingCapital } from './cf/indirect'
import { incomeTaxesPaid, investingAndFinancing } from './cf/more'
import { breakEvenBasic } from './cvp/break-even-basic'
import { highLow, leverage, targetProfitSales } from './cvp/more'
import { priceCut } from './cvp/price-cut'
import { allowance, creditSale, depreciation } from './journal/basic'
import { badDebtWriteOff, fixedAssetSale, prepaidExpense } from './journal/more'
import { workingCapitalAndResidual } from './npv/more'
import { newInvestmentNpv, payback, replacementNpv } from './npv/npv'

/** すべての問題テンプレート。追加したらここに登録する */
export const PROBLEM_TEMPLATES: readonly ProblemTemplate[] = [
  // CVP
  breakEvenBasic,
  targetProfitSales,
  highLow,
  leverage,
  priceCut,
  // 経営分析
  profitability,
  safety,
  efficiency,
  compareWithPeer,
  receivableTurnoverDays,
  // 投資の意思決定
  newInvestmentNpv,
  replacementNpv,
  payback,
  workingCapitalAndResidual,
  // キャッシュフロー計算書
  workingCapital,
  adjustments,
  incomeTaxesPaid,
  investingAndFinancing,
  // 仕訳
  creditSale,
  depreciation,
  allowance,
  fixedAssetSale,
  prepaidExpense,
  badDebtWriteOff,
]

export function templatesForTopic(topic: Topic): ProblemTemplate[] {
  return PROBLEM_TEMPLATES.filter((template) => template.topic === topic)
}

export function findTemplate(id: string): ProblemTemplate | undefined {
  return PROBLEM_TEMPLATES.find((template) => template.id === id)
}
