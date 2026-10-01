import { afterTaxOperatingCashFlow, straightLineDepreciation } from '@/domain/investment/investment'
import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { amountTable, annuityFactorBlock, annuityFactorOf, text, yen } from '../../helpers'

const TAX_RATE = 0.3

/**
 * 事例Ⅳ総合 型 2：新規の設備投資の NPV と、全額借入による安全性の変化。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * - 毎年の CF が同じなので、年金現価係数で割り引く（係数は試験と同じく小数第 3 位まで）
 * - 借入で投資すると、総資産と負債が同じ額だけ増える（自己資本は変わらない）
 */
function model(p: Params) {
  const years = p.years!
  const investment = p.investment!
  const depreciation = straightLineDepreciation(investment, 0, years)
  const cashFlow = afterTaxOperatingCashFlow({
    revenue: p.revenueIncrease!,
    cashExpenses: p.expenseIncrease!,
    depreciation,
    taxRate: TAX_RATE,
  })
  const rate = p.ratePercent! / 100
  const factor = annuityFactorOf(rate, years)
  const npv = cashFlow * factor - investment
  const equityRatioAfter = (p.equityBase! / (p.assetsBase! + investment)) * 100
  return { years, investment, depreciation, cashFlow, rate, factor, npv, equityRatioAfter }
}

