import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { annuityFactorBlock, annuityFactorOf, multiColumnTable, text, yen } from '../../helpers'

const YEARS = 5

/**
 * 投資評価・NPV 型 5：相互に排他的な 2 つの投資案の比較（NPV・収益性指数・回収期間）。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * NotebookLM の案は「回収期間が短い案と NPV が大きい案が必ず逆転する」だったが、その条件だと
 * NPV が大きいのは必ず投資額の大きい案になり、「大きい方を選ぶ」と覚えれば当たってしまう。
 * そこで、パターンを決めてから数値を組み立てる：
 * - 0：逆転（大きい案は回収が遅いが、NPV は大きい）
 * - 1：大きい案の圧勝（回収も早く、NPV も大きい）
 * - 2：小さい案の圧勝（回収も早く、NPV も大きい）
 * 「大きい方を選ぶ」「回収が早い方を選ぶ」のどちらも 6 割くらいしか当たらないように重みを付け、
 * 大きい案を A・B のどちらに置くかも毎回変える。
 */
function model(p: Params) {
  const smallInvestment = p.smallInvestment!
  const smallPayback = p.smallPaybackTenths! / 10
  const gap = p.gapTenths! / 10
  const bigInvestment = Math.round((smallInvestment * p.scaleTenths!) / 10 / 5_000) * 5_000
  const bigPayback = p.pattern === 1 ? smallPayback - gap : smallPayback + gap
  const small = {
    investment: smallInvestment,
    cashFlow: Math.round(smallInvestment / smallPayback / 100) * 100,
  }
  const big = {
    investment: bigInvestment,
    cashFlow: Math.round(bigInvestment / bigPayback / 100) * 100,
  }
  const rate = p.ratePercent! / 100
  const factor = annuityFactorOf(rate, YEARS)
  const evaluate = (plan: { investment: number; cashFlow: number }) => ({
    ...plan,
    npv: plan.cashFlow * factor - plan.investment,
    pi: (plan.cashFlow * factor) / plan.investment,
    payback: plan.investment / plan.cashFlow,
  })
  const [a, b] =
    p.bigIsA === 1 ? [evaluate(big), evaluate(small)] : [evaluate(small), evaluate(big)]
  return { rate, factor, a, b, small: evaluate(small), big: evaluate(big) }
}

