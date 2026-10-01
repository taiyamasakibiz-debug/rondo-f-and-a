import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { amountTable, annuityFactorBlock, annuityFactorOf, text, yen } from '../../helpers'

const TAX_RATE = 0.3
const YEARS = 5

/**
 * 事例Ⅳ総合 型 4：設備の取替投資の差額キャッシュフローと、借入による財務への影響。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * - 0 年目：新設備の購入 − 旧設備の売却収入。売却損なら節税（キャッシュイン）、売却益なら納税（アウト）
 * - 毎年：費用の削減額 ×（1 − 税率）＋ 差額の減価償却費 × 税率
 * - 旧設備も残り 5 年・残存価額 0 で償却している前提
 */
function model(p: Params) {
  const newCost = p.newCost!
  const oldBook = p.oldBook!
  const oldSale = p.oldSale!
  const gainOnSale = oldSale - oldBook
  const initial = newCost - oldSale + gainOnSale * TAX_RATE
  const newDepreciation = newCost / YEARS
  const oldDepreciation = oldBook / YEARS
  const depreciationDiff = newDepreciation - oldDepreciation
  const cashFlow = p.costSaving! * (1 - TAX_RATE) + depreciationDiff * TAX_RATE
  const rate = p.ratePercent! / 100
  const factor = annuityFactorOf(rate, YEARS)
  const npv = cashFlow * factor - initial
  const equityRatioBefore = (p.equityBase! / p.assetsBase!) * 100
  const equityRatioAfter = (p.equityBase! / (p.assetsBase! + initial)) * 100
  return {
    newCost,
    oldBook,
    oldSale,
    gainOnSale,
    initial,
    newDepreciation,
    oldDepreciation,
    depreciationDiff,
    cashFlow,
    rate,
    factor,
    npv,
    equityRatioBefore,
    equityRatioAfter,
  }
}

