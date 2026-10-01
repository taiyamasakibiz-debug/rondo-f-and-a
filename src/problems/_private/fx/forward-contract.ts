import type { Params, ProblemTemplate } from '@/engine/types'
import { text, yen } from '../../helpers'

/**
 * 為替・デリバティブ 型 1：為替予約と、決済日の直物レートで決済した場合の比較。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * - 輸出（ドルを受け取る）：直物が予約より円高（安い）なら、予約して得
 * - 輸入（ドルを支払う）：直物が予約より円安（高い）なら、予約して得
 * 直物と予約の差（−10〜+10 円、0 を除く）の正負で、得か損かが半々になる。輸出か輸入かも半々。
 * 罠として、取引時のアナリストの予測レートも載せる。
 */
function model(p: Params) {
  const isExport = p.tradeType === 1
  const spot = p.forwardRate! + p.spotDiff!
  const withContract = p.amount! * p.forwardRate!
  const withoutContract = p.amount! * spot
  // 輸出は受取額が多いほど、輸入は支払額が少ないほど得
  const contractWasBetter = isExport
    ? withContract > withoutContract
    : withContract < withoutContract
  return {
    isExport,
    spot,
    withContract,
    withoutContract,
    difference: Math.abs(withContract - withoutContract),
    contractWasBetter,
  }
}

export const forwardContract: ProblemTemplate = {
  id: 'fx.forward-contract',
  topic: 'npv',
  title: '為替予約と直物レートでの決済の比較',
  difficulty: 2,
  source: {
    kind: 'past-exam',
    note: '1 次試験 財務・会計（令和 6 年度 第 18 問、令和 7 年度 第 18 問など）の為替予約の構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    // 1 = 輸出（ドルを受け取る）、2 = 輸入（ドルを支払う）
    tradeType: { kind: 'choice', values: [1, 2] },
    amount: { kind: 'int', min: 100, max: 500, step: 50 },
    forwardRate: { kind: 'int', min: 140, max: 150 },
    spotDiff: { kind: 'int', min: -10, max: 10 },
    // 罠の情報：取引時のアナリストの予測レート（決済額には関係しない）
    forecastRate: { kind: 'int', min: 130, max: 160, step: 5 },
  },
  constraint: (p) => {
    const spot = p.forwardRate! + p.spotDiff!
    return (
      p.spotDiff !== 0 &&
      // 予測レートで計算した誤答が、正解と同じ値にならない
      p.forecastRate !== p.forwardRate &&
      p.forecastRate !== spot &&
      Math.abs(p.forecastRate! - spot) !== Math.abs(p.spotDiff!)
    )
  },
  body: (p) => {
    const m = model(p)
    return [
      text(
        `K 社は海外と取引しており、為替の変動のリスクを避けるため、銀行と為替予約を結んだ。取引は、${
          m.isExport ? '製品の輸出による代金の受け取り' : '原材料の輸入による代金の支払い'
        }（${yen(p.amount!)} 千ドル）である。`,
      ),
      {
        type: 'table',
        caption: '為替レート（1 ドルあたり）',
        headers: ['項目', 'レート'],
        rows: [
          ['為替予約のレート', `${p.forwardRate} 円`],
          ['取引時にアナリストが予測していた決済日のレート（参考）', `${p.forecastRate} 円`],
          ['決済日の実際の直物レート', `${m.spot} 円`],
        ],
      },
      text(
        'K 社は為替予約を結んでいたので、決済日の直物レートにかかわらず、予約のレートで決済した。',
      ),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'withContract',
      prompt: '設問 1：為替予約のレートで決済した、円での受取額または支払額を求めよ（千円）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).withContract,
      commonMistakes: [
        {
          answer: (p) => p.amount! * p.forecastRate!,
          hint: 'アナリストの予測レートを使っていない？ 為替予約を結んだので、決済額は予約のレートで決まる。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'withoutContract',
      prompt:
        '設問 2：為替予約を結ばず、決済日の直物レートで決済していた場合の円の金額を求めよ（千円）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).withoutContract,
      commonMistakes: [
        {
          answer: (p) => p.amount! * p.forecastRate!,
          hint: 'アナリストの予測レートを使っていない？ 予約しなければ、決済日の実際の直物レートで決済する。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'difference',
      prompt:
        '設問 3：為替予約をした場合としなかった場合の、円の金額の差を求めよ（千円、差の大きさで答える）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).difference,
      commonMistakes: [
        {
          answer: (p) => p.amount! * Math.abs(p.forecastRate! - model(p).spot),
          hint: '予測レートと比べていない？ 比べるのは、予約のレートと決済日の直物レート。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'evaluation',
      prompt: '設問 4：結果から見て、今回の為替予約の評価として最も適切なものはどれか。',
      points: 2,
      options: () => [
        { key: 'A', label: '為替予約を結んでおいてよかった（直物で決済するより有利だった）' },
        { key: 'B', label: '為替予約を結ばず、直物で決済した方がよかった' },
      ],
      answer: (p) => (model(p).contractWasBetter ? 'A' : 'B'),
      hints: {
        A: '直物レートの方が有利だった。輸出（受け取り）は円安で、輸入（支払い）は円高で、直物の方が得になる。',
        B: '直物レートの方が不利だった。輸出（受け取り）は円高で、輸入（支払い）は円安で、予約していた方が得になる。',
      },
    },
  ],
  explanation: (p) => {
    const m = model(p)
    const direction = p.spotDiff! > 0 ? '円安' : '円高'
    return [
      text(
        `予約のレートでの金額 = ${yen(p.amount!)} 千ドル × ${p.forwardRate} 円 = ${yen(m.withContract)} 千円`,
      ),
      text(
        `直物レートでの金額 = ${yen(p.amount!)} 千ドル × ${m.spot} 円 = ${yen(m.withoutContract)} 千円（差 ${yen(m.difference)} 千円）`,
      ),
      text(
        `決済日は予約のレートより${direction}になった。${m.isExport ? '輸出（受け取り）' : '輸入（支払い）'}なので、${
          m.contractWasBetter ? '予約していた方が有利だった' : '直物で決済した方が有利だった'
        }。`,
      ),
      text(
        'アナリストの予測レートは、決済額に関係しない。為替予約は結果として損になることもあるが、決済額を確定させてリスクを避けることが目的である。',
      ),
    ]
  },
}