export const mutuallyExclusive: ProblemTemplate = {
  id: 'npv.mutually-exclusive',
  topic: 'npv',
  title: '2 つの投資案の比較（NPV・収益性指数・回収期間）',
  difficulty: 2,
  source: {
    kind: 'past-exam',
    note: '1 次試験 財務・会計（平成 29 年度 第 16 問、令和 4 年度 第 14 問など）の投資案の比較の構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    smallInvestment: { kind: 'int', min: 20_000, max: 50_000, step: 5_000 },
    smallPaybackTenths: { kind: 'choice', values: [25, 30, 35] },
    gapTenths: { kind: 'choice', values: [3, 5, 7, 9] },
    // 大きい案の投資額が、小さい案の何倍か（10 倍した値）
    scaleTenths: { kind: 'choice', values: [15, 20, 25, 30] },
    ratePercent: { kind: 'choice', values: [5, 6, 8] },
    // 0 = 逆転、1 = 大きい案の圧勝、2 = 小さい案の圧勝。逆転は成り立つ組み合わせが少ないので多めに引く
    pattern: { kind: 'choice', values: [0, 0, 0, 0, 0, 1, 2, 2, 2] },
    bigIsA: { kind: 'choice', values: [0, 1] },
    // 罠の情報：本社の共通固定費の配賦額（どちらの案でも変わらないので、判断に使わない）
    overhead: { kind: 'int', min: 10_000, max: 30_000, step: 5_000 },
  },
  constraint: (p) => {
    const { small, big } = model(p)
    const bigWins = big.npv > small.npv
    const bigSlower = big.payback > small.payback
    const patternHolds =
      p.pattern === 0
        ? bigWins && bigSlower
        : p.pattern === 1
          ? bigWins && !bigSlower
          : !bigWins && bigSlower
    return (
      patternHolds &&
      // NPV や回収期間の差が小さいと、判断が紛らわしい
      Math.abs(big.npv - small.npv) >= 2_000 &&
      Math.abs(big.payback - small.payback) >= 0.1
    )
  },
  body: (p) => {
    const m = model(p)
    return [
      text(
        'P 社は新規事業について、相互に排他的な 2 つの投資案（どちらか一方しか選べない）を比べている。資金の制約はなく、企業価値（NPV）を最大にすることを方針とする。',
      ),
      multiColumnTable(
        '投資案の概要（単位：千円）',
        ['投資案 A', '投資案 B'],
        [
          ['初期投資額', m.a.investment, m.b.investment],
          ['毎年の税引後キャッシュフロー', m.a.cashFlow, m.b.cashFlow],
        ],
      ),
      text(
        `どちらの案も ${YEARS} 年間で、キャッシュフローは毎年末に生じ、残存価額は 0 とする。割引率（資本コスト）は年 ${formatNumber(m.rate * 100)}% である。どちらの案を選んでも、本社の共通固定費 ${yen(p.overhead!)} 千円が配賦される。`,
      ),
      annuityFactorBlock(m.rate, YEARS),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'npvA',
      prompt:
        '設問 1：投資案 A の正味現在価値（NPV）を求めよ（千円、千円未満を四捨五入。マイナスは △ を付ける）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).a.npv,
      commonMistakes: [
        {
          answer: (p) => model(p).a.npv - p.overhead!,
          hint: '本社の共通固定費の配賦額を引いていない？ どちらの案でも変わらない費用は、判断に使わない。',
        },
        {
          answer: (p) => model(p).a.cashFlow * YEARS - model(p).a.investment,
          hint: 'キャッシュフローを割り引いていない？ 毎年同じ CF には年金現価係数を掛ける。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'npvB',
      prompt:
        '設問 2：投資案 B の正味現在価値（NPV）を求めよ（千円、千円未満を四捨五入。マイナスは △ を付ける）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).b.npv,
      commonMistakes: [
        {
          answer: (p) => model(p).b.npv - p.overhead!,
          hint: '本社の共通固定費の配賦額を引いていない？ どちらの案でも変わらない費用は、判断に使わない。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'piB',
      prompt:
        '設問 3：投資案 B の収益性指数（PI ＝ キャッシュフローの現在価値の合計 ÷ 初期投資額）を求めよ（倍、小数点第 3 位を四捨五入）。',
      unit: '倍',
      rounding: { mode: 'halfUp', digits: 2 },
      points: 2,
      answer: (p) => model(p).b.pi,
      commonMistakes: [
        {
          answer: (p) => model(p).b.npv / model(p).b.investment,
          hint: '分子を NPV にしていない？ PI の分子は、キャッシュフローの現在価値の合計（初期投資額を引く前）。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'decision',
      prompt: '設問 4：企業価値を最大にする観点から、採用すべき投資案はどれか。',
      points: 2,
      options: () => [
        { key: 'A', label: '投資案 A' },
        { key: 'B', label: '投資案 B' },
      ],
      answer: (p) => {
        const m = model(p)
        return m.a.npv > m.b.npv ? 'A' : 'B'
      },
      hints: {
        A: '投資案 A の NPV は投資案 B より小さい。回収期間の短さや PI の高さではなく、資金の制約がないときは NPV の大きさで選ぶ。',
        B: '投資案 B の NPV は投資案 A より小さい。投資額の大きさや回収期間ではなく、資金の制約がないときは NPV の大きさで選ぶ。',
      },
    },
  ],
  explanation: (p) => {
    const m = model(p)
    const line = (name: string, plan: typeof m.a) =>
      text(
        `投資案 ${name}：NPV = ${yen(plan.cashFlow)} × ${formatNumber(m.factor, 3)} − ${yen(plan.investment)} ≒ ${yen(Math.round(plan.npv))} 千円、PI ≒ ${formatNumber(Math.round(plan.pi * 100) / 100, 2)} 倍、回収期間 ≒ ${formatNumber(Math.round(plan.payback * 10) / 10, 1)} 年`,
      )
    const winner = m.a.npv > m.b.npv ? 'A' : 'B'
    const fasterIsWinner = (winner === 'A') === m.a.payback < m.b.payback
    return [
      line('A', m.a),
      line('B', m.b),
      text(
        `NPV が大きいのは投資案 ${winner}。資金の制約がないので、投資案 ${winner} を採用する。${
          fasterIsWinner
            ? ''
            : '回収期間は、もう一方の案の方が短い。回収期間は回収後の CF や時間価値を考えないので、NPV と結論が逆になることがある。'
        }`,
      ),
      text('本社の共通固定費の配賦額は、どちらの案でも変わらないので、判断に使わない。'),
    ]
  },
}