export const replacementFunding: ProblemTemplate = {
  id: 'case4.replacement-funding',
  topic: 'npv',
  title: '【総合】設備の取替投資と借入による財務への影響',
  difficulty: 3,
  source: {
    kind: 'past-exam',
    note: '平成 27 年度 事例Ⅳ 第 3 問（取替投資の差額 CF）・令和 4 年度 事例Ⅳ 第 1 問（財務比率の変化）の構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    newCost: { kind: 'int', min: 80_000, max: 160_000, step: 10_000 },
    oldBook: { kind: 'int', min: 15_000, max: 35_000, step: 5_000 },
    oldSale: { kind: 'int', min: 5_000, max: 25_000, step: 5_000 },
    // 実行と見送りが 6：4 くらいで出る範囲（NotebookLM の案 20,000〜45,000 だと、実行が 7 割を超える）
    costSaving: { kind: 'int', min: 15_000, max: 40_000, step: 2_500 },
    ratePercent: { kind: 'choice', values: [5, 6] },
    assetsBase: { kind: 'int', min: 300_000, max: 600_000, step: 20_000 },
    equityBase: { kind: 'int', min: 120_000, max: 250_000, step: 10_000 },
  },
  constraint: (p) => {
    const m = model(p)
    return (
      // 売却損益が出て、税効果の計算が要る
      p.oldBook !== p.oldSale &&
      // NPV が 0 に近いと、採否の判断が紛らわしい
      Math.abs(m.npv) >= 2_000 &&
      // 借入による自己資本比率の低下が、はっきり出る
      m.equityRatioBefore - m.equityRatioAfter >= 1.5
    )
  },
  body: (p) => {
    const m = model(p)
    return [
      text(
        '金属加工メーカーの G 社は、使っている旧式の加工機械を、省エネ性能の高い新しい機械に買い替える取替投資を検討している。',
      ),
      amountTable('設備に関する情報（単位：千円）', [
        ['新設備の購入価額', m.newCost],
        ['旧設備の帳簿価額', m.oldBook],
        ['旧設備の現時点の売却価額', m.oldSale],
        ['取替による毎年の現金費用の削減額', p.costSaving!],
      ]),
      text(
        `新設備・旧設備とも、残りの耐用年数は ${YEARS} 年、残存価額は 0 で、定額法で減価償却する。旧設備は今すぐ売却できる。取替による売上高の変化はない。法人税等の税率は ${TAX_RATE * 100}% とし、G 社は他の事業で十分な利益を上げているものとする。割引率は ${formatNumber(m.rate * 100)}% で、キャッシュフローは毎年末に生じる。`,
      ),
      amountTable('G 社の現在の財務状況（単位：千円）', [
        ['総資産', p.assetsBase!],
        ['自己資本', p.equityBase!],
      ]),
      text(
        '取替に必要な正味の初期投資額（新設備の購入価額 − 旧設備の売却収入 ± 売却損益の税効果）は、全額を銀行からの長期借入金で調達する計画である。',
      ),
      annuityFactorBlock(m.rate, YEARS),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'initial',
      prompt:
        '設問 1：取替投資を行う時点（0 年目）の、正味の初期投資額（キャッシュアウトフロー）を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 4,
      answer: (p) => model(p).initial,
      commonMistakes: [
        {
          answer: (p) => p.newCost! - p.oldSale!,
          hint: '旧設備の売却損益の税効果を入れ忘れていない？ 売却損なら税金が減り、売却益なら税金が増える。',
        },
        {
          answer: (p) => {
            const m = model(p)
            return m.newCost - m.oldSale - m.gainOnSale * TAX_RATE
          },
          hint: '税効果の向きが逆になっていない？ 売却損（帳簿価額 > 売却価額）は節税になり、初期投資額を減らす。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'cashFlow',
      prompt:
        '設問 2：取替による毎年の差額キャッシュフロー（インフロー）を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 4,
      answer: (p) => model(p).cashFlow,
      commonMistakes: [
        {
          answer: (p) => p.costSaving! * (1 - TAX_RATE),
          hint: '減価償却費の増加による節税効果を入れ忘れていない？ 差額の減価償却費 × 税率を足す。',
        },
        {
          answer: (p) => p.costSaving! * (1 - TAX_RATE) + model(p).newDepreciation * TAX_RATE,
          hint: '新設備の減価償却費をそのまま使っていない？ 旧設備を使い続けた場合との差額（新 − 旧）で考える。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'npv',
      prompt:
        '設問 3：この取替投資の正味現在価値（NPV）を求めよ（千円、千円未満を四捨五入。マイナスは △ を付ける）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 4,
      answer: (p) => model(p).npv,
      commonMistakes: [
        {
          answer: (p) => {
            const m = model(p)
            return m.cashFlow * YEARS - m.initial
          },
          hint: 'キャッシュフローを割り引いていない？ 毎年同じ CF には年金現価係数を掛ける。',
        },
        {
          answer: (p) => {
            const m = model(p)
            return m.cashFlow * m.factor - m.newCost
          },
          hint: '初期投資額に新設備の購入価額をそのまま使っていない？ 旧設備の売却収入と税効果を差し引いた正味の額を使う。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'decision',
      prompt: '設問 4：NPV にもとづいて、取替投資を行うべきか。',
      points: 3,
      options: () => [
        { key: 'A', label: '新設備への取替を行うべきである' },
        { key: 'B', label: '取替を見送り、旧設備を使い続けるべきである' },
      ],
      answer: (p) => (model(p).npv > 0 ? 'A' : 'B'),
      hints: {
        A: 'NPV がマイナスなので、取替を行うと企業価値を損なう。',
        B: 'NPV がプラスなので、費用削減による CF が初期投資を上回り、企業価値が高まる。',
      },
    },
    {
      kind: 'written',
      id: 'advice',
      prompt:
        '設問 5：取替投資の採否と、取替を行う場合の財務構造（自己資本比率）への影響、およびその対策を 80 字以内で述べよ。',
      points: 5,
      maxLength: 80,
      keywords: (p) =>
        model(p).npv > 0
          ? [
              { label: '採否（実行）', anyOf: ['実行', '採用', '取替を行う'] },
              { label: '影響（自己資本比率の低下）', anyOf: ['自己資本比率'] },
              {
                label: '対策（利益の蓄積・早期返済など）',
                anyOf: ['返済', '利益蓄積', '内部留保', '増資'],
              },
            ]
          : [
              { label: '採否（見送り）', anyOf: ['見送'] },
              { label: '影響（自己資本比率の低下を避ける）', anyOf: ['自己資本比率'] },
              {
                label: '対策（旧設備の保守・コスト維持など）',
                anyOf: ['メンテナンス', '保守', '維持', '延命', '再検討'],
              },
            ],
      modelAnswer: (p) =>
        model(p).npv > 0
          ? 'NPVが正のため取替を実行する。全額借入により総資産と負債が拡大し自己資本比率は低下するため、費用削減による利益蓄積を進め早期返済を図る。'
          : 'NPVが負のため取替は見送る。借入による自己資本比率の低下と財務健全性の悪化を避け、旧設備の適切なメンテナンスでコストの維持に努める。',
    },
  ],
  explanation: (p) => {
    const m = model(p)
    const saleText =
      m.gainOnSale < 0
        ? `売却損 ${yen(-m.gainOnSale)} 千円の節税効果 ${yen(-m.gainOnSale * TAX_RATE)} 千円を差し引く`
        : `売却益 ${yen(m.gainOnSale)} 千円にかかる税金 ${yen(m.gainOnSale * TAX_RATE)} 千円を足す`
    return [
      text(
        `正味の初期投資額 = ${yen(m.newCost)} − ${yen(m.oldSale)}（${saleText}）= ${yen(m.initial)} 千円`,
      ),
      text(
        `差額の減価償却費 = ${yen(m.newDepreciation)} − ${yen(m.oldDepreciation)} = ${yen(m.depreciationDiff)} 千円。毎年の差額 CF = ${yen(p.costSaving!)} × (1 − ${TAX_RATE}) + ${yen(m.depreciationDiff)} × ${TAX_RATE} = ${yen(Math.round(m.cashFlow))} 千円`,
      ),
      text(
        `NPV = ${yen(Math.round(m.cashFlow))} × ${formatNumber(m.factor, 3)} − ${yen(m.initial)} ≒ ${yen(Math.round(m.npv))} 千円。${m.npv > 0 ? 'プラスなので取替を行う' : 'マイナスなので見送る'}。`,
      ),
      text(
        `借入で取替を行うと、自己資本比率は ${formatNumber(Math.round(m.equityRatioBefore * 10) / 10, 1)}% から ${formatNumber(Math.round(m.equityRatioAfter * 10) / 10, 1)}% に下がる（総資産と負債が同じ額だけ増える）。`,
      ),
    ]
  },
}
