import { formatNumber } from '@/engine/numbers'
import type { Block, Params, ProblemTemplate } from '@/engine/types'
import { text, yen } from '../../helpers'

const TAX_RATE = 0.3

/**
 * 企業価値・WACC 型 1：CAPM による株主資本コストと、時価で重み付けした WACC。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * - 株主資本コスト = リスクフリーレート + β × 市場リスクプレミアム
 * - WACC = 株主資本コスト × 株主資本の時価の比率 + 負債コスト ×（1 − 税率）× 負債の時価の比率
 * - 罠として、簿価（B/S の値）も並べて載せる
 * 設問 3 は、NotebookLM の案（WACC が「目標ハードルレート」以下か）を、
 * 新規事業の期待収益率と WACC を比べて投資すべきかの判断に変えた（WACC は達成する目標ではなく、投資のハードルなので）
 */
function model(p: Params) {
  const costOfEquity = p.riskFree! + p.beta! * p.marketPremium!
  const afterTaxDebt = p.debtCost! * (1 - TAX_RATE)
  const weighted = (equity: number, debt: number, debtCost: number) =>
    (costOfEquity * equity + debtCost * debt) / (equity + debt)
  return {
    costOfEquity,
    afterTaxDebt,
    wacc: weighted(p.equityMarket!, p.debtMarket!, afterTaxDebt),
    bookWacc: weighted(p.equityBook!, p.debtBook!, afterTaxDebt),
    preTaxWacc: weighted(p.equityMarket!, p.debtMarket!, p.debtCost!),
    invest: p.projectReturn! > weighted(p.equityMarket!, p.debtMarket!, afterTaxDebt),
  }
}

const round1 = (value: number) => Math.round(value * 10) / 10

