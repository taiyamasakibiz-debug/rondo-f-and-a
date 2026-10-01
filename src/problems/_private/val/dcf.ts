import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { discountFactorsTable, factorBlock, text, yen } from '../../helpers'

/**
 * 企業価値・WACC 型 2：DCF 法による企業価値・株主価値と、買収価格の判断。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * - 事業価値 = 予測期間の FCF の現在価値 + 継続価値（3 年目末、FCF3 ×（1 + g）÷（r − g））の現在価値
 * - 企業価値 = 事業価値 + 非事業用資産。株主価値 = 企業価値 − 有利子負債
 * - 罠として、営業負債（買掛金・未払金）も載せる。営業負債は FCF に織り込み済みなので引かない
 */
function model(p: Params) {
  const rate = p.ratePercent! / 100
  const growth = p.growthPercent! / 100
  const factors = discountFactorsTable(rate, 3)
  const fcfs = [p.fcf1!, p.fcf2!, p.fcf3!]
  const forecastPv = fcfs.reduce((sum, fcf, i) => sum + fcf * factors[i]!, 0)
  const terminal = (p.fcf3! * (1 + growth)) / (rate - growth)
  const terminalPv = terminal * factors[2]!
  const enterprise = forecastPv + terminalPv + p.nonOperatingAssets!
  const equity = enterprise - p.interestBearingDebt!
  // 売り手の提示価格は、株主価値の前後（千円単位）
  const offer = Math.round((equity * p.offerPercent!) / 100 / 1_000) * 1_000
  return {
    rate,
    growth,
    factors,
    forecastPv,
    terminal,
    terminalPv,
    enterprise,
    equity,
    offer,
    buy: offer <= equity,
  }
}

