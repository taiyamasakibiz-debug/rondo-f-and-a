import type { Params, ProblemTemplate } from '@/engine/types'
import { amountTable, text, yen } from '../../helpers'

/**
 * セグメント別・意思決定 型 2：遊休設備があるときの特別注文（差額原価分析）。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * - 差額原価 = 数量 × 1 個あたりの変動費 + 追加の固定費
 * - 既存の固定費（1 個あたりの固定費の配賦額）は、受けても受けなくても変わらない埋没原価なので含めない
 *   → 罠として、製造原価（固定費の配賦額を含む）を問題文に載せる（NotebookLM の案に足した）
 */
function model(p: Params) {
  const revenue = p.units! * p.specialPrice!
  const cost = p.units! * p.unitVariable! + p.additionalFixed!
  return {
    revenue,
    cost,
    profit: revenue - cost,
    fullUnitCost: p.unitVariable! + p.unitFixed!,
  }
}

export const specialOrder: ProblemTemplate = {
  id: 'seg.special-order',
  topic: 'cvp',
  title: '特別注文を受けるべきか（差額原価）',
  difficulty: 2,
  source: {
    kind: 'past-exam',
    note: '1 次試験 財務・会計（平成 28 年度 第 12 問など）の特別注文・差額原価の構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    normalPrice: { kind: 'int', min: 10, max: 25 },
    unitVariable: { kind: 'int', min: 5, max: 15 },
    // 1 個あたりの既存の固定費の配賦額（埋没原価。判断には使わない）
    unitFixed: { kind: 'int', min: 2, max: 6 },
    specialPrice: { kind: 'int', min: 7, max: 18 },
    units: { kind: 'int', min: 1_000, max: 5_000, step: 500 },
    // 受ける・断るが半々くらいで出る範囲（NotebookLM の案 2,000〜10,000 だと、受けるが 7 割を超える）
    additionalFixed: { kind: 'int', min: 5_000, max: 20_000, step: 1_000 },
  },
  constraint: (p) => {
    const m = model(p)
    return (
      // 特別価格は、通常の価格より安く、1 個あたりの変動費より高い
      p.unitVariable! < p.specialPrice! &&
      p.specialPrice! < p.normalPrice! &&
      // 通常の価格は、製造原価を上回る（通常の販売は黒字）
      p.normalPrice! > m.fullUnitCost &&
      // 差額利益が 0 に近いと、判断が紛らわしい
      Math.abs(m.profit) >= 1_000
    )
  },
  body: (p) => {
    const m = model(p)
    return [
      text(
        `精密部品メーカーの J 社は、主力製品を 1 個 ${p.normalPrice} 千円で販売している。生産能力には十分な余裕（遊休設備）がある。`,
      ),
      amountTable(
        '主力製品 1 個あたりの製造原価（単位：千円）',
        [
          ['変動費', p.unitVariable!],
          ['固定費の配賦額', p.unitFixed!],
          ['製造原価', m.fullUnitCost],
        ],
        '1 個あたり',
      ),
      text(
        `このたび大口の顧客から、この製品 ${yen(p.units!)} 個を 1 個 ${p.specialPrice} 千円で納入してほしいという特別注文の打診があった。引き受けても、今の通常の販売には影響しない。ただし、特別注文のための金型や出荷検査に、追加の固定費が総額 ${yen(p.additionalFixed!)} 千円かかる。`,
      ),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'cost',
      prompt:
        '設問 1：特別注文を引き受けた場合の差額原価（引き受けることで新たに発生する費用の合計）を求めよ（千円）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).cost,
      commonMistakes: [
        {
          answer: (p) => p.units! * p.unitVariable!,
          hint: '追加の固定費を入れ忘れていない？ 引き受けることで新たに発生する固定費は、差額原価に入る。',
        },
        {
          answer: (p) => p.units! * model(p).fullUnitCost + p.additionalFixed!,
          hint: '既存の固定費の配賦額まで入れていない？ 既存の固定費は引き受けても増えない（埋没原価）。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'profit',
      prompt: '設問 2：特別注文を引き受けた場合の差額利益を求めよ（千円。損失は △ を付ける）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).profit,
      commonMistakes: [
        {
          answer: (p) => p.units! * (p.normalPrice! - p.unitVariable!) - p.additionalFixed!,
          hint: '通常の販売価格で計算していない？ 差額収益は、特別注文の単価 × 数量。',
        },
        {
          answer: (p) => p.units! * (p.specialPrice! - model(p).fullUnitCost) - p.additionalFixed!,
          hint: '1 個あたりの製造原価（固定費の配賦額を含む）を使っていない？ 既存の固定費は埋没原価なので、判断に含めない。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'decision',
      prompt: '設問 3：J 社は、この特別注文を引き受けるべきか。',
      points: 2,
      options: () => [
        { key: 'A', label: '引き受けるべきである' },
        { key: 'B', label: '断るべきである' },
      ],
      answer: (p) => (model(p).profit > 0 ? 'A' : 'B'),
      hints: {
        A: '差額原価（変動費 + 追加の固定費）が、特別注文の収入を上回る。引き受けると利益が減る。',
        B: '特別注文の収入が、差額原価（変動費 + 追加の固定費）を上回る。単価が製造原価より安くても、既存の固定費は埋没原価なので、引き受けた方が利益は増える。',
      },
    },
  ],
  explanation: (p) => {
    const m = model(p)
    return [
      text(`差額収益 = ${yen(p.units!)} 個 × ${p.specialPrice} 千円 = ${yen(m.revenue)} 千円`),
      text(
        `差額原価 = ${yen(p.units!)} 個 × ${p.unitVariable} 千円 + ${yen(p.additionalFixed!)} 千円 = ${yen(m.cost)} 千円`,
      ),
      text(
        `差額利益 = ${yen(m.revenue)} − ${yen(m.cost)} = ${yen(m.profit)} 千円。${m.profit > 0 ? 'プラスなので引き受ける' : 'マイナスなので断る'}。`,
      ),
      text(
        `1 個あたりの製造原価 ${m.fullUnitCost} 千円には、既存の固定費の配賦額 ${p.unitFixed} 千円が含まれる。既存の固定費は引き受けても増えない埋没原価なので、判断に使わない。遊休設備があり通常の販売に影響しないときは、変動費と追加の固定費だけを差額原価とする。`,
      ),
    ]
  },
}
