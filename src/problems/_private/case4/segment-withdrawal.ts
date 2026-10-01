import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { multiColumnTable, text, yen } from '../../helpers'

/**
 * 事例Ⅳ総合 型 3：セグメント別の損益と、事業部の撤退・継続の判断。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * - 本社の共通固定費は、事業部を撤退しても減らない（撤退すると全額が残る事業部の負担になる）
 * - 撤退の判断は、共通費の配賦後の損益ではなく、貢献利益（限界利益 − 個別固定費）の正負で決める
 * - 表に貢献利益や配賦後の損益を載せると答えがそのまま見えるので、表は売上高・変動費・個別固定費だけにする
 */
function model(p: Params) {
  const salesA = p.salesA!
  const salesB = p.salesB!
  const variableA = (salesA * p.variableRatioAPercent!) / 100
  const variableB = (salesB * p.variableRatioBPercent!) / 100
  const contributionA = salesA - variableA - p.directFixedA!
  const contributionB = salesB - variableB - p.directFixedB!
  const common = p.commonFixed!
  const allocatedA = (common * salesA) / (salesA + salesB)
  const allocatedB = (common * salesB) / (salesA + salesB)
  return {
    salesA,
    salesB,
    variableA,
    variableB,
    contributionA,
    contributionB,
    contributionRatioB: (contributionB / salesB) * 100,
    common,
    allocatedA,
    allocatedB,
    profitAfterAllocationB: contributionB - allocatedB,
    totalProfit: contributionA + contributionB - common,
    profitAfterWithdrawal: contributionA - common,
    keep: contributionB > 0,
  }
}

