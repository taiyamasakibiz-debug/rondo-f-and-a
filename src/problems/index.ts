import type { ProblemTemplate, Topic } from '@/engine/types'
import { compareWithPeer } from './analysis/compare'
import { efficiency, profitability, safety } from './analysis/indicators'
import { adjustments, workingCapital } from './cf/indirect'
import { breakEvenBasic } from './cvp/break-even-basic'
import { highLow, leverage, targetProfitSales } from './cvp/more'
import { allowance, creditSale, depreciation } from './journal/basic'
import { newInvestmentNpv, payback, replacementNpv } from './npv/npv'

/** すべての問題テンプレート。追加したらここに登録する */
export const PROBLEM_TEMPLATES: readonly ProblemTemplate[] = [
  // CVP
  breakEvenBasic,
  targetProfitSales,
  highLow,
  leverage,
  // 経営分析
  profitability,
  safety,
  efficiency,
  compareWithPeer,
  // 投資の意思決定
  newInvestmentNpv,
  replacementNpv,
  payback,
  // キャッシュフロー計算書
  workingCapital,
  adjustments,
  // 仕訳
  creditSale,
  depreciation,
  allowance,
]

export function templatesForTopic(topic: Topic): ProblemTemplate[] {
  return PROBLEM_TEMPLATES.filter((template) => template.topic === topic)
}

export function findTemplate(id: string): ProblemTemplate | undefined {
  return PROBLEM_TEMPLATES.find((template) => template.id === id)
}
