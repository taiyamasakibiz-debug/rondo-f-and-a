import type { ProblemTemplate, Topic } from '@/engine/types'
import { investmentAndFunding } from './_private/case4/investment-and-funding'
import { peerAndPriceCut } from './_private/case4/peer-and-price-cut'
import { replacementFunding } from './_private/case4/replacement-funding'
import { segmentWithdrawal } from './_private/case4/segment-withdrawal'
import { specialOrder } from './_private/seg/special-order'
import { storeClosure } from './_private/seg/store-closure'
import { paymentPlans } from './_private/tvm/payment-plans'
import { perpetuity } from './_private/tvm/perpetuity'
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
  // セグメント別・意思決定（過去問の構造を参考にしたもの。公開しない）
  storeClosure,
  specialOrder,
  // 資金の時間価値（過去問の構造を参考にしたもの。公開しない）
  paymentPlans,
  perpetuity,
  // 事例Ⅳ総合（過去問の構造を参考にしたもの。公開しない）
  peerAndPriceCut,
  investmentAndFunding,
  segmentWithdrawal,
  replacementFunding,
]

export function templatesForTopic(topic: Topic): ProblemTemplate[] {
  return PROBLEM_TEMPLATES.filter((template) => template.topic === topic)
}

export function findTemplate(id: string): ProblemTemplate | undefined {
  return PROBLEM_TEMPLATES.find((template) => template.id === id)
}
