import {
  type CostStructure,
  contributionMargin,
  contributionMarginRatio,
  highLowMethod,
  operatingLeverage,
  operatingProfit,
  salesForTargetProfit,
  variableCostRatio,
} from '@/domain/cvp/cvp'
import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { amountTable, multiColumnTable, pct, text, yen } from '../helpers'

// 単位：千円。売上高・変動費率・固定費（限界利益に対する割合）から損益を作る
function costOf(p: Params): CostStructure {
  const variableCosts = (p.sales! * p.variableCostPercent!) / 100
  return {
    sales: p.sales!,
    variableCosts,
    fixedCosts: Math.round(((p.sales! - variableCosts) * p.fixedCostPercentOfMargin!) / 100),
  }
}

function plBlock(cost: CostStructure) {
  return amountTable('当期の損益（単位：千円）', [
    ['売上高', cost.sales],
    ['変動費', cost.variableCosts],
    ['固定費', cost.fixedCosts],
    ['営業利益', operatingProfit(cost)],
  ])
}

const baseParams = {
  sales: { kind: 'int', min: 20_000, max: 80_000, step: 1_000 },
  variableCostPercent: { kind: 'int', min: 45, max: 80 },
  fixedCostPercentOfMargin: { kind: 'int', min: 55, max: 90, step: 5 },
} as const

/** 目標営業利益 = 当期の営業利益 × (1 + 増加率)。千円未満は四捨五入 */
function targetProfit(p: Params): number {
  return Math.round(operatingProfit(costOf(p)) * (1 + p.profitIncreasePercent! / 100))
}

