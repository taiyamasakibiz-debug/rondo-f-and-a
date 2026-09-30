import { type IndicatorId, INDICATORS, computeIndicators } from '@/domain/analysis/indicators'
import { balanceSheetTotals, incomeStatementProfits } from '@/domain/statements'
import { formatNumber } from '@/engine/numbers'
import type { NumericStep, Params, ProblemTemplate } from '@/engine/types'
import { text, yen } from '../helpers'
import { companyBlocks, companyOf, companyParams, isReasonableCompany } from './company'

/** 指標の値（計算できない指標はテンプレートの制約で出さない） */
function indicator(p: Params, id: IndicatorId): number {
  return computeIndicators(companyOf(p))[id] ?? Number.NaN
}

function definition(id: IndicatorId) {
  return INDICATORS.find((item) => item.id === id)!
}

/** 事例Ⅳの慣例に合わせ、小数点第 3 位を四捨五入 */
function indicatorStep(
  id: IndicatorId,
  commonMistakes: NumericStep['commonMistakes'] = [],
): NumericStep {
  const def = definition(id)
  return {
    kind: 'numeric',
    id,
    prompt: `${def.label}を求めよ（${def.unit}、小数点第 3 位を四捨五入）。`,
    unit: def.unit,
    rounding: { mode: 'halfUp', digits: 2 },
    answer: (p) => indicator(p, id),
    commonMistakes,
  }
}

const intro = text('D 社の当期の財務諸表は次のとおりである（期末の値を用いる）。')

function explanation(ids: readonly IndicatorId[]) {
  return (p: Params) =>
    ids.map((id) => {
      const def = definition(id)
      return text(`${def.label} = ${def.formula} = ${formatNumber(indicator(p, id), 2)}${def.unit}`)
    })
}

const PROFITABILITY = [
  'grossProfitMargin',
  'operatingProfitMargin',
  'ordinaryProfitMargin',
] as const

export const profitability: ProblemTemplate = {
  id: 'analysis.profitability',
  topic: 'analysis',
  title: '収益性の指標',
  difficulty: 1,
  source: { kind: 'original', publishable: true },
  params: companyParams,
  constraint: isReasonableCompany,
  body: (p) => [intro, ...companyBlocks(companyOf(p))],
  steps: [
    indicatorStep('grossProfitMargin', [
      {
        answer: (p) => (companyOf(p).incomeStatement.costOfSales / p.sales!) * 100,
        hint: '売上原価率を答えていない？ 売上高総利益率は 売上総利益 ÷ 売上高。',
      },
    ]),
    indicatorStep('operatingProfitMargin'),
    indicatorStep('ordinaryProfitMargin', [
      {
        answer: (p) => {
          const { incomeStatement } = companyOf(p)
          return (
            (incomeStatementProfits(incomeStatement).operatingProfit / p.sales!) * 100 -
            (incomeStatement.interestExpense / p.sales!) * 100
          )
        },
        hint: '受取利息・配当金を足し忘れていない？ 経常利益 = 営業利益 + 営業外収益 − 営業外費用。',
      },
    ]),
  ],
  explanation: explanation(PROFITABILITY),
}

const SAFETY = [
  'currentRatio',
  'quickRatio',
  'equityRatio',
  'fixedLongTermSuitabilityRatio',
] as const

export const safety: ProblemTemplate = {
  id: 'analysis.safety',
  topic: 'analysis',
  title: '安全性の指標',
  difficulty: 1,
  source: { kind: 'original', publishable: true },
  params: companyParams,
  constraint: isReasonableCompany,
  body: (p) => [intro, ...companyBlocks(companyOf(p))],
  steps: [
    indicatorStep('currentRatio', [
      {
        answer: (p) => {
          const t = balanceSheetTotals(companyOf(p).balanceSheet)
          return (t.currentLiabilities / t.currentAssets) * 100
        },
        hint: '分子と分母が逆になっていない？ 流動比率 = 流動資産 ÷ 流動負債。',
      },
    ]),
    indicatorStep('quickRatio', [
      {
        answer: (p) => indicator(p, 'currentRatio'),
        hint: '棚卸資産を含めていない？ 当座資産は現金預金・売上債権・有価証券。',
      },
    ]),
    indicatorStep('equityRatio', [
      {
        answer: (p) => {
          const t = balanceSheetTotals(companyOf(p).balanceSheet)
          return (t.netAssets / t.totalLiabilities) * 100
        },
        hint: '負債で割っていない？ 自己資本比率の分母は総資本（負債 + 純資産）。',
      },
    ]),
    indicatorStep('fixedLongTermSuitabilityRatio', [
      {
        answer: (p) => indicator(p, 'fixedRatio'),
        hint: '固定比率を答えていない？ 固定長期適合率の分母は 純資産 + 固定負債。',
      },
    ]),
  ],
  explanation: explanation(SAFETY),
}

const EFFICIENCY = [
  'totalAssetTurnover',
  'tangibleFixedAssetTurnover',
  'receivablesTurnover',
  'inventoryTurnover',
] as const

export const efficiency: ProblemTemplate = {
  id: 'analysis.efficiency',
  topic: 'analysis',
  title: '効率性の指標',
  difficulty: 1,
  source: { kind: 'original', publishable: true },
  params: companyParams,
  constraint: isReasonableCompany,
  body: (p) => [
    intro,
    ...companyBlocks(companyOf(p)),
    text('回転率はいずれも売上高を分子とする。'),
  ],
  steps: [
    indicatorStep('totalAssetTurnover'),
    indicatorStep('tangibleFixedAssetTurnover'),
    indicatorStep('receivablesTurnover', [
      {
        answer: (p) => companyOf(p).balanceSheet.receivables / p.sales!,
        hint: '分子と分母が逆になっていない？ 回転率 = 売上高 ÷ 売上債権。',
      },
    ]),
    indicatorStep('inventoryTurnover', [
      {
        answer: (p) => companyOf(p).incomeStatement.costOfSales / p.inventories!,
        hint: '売上原価で割っていない？ この問題では売上高を分子にする。',
      },
    ]),
  ],
  explanation: (p) => [
    ...explanation(EFFICIENCY)(p),
    text(
      `（参考）売上債権回転日数 = 365 ÷ ${formatNumber(indicator(p, 'receivablesTurnover'), 2)} ≒ ${formatNumber(365 / indicator(p, 'receivablesTurnover'), 1)} 日。総資本は ${yen(balanceSheetTotals(companyOf(p).balanceSheet).totalAssets)} 千円。`,
    ),
  ],
}
