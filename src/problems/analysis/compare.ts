import { INDICATORS, type IndicatorId, computeIndicators } from '@/domain/analysis/indicators'
import { balanceSheetTotals, incomeStatementProfits } from '@/domain/statements'
import { formatNumber } from '@/engine/numbers'
import type { Block, Params, ParamSpec, ProblemTemplate } from '@/engine/types'
import { multiColumnTable, text } from '../helpers'
import { type Company, companyOf, companyParams, isReasonableCompany } from './company'

/**
 * 同業他社比較（事例Ⅳの第 1 問でよく出る形）。
 * D 社と同業他社の財務諸表を別々に作り、D 社が最も劣っている指標がはっきり 1 つに決まる組み合わせだけを出す。
 */

/** 選択肢にする指標（いずれも高いほど良い） */
const CANDIDATES = [
  'operatingProfitMargin',
  'inventoryTurnover',
  'equityRatio',
  'currentRatio',
] as const satisfies readonly IndicatorId[]

/** レーダーと比較表に出す指標 */
const OVERVIEW: readonly IndicatorId[] = [
  'grossProfitMargin',
  'operatingProfitMargin',
  'tangibleFixedAssetTurnover',
  'inventoryTurnover',
  'currentRatio',
  'equityRatio',
]

const KEYS = ['A', 'B', 'C', 'D'] as const

/** 最も劣っている指標が、2 番目より少なくともこれだけ（相対差で）大きく劣っていること */
const MIN_GAP = 0.1
/** 最も劣っている指標は、同業他社より少なくともこれだけ（相対差で）劣っていること */
const MIN_DISADVANTAGE = 0.15

function prefixed(prefix: string): ParamSpec {
  return Object.fromEntries(
    Object.entries(companyParams).map(([key, spec]) => [`${prefix}${key}`, spec]),
  )
}

function unprefixed(p: Params, prefix: string): Params {
  return Object.fromEntries(
    Object.entries(p)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]),
  )
}

function companies(p: Params): { d: Company; c: Company } {
  return { d: companyOf(unprefixed(p, 'd_')), c: companyOf(unprefixed(p, 'c_')) }
}

function label(id: IndicatorId): string {
  return INDICATORS.find((indicator) => indicator.id === id)!.label
}

function unit(id: IndicatorId): string {
  return INDICATORS.find((indicator) => indicator.id === id)!.unit
}

/** D 社がどれだけ劣っているか（相対差。プラスなら D 社が劣る） */
function disadvantages(p: Params): { id: IndicatorId; d: number; c: number; gap: number }[] {
  const { d, c } = companies(p)
  const dv = computeIndicators(d)
  const cv = computeIndicators(c)
  return CANDIDATES.map((id) => {
    const dValue = dv[id] ?? 0
    const cValue = cv[id] ?? 0
    return {
      id,
      d: dValue,
      c: cValue,
      gap: cValue === 0 ? 0 : (cValue - dValue) / Math.abs(cValue),
    }
  })
}

function answerId(p: Params): IndicatorId {
  return [...disadvantages(p)].sort((a, b) => b.gap - a.gap)[0]!.id
}

