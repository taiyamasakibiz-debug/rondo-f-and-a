import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { amountTable, text, yen } from '../helpers'

/**
 * 値下げの意思決定（単価と数量で考える CVP）。
 * 単価・単位あたり変動費は円、固定費と利益は千円、数量は個。
 */
function caseOf(p: Params) {
  const price = p.price!
  const newPrice = price * (1 - p.cutPercent! / 100)
  const unitVariable = (price * p.variablePercent!) / 100
  const quantity = p.quantityThousands! * 1_000
  const unitMargin = price - unitVariable
  const newUnitMargin = newPrice - unitVariable
  // 固定費は、当期の限界利益の一定割合（黒字になるように）
  const contribution = (unitMargin * quantity) / 1_000 // 千円
  const fixedCosts = Math.round((contribution * p.fixedPercentOfMargin!) / 100)
  const profit = contribution - fixedCosts
  // 値下げ後に同じ営業利益を得るための数量（個、端数は切り上げ）
  const requiredQuantity = ((fixedCosts + profit) * 1_000) / newUnitMargin
  return {
    price,
    newPrice,
    unitVariable,
    quantity,
    unitMargin,
    newUnitMargin,
    fixedCosts,
    profit,
    requiredQuantity,
  }
}

export const priceCut: ProblemTemplate = {
  id: 'cvp.price-cut',
  topic: 'cvp',
  title: '値下げ後に必要な販売数量',
  difficulty: 3,
  source: { kind: 'original', publishable: true },
  params: {
    price: { kind: 'int', min: 1_000, max: 5_000, step: 100 },
    variablePercent: { kind: 'int', min: 40, max: 70, step: 5 },
    quantityThousands: { kind: 'int', min: 10, max: 60 },
    fixedPercentOfMargin: { kind: 'int', min: 50, max: 85, step: 5 },
    cutPercent: { kind: 'choice', values: [5, 10, 15] },
  },
  constraint: (p) => {
    const c = caseOf(p)
    // 値下げしても単位あたりの限界利益がプラスで、単価に端数が出ないこと
    return c.newUnitMargin > 0 && Number.isInteger(c.newPrice) && Number.isInteger(c.unitVariable)
  },
  body: (p) => {
    const c = caseOf(p)
    return [
      text(`D 社は製品 X を 1 種類だけ製造・販売している。当期の実績は次のとおりである。`),
      amountTable(
        '当期の実績',
        [
          ['販売単価（円）', c.price],
          ['単位あたり変動費（円）', c.unitVariable],
          ['販売数量（個）', c.quantity],
          ['固定費（千円）', c.fixedCosts],
        ],
        '数値',
      ),
      text(
        `来期は販売単価を ${p.cutPercent}% 引き下げることを検討している。単位あたり変動費と固定費は変わらないものとする。`,
      ),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'profit',
      prompt: '当期の営業利益を求めよ（千円）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      answer: (p) => caseOf(p).profit,
    },
    {
      kind: 'numeric',
      id: 'requiredQuantity',
      prompt:
        '値下げ後に当期と同じ営業利益を得るために必要な販売数量を求めよ（個、1 個未満を切り上げ）。',
      unit: '個',
      rounding: { mode: 'up', digits: 0 },
      points: 2,
      answer: (p) => caseOf(p).requiredQuantity,
      commonMistakes: [
        {
          answer: (p) => {
            const c = caseOf(p)
            return ((c.fixedCosts + c.profit) * 1_000) / c.unitMargin
          },
          hint: '値下げ前の単位あたり限界利益を使っていない？ 値下げで 1 個あたりの限界利益は小さくなる。',
        },
        {
          answer: (p) => (caseOf(p).fixedCosts * 1_000) / caseOf(p).newUnitMargin,
          hint: '損益分岐点の数量を答えていない？ 同じ営業利益を得るには、固定費に目標の利益を足して割る。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const c = caseOf(p)
    return [
      text(
        `当期の営業利益 = (${yen(c.price)} − ${yen(c.unitVariable)}) × ${yen(c.quantity)} 個 ÷ 1,000 − ${yen(c.fixedCosts)} = ${yen(c.profit)} 千円`,
      ),
      text(
        `値下げ後の単価 = ${yen(c.price)} × (1 − ${p.cutPercent}%) = ${yen(c.newPrice)} 円、1 個あたりの限界利益 = ${yen(c.newPrice)} − ${yen(c.unitVariable)} = ${yen(c.newUnitMargin)} 円`,
      ),
      text(
        `必要な数量 = (固定費 ${yen(c.fixedCosts)} + 営業利益 ${yen(c.profit)}) × 1,000 ÷ ${yen(c.newUnitMargin)} ≒ ${formatNumber(c.requiredQuantity, 1)} → ${yen(Math.ceil(c.requiredQuantity))} 個（当期の ${formatNumber((Math.ceil(c.requiredQuantity) / c.quantity) * 100, 1)}%）`,
      ),
    ]
  },
}
