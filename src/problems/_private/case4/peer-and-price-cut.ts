import { formatNumber } from '@/engine/numbers'
import type { Block, Params, ProblemTemplate } from '@/engine/types'
import { amountTable, text, yen } from '../../helpers'

/**
 * 事例Ⅳ総合 型 1：同業他社との比較（経営分析）と、値下げの CVP。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * - 売上原価はすべて変動費、販管費はすべて固定費
 * - 値下げしても 1 個あたりの変動費（額）は変わらない → 変動費は数量の増加分だけ増える
 */
function model(p: Params) {
  const sales = p.sales!
  const costRatio = p.costRatioPercent! / 100
  const cogs = sales * costRatio
  const grossProfit = sales - cogs
  const sga = p.sgaFixed!
  const operatingProfit = grossProfit - sga
  // 表示と同じく、小数第 1 位に丸めた値で比べる
  const grossMargin = round1((grossProfit / sales) * 100)
  const equityRatio = round1((p.equity! / p.assets!) * 100)
  const drop = p.priceDropPercent! / 100
  const increase = p.volumeIncreasePercent! / 100
  const newSales = sales * (1 - drop) * (1 + increase)
  const newVariable = cogs * (1 + increase)
  const newOperatingProfit = newSales - newVariable - sga
  return {
    sales,
    cogs,
    grossProfit,
    sga,
    operatingProfit,
    grossMargin,
    equityRatio,
    drop,
    increase,
    newSales,
    newVariable,
    newOperatingProfit,
    /** D 社の方が良ければプラス（ポイント） */
    marginGap: grossMargin - p.peerGrossMarginPercent!,
    equityGap: equityRatio - p.peerEquityRatioPercent!,
    profitUp: newOperatingProfit > operatingProfit,
  }
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

/** 同業他社より劣っている方の指標 */
function weakerKey(p: Params): 'A' | 'B' {
  return model(p).marginGap < 0 ? 'A' : 'B'
}

const MIN_GAP = 2
const MIN_PROFIT_CHANGE = 1_000

export const peerAndPriceCut: ProblemTemplate = {
  id: 'case4.peer-and-price-cut',
  topic: 'analysis',
  title: '【総合】同業他社比較と値下げの効果',
  difficulty: 3,
  source: {
    kind: 'past-exam',
    note: '令和 5 年度 事例Ⅳ 第 1 問（経営分析）・第 2 問（CVP）の構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    sales: { kind: 'int', min: 300_000, max: 800_000, step: 10_000 },
    costRatioPercent: { kind: 'int', min: 60, max: 80 },
    sgaFixed: { kind: 'int', min: 30_000, max: 100_000, step: 5_000 },
    assets: { kind: 'int', min: 200_000, max: 600_000, step: 10_000 },
    equity: { kind: 'int', min: 80_000, max: 300_000, step: 5_000 },
    peerGrossMarginPercent: { kind: 'int', min: 15, max: 35 },
    peerEquityRatioPercent: { kind: 'int', min: 25, max: 50 },
    // 増益と減益が半々くらいで出る範囲（NotebookLM の案 3〜10% / 5〜20% だと、増益が 1 割しか出ない）
    priceDropPercent: { kind: 'int', min: 2, max: 6 },
    volumeIncreasePercent: { kind: 'int', min: 8, max: 25 },
  },
  constraint: (p) => {
    const m = model(p)
    // 一方は D 社が明らかに劣り、他方は明らかに優れる（課題の指標が 1 つに決まる）
    const oneWeak =
      (m.marginGap <= -MIN_GAP && m.equityGap >= MIN_GAP) ||
      (m.equityGap <= -MIN_GAP && m.marginGap >= MIN_GAP)
    return (
      m.operatingProfit > 0 &&
      p.assets! > p.equity! &&
      // 50% ちょうどだと、負債で計算した誤答と正解が同じ値になって区別できない
      m.equityRatio !== 50 &&
      oneWeak &&
      // 増益か減益かがはっきりする
      Math.abs(m.newOperatingProfit - m.operatingProfit) >= MIN_PROFIT_CHANGE
    )
  },
  body: (p) => {
    const m = model(p)
    const balanceSheet: Block = {
      type: 'table',
      caption: 'D 社の貸借対照表（要約、単位：千円）',
      headers: ['資産の部', '金額', '負債・純資産の部', '金額'],
      rows: [
        ['総資産', yen(p.assets!), '負債', yen(p.assets! - p.equity!)],
        ['', '', '純資産（自己資本）', yen(p.equity!)],
        ['資産合計', yen(p.assets!), '負債・純資産合計', yen(p.assets!)],
      ],
    }
    return [
      text(
        'D 社は受託製造を中心とする中小企業である。競合が激しくなるなか、収益構造の改善を検討している。当期の財務諸表（要約）と同業他社の平均の指標は次のとおりである。',
      ),
      amountTable('D 社の損益計算書（単位：千円）', [
        ['売上高', m.sales],
        ['売上原価', m.cogs],
        ['売上総利益', m.grossProfit],
        ['販売費及び一般管理費', m.sga],
        ['営業利益', m.operatingProfit],
      ]),
      text('売上原価はすべて変動費、販売費及び一般管理費はすべて固定費とする。'),
      balanceSheet,
      {
        type: 'table',
        caption: '同業他社の平均',
        headers: ['指標', '値'],
        rows: [
          ['売上高総利益率', `${p.peerGrossMarginPercent}%`],
          ['自己資本比率', `${p.peerEquityRatioPercent}%`],
        ],
      },
      text(
        `D 社は翌期、販売単価を ${p.priceDropPercent}% 値下げすることで、販売数量を ${p.volumeIncreasePercent}% 増やす案を検討している。1 個あたりの変動費と固定費は変わらないものとする。`,
      ),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'grossMargin',
      prompt: '設問 1：D 社の当期の売上高総利益率を求めよ（%、小数点第 2 位を四捨五入）。',
      unit: '%',
      rounding: { mode: 'halfUp', digits: 1 },
      points: 3,
      answer: (p) => model(p).grossMargin,
      commonMistakes: [
        {
          answer: (p) => p.costRatioPercent!,
          hint: '売上原価率を答えていない？ 売上高総利益率 = 売上総利益 ÷ 売上高。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'equityRatio',
      prompt: '設問 2：D 社の当期の自己資本比率を求めよ（%、小数点第 2 位を四捨五入）。',
      unit: '%',
      rounding: { mode: 'halfUp', digits: 1 },
      points: 3,
      answer: (p) => model(p).equityRatio,
      commonMistakes: [
        {
          answer: (p) => ((p.assets! - p.equity!) / p.assets!) * 100,
          hint: '負債比率の分子（負債）で計算していない？ 自己資本比率 = 自己資本 ÷ 総資産。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'weakness',
      prompt: '設問 3：同業他社と比べて、D 社が劣っており、改善すべき課題を示す指標はどれか。',
      points: 4,
      options: () => [
        { key: 'A', label: '売上高総利益率' },
        { key: 'B', label: '自己資本比率' },
      ],
      answer: weakerKey,
      hints: {
        A: 'D 社の売上高総利益率は、同業他社より高い（優れている）。D 社の方が低い指標を選ぶ。',
        B: 'D 社の自己資本比率は、同業他社より高い（優れている）。D 社の方が低い指標を選ぶ。',
      },
    },
    {
      kind: 'numeric',
      id: 'newOperatingProfit',
      prompt:
        '設問 4：値下げと販売数量の増加を実施した場合の、翌期の営業利益を求めよ（千円、千円未満を四捨五入。マイナスは △ を付ける）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 5,
      answer: (p) => model(p).newOperatingProfit,
      commonMistakes: [
        {
          answer: (p) => {
            const m = model(p)
            return m.newSales * (1 - m.cogs / m.sales) - m.sga
          },
          hint: '値下げ後も変動費率をそのまま使っていない？ 値下げしても 1 個あたりの変動費（額）は変わらないので、変動費は数量の増加分だけ増える。',
        },
        {
          answer: (p) => {
            const m = model(p)
            return m.newSales - m.cogs - m.sga
          },
          hint: '変動費を据え置いていない？ 販売数量が増えると、変動費もその分増える。',
        },
        {
          answer: (p) => {
            const m = model(p)
            return (m.sales - m.cogs) * (1 + m.increase) - m.sga
          },
          hint: '値下げを売上高に反映し忘れていない？ 新しい売上高 = 売上高 ×（1 − 値下げ率）×（1 + 数量の増加率）。',
        },
      ],
    },
    {
      kind: 'written',
      id: 'advice',
      prompt:
        '設問 5：この値下げ案が営業利益に与える影響を評価し、今後の改善策を 60 字以内で述べよ。',
      points: 5,
      maxLength: 60,
      keywords: (p) => [
        model(p).profitUp
          ? { label: '損益への影響（増益）', anyOf: ['増益', '利益が増', '利益は増'] }
          : { label: '損益への影響（減益）', anyOf: ['減益', '利益が減', '利益は減'] },
        { label: '原因（単価の低下・限界利益率の低下）', anyOf: ['単価', '限界利益率', '値下げ'] },
        {
          label: '改善策（高付加価値化・原価低減など）',
          anyOf: ['高付加価値', '付加価値', '原価低減', '固定費削減', '差別化', '価格競争'],
        },
      ],
      modelAnswer: (p) =>
        model(p).profitUp
          ? '値下げによる単価低下を数量増加が補い増益となるが、限界利益率は低下するため、高付加価値化で粗利率の向上を図る。'
          : '数量増加の効果より単価低下の影響が大きく減益となるため、安易な値下げは避け、原価低減と高付加価値化を進める。',
    },
  ],
  explanation: (p) => {
    const m = model(p)
    return [
      text(
        `売上高総利益率 = ${yen(m.grossProfit)} ÷ ${yen(m.sales)} = ${formatNumber(m.grossMargin, 1)}%（同業他社 ${p.peerGrossMarginPercent}%）`,
      ),
      text(
        `自己資本比率 = ${yen(p.equity!)} ÷ ${yen(p.assets!)} = ${formatNumber(m.equityRatio, 1)}%（同業他社 ${p.peerEquityRatioPercent}%）`,
      ),
      text(
        `同業他社より低いのは ${m.marginGap < 0 ? '売上高総利益率' : '自己資本比率'}。これが D 社の課題を示す指標である。`,
      ),
      text(
        `翌期の売上高 = ${yen(m.sales)} × (1 − ${formatNumber(m.drop, 2)}) × (1 + ${formatNumber(m.increase, 2)}) = ${yen(Math.round(m.newSales))} 千円。値下げしても 1 個あたりの変動費は変わらないので、変動費 = ${yen(m.cogs)} × (1 + ${formatNumber(m.increase, 2)}) = ${yen(Math.round(m.newVariable))} 千円。`,
      ),
      text(
        `翌期の営業利益 = ${yen(Math.round(m.newSales))} − ${yen(Math.round(m.newVariable))} − ${yen(m.sga)} ≒ ${yen(Math.round(m.newOperatingProfit))} 千円（当期 ${yen(m.operatingProfit)} 千円から${m.profitUp ? '増益' : '減益'}）。`,
      ),
      text(
        '値下げは限界利益率を下げる。数量の増加でそれを補えるかが判断の分かれ目になる。助言は、計算結果（増益か減益か）と矛盾しない向きで、収益性を高める策（高付加価値化、原価低減など）を書く。',
      ),
    ]
  },
}