function comparisonTables({ d, c }: { d: Company; c: Company }): Block[] {
  const dt = balanceSheetTotals(d.balanceSheet)
  const ct = balanceSheetTotals(c.balanceSheet)
  const dp = incomeStatementProfits(d.incomeStatement)
  const cp = incomeStatementProfits(c.incomeStatement)
  return [
    multiColumnTable(
      '貸借対照表（単位：千円）',
      ['D 社', '同業他社'],
      [
        ['現金預金', d.balanceSheet.cashAndDeposits, c.balanceSheet.cashAndDeposits],
        ['売上債権', d.balanceSheet.receivables, c.balanceSheet.receivables],
        ['棚卸資産', d.balanceSheet.inventories, c.balanceSheet.inventories],
        ['流動資産合計', dt.currentAssets, ct.currentAssets],
        ['有形固定資産', d.balanceSheet.tangibleFixedAssets, c.balanceSheet.tangibleFixedAssets],
        ['固定資産合計', dt.fixedAssets, ct.fixedAssets],
        ['資産合計', dt.totalAssets, ct.totalAssets],
        ['流動負債合計', dt.currentLiabilities, ct.currentLiabilities],
        ['固定負債合計', dt.fixedLiabilities, ct.fixedLiabilities],
        ['純資産合計', dt.netAssets, ct.netAssets],
      ],
    ),
    multiColumnTable(
      '損益計算書（単位：千円）',
      ['D 社', '同業他社'],
      [
        ['売上高', d.incomeStatement.sales, c.incomeStatement.sales],
        ['売上総利益', dp.grossProfit, cp.grossProfit],
        ['営業利益', dp.operatingProfit, cp.operatingProfit],
        ['経常利益', dp.ordinaryProfit, cp.ordinaryProfit],
      ],
    ),
  ]
}

export const compareWithPeer: ProblemTemplate = {
  id: 'analysis.compare-peer',
  topic: 'analysis',
  title: '同業他社との比較',
  difficulty: 2,
  source: { kind: 'original', publishable: true },
  params: { ...prefixed('d_'), ...prefixed('c_') },
  constraint: (p) => {
    if (!isReasonableCompany(unprefixed(p, 'd_')) || !isReasonableCompany(unprefixed(p, 'c_'))) {
      return false
    }
    const sorted = [...disadvantages(p)].sort((a, b) => b.gap - a.gap)
    return sorted[0]!.gap >= MIN_DISADVANTAGE && sorted[0]!.gap - sorted[1]!.gap >= MIN_GAP
  },
  body: (p) => [
    text('D 社と同業他社の当期の財務諸表（要約）は次のとおりである（期末の値を用いる）。'),
    ...comparisonTables(companies(p)),
  ],
  steps: [
    {
      kind: 'choice',
      id: 'weakest',
      prompt: '次の指標のうち、D 社が同業他社と比べて最も劣っているものはどれか。',
      points: 2,
      options: () => CANDIDATES.map((id, i) => ({ key: KEYS[i]!, label: label(id) })),
      answer: (p) => KEYS[CANDIDATES.indexOf(answerId(p) as (typeof CANDIDATES)[number])]!,
    },
  ],
  explanation: (p) => {
    const { d, c } = companies(p)
    const dv = computeIndicators(d)
    const cv = computeIndicators(c)
    const fmt = (value: number | null, id: IndicatorId) =>
      value === null ? '—' : `${formatNumber(value, 2)}${unit(id)}`
    const answer = answerId(p)
    return [
      {
        type: 'table',
        caption: '指標の比較（期末）',
        headers: ['指標', 'D 社', '同業他社'],
        rows: OVERVIEW.map((id) => [label(id), fmt(dv[id], id), fmt(cv[id], id)]),
      },
      {
        type: 'radar',
        caption: '分析レーダー（各指標で良い方を外側の 1 とした比）',
        axes: OVERVIEW.map(label),
        series: [
          {
            label: 'D 社',
            values: OVERVIEW.map((id) => (dv[id] ?? 0) / Math.max(dv[id] ?? 0, cv[id] ?? 0, 1e-9)),
          },
          {
            label: '同業他社',
            values: OVERVIEW.map((id) => (cv[id] ?? 0) / Math.max(dv[id] ?? 0, cv[id] ?? 0, 1e-9)),
          },
        ],
      },
      ...disadvantages(p).map(({ id, d: dValue, c: cValue, gap }) =>
        text(
          `${label(id)}：D 社 ${fmt(dValue, id)}、同業他社 ${fmt(cValue, id)}（${
            gap > 0 ? `D 社が ${formatNumber(gap * 100, 0)}% 劣る` : 'D 社の方が良い'
          }）${id === answer ? ' ← 最も劣っている' : ''}`,
        ),
      ),
    ]
  },
}