export const dcf: ProblemTemplate = {
  id: 'val.dcf',
  topic: 'npv',
  title: 'DCF 法による企業価値と株主価値',
  difficulty: 2,
  source: {
    kind: 'past-exam',
    note: '1 次試験 財務・会計（令和 5 年度 第 17 問、令和 6 年度 第 17 問など）の DCF 法の構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    fcf1: { kind: 'int', min: 10_000, max: 25_000, step: 1_000 },
    fcf2: { kind: 'int', min: 12_000, max: 30_000, step: 1_000 },
    fcf3: { kind: 'int', min: 15_000, max: 35_000, step: 1_000 },
    ratePercent: { kind: 'choice', values: [5, 6, 8] },
    growthPercent: { kind: 'choice', values: [1, 2] },
    nonOperatingAssets: { kind: 'int', min: 10_000, max: 40_000, step: 5_000 },
    interestBearingDebt: { kind: 'int', min: 50_000, max: 150_000, step: 10_000 },
    // 罠の情報：営業負債（株主価値の計算では引かない）
    tradePayables: { kind: 'int', min: 20_000, max: 50_000, step: 5_000 },
    // 提示価格が株主価値の何 % か。100% に近いと判断が紛らわしいので外す
    offerPercent: { kind: 'choice', values: [85, 90, 110, 115] },
  },
  constraint: (p) => p.fcf1! < p.fcf2! && p.fcf2! < p.fcf3! && model(p).equity > 0,
  body: (p) => {
    const m = model(p)
    return [
      text(
        'M 社は、競合企業である L 社の買収を検討している。DCF 法で L 社の企業価値と株主価値を評価し、買収すべきかを判断する。L 社の予測と評価のデータは次のとおりである。',
      ),
      {
        type: 'table',
        caption: 'L 社の予測フリーキャッシュフロー（単位：千円）',
        headers: ['', '1 年目', '2 年目', '3 年目'],
        rows: [['FCF', yen(p.fcf1!), yen(p.fcf2!), yen(p.fcf3!)]],
      },
      text(
        `4 年目以降、FCF は年 ${formatNumber(m.growth * 100)}% で永久に成長すると見込む。L 社の WACC は年 ${formatNumber(m.rate * 100)}% で、FCF は毎年末に生じる。`,
      ),
      {
        type: 'table',
        caption: 'L 社の貸借対照表の一部（単位：千円）',
        headers: ['項目', '金額'],
        rows: [
          ['非事業用資産（有価証券・余剰現金）', yen(p.nonOperatingAssets!)],
          ['有利子負債（借入金・社債）', yen(p.interestBearingDebt!)],
          ['営業負債（買掛金・未払金）', yen(p.tradePayables!)],
        ],
      },
      factorBlock(m.rate, 3),
      text(`売り手は、L 社の全株式の買収価格として ${yen(m.offer)} 千円を提示している。`),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'forecastPv',
      prompt: '設問 1：1〜3 年目の予測 FCF の現在価値の合計を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).forecastPv,
      commonMistakes: [
        {
          answer: (p) => p.fcf1! + p.fcf2! + p.fcf3!,
          hint: '割り引かずに合計していない？ 各年の FCF に、その年の複利現価係数を掛ける。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'enterprise',
      prompt:
        '設問 2：4 年目以降の継続価値も含め、非事業用資産を加えた L 社の企業価値を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 3,
      answer: (p) => model(p).enterprise,
      commonMistakes: [
        {
          answer: (p) => {
            const m = model(p)
            return m.forecastPv + m.terminalPv
          },
          hint: '非事業用資産を足し忘れていない？ 企業価値 = 事業価値 + 非事業用資産。',
        },
        {
          answer: (p) => {
            const m = model(p)
            return m.forecastPv + m.terminal + p.nonOperatingAssets!
          },
          hint: '継続価値を割り引いていない？ 継続価値は 3 年目末の価値なので、3 年目の複利現価係数を掛ける。',
        },
        {
          answer: (p) => {
            const m = model(p)
            return (
              m.forecastPv + (p.fcf3! / (m.rate - m.growth)) * m.factors[2]! + p.nonOperatingAssets!
            )
          },
          hint: '継続価値の分子を 3 年目の FCF のままにしていない？ 4 年目の FCF = 3 年目の FCF ×（1 + 成長率）。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'equity',
      prompt: '設問 3：L 社の株主価値を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).equity,
      commonMistakes: [
        {
          answer: (p) => model(p).equity - p.tradePayables!,
          hint: '営業負債（買掛金・未払金）まで引いていない？ 営業負債は FCF の計算に織り込み済みなので、引くのは有利子負債だけ。',
        },
        {
          answer: (p) => model(p).enterprise,
          hint: '企業価値のままにしていない？ 株主価値 = 企業価値 − 有利子負債。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'decision',
      prompt: '設問 4：M 社は、提示された価格で L 社を買収すべきか。',
      points: 2,
      options: () => [
        { key: 'A', label: '買収すべきである（提示価格は株主価値以下）' },
        { key: 'B', label: '買収すべきではない（提示価格は株主価値を上回る）' },
      ],
      answer: (p) => (model(p).buy ? 'A' : 'B'),
      hints: {
        A: '提示価格が株主価値を上回り、割高。この価格で買うと、払う額が得られる価値より大きい。',
        B: '提示価格が株主価値以下で、割安。この価格で買えば、その差だけ得をする。比べるのは企業価値ではなく株主価値。',
      },
    },
  ],
  explanation: (p) => {
    const m = model(p)
    const f = m.factors.map((factor) => formatNumber(factor, 3))
    return [
      text(
        `予測期間の現在価値 = ${yen(p.fcf1!)} × ${f[0]} + ${yen(p.fcf2!)} × ${f[1]} + ${yen(p.fcf3!)} × ${f[2]} ≒ ${yen(Math.round(m.forecastPv))} 千円`,
      ),
      text(
        `継続価値（3 年目末）= ${yen(p.fcf3!)} × (1 + ${formatNumber(m.growth, 2)}) ÷ (${formatNumber(m.rate, 2)} − ${formatNumber(m.growth, 2)}) ≒ ${yen(Math.round(m.terminal))} 千円。現在価値 = × ${f[2]} ≒ ${yen(Math.round(m.terminalPv))} 千円`,
      ),
      text(
        `企業価値 = ${yen(Math.round(m.forecastPv))} + ${yen(Math.round(m.terminalPv))} + 非事業用資産 ${yen(p.nonOperatingAssets!)} ≒ ${yen(Math.round(m.enterprise))} 千円`,
      ),
      text(
        `株主価値 = 企業価値 − 有利子負債 ${yen(p.interestBearingDebt!)} ≒ ${yen(Math.round(m.equity))} 千円。営業負債は FCF に織り込み済みなので引かない。`,
      ),
      text(
        `提示価格 ${yen(m.offer)} 千円は株主価値${m.buy ? '以下なので、買収すべき' : 'を上回るので、買収すべきではない'}。`,
      ),
    ]
  },
}
