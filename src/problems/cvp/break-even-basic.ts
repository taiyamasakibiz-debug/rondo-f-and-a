import {
  type CostStructure,
  breakEvenPointRatio,
  breakEvenSales,
  contributionMarginRatio,
  marginOfSafetyRatio,
  variableCostRatio,
} from '@/domain/cvp/cvp'
import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'

// 単位：千円。売上高・変動費率・固定費（限界利益に対する割合）から問題を作る
function costOf(p: Params): CostStructure {
  const variableCosts = (p.sales! * p.variableCostPercent!) / 100
  const contribution = p.sales! - variableCosts
  return {
    sales: p.sales!,
    variableCosts,
    fixedCosts: Math.round((contribution * p.fixedCostPercentOfMargin!) / 100),
  }
}

export const breakEvenBasic: ProblemTemplate = {
  id: 'cvp.break-even.basic',
  topic: 'cvp',
  title: '損益分岐点売上高と安全余裕率',
  difficulty: 1,
  source: { kind: 'original', publishable: true },
  params: {
    sales: { kind: 'int', min: 20_000, max: 80_000, step: 1_000 },
    variableCostPercent: { kind: 'int', min: 45, max: 80 },
    // 固定費が限界利益の何 % か。100 未満なので必ず黒字になる
    fixedCostPercentOfMargin: { kind: 'int', min: 50, max: 90, step: 5 },
  },
  // 50% ちょうどだと、正解とよくある誤答が同じ値になって区別できない
  // （限界利益率 = 変動費率、安全余裕率 = 損益分岐点比率）
  constraint: (p) => p.variableCostPercent !== 50 && p.fixedCostPercentOfMargin !== 50,
  body: (p) => {
    const cost = costOf(p)
    return [
      {
        type: 'text',
        text: 'D 社の当期の損益は次のとおりである。変動費と固定費の構造は来期も変わらないものとする。',
      },
      {
        type: 'table',
        caption: '損益計算書（単位：千円）',
        headers: ['項目', '金額'],
        rows: [
          ['売上高', formatNumber(cost.sales)],
          ['変動費', formatNumber(cost.variableCosts)],
          ['限界利益', formatNumber(cost.sales - cost.variableCosts)],
          ['固定費', formatNumber(cost.fixedCosts)],
          ['営業利益', formatNumber(cost.sales - cost.variableCosts - cost.fixedCosts)],
        ],
      },
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'contributionMarginRatio',
      prompt: '限界利益率を求めよ（%、小数点第 2 位を四捨五入）。',
      unit: '%',
      rounding: { mode: 'halfUp', digits: 1 },
      answer: (p) => contributionMarginRatio(costOf(p)) * 100,
      commonMistakes: [
        {
          answer: (p) => variableCostRatio(costOf(p)) * 100,
          hint: '変動費率を答えていない？ 限界利益率は 1 − 変動費率。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'breakEvenSales',
      prompt: '損益分岐点売上高を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => breakEvenSales(costOf(p)),
      commonMistakes: [
        {
          answer: (p) => costOf(p).fixedCosts / variableCostRatio(costOf(p)),
          hint: '固定費を変動費率で割っていない？ 割るのは限界利益率。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'marginOfSafetyRatio',
      prompt: '安全余裕率を求めよ（%、小数点第 2 位を四捨五入）。',
      unit: '%',
      rounding: { mode: 'halfUp', digits: 1 },
      points: 2,
      answer: (p) => marginOfSafetyRatio(costOf(p)) * 100,
      commonMistakes: [
        {
          answer: (p) => breakEvenPointRatio(costOf(p)) * 100,
          hint: '損益分岐点比率を答えていない？ 安全余裕率は 1 − 損益分岐点比率。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const cost = costOf(p)
    const cm = contributionMarginRatio(cost)
    const bep = breakEvenSales(cost)
    return [
      {
        type: 'text',
        text: `限界利益率 = 限界利益 ÷ 売上高 = ${formatNumber(cost.sales - cost.variableCosts)} ÷ ${formatNumber(cost.sales)} = ${formatNumber(cm * 100, 1)}%`,
      },
      {
        type: 'text',
        text: `損益分岐点売上高 = 固定費 ÷ 限界利益率 = ${formatNumber(cost.fixedCosts)} ÷ ${formatNumber(cm, 4)} ≒ ${formatNumber(Math.round(bep))}千円`,
      },
      {
        type: 'text',
        text: `安全余裕率 = (売上高 − 損益分岐点売上高) ÷ 売上高 = (${formatNumber(cost.sales)} − ${formatNumber(Math.round(bep))}) ÷ ${formatNumber(cost.sales)} ≒ ${formatNumber(marginOfSafetyRatio(cost) * 100, 1)}%`,
      },
    ]
  },
}