export const targetProfitSales: ProblemTemplate = {
  id: 'cvp.target-profit',
  topic: 'cvp',
  title: '目標利益を達成する売上高',
  difficulty: 2,
  source: { kind: 'original', publishable: true },
  params: { ...baseParams, profitIncreasePercent: { kind: 'int', min: 20, max: 100, step: 10 } },
  // 変動費率 50% だと、限界利益率と変動費率を取り違えても同じ値になる
  constraint: (p) => p.variableCostPercent !== 50,
  body: (p) => [
    text('D 社の当期の損益は次のとおりである。来期も変動費率と固定費は変わらないものとする。'),
    plBlock(costOf(p)),
    text(`D 社は来期、営業利益を ${yen(targetProfit(p))} 千円にすることを目標としている。`),
  ],
  steps: [
    {
      kind: 'numeric',
      id: 'targetSales',
      prompt: '目標営業利益を達成する売上高を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => salesForTargetProfit(costOf(p), targetProfit(p)),
      commonMistakes: [
        {
          answer: (p) => targetProfit(p) / contributionMarginRatio(costOf(p)),
          hint: '固定費を足し忘れていない？ 売上高 = (固定費 + 目標利益) ÷ 限界利益率。',
        },
        {
          answer: (p) => (costOf(p).fixedCosts + targetProfit(p)) / variableCostRatio(costOf(p)),
          hint: '変動費率で割っていない？ 割るのは限界利益率。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'salesGrowth',
      prompt: '当期に対する売上高の増加率を求めよ（%、小数点第 2 位を四捨五入）。',
      unit: '%',
      rounding: { mode: 'halfUp', digits: 1 },
      answer: (p) => (salesForTargetProfit(costOf(p), targetProfit(p)) / p.sales! - 1) * 100,
      commonMistakes: [
        {
          answer: (p) => (salesForTargetProfit(costOf(p), targetProfit(p)) / p.sales!) * 100,
          hint: '当期比（何 % の大きさか）を答えていない？ 増加率は 当期比 − 100%。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const cost = costOf(p)
    const cm = contributionMarginRatio(cost)
    const target = targetProfit(p)
    const sales = salesForTargetProfit(cost, target)
    return [
      text(`限界利益率 = ${yen(contributionMargin(cost))} ÷ ${yen(cost.sales)} = ${pct(cm)}`),
      text(
        `目標売上高 = (固定費 ${yen(cost.fixedCosts)} + 目標利益 ${yen(target)}) ÷ ${formatNumber(cm, 4)} ≒ ${yen(Math.round(sales))} 千円`,
      ),
      text(
        `増加率 = ${yen(Math.round(sales))} ÷ ${yen(cost.sales)} − 1 ≒ ${pct(sales / cost.sales - 1)}`,
      ),
    ]
  },
}

/** 高低点法：4 か月分の売上高と総費用 */
function monthsOf(p: Params) {
  return [p.m1!, p.m2!, p.m3!, p.m4!].map((sales) => ({
    sales,
    totalCosts: p.fixedCosts! + (sales * p.variableCostPercent!) / 100,
  }))
}

export const highLow: ProblemTemplate = {
  id: 'cvp.high-low',
  topic: 'cvp',
  title: '高低点法による費用分解と損益分岐点',
  difficulty: 2,
  source: { kind: 'original', publishable: true },
  params: {
    variableCostPercent: { kind: 'int', min: 40, max: 75 },
    fixedCosts: { kind: 'int', min: 2_000, max: 6_000, step: 100 },
    m1: { kind: 'int', min: 8_000, max: 20_000, step: 500 },
    m2: { kind: 'int', min: 8_000, max: 20_000, step: 500 },
    m3: { kind: 'int', min: 8_000, max: 20_000, step: 500 },
    m4: { kind: 'int', min: 8_000, max: 20_000, step: 500 },
  },
  constraint: (p) =>
    new Set([p.m1, p.m2, p.m3, p.m4]).size === 4 &&
    p.variableCostPercent !== 50 &&
    // 最大と最小の差が小さすぎると、分解の意味が薄い
    Math.max(p.m1!, p.m2!, p.m3!, p.m4!) - Math.min(p.m1!, p.m2!, p.m3!, p.m4!) >= 4_000,
  body: (p) => [
    text('D 社の直近 4 か月の売上高と総費用は次のとおりである。高低点法で費用を分解する。'),
    multiColumnTable(
      '売上高と総費用（単位：千円）',
      ['売上高', '総費用'],
      monthsOf(p).map((m, i): [string, number, number] => [`${i + 1} 月`, m.sales, m.totalCosts]),
    ),
  ],
  steps: [
    {
      kind: 'numeric',
      id: 'variableCostRatio',
      prompt: '変動費率を求めよ（%、小数点第 2 位を四捨五入）。',
      unit: '%',
      rounding: { mode: 'halfUp', digits: 1 },
      answer: (p) => highLowMethod(monthsOf(p)).variableCostRatio * 100,
    },
    {
      kind: 'numeric',
      id: 'fixedCosts',
      prompt: '1 か月の固定費を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      answer: (p) => highLowMethod(monthsOf(p)).fixedCosts,
      commonMistakes: [
        {
          answer: (p) => Math.min(...monthsOf(p).map((m) => m.totalCosts)),
          hint: '総費用の最小値をそのまま固定費にしていない？ 最小の月にも変動費は含まれる。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'breakEvenSales',
      prompt: '1 か月の損益分岐点売上高を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => {
        const { variableCostRatio: ratio, fixedCosts } = highLowMethod(monthsOf(p))
        return fixedCosts / (1 - ratio)
      },
      commonMistakes: [
        {
          answer: (p) => {
            const { variableCostRatio: ratio, fixedCosts } = highLowMethod(monthsOf(p))
            return fixedCosts / ratio
          },
          hint: '固定費を変動費率で割っていない？ 割るのは限界利益率（1 − 変動費率）。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const months = monthsOf(p)
    const sorted = [...months].sort((a, b) => a.sales - b.sales)
    const low = sorted[0]!
    const high = sorted[3]!
    const { variableCostRatio: ratio, fixedCosts } = highLowMethod(months)
    return [
      text('高低点法では、売上高が最大の月と最小の月の 2 点だけを使う。'),
      text(
        `変動費率 = (${yen(high.totalCosts)} − ${yen(low.totalCosts)}) ÷ (${yen(high.sales)} − ${yen(low.sales)}) = ${pct(ratio)}`,
      ),
      text(
        `固定費 = ${yen(high.totalCosts)} − ${yen(high.sales)} × ${pct(ratio)} = ${yen(Math.round(fixedCosts))} 千円`,
      ),
      text(
        `損益分岐点売上高 = ${yen(Math.round(fixedCosts))} ÷ (1 − ${pct(ratio)}) ≒ ${yen(Math.round(fixedCosts / (1 - ratio)))} 千円`,
      ),
    ]
  },
}

export const leverage: ProblemTemplate = {
  id: 'cvp.operating-leverage',
  topic: 'cvp',
  title: '営業レバレッジと利益の感応度',
  difficulty: 2,
  source: { kind: 'original', publishable: true },
  params: { ...baseParams, salesIncreasePercent: { kind: 'int', min: 5, max: 30, step: 5 } },
  body: (p) => [
    text('D 社の当期の損益は次のとおりである。'),
    plBlock(costOf(p)),
    text(
      `来期は売上高が ${p.salesIncreasePercent}% 増加すると見込んでいる。変動費率と固定費は変わらないものとする。`,
    ),
  ],
  steps: [
    {
      kind: 'numeric',
      id: 'operatingLeverage',
      prompt: '営業レバレッジを求めよ（倍、小数点第 3 位を四捨五入）。',
      unit: '倍',
      rounding: { mode: 'halfUp', digits: 2 },
      answer: (p) => operatingLeverage(costOf(p)),
      commonMistakes: [
        {
          answer: (p) => operatingProfit(costOf(p)) / contributionMargin(costOf(p)),
          hint: '分子と分母が逆になっていない？ 営業レバレッジ = 限界利益 ÷ 営業利益。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'profitGrowth',
      prompt: '来期の営業利益の増加率を求めよ（%、小数点第 2 位を四捨五入）。',
      unit: '%',
      rounding: { mode: 'halfUp', digits: 1 },
      points: 2,
      answer: (p) => operatingLeverage(costOf(p)) * p.salesIncreasePercent!,
      commonMistakes: [
        {
          answer: (p) => p.salesIncreasePercent!,
          hint: '売上高と同じ率で利益も増えるわけではない。固定費があるので、利益は営業レバレッジ倍で動く。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const cost = costOf(p)
    const ol = operatingLeverage(cost)
    return [
      text(
        `営業レバレッジ = 限界利益 ${yen(contributionMargin(cost))} ÷ 営業利益 ${yen(operatingProfit(cost))} ≒ ${formatNumber(ol, 2)} 倍`,
      ),
      text(
        `営業利益の増加率 = 売上高の増加率 ${p.salesIncreasePercent}% × ${formatNumber(ol, 2)} ≒ ${formatNumber(ol * p.salesIncreasePercent!, 1)}%`,
      ),
      (() => {
        const nextSales = cost.sales * (1 + p.salesIncreasePercent! / 100)
        const nextProfit = nextSales * contributionMarginRatio(cost) - cost.fixedCosts
        return text(
          `確かめ：来期の営業利益 = ${yen(Math.round(nextSales))} × ${pct(contributionMarginRatio(cost))} − ${yen(cost.fixedCosts)} ≒ ${yen(Math.round(nextProfit))} 千円（当期 ${yen(operatingProfit(cost))} 千円から ${pct(nextProfit / operatingProfit(cost) - 1)} 増）`,
        )
      })(),
    ]
  },
}
