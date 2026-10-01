import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { text, yen } from '../../helpers'

/**
 * CVP 分析 型 6：制約のある資源（機械の稼働時間）のもとでの、最適な製品の組み合わせ。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * - 優先順位は、1 個あたりではなく、機械 1 時間あたりの限界利益で決める
 * - 「1 個あたりの限界利益が大きい製品」と「1 時間あたりが大きい製品」が必ず違う（罠が効く）
 * - NotebookLM の案は製品 P の加工時間が短い範囲で、ほぼ P が正解になったので、2 製品の範囲をそろえた
 * - 生産量は整数（1 個未満は切り捨て）
 */
type Product = { price: number; variable: number; hours: number; demand: number }

function plan(first: Product, second: Product, capacity: number) {
  const firstUnits = Math.min(first.demand, Math.floor(capacity / first.hours))
  const rest = capacity - firstUnits * first.hours
  const secondUnits = Math.min(second.demand, Math.floor(rest / second.hours))
  const margin =
    firstUnits * (first.price - first.variable) + secondUnits * (second.price - second.variable)
  return { firstUnits, secondUnits, margin }
}

function model(p: Params) {
  const productP: Product = {
    price: p.priceP!,
    variable: p.variableP!,
    hours: p.hoursP!,
    demand: p.demandP!,
  }
  const productQ: Product = {
    price: p.priceQ!,
    variable: p.variableQ!,
    hours: p.hoursQ!,
    demand: p.demandQ!,
  }
  const need = productP.demand * productP.hours + productQ.demand * productQ.hours
  const capacity = Math.round((need * p.capacityPercent!) / 100 / 10) * 10
  const marginP = productP.price - productP.variable
  const marginQ = productQ.price - productQ.variable
  const rateP = marginP / productP.hours
  const rateQ = marginQ / productQ.hours
  const pFirst = rateP > rateQ
  const best = pFirst ? plan(productP, productQ, capacity) : plan(productQ, productP, capacity)
  // 1 個あたりの限界利益の大きい順に作った場合（罠）
  const trap = pFirst ? plan(productQ, productP, capacity) : plan(productP, productQ, capacity)
  return {
    productP,
    productQ,
    capacity,
    marginP,
    marginQ,
    rateP,
    rateQ,
    pFirst,
    best,
    profit: best.margin - p.fixedCost!,
    trapProfit: trap.margin - p.fixedCost!,
    firstHours: pFirst ? productP.demand * productP.hours : productQ.demand * productQ.hours,
  }
}

const HOURS = [1.5, 2, 2.5, 3, 3.5, 4]

