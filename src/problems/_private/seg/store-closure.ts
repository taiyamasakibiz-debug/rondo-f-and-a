import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { multiColumnTable, text, yen } from '../../helpers'

/**
 * セグメント別・意思決定 型 1：3 店舗の貢献利益と、店舗を廃止すべきかの判断。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * NotebookLM の案は、赤字の店舗がいつも店舗 Z だった。覚えて答えられないよう、
 * 赤字になりやすい店舗（weak）を X・Y・Z のどこに置くかを毎回変え、選択肢を 4 つにした。
 */
const NAMES = ['X', 'Y', 'Z'] as const
const KEYS = ['A', 'B', 'C'] as const

type Store = { sales: number; variable: number; directFixed: number; contribution: number }

function store(sales: number, variablePercent: number, directFixed: number): Store {
  const variable = (sales * variablePercent) / 100
  return { sales, variable, directFixed, contribution: sales - variable - directFixed }
}

function model(p: Params) {
  const strong1 = store(p.sales1!, p.variable1Percent!, p.directFixed1!)
  const strong2 = store(p.sales2!, p.variable2Percent!, p.directFixed2!)
  const weak = store(p.weakSales!, p.weakVariablePercent!, p.weakDirectFixed!)
  const weakIndex = p.weakPosition!
  const stores = [strong1, strong2]
  stores.splice(weakIndex, 0, weak)
  const totalSales = stores.reduce((sum, s) => sum + s.sales, 0)
  const common = p.commonFixed!
  const allocatedWeak = (common * weak.sales) / totalSales
  return {
    stores,
    weak,
    weakIndex,
    weakName: NAMES[weakIndex]!,
    totalSales,
    common,
    allocatedWeak,
    weakAfterAllocation: weak.contribution - allocatedWeak,
    totalProfit: stores.reduce((sum, s) => sum + s.contribution, 0) - common,
    close: weak.contribution < 0,
  }
}