export const investmentAndFunding: ProblemTemplate = {
  id: 'case4.investment-funding',
  topic: 'npv',
  title: '【総合】設備投資の採否と借入による安全性の変化',
  difficulty: 3,
  source: {
    kind: 'past-exam',
    note: '平成 29 年度 事例Ⅳ 第 3 問（投資評価）・第 4 問（財務への影響）の構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    investment: { kind: 'int', min: 50_000, max: 200_000, step: 10_000 },
    years: { kind: 'int', min: 4, max: 5 },
    // 採用と見送りが 6：4 くらいで出る範囲（NotebookLM の案だと、見送りが 1 割しか出ない）
    revenueIncrease: { kind: 'int', min: 20_000, max: 60_000, step: 5_000 },
    expenseIncrease: { kind: 'int', min: 10_000, max: 40_000, step: 2_000 },
    ratePercent: { kind: 'choice', values: [6, 8, 10] },
    assetsBase: { kind: 'int', min: 200_000, max: 500_000, step: 10_000 },
    equityBase: { kind: 'int', min: 80_000, max: 250_000, step: 5_000 },
  },
  constraint: (p) => {
    const m = model(p)
    return (
      // 投資による税引前の利益の増分がプラス
      p.revenueIncrease! > p.expenseIncrease! + m.depreciation &&
      // NPV がゼロに近すぎると、採否の判断が紛らわしい
      Math.abs(m.npv) >= 3_000 &&
      p.assetsBase! > p.equityBase!
    )
  },
  body: (p) => {
    const m = model(p)
    return [
      text(
        'E 社は清涼飲料水のメーカーである。生産能力を増やすため、新しい製造ラインの導入を検討している。投資計画と、E 社の現在の財務状況は次のとおりである。',
      ),
      amountTable('投資計画（単位：千円）', [
        ['初期投資額（期首に全額を現金で支出）', m.investment],
        ['毎年の現金売上の増加額', p.revenueIncrease!],
        ['毎年の現金費用の増加額（減価償却費を除く）', p.expenseIncrease!],
      ]),
      text(
        `設備は ${m.years} 年間使い、残存価額は 0、定額法で減価償却する。法人税等の税率は ${TAX_RATE * 100}% とし、E 社は他の事業で十分な利益を上げているものとする。割引率（資本コスト）は ${formatNumber(m.rate * 100)}% で、キャッシュフローは毎年末に生じる。`,
      ),
      amountTable('E 社の現在の貸借対照表（要約、単位：千円）', [
        ['総資産', p.assetsBase!],
        ['負債', p.assetsBase! - p.equityBase!],
        ['自己資本（純資産）', p.equityBase!],
      ]),
      text(
        `投資資金 ${yen(m.investment)} 千円は、全額を長期借入金で調達する計画である（利息は考えない）。`,
      ),
      annuityFactorBlock(m.rate, m.years),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'cashFlow',
      prompt:
        '設問 1：この投資の毎年の税引後キャッシュフローを求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 4,
      answer: (p) => model(p).cashFlow,
      commonMistakes: [
        {
          answer: (p) => (p.revenueIncrease! - p.expenseIncrease!) * (1 - TAX_RATE),
          hint: '減価償却費の節税効果（減価償却費 × 税率）を入れ忘れていない？',
        },
        {
          answer: (p) =>
            (p.revenueIncrease! - p.expenseIncrease! - model(p).depreciation) * (1 - TAX_RATE),
          hint: '減価償却費を足し戻していない？ 減価償却費は現金の支出ではない。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'npv',
      prompt:
        '設問 2：この投資の正味現在価値（NPV）を求めよ（千円、千円未満を四捨五入。マイナスは △ を付ける）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 4,
      answer: (p) => model(p).npv,
      commonMistakes: [
        {
          answer: (p) => {
            const m = model(p)
            return m.cashFlow * m.years - m.investment
          },
          hint: 'キャッシュフローを割り引いていない？ 毎年同じ CF には年金現価係数を掛ける。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'decision',
      prompt: '設問 3：NPV にもとづいて、この投資の採否を選べ。',
      points: 3,
      options: () => [
        { key: 'A', label: '採用すべきである' },
        { key: 'B', label: '見送るべきである' },
      ],
      answer: (p) => (model(p).npv > 0 ? 'A' : 'B'),
      hints: {
        A: 'NPV がマイナスの投資は、資本コストに見合う回収ができない。',
        B: 'NPV がプラスなら、資本コストを上回るリターンが見込める。',
      },
    },
    {
      kind: 'numeric',
      id: 'equityRatioAfter',
      prompt:
        '設問 4：投資額の全額を長期借入金で調達して投資した直後の、自己資本比率を求めよ（%、小数点第 2 位を四捨五入）。',
      unit: '%',
      rounding: { mode: 'halfUp', digits: 1 },
      points: 4,
      answer: (p) => model(p).equityRatioAfter,
      commonMistakes: [
        {
          answer: (p) => (p.equityBase! / p.assetsBase!) * 100,
          hint: '総資産を更新していない？ 借入で投資すると、負債と同時に総資産も同じ額だけ増える。',
        },
        {
          answer: (p) => ((p.equityBase! + p.investment!) / (p.assetsBase! + p.investment!)) * 100,
          hint: '自己資本に足していない？ 借入金は負債なので、自己資本は増えない。',
        },
      ],
    },
    {
      kind: 'written',
      id: 'advice',
      prompt:
        '設問 5：投資の採否と、全額を借入で調達することが E 社の財務の安全性に与える影響、およびその対策を 80 字以内で述べよ。',
      points: 5,
      maxLength: 80,
      keywords: (p) => [
        model(p).npv > 0
          ? { label: '採否（採用）', anyOf: ['採用', '投資すべき', '実施すべき'] }
          : { label: '採否（見送り）', anyOf: ['見送'] },
        { label: '安全性への影響（自己資本比率の低下）', anyOf: ['自己資本比率', '安全性'] },
        {
          label: '対策（増資・返済・自己資金など）',
          anyOf: ['増資', '返済', '段階的', '自己資金', '内部留保', '利益蓄積', '充当'],
        },
      ],
      modelAnswer: (p) =>
        model(p).npv > 0
          ? 'NPVが正のため投資を採用するが、全額借入で自己資本比率が低下し安全性は悪化する。増資の検討や利益蓄積による早期返済を進めるべきである。'
          : 'NPVが負のため投資は見送る。全額借入で実行すれば自己資本比率が低下し安全性を損なうため、計画の見直しや自己資金の充当で再検討すべきである。',
    },
  ],
  explanation: (p) => {
    const m = model(p)
    return [
      text(`減価償却費 = ${yen(m.investment)} ÷ ${m.years} 年 = ${yen(m.depreciation)} 千円`),
      text(
        `税引後 CF = (${yen(p.revenueIncrease!)} − ${yen(p.expenseIncrease!)} − ${yen(m.depreciation)}) × (1 − ${TAX_RATE}) + ${yen(m.depreciation)} = ${yen(Math.round(m.cashFlow))} 千円`,
      ),
      text(
        `NPV = ${yen(Math.round(m.cashFlow))} × ${formatNumber(m.factor, 3)} − ${yen(m.investment)} ≒ ${yen(Math.round(m.npv))} 千円。${m.npv > 0 ? 'プラスなので採用' : 'マイナスなので見送り'}。`,
      ),
      text(
        `借入で投資すると総資産も ${yen(m.investment)} 千円増える。自己資本比率 = ${yen(p.equityBase!)} ÷ (${yen(p.assetsBase!)} + ${yen(m.investment)}) = ${formatNumber(Math.round(m.equityRatioAfter * 10) / 10, 1)}%（投資前は ${formatNumber(Math.round((p.equityBase! / p.assetsBase!) * 1000) / 10, 1)}%）。`,
      ),
      text(
        '助言は、採否の判断と矛盾しない向きで、借入による安全性の低下と、その手当（増資、返済計画、自己資金の充当など）に触れる。',
      ),
    ]
  },
}