export const segmentWithdrawal: ProblemTemplate = {
  id: 'case4.segment-withdrawal',
  topic: 'cvp',
  title: '【総合】セグメント別の損益と事業部の撤退判断',
  difficulty: 3,
  source: {
    kind: 'past-exam',
    note: '平成 30 年度 事例Ⅳ 第 2 問（セグメント別損益・意思決定）の構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    salesA: { kind: 'int', min: 200_000, max: 400_000, step: 10_000 },
    variableRatioAPercent: { kind: 'int', min: 50, max: 70, step: 2 },
    directFixedA: { kind: 'int', min: 30_000, max: 80_000, step: 5_000 },
    salesB: { kind: 'int', min: 150_000, max: 350_000, step: 10_000 },
    variableRatioBPercent: { kind: 'int', min: 60, max: 80, step: 2 },
    directFixedB: { kind: 'int', min: 40_000, max: 90_000, step: 5_000 },
    commonFixed: { kind: 'int', min: 40_000, max: 100_000, step: 5_000 },
  },
  // 継続と撤退が半々くらいで出る（NotebookLM の見込みどおり。1,000 通りで確かめた）
  constraint: (p) => {
    const m = model(p)
    return (
      // 配賦後は事業部 B が赤字（撤退の案が出る理由）
      m.profitAfterAllocationB < 0 &&
      // 貢献利益が 0 に近いと、判断が紛らわしい
      Math.abs(m.contributionB) >= 2_000 &&
      // 売上高が同じだと、共通費を半分ずつにした誤答と正解が同じ値になる
      m.salesA !== m.salesB
    )
  },
  body: (p) => {
    const m = model(p)
    return [
      text(
        'F 社は、一般消費者向けの飲料事業部（事業部 A）と、業務用の調味料事業部（事業部 B）の 2 つの事業を営んでいる。当期の事業部別の損益（要約）は次のとおりである。',
      ),
      multiColumnTable(
        '事業部別の損益（単位：千円）',
        ['事業部 A', '事業部 B'],
        [
          ['売上高', m.salesA, m.salesB],
          ['変動費', m.variableA, m.variableB],
          ['個別固定費', p.directFixedA!, p.directFixedB!],
        ],
      ),
      text(
        `このほかに本社の共通固定費が ${yen(m.common)} 千円あり、社内の管理会計では売上高の比率で各事業部に配賦している。共通費を配賦すると事業部 B が赤字になるため、社内では事業部 B の撤退案が出ている。`,
      ),
      text(
        '事業部 B を撤退すると、事業部 B の売上高・変動費・個別固定費はなくなるが、本社の共通固定費は全額がそのまま発生する。',
      ),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'contributionRatioB',
      prompt:
        '設問 1：事業部 B の売上高貢献利益率（貢献利益 ÷ 売上高）を求めよ（%、小数点第 2 位を四捨五入。マイナスは △ を付ける）。',
      unit: '%',
      rounding: { mode: 'halfUp', digits: 1 },
      points: 3,
      answer: (p) => model(p).contributionRatioB,
      commonMistakes: [
        {
          answer: (p) => 100 - p.variableRatioBPercent!,
          hint: '限界利益率を答えていない？ 貢献利益は、限界利益から個別固定費も引いたもの。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'profitAfterAllocationB',
      prompt:
        '設問 2：共通固定費を売上高の比率で配賦したあとの、事業部 B の営業損益を求めよ（千円、千円未満を四捨五入。損失は △ を付ける）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 4,
      answer: (p) => model(p).profitAfterAllocationB,
      commonMistakes: [
        {
          answer: (p) => model(p).contributionB,
          hint: '共通固定費の配賦を引き忘れていない？ 配賦額 = 共通固定費 × 事業部 B の売上高 ÷ 全社の売上高。',
        },
        {
          answer: (p) => {
            const m = model(p)
            return m.contributionB - m.common / 2
          },
          hint: '共通固定費を半分ずつにしていない？ 配賦の基準は売上高の比率。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'decision',
      prompt: '設問 3：全社の利益を大きくする観点から、事業部 B を継続すべきか、撤退すべきか。',
      points: 4,
      options: () => [
        { key: 'A', label: '事業部 B を継続すべきである' },
        { key: 'B', label: '事業部 B を撤退すべきである' },
      ],
      answer: (p) => (model(p).keep ? 'A' : 'B'),
      hints: {
        A: '事業部 B は個別固定費すら回収できておらず、貢献利益がマイナス。撤退すれば全社の利益は増える。',
        B: '撤退しても本社の共通固定費は減らない。貢献利益がプラスの事業部を撤退すると、全社の利益は減る。配賦後の赤字ではなく、貢献利益の正負で判断する。',
      },
    },
    {
      kind: 'numeric',
      id: 'profitAfterWithdrawal',
      prompt:
        '設問 4：事業部 B を撤退した場合の、全社の営業利益を求めよ（千円、千円未満を四捨五入。損失は △ を付ける）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 4,
      answer: (p) => model(p).profitAfterWithdrawal,
      commonMistakes: [
        {
          answer: (p) => {
            const m = model(p)
            return m.contributionA - m.allocatedA
          },
          hint: '事業部 A の配賦後の利益のままにしていない？ 撤退すると、事業部 B が負担していた共通費も事業部 A に残る。',
        },
        {
          answer: (p) => model(p).totalProfit,
          hint: '今の全社の営業利益のままにしていない？ 撤退すると、事業部 B の貢献利益がなくなる。',
        },
      ],
    },
    {
      kind: 'written',
      id: 'advice',
      prompt:
        '設問 5：事業部 B の継続・撤退の判断とその理由、今後の全社の収益改善に向けた助言を 70 字以内で述べよ。',
      points: 5,
      maxLength: 70,
      keywords: (p) =>
        model(p).keep
          ? [
              { label: '判断（継続）', anyOf: ['継続'] },
              { label: '理由（貢献利益がプラス）', anyOf: ['貢献利益'] },
              {
                label: '助言（個別固定費の削減・原価低減など）',
                anyOf: ['個別固定費', '原価低減', '限界利益率', '固定費の削減', '固定費削減'],
              },
            ]
          : [
              { label: '判断（撤退）', anyOf: ['撤退'] },
              { label: '理由（貢献利益がマイナス）', anyOf: ['貢献利益'] },
              {
                label: '助言（経営資源の集中など）',
                anyOf: ['経営資源', '集中', '資源を', '振り向け'],
              },
            ],
      modelAnswer: (p) =>
        model(p).keep
          ? '事業部Bは貢献利益が正で共通費の回収に貢献しているため継続する。今後は個別固定費の削減と原価低減で利益改善を図る。'
          : '事業部Bは貢献利益が負で個別固定費すら回収できないため撤退する。経営資源を事業部Aに集中し全社の収益性を高める。',
    },
  ],
  explanation: (p) => {
    const m = model(p)
    return [
      text(
        `事業部 B の貢献利益 = ${yen(m.salesB)} − ${yen(m.variableB)} − ${yen(p.directFixedB!)} = ${yen(m.contributionB)} 千円。売上高貢献利益率 = ${formatNumber(Math.round(m.contributionRatioB * 10) / 10, 1)}%`,
      ),
      text(
        `共通費の配賦額（B）= ${yen(m.common)} × ${yen(m.salesB)} ÷ ${yen(m.salesA + m.salesB)} ≒ ${yen(Math.round(m.allocatedB))} 千円。配賦後の営業損益（B）≒ ${yen(Math.round(m.profitAfterAllocationB))} 千円`,
      ),
      text(
        `撤退後の全社の営業利益 = 事業部 A の貢献利益 ${yen(m.contributionA)} − 共通固定費 ${yen(m.common)} = ${yen(m.profitAfterWithdrawal)} 千円（今は ${yen(m.totalProfit)} 千円）。`,
      ),
      text(
        m.keep
          ? '事業部 B は貢献利益がプラスで、共通費の回収に役立っている。配賦後は赤字でも、撤退すると全社の利益が減るので継続する。'
          : '事業部 B は貢献利益がマイナスで、個別固定費すら回収できていない。撤退すると全社の利益が増える。',
      ),
      text(
        '共通固定費は事業部を撤退しても減らない。撤退の判断は、配賦後の損益ではなく貢献利益の正負で行う。',
      ),
    ]
  },
}
