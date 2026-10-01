import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { annuityFactorBlock, annuityFactorOf, text, yen } from '../../helpers'

/**
 * 資金の時間価値 型 1：一括払いと分割払いの現在価値の比較。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 * 分割払いは 1 年後から毎年末（期末払い）なので、年金現価係数をそのまま掛ける。
 */
function model(p: Params) {
  const rate = p.ratePercent! / 100
  const factor = annuityFactorOf(rate, p.years!)
  const installmentPv = p.annualPayment! * factor
  return {
    rate,
    factor,
    installmentPv,
    lumpIsBetter: p.lumpSum! < installmentPv,
    saving: Math.abs(p.lumpSum! - installmentPv),
  }
}

export const paymentPlans: ProblemTemplate = {
  id: 'tvm.payment-plans',
  topic: 'npv',
  title: '一括払いと分割払いの現在価値',
  difficulty: 1,
  source: {
    kind: 'past-exam',
    note: '1 次試験 財務・会計（令和 7 年度 第 14 問など）の年金現価係数の問題の構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    lumpSum: { kind: 'int', min: 8_000, max: 20_000, step: 500 },
    annualPayment: { kind: 'int', min: 1_500, max: 4_500, step: 100 },
    years: { kind: 'int', min: 4, max: 6 },
    ratePercent: { kind: 'choice', values: [3, 4, 5, 6] },
  },
  // 一括払いが有利になるのは 4 割強（1,000 通りで確かめた）
  constraint: (p) => {
    const m = model(p)
    const undiscountedGap = Math.abs(p.lumpSum! - p.annualPayment! * p.years!)
    return (
      // 差が小さいと、どちらが有利かが紛らわしい
      m.saving >= 200 &&
      // 割り引かずに比べた差額の誤答が、正解と同じ値にならない
      Math.round(undiscountedGap) !== Math.round(m.saving)
    )
  },
  body: (p) => {
    const m = model(p)
    return [
      text('H 社は工場の機器を更新するにあたり、販売元から次の 2 つの支払い方法を提示された。'),
      {
        type: 'table',
        caption: '支払い方法',
        headers: ['案', '内容'],
        rows: [
          ['案 1', `購入時に一括で ${yen(p.lumpSum!)} 千円を支払う`],
          ['案 2', `1 年後から毎年末に ${yen(p.annualPayment!)} 千円ずつ、${p.years} 年間支払う`],
        ],
      },
      text(`H 社の割引率（資本コスト）は年 ${formatNumber(m.rate * 100)}% である。`),
      annuityFactorBlock(m.rate, p.years!),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'installmentPv',
      prompt: '設問 1：案 2（分割払い）の支払額の現在価値を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).installmentPv,
      commonMistakes: [
        {
          answer: (p) => p.annualPayment! * p.years!,
          hint: '割り引かずに合計していない？ 毎年同じ額の現在価値は、毎年の額 × 年金現価係数。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'better',
      prompt: '設問 2：支払額の現在価値が小さく、H 社にとって有利な支払い方法はどれか。',
      options: () => [
        { key: 'A', label: '案 1（一括払い）' },
        { key: 'B', label: '案 2（分割払い）' },
      ],
      answer: (p) => (model(p).lumpIsBetter ? 'A' : 'B'),
      hints: {
        A: '案 2 の現在価値は、案 1 の一括払いの額より小さい。支払いの現在価値が小さい方が有利。',
        B: '案 2 の現在価値は、案 1 の一括払いの額より大きい。額面の合計ではなく、現在価値で比べる。',
      },
    },
    {
      kind: 'numeric',
      id: 'saving',
      prompt:
        '設問 3：有利な方を選んだ場合、もう一方と比べて現在価値でいくら得をするか（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).saving,
      commonMistakes: [
        {
          answer: (p) => Math.abs(p.lumpSum! - p.annualPayment! * p.years!),
          hint: '案 2 を割り引かずに比べていない？ 案 2 は現在価値に直してから差を取る。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const m = model(p)
    return [
      text(
        `案 2 の現在価値 = ${yen(p.annualPayment!)} × ${formatNumber(m.factor, 3)} ≒ ${yen(Math.round(m.installmentPv))} 千円`,
      ),
      text(
        `案 1 は ${yen(p.lumpSum!)} 千円（今払うので、そのまま現在価値）。${m.lumpIsBetter ? '案 1 の方が小さいので、一括払いが有利' : '案 2 の方が小さいので、分割払いが有利'}。差は ${yen(Math.round(m.saving))} 千円。`,
      ),
      text(
        '将来の支払いは、割り引くと今の価値は小さくなる。額面の合計（毎年の額 × 年数）で比べると、分割払いを不利に見積もってしまう。',
      ),
    ]
  },
}