export const storeClosure: ProblemTemplate = {
  id: 'seg.store-closure',
  topic: 'cvp',
  title: '店舗別の貢献利益と店舗の廃止',
  difficulty: 2,
  source: {
    kind: 'past-exam',
    note: '1 次試験 財務・会計（平成 25 年度 第 15 問など）のセグメント別損益の構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    sales1: { kind: 'int', min: 100_000, max: 250_000, step: 10_000 },
    variable1Percent: { kind: 'int', min: 50, max: 65 },
    directFixed1: { kind: 'int', min: 20_000, max: 50_000, step: 2_000 },
    sales2: { kind: 'int', min: 100_000, max: 250_000, step: 10_000 },
    variable2Percent: { kind: 'int', min: 55, max: 70 },
    directFixed2: { kind: 'int', min: 20_000, max: 50_000, step: 2_000 },
    weakSales: { kind: 'int', min: 80_000, max: 200_000, step: 10_000 },
    weakVariablePercent: { kind: 'int', min: 65, max: 80 },
    weakDirectFixed: { kind: 'int', min: 25_000, max: 55_000, step: 2_000 },
    commonFixed: { kind: 'int', min: 50_000, max: 100_000, step: 5_000 },
    // 配賦後に赤字になる店舗を、X・Y・Z のどこに置くか
    weakPosition: { kind: 'choice', values: [0, 1, 2] },
  },
  // 「どれも廃止しない」が 4 割、残りが X・Y・Z に分かれる（1,000 通りで確かめた）
  constraint: (p) => {
    const m = model(p)
    const [s1, s2] = m.stores.filter((_, i) => i !== m.weakIndex)
    return (
      // ほかの 2 店舗は、貢献利益がしっかり黒字
      s1!.contribution >= 5_000 &&
      s2!.contribution >= 5_000 &&
      // 配賦後は赤字（廃止が議論される理由）
      m.weakAfterAllocation <= -1_000 &&
      // 貢献利益が 0 に近いと、判断が紛らわしい
      Math.abs(m.weak.contribution) >= 1_000 &&
      // 売上高がちょうど 3 分の 1 だと、共通費を等分した誤答と正解が同じ値になる
      m.weak.sales * 3 !== m.totalSales
    )
  },
  body: (p) => {
    const m = model(p)
    return [
      text('I 社は飲食店を 3 店舗営んでいる。当期の店舗別の業績は次のとおりである。'),
      multiColumnTable(
        '店舗別の業績（単位：千円）',
        NAMES.map((name) => `店舗 ${name}`),
        [
          ['売上高', ...m.stores.map((s) => s.sales)],
          ['変動費', ...m.stores.map((s) => s.variable)],
          ['個別固定費', ...m.stores.map((s) => s.directFixed)],
        ],
      ),
      text(
        `このほかに全社の共通固定費が ${yen(m.common)} 千円あり、社内では各店舗の売上高の比率で配賦している。配賦すると店舗 ${m.weakName} が営業赤字になるため、社内では店舗 ${m.weakName} の廃止が議論されている。`,
      ),
      text(
        '店舗を廃止すると、その店舗の売上高・変動費・個別固定費はなくなるが、全社の共通固定費は廃止後も減らず、残る店舗で全額を負担する。',
      ),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'totalProfit',
      prompt:
        '設問 1：共通固定費も含めた、現在の全社の営業利益を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).totalProfit,
      commonMistakes: [
        {
          answer: (p) => model(p).totalProfit + p.commonFixed!,
          hint: '共通固定費を引き忘れていない？ 全社の営業利益 = 各店舗の貢献利益の合計 − 共通固定費。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'weakAfterAllocation',
      prompt:
        '設問 2：共通固定費を売上高の比率で配賦したとき、赤字になる店舗の営業損益を求めよ（千円、千円未満を四捨五入。損失は △ を付ける）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).weakAfterAllocation,
      commonMistakes: [
        {
          answer: (p) => model(p).weak.contribution,
          hint: '共通固定費の配賦を引き忘れていない？ 配賦額 = 共通固定費 × その店舗の売上高 ÷ 全社の売上高。',
        },
        {
          answer: (p) => {
            const m = model(p)
            return m.weak.contribution - m.common / 3
          },
          hint: '共通固定費を 3 等分していない？ 配賦の基準は売上高の比率。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'decision',
      prompt: '設問 3：全社の営業利益を大きくする観点から、最も適切な判断はどれか。',
      points: 2,
      options: () => [
        ...NAMES.map((name, i) => ({ key: KEYS[i]!, label: `店舗 ${name} を廃止すべきである` })),
        { key: 'D', label: 'どの店舗も廃止すべきではない' },
      ],
      answer: (p) => {
        const m = model(p)
        return m.close ? KEYS[m.weakIndex]! : 'D'
      },
      hints: {
        A: '店舗 X を廃止するとどうなるか、店舗ごとの貢献利益（売上高 − 変動費 − 個別固定費）で確かめよう。貢献利益がプラスの店舗を廃止すると、全社の利益は減る。',
        B: '店舗 Y を廃止するとどうなるか、店舗ごとの貢献利益（売上高 − 変動費 − 個別固定費）で確かめよう。貢献利益がプラスの店舗を廃止すると、全社の利益は減る。',
        C: '店舗 Z を廃止するとどうなるか、店舗ごとの貢献利益（売上高 − 変動費 − 個別固定費）で確かめよう。貢献利益がプラスの店舗を廃止すると、全社の利益は減る。',
        D: '貢献利益がマイナスの店舗がある。個別固定費すら回収できていない店舗は、廃止すると全社の利益が増える。',
      },
    },
  ],
  explanation: (p) => {
    const m = model(p)
    return [
      ...m.stores.map((s, i) =>
        text(
          `店舗 ${NAMES[i]} の貢献利益 = ${yen(s.sales)} − ${yen(s.variable)} − ${yen(s.directFixed)} = ${yen(s.contribution)} 千円`,
        ),
      ),
      text(
        `全社の営業利益 = 貢献利益の合計 ${yen(m.totalProfit + m.common)} − 共通固定費 ${yen(m.common)} = ${yen(m.totalProfit)} 千円`,
      ),
      text(
        `店舗 ${m.weakName} の配賦額 = ${yen(m.common)} × ${yen(m.weak.sales)} ÷ ${yen(m.totalSales)} ≒ ${yen(Math.round(m.allocatedWeak))} 千円。配賦後の営業損益 ≒ ${yen(Math.round(m.weakAfterAllocation))} 千円`,
      ),
      text(
        m.close
          ? `店舗 ${m.weakName} は貢献利益がマイナス（${yen(m.weak.contribution)} 千円）なので、廃止すると全社の利益が ${formatNumber(-m.weak.contribution)} 千円増える。`
          : `店舗 ${m.weakName} は配賦後は赤字でも、貢献利益はプラス（${yen(m.weak.contribution)} 千円）。廃止すると、その分だけ全社の利益が減るので、どの店舗も廃止すべきではない。`,
      ),
      text(
        '共通固定費は店舗を廃止しても減らない。廃止の判断は、配賦後の損益ではなく貢献利益の正負で行う。',
      ),
    ]
  },
}
