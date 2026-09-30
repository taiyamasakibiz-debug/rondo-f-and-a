import {
  afterTaxDisposalProceeds,
  afterTaxOperatingCashFlow,
  netPresentValue,
  straightLineDepreciation,
} from '@/domain/investment/investment'
import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { amountTable, discountFactorsTable, factorBlock, text, yen } from '../helpers'

const TAX_RATE = 0.3

/**
 * 運転資本と残存価額がある投資。
 * - 0 年目：設備の取得と、運転資本（在庫など）の投入
 * - 毎年：税引後の営業 CF
 * - 最終年：運転資本の回収と、設備の売却（帳簿価額 = 残存価額で売るので税効果なし）
 */
function projectOf(p: Params) {
  const years = p.years!
  const residual = p.residual!
  const cost = residual + years * p.depreciationPerYear!
  const depreciation = straightLineDepreciation(cost, residual, years)
  const operating = afterTaxOperatingCashFlow({
    revenue: p.revenue!,
    cashExpenses: p.cashExpenses!,
    depreciation,
    taxRate: TAX_RATE,
  })
  const disposal = afterTaxDisposalProceeds(residual, residual, TAX_RATE)
  const lastYear = operating + p.workingCapital! + disposal
  const cashFlows = Array.from({ length: years }, (_, i) =>
    i === years - 1 ? lastYear : operating,
  )
  const rate = p.ratePercent! / 100
  const factors = discountFactorsTable(rate, years)
  const initial = cost + p.workingCapital!
  return {
    years,
    cost,
    residual,
    depreciation,
    operating,
    lastYear,
    cashFlows,
    rate,
    factors,
    initial,
    npv: netPresentValue(initial, cashFlows, { factors }),
  }
}

export const workingCapitalAndResidual: ProblemTemplate = {
  id: 'npv.working-capital-residual',
  topic: 'npv',
  title: '運転資本と残存価額がある投資',
  difficulty: 3,
  source: { kind: 'original', publishable: true },
  params: {
    years: { kind: 'int', min: 3, max: 5 },
    residual: { kind: 'int', min: 100, max: 1_000, step: 100 },
    depreciationPerYear: { kind: 'int', min: 500, max: 3_000, step: 100 },
    revenue: { kind: 'int', min: 2_000, max: 8_000, step: 100 },
    cashExpenses: { kind: 'int', min: 500, max: 4_000, step: 100 },
    workingCapital: { kind: 'int', min: 200, max: 1_500, step: 100 },
    ratePercent: { kind: 'choice', values: [5, 6, 8, 10] },
  },
  constraint: (p) => {
    const { operating, npv, initial } = projectOf(p)
    return (
      p.revenue! > p.cashExpenses! &&
      operating > 0 &&
      Math.abs(npv) >= initial * 0.02 &&
      // 同じ額だと「運転資本の回収忘れ」と「売却収入の忘れ」の誤答が区別できない
      p.residual !== p.workingCapital
    )
  },
  body: (p) => {
    const { years, cost, rate } = projectOf(p)
    return [
      text(
        `D 社は新規事業への投資を検討している。設備の取得原価は ${yen(cost)} 千円、耐用年数は ${years} 年、残存価額は ${yen(p.residual!)} 千円で、定額法で減価償却する。設備は ${years} 年目の末に残存価額で売却する。`,
      ),
      text(
        `事業の開始時に運転資本（在庫など）として ${yen(p.workingCapital!)} 千円が必要で、${years} 年目の末に全額回収される。`,
      ),
      amountTable('事業による毎年の増分（単位：千円）', [
        ['売上高の増加', p.revenue!],
        ['現金支出費用の増加', p.cashExpenses!],
      ]),
      text(
        `法人税等の税率は ${TAX_RATE * 100}% とし、D 社は他の事業で十分な利益を上げているものとする。資本コストは ${formatNumber(rate * 100)}% とする。キャッシュフローは毎年末に生じる。`,
      ),
      factorBlock(rate, years),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'lastYear',
      prompt: '最終年のキャッシュフローを求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => projectOf(p).lastYear,
      commonMistakes: [
        {
          answer: (p) => projectOf(p).operating + p.residual!,
          hint: '運転資本の回収を忘れていない？ 最初に投入した運転資本は、最終年に戻ってくる。',
        },
        {
          answer: (p) => projectOf(p).operating + p.workingCapital!,
          hint: '設備の売却収入を忘れていない？ 残存価額で売れるので、その分のキャッシュが入る。',
        },
        {
          answer: (p) => projectOf(p).operating,
          hint: '最終年には、運転資本の回収と設備の売却収入も加わる。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'npv',
      prompt: '正味現在価値（NPV）を求めよ（千円、千円未満を四捨五入。マイナスは △ を付ける）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => projectOf(p).npv,
      commonMistakes: [
        {
          answer: (p) => {
            const { cashFlows, factors, cost } = projectOf(p)
            return netPresentValue(cost, cashFlows, { factors })
          },
          hint: '初期投資に運転資本を含め忘れていない？ 0 年目には設備と運転資本の両方が出ていく。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const { years, cost, depreciation, operating, lastYear, factors, initial, npv } = projectOf(p)
    return [
      text(
        `減価償却費 = (${yen(cost)} − ${yen(p.residual!)}) ÷ ${years} 年 = ${yen(depreciation)} 千円`,
      ),
      text(
        `毎年の税引後 CF = (${yen(p.revenue!)} − ${yen(p.cashExpenses!)} − ${yen(depreciation)}) × (1 − ${TAX_RATE}) + ${yen(depreciation)} = ${yen(Math.round(operating))} 千円`,
      ),
      text(
        `最終年の CF = ${yen(Math.round(operating))} + 運転資本の回収 ${yen(p.workingCapital!)} + 設備の売却 ${yen(p.residual!)} = ${yen(Math.round(lastYear))} 千円（帳簿価額で売るので売却損益・税効果はない）`,
      ),
      text(
        `初期投資 = 設備 ${yen(cost)} + 運転資本 ${yen(p.workingCapital!)} = ${yen(initial)} 千円。NPV = ${factors
          .map(
            (f, i) =>
              `${yen(Math.round(i === years - 1 ? lastYear : operating))} × ${formatNumber(f, 3)}`,
          )
          .join(' + ')} − ${yen(initial)} ≒ ${yen(Math.round(npv))} 千円`,
      ),
    ]
  },
}
