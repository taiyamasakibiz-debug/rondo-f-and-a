import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { amountTable, text, yen } from '../../helpers'

/**
 * 企業価値・WACC 型 3：EV/EBITDA 倍率（マルチプル法）による評価と、同業他社との比較。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * - EBITDA = 営業利益 + 減価償却費（支払利息や特別損失は含めない）
 * - EV = 株式時価総額 + 有利子負債 − 現金及び預金（営業負債は引かない）
 * - 罠として、支払利息・特別損失・営業負債も載せる
 */
function model(p: Params) {
  const ebitda = p.operatingProfit! + p.depreciation!
  const ev = p.marketCap! + p.interestBearingDebt! - p.cash!
  const multiple = ev / ebitda
  return {
    ebitda,
    ev,
    multiple,
    cheap: multiple < p.peerMultiple!,
    // よくある誤答の倍率
    wrongEbitdaMultiple: ev / (ebitda - p.interestExpense! - p.extraordinaryLoss!),
    wrongEvMultiple: (ev - p.tradePayables!) / ebitda,
    marketCapMultiple: p.marketCap! / ebitda,
    operatingProfitMultiple: ev / p.operatingProfit!,
  }
}

const round1 = (value: number) => Math.round(value * 10) / 10

export const evEbitda: ProblemTemplate = {
  id: 'val.ev-ebitda',
  topic: 'npv',
  title: 'EV/EBITDA 倍率による評価',
  difficulty: 2,
  source: {
    kind: 'past-exam',
    note: '1 次試験 財務・会計（令和 5 年度 第 17 問、令和 6 年度 第 16 問など）のマルチプル法の構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    operatingProfit: { kind: 'int', min: 50_000, max: 150_000, step: 10_000 },
    depreciation: { kind: 'int', min: 10_000, max: 40_000, step: 5_000 },
    // 罠の情報：EBITDA に含めない
    interestExpense: { kind: 'int', min: 5_000, max: 20_000, step: 1_000 },
    extraordinaryLoss: { kind: 'int', min: 2_000, max: 10_000, step: 1_000 },
    interestBearingDebt: { kind: 'int', min: 100_000, max: 400_000, step: 20_000 },
    cash: { kind: 'int', min: 30_000, max: 120_000, step: 10_000 },
    // 罠の情報：EV から引かない
    tradePayables: { kind: 'int', min: 20_000, max: 80_000, step: 5_000 },
    marketCap: { kind: 'int', min: 300_000, max: 1_200_000, step: 50_000 },
    peerMultiple: { kind: 'choice', values: [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9] },
  },
  // 割安が 4 割強、割高が 6 割弱（1,000 通りで確かめた）
  constraint: (p) => {
    const m = model(p)
    const answer = round1(m.multiple)
    const mistakes = [
      m.wrongEbitdaMultiple,
      m.wrongEvMultiple,
      m.marketCapMultiple,
      m.operatingProfitMultiple,
    ]
    return (
      // 同業他社との差が小さいと、割安か割高かが紛らわしい
      Math.abs(m.multiple - p.peerMultiple!) >= 0.5 &&
      // 誤答の倍率が、丸めたあとも正解とはっきり違う
      mistakes.every((value) => Math.abs(round1(value) - answer) >= 0.2)
    )
  },
  body: (p) => [
    text(
      'N 社は事業を広げるため、L 社の買収を検討している。同業他社と比べやすいマルチプル法（EV/EBITDA 倍率）で、L 社を評価することにした。L 社の当期のデータは次のとおりである。',
    ),
    amountTable('L 社の損益のデータ（単位：千円）', [
      ['営業利益', p.operatingProfit!],
      ['減価償却費', p.depreciation!],
      ['支払利息（営業外費用）', p.interestExpense!],
      ['特別損失', p.extraordinaryLoss!],
    ]),
    amountTable('L 社の財務・株式のデータ（単位：千円）', [
      ['株式時価総額', p.marketCap!],
      ['有利子負債（借入金・社債）', p.interestBearingDebt!],
      ['現金及び預金', p.cash!],
      ['営業負債（買掛金・未払金）', p.tradePayables!],
    ]),
    text(
      `同業他社の平均の EV/EBITDA 倍率は ${formatNumber(p.peerMultiple!, 1)} 倍である。企業価値（EV）は「株式時価総額 + 有利子負債 − 現金及び預金」、EBITDA は「営業利益 + 減価償却費」で計算する。`,
    ),
  ],
  steps: [
    {
      kind: 'numeric',
      id: 'ebitda',
      prompt: '設問 1：L 社の EBITDA を求めよ（千円）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).ebitda,
      commonMistakes: [
        {
          answer: (p) => model(p).ebitda - p.interestExpense! - p.extraordinaryLoss!,
          hint: '支払利息や特別損失を引いていない？ EBITDA は本業の稼ぐ力なので、営業利益 + 減価償却費。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'ev',
      prompt: '設問 2：L 社の企業価値（EV）を求めよ（千円）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).ev,
      commonMistakes: [
        {
          answer: (p) => model(p).ev - p.tradePayables!,
          hint: '営業負債（買掛金・未払金）まで引いていない？ EV から引くのは現金及び預金だけ。',
        },
        {
          answer: (p) => p.marketCap! + p.interestBearingDebt!,
          hint: '現金及び預金を引き忘れていない？ EV = 株式時価総額 + 有利子負債 − 現金及び預金。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'multiple',
      prompt: '設問 3：L 社の EV/EBITDA 倍率を求めよ（倍、小数点第 2 位を四捨五入）。',
      unit: '倍',
      rounding: { mode: 'halfUp', digits: 1 },
      points: 2,
      answer: (p) => model(p).multiple,
      commonMistakes: [
        {
          answer: (p) => model(p).marketCapMultiple,
          hint: '株式時価総額で割っていない？ 分子は EV（株式時価総額 + 有利子負債 − 現金及び預金）。',
        },
        {
          answer: (p) => model(p).operatingProfitMultiple,
          hint: '営業利益で割っていない？ 分母は EBITDA（営業利益 + 減価償却費）。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'decision',
      prompt:
        '設問 4：同業他社の平均と比べて、L 社の評価と買収の判断として最も適切なものはどれか。',
      points: 2,
      options: () => [
        { key: 'A', label: '割安に評価されており、買収を積極的に検討すべきである' },
        { key: 'B', label: '割高に評価されており、今の株価での買収は見送るべきである' },
      ],
      answer: (p) => (model(p).cheap ? 'A' : 'B'),
      hints: {
        A: 'L 社の倍率は同業他社の平均を上回る。稼ぐ力に比べて高く評価されている（割高）。',
        B: 'L 社の倍率は同業他社の平均を下回る。稼ぐ力に比べて低く評価されている（割安）。',
      },
    },
  ],
  explanation: (p) => {
    const m = model(p)
    return [
      text(
        `EBITDA = 営業利益 ${yen(p.operatingProfit!)} + 減価償却費 ${yen(p.depreciation!)} = ${yen(m.ebitda)} 千円（支払利息・特別損失は含めない）`,
      ),
      text(
        `EV = ${yen(p.marketCap!)} + ${yen(p.interestBearingDebt!)} − ${yen(p.cash!)} = ${yen(m.ev)} 千円（営業負債は引かない）`,
      ),
      text(
        `EV/EBITDA 倍率 = ${yen(m.ev)} ÷ ${yen(m.ebitda)} ≒ ${formatNumber(round1(m.multiple), 1)} 倍（同業他社 ${formatNumber(p.peerMultiple!, 1)} 倍）`,
      ),
      text(
        m.cheap
          ? '同業他社より倍率が低い＝稼ぐ力に比べて安く評価されているので、割安。買収を検討する価値がある。'
          : '同業他社より倍率が高い＝稼ぐ力に比べて高く評価されているので、割高。今の株価での買収は見送る。',
      ),
    ]
  },
}