export const bottleneckMix: ProblemTemplate = {
  id: 'cvp.bottleneck-mix',
  topic: 'cvp',
  title: '機械の稼働時間に制約があるときの最適な生産計画',
  difficulty: 2,
  source: {
    kind: 'past-exam',
    note: '1 次試験 財務・会計（平成 30 年度 第 12 問など）の制約条件下の最適な組み合わせの構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    priceP: { kind: 'int', min: 10, max: 30 },
    variableP: { kind: 'int', min: 5, max: 18 },
    // 1 時間を入れると、1 個あたりと 1 時間あたりの限界利益が同じ値になり、誤答と区別できない
    hoursP: { kind: 'choice', values: HOURS },
    demandP: { kind: 'int', min: 200, max: 500, step: 50 },
    priceQ: { kind: 'int', min: 10, max: 30 },
    variableQ: { kind: 'int', min: 5, max: 18 },
    hoursQ: { kind: 'choice', values: HOURS },
    demandQ: { kind: 'int', min: 200, max: 500, step: 50 },
    // 使える機械の時間が、両方の需要を満たすのに要る時間の何 % か
    capacityPercent: { kind: 'choice', values: [60, 65, 70, 75, 80] },
    fixedCost: { kind: 'int', min: 1_000, max: 3_000, step: 100 },
    // 罠の情報：固定費のうち、製品に配賦している共通固定費（固定費の内訳なので、二重に引かない）
    allocatedCommon: { kind: 'int', min: 500, max: 1_000, step: 100 },
  },
  constraint: (p) => {
    const m = model(p)
    return (
      m.marginP > 0 &&
      m.marginQ > 0 &&
      // 1 個あたりで大きい製品と、1 時間あたりで大きい製品が必ず違う
      (m.marginP - m.marginQ) * (m.rateP - m.rateQ) < 0 &&
      // 1 時間あたりの差が小さいと、判断が紛らわしい
      Math.abs(m.rateP - m.rateQ) >= 0.2 &&
      // 優先する製品を需要の分まで作っても、時間が余る（もう一方も作る）
      m.capacity > m.firstHours &&
      m.best.secondUnits > 0 &&
      // 罠どおりに作った場合の利益が、正解とはっきり違う
      Math.round(m.trapProfit) !== Math.round(m.profit)
    )
  },
  body: (p) => {
    const m = model(p)
    return [
      text(
        '部品メーカーの Q 社は、同じ加工機械を使って製品 P と製品 Q を作っている。それぞれの製品のデータは次のとおりである。',
      ),
      {
        type: 'table',
        caption: '製品のデータ',
        headers: ['項目', '製品 P', '製品 Q'],
        rows: [
          ['販売単価（千円）', yen(p.priceP!), yen(p.priceQ!)],
          ['1 個あたりの変動費（千円）', yen(p.variableP!), yen(p.variableQ!)],
          [
            '1 個あたりの機械の加工時間（時間）',
            formatNumber(p.hoursP!, 1),
            formatNumber(p.hoursQ!, 1),
          ],
          ['最大の需要量（個）', yen(p.demandP!), yen(p.demandQ!)],
        ],
      },
      text(
        `当期に使える機械の加工時間は ${yen(m.capacity)} 時間で、両方の製品の需要を満たすには足りない。固定費は全社で ${yen(p.fixedCost!)} 千円（このうち ${yen(p.allocatedCommon!)} 千円は、各製品に配賦している共通固定費）である。作った製品はすべて売れ、生産量は整数（1 個未満は切り捨て）とする。`,
      ),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'rateP',
      prompt:
        '設問 1：製品 P の、機械 1 時間あたりの限界利益を求めよ（千円、小数点第 2 位を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 1 },
      points: 2,
      answer: (p) => model(p).rateP,
      commonMistakes: [
        {
          answer: (p) => model(p).marginP,
          hint: '1 個あたりの限界利益のままにしていない？ 1 個あたりの限界利益 ÷ 1 個あたりの加工時間。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'rateQ',
      prompt:
        '設問 2：製品 Q の、機械 1 時間あたりの限界利益を求めよ（千円、小数点第 2 位を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 1 },
      points: 2,
      answer: (p) => model(p).rateQ,
      commonMistakes: [
        {
          answer: (p) => model(p).marginQ,
          hint: '1 個あたりの限界利益のままにしていない？ 1 個あたりの限界利益 ÷ 1 個あたりの加工時間。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'priority',
      prompt: '設問 3：利益を最大にするために、優先して作るべき製品はどれか。',
      points: 2,
      options: () => [
        { key: 'A', label: '製品 P' },
        { key: 'B', label: '製品 Q' },
      ],
      answer: (p) => (model(p).pFirst ? 'A' : 'B'),
      hints: {
        A: '製品 P は 1 個あたりの限界利益は大きいが、機械 1 時間あたりでは製品 Q の方が大きい。制約のある資源 1 単位あたりの限界利益で比べる。',
        B: '製品 Q は 1 個あたりの限界利益は大きいが、機械 1 時間あたりでは製品 P の方が大きい。制約のある資源 1 単位あたりの限界利益で比べる。',
      },
    },
    {
      kind: 'numeric',
      id: 'profit',
      prompt:
        '設問 4：優先する製品を需要の分まで作り、残りの時間でもう一方を作るとき、営業利益を求めよ（千円。マイナスは △ を付ける）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 3,
      answer: (p) => model(p).profit,
      commonMistakes: [
        {
          answer: (p) => model(p).trapProfit,
          hint: '1 個あたりの限界利益が大きい製品を優先していない？ 機械 1 時間あたりの限界利益が大きい製品を先に作る。',
        },
        {
          answer: (p) => model(p).profit - p.allocatedCommon!,
          hint: '配賦している共通固定費を、もう一度引いていない？ 共通固定費は全社の固定費の内訳なので、二重に引かない。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const m = model(p)
    const [first, second] = m.pFirst ? ['P', 'Q'] : ['Q', 'P']
    return [
      text(
        `1 時間あたりの限界利益：製品 P = ${m.marginP} ÷ ${formatNumber(p.hoursP!, 1)} ≒ ${formatNumber(Math.round(m.rateP * 10) / 10, 1)} 千円、製品 Q = ${m.marginQ} ÷ ${formatNumber(p.hoursQ!, 1)} ≒ ${formatNumber(Math.round(m.rateQ * 10) / 10, 1)} 千円。製品 ${first} を優先する（1 個あたりの限界利益は製品 ${second} の方が大きいが、時間がかかる）。`,
      ),
      text(
        `製品 ${first} を ${yen(m.best.firstUnits)} 個作り、残りの時間で製品 ${second} を ${yen(m.best.secondUnits)} 個作る。限界利益の合計 = ${yen(m.best.margin)} 千円`,
      ),
      text(
        `営業利益 = ${yen(m.best.margin)} − 固定費 ${yen(p.fixedCost!)} = ${yen(m.profit)} 千円（共通固定費の配賦額は固定費の内訳なので、別に引かない）`,
      ),
    ]
  },
}
