import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { text, yen } from '../../helpers'

/**
 * 資金の時間価値 型 2：永久年金と、一定の率で成長する永久年金の現在価値。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * - 零成長：PV = C ÷ r
 * - 一定成長：PV = C1 ÷ (r − g)。C1 は 1 年後の CF なので、分子に (1 + g) を掛けない
 * 設問 3 は、NotebookLM の案（増加額が中央値の閾値より大きいか）を、買取価格と比べる判断に変えた
 */
function model(p: Params) {
  const rate = p.ratePercent! / 100
  const growth = p.growthPercent! / 100
  const noGrowth = p.cashFlow! / rate
  const withGrowth = p.cashFlow! / (rate - growth)
  // 売り手の提示価格は、一定成長の価値の前後（百千円単位）
  const price = Math.round((withGrowth * p.pricePercent!) / 100 / 100) * 100
  return { rate, growth, noGrowth, withGrowth, price, buy: withGrowth > price }
}

export const perpetuity: ProblemTemplate = {
  id: 'tvm.perpetuity',
  topic: 'npv',
  title: '永久年金と成長する永久年金',
  difficulty: 2,
  source: {
    kind: 'past-exam',
    note: '1 次試験 財務・会計（令和 5 年度 第 18 問など）の定率成長モデルの問題の構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    cashFlow: { kind: 'int', min: 1_000, max: 5_000, step: 200 },
    ratePercent: { kind: 'int', min: 5, max: 10 },
    growthPercent: { kind: 'int', min: 1, max: 3 },
    // 提示価格が一定成長の価値の何 % か。100 % に近いと判断が紛らわしいので外す
    pricePercent: { kind: 'choice', values: [80, 85, 90, 110, 115, 120] },
  },
  constraint: (p) => p.ratePercent! - p.growthPercent! >= 2,
  body: (p) => {
    const m = model(p)
    return [
      text(
        `J 社は、ある事業の買取りを検討している。この事業が生む 1 年後（1 年目の末）のフリーキャッシュフロー（FCF）は ${yen(p.cashFlow!)} 千円と見込まれる。J 社の資本コスト（割引率）は年 ${formatNumber(m.rate * 100)}% である。`,
      ),
      text('2 年目以降の FCF について、次の 2 つのシナリオを考える。'),
      {
        type: 'table',
        caption: 'シナリオ',
        headers: ['シナリオ', '2 年目以降の FCF'],
        rows: [
          ['X（成長なし）', `毎年 ${yen(p.cashFlow!)} 千円が永久に続く`],
          ['Y（一定成長）', `毎年 ${p.growthPercent}% ずつ成長し、永久に続く`],
        ],
      },
      text(`売り手は、この事業を ${yen(m.price)} 千円で売りたいと提示している。`),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'noGrowth',
      prompt: '設問 1：シナリオ X での事業価値（現在価値）を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).noGrowth,
      commonMistakes: [
        {
          answer: (p) => model(p).withGrowth,
          hint: 'シナリオ X は成長しないので、割引率から成長率を引かない。PV = C ÷ r。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'withGrowth',
      prompt: '設問 2：シナリオ Y での事業価値（現在価値）を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).withGrowth,
      commonMistakes: [
        {
          answer: (p) => {
            const m = model(p)
            return (p.cashFlow! * (1 + m.growth)) / (m.rate - m.growth)
          },
          hint: '分子に (1 + 成長率) を掛けていない？ 与えられた FCF は 1 年後の額なので、そのまま C1 ÷ (r − g)。',
        },
        {
          answer: (p) => {
            const m = model(p)
            return p.cashFlow! / (m.rate + m.growth)
          },
          hint: '割引率に成長率を足していない？ 成長するほど価値は大きくなるので、分母は r − g。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'buy',
      prompt: '設問 3：シナリオ Y を前提とすると、J 社は提示価格でこの事業を買い取るべきか。',
      options: () => [
        { key: 'A', label: '買い取るべきである' },
        { key: 'B', label: '買い取るべきではない' },
      ],
      answer: (p) => (model(p).buy ? 'A' : 'B'),
      hints: {
        A: 'シナリオ Y の事業価値は、提示価格より小さい。払う額の方が、得られる価値より大きい。',
        B: 'シナリオ Y の事業価値は、提示価格より大きい。提示価格で買うと、その差だけ得をする。',
      },
    },
  ],
  explanation: (p) => {
    const m = model(p)
    return [
      text(
        `シナリオ X：${yen(p.cashFlow!)} ÷ ${formatNumber(m.rate, 2)} ≒ ${yen(Math.round(m.noGrowth))} 千円`,
      ),
      text(
        `シナリオ Y：${yen(p.cashFlow!)} ÷ (${formatNumber(m.rate, 2)} − ${formatNumber(m.growth, 2)}) ≒ ${yen(Math.round(m.withGrowth))} 千円（成長によって ${yen(Math.round(m.withGrowth - m.noGrowth))} 千円大きくなる）`,
      ),
      text(
        `提示価格は ${yen(m.price)} 千円。シナリオ Y の価値の方が${m.buy ? '大きいので、買い取るべき' : '小さいので、買い取るべきではない'}。`,
      ),
      text(
        '与えられた FCF が 1 年後の額なら、分子はそのまま。今年の額（0 年目）が与えられたときだけ、(1 + g) を掛けて 1 年後の額に直す。',
      ),
    ]
  },
}