export const wacc: ProblemTemplate = {
  id: 'val.wacc',
  topic: 'npv',
  title: 'CAPM と WACC（時価のウェイト）',
  difficulty: 2,
  source: {
    kind: 'past-exam',
    note: '1 次試験 財務・会計（令和 6 年度 第 15 問、令和 7 年度 第 16 問など）の WACC・CAPM の構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    riskFree: { kind: 'choice', values: [1, 1.5, 2, 2.5, 3] },
    beta: { kind: 'choice', values: [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5] },
    marketPremium: { kind: 'choice', values: [4, 4.5, 5, 5.5, 6] },
    debtCost: { kind: 'choice', values: [2, 2.5, 3, 3.5, 4, 4.5, 5] },
    equityMarket: { kind: 'int', min: 300_000, max: 800_000, step: 50_000 },
    debtMarket: { kind: 'int', min: 200_000, max: 600_000, step: 50_000 },
    // 罠の情報：簿価（WACC のウェイトには使わない）
    equityBook: { kind: 'int', min: 100_000, max: 300_000, step: 50_000 },
    debtBook: { kind: 'int', min: 200_000, max: 600_000, step: 50_000 },
    // 新規事業の期待収益率（%）。WACC の中央値（5.5% くらい）の前後で、投資する・しないが半々くらいになる
    projectReturn: { kind: 'choice', values: [3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5] },
  },
  constraint: (p) => {
    const m = model(p)
    // 丸めた値どうしで比べて、誤答と正解がはっきり違い、判断が紛らわしくない
    return (
      Math.abs(round1(m.wacc) - round1(m.bookWacc)) >= 0.3 &&
      Math.abs(round1(m.wacc) - round1(m.preTaxWacc)) >= 0.3 &&
      Math.abs(p.projectReturn! - m.wacc) >= 0.3
    )
  },
  body: (p) => {
    const table: Block = {
      type: 'table',
      caption: 'K 社の資本構成（単位：千円）',
      headers: ['項目', '時価', '簿価'],
      rows: [
        ['株主資本', yen(p.equityMarket!), yen(p.equityBook!)],
        ['負債', yen(p.debtMarket!), yen(p.debtBook!)],
      ],
    }
    return [
      text(
        'K 社は新規事業への投資を判断するため、全社の加重平均資本コスト（WACC）を求めることにした。資本コストと資本構成に関するデータは次のとおりである。',
      ),
      {
        type: 'table',
        caption: '資本コストのデータ',
        headers: ['項目', '値'],
        rows: [
          ['リスクフリーレート', `${formatNumber(p.riskFree!)}%`],
          ['K 社株式のベータ値（β）', formatNumber(p.beta!, 1)],
          ['市場リスクプレミアム', `${formatNumber(p.marketPremium!)}%`],
          ['負債コスト（税引前）', `${formatNumber(p.debtCost!)}%`],
          ['法人税等の税率', `${TAX_RATE * 100}%`],
        ],
      },
      table,
      text(
        `WACC の資本構成のウェイトには時価を用いる。計算の途中では端数を丸めない。新規事業の期待収益率は年 ${formatNumber(p.projectReturn!)}% と見込まれている。`,
      ),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'costOfEquity',
      prompt:
        '設問 1：CAPM にもとづいて、K 社の株主資本コストを求めよ（%、小数点第 2 位を四捨五入）。',
      unit: '%',
      rounding: { mode: 'halfUp', digits: 1 },
      points: 2,
      answer: (p) => model(p).costOfEquity,
      commonMistakes: [
        {
          answer: (p) => p.beta! * p.marketPremium!,
          hint: 'リスクフリーレートを足し忘れていない？ 株主資本コスト = リスクフリーレート + β × 市場リスクプレミアム。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'wacc',
      prompt: '設問 2：K 社の WACC を求めよ（%、小数点第 2 位を四捨五入）。',
      unit: '%',
      rounding: { mode: 'halfUp', digits: 1 },
      points: 3,
      answer: (p) => model(p).wacc,
      commonMistakes: [
        {
          answer: (p) => model(p).bookWacc,
          hint: 'ウェイトに簿価を使っていない？ WACC のウェイトには、市場の評価を表す時価を使う。',
        },
        {
          answer: (p) => model(p).preTaxWacc,
          hint: '負債コストを税引前のまま使っていない？ 支払利息は損金になるので、負債コスト ×（1 − 税率）を使う。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'decision',
      prompt: '設問 3：WACC をハードルレートとすると、K 社はこの新規事業に投資すべきか。',
      points: 2,
      options: () => [
        { key: 'A', label: '投資すべきである' },
        { key: 'B', label: '投資すべきではない' },
      ],
      answer: (p) => (model(p).invest ? 'A' : 'B'),
      hints: {
        A: '期待収益率が WACC を下回る。資金の提供者が求める収益を賄えないので、投資すべきではない。',
        B: '期待収益率が WACC を上回る。資金の提供者が求める収益を超える収益が見込めるので、投資すべき。',
      },
    },
  ],
  explanation: (p) => {
    const m = model(p)
    const equityWeight = p.equityMarket! / (p.equityMarket! + p.debtMarket!)
    return [
      text(
        `株主資本コスト = ${formatNumber(p.riskFree!)}% + ${formatNumber(p.beta!, 1)} × ${formatNumber(p.marketPremium!)}% = ${formatNumber(m.costOfEquity, 2)}%`,
      ),
      text(
        `税引後の負債コスト = ${formatNumber(p.debtCost!)}% × (1 − ${TAX_RATE}) = ${formatNumber(m.afterTaxDebt, 2)}%`,
      ),
      text(
        `WACC = ${formatNumber(m.costOfEquity, 2)}% × ${formatNumber(equityWeight, 3)} + ${formatNumber(m.afterTaxDebt, 2)}% × ${formatNumber(1 - equityWeight, 3)} ≒ ${formatNumber(round1(m.wacc), 1)}%（ウェイトは時価：株主資本 ${yen(p.equityMarket!)}、負債 ${yen(p.debtMarket!)}）`,
      ),
      text(
        `期待収益率 ${formatNumber(p.projectReturn!)}% は WACC を${m.invest ? '上回るので、投資すべき' : '下回るので、投資すべきではない'}。`,
      ),
    ]
  },
}
