import {
  afterTaxDisposalProceeds,
  afterTaxOperatingCashFlow,
  netPresentValue,
  paybackPeriod,
  straightLineDepreciation,
} from '@/domain/investment/investment'
import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import {
  amountTable,
  discountFactorsTable,
  factorBlock,
  multiColumnTable,
  text,
  yen,
} from '../helpers'

const TAX_RATE = 0.3
const taxText = `法人税等の税率は ${TAX_RATE * 100}% とし、D 社は他の事業で十分な利益を上げているものとする。`

// ---------------------------------------------------------------------------
// 新規投資の NPV

function newInvestment(p: Params) {
  const years = p.years!
  const cost = p.years! * p.costPerYear!
  const depreciation = straightLineDepreciation(cost, 0, years)
  const cashFlow = afterTaxOperatingCashFlow({
    revenue: p.revenue!,
    cashExpenses: p.cashExpenses!,
    depreciation,
    taxRate: TAX_RATE,
  })
  const rate = p.ratePercent! / 100
  const factors = discountFactorsTable(rate, years)
  const cashFlows = Array.from({ length: years }, () => cashFlow)
  const npv = netPresentValue(cost, cashFlows, { factors })
  return { years, cost, depreciation, cashFlow, rate, factors, npv }
}

export const newInvestmentNpv: ProblemTemplate = {
  id: 'npv.new-investment',
  topic: 'npv',
  title: '新規投資の正味現在価値',
  difficulty: 2,
  source: { kind: 'original', publishable: true },
  params: {
    years: { kind: 'int', min: 3, max: 5 },
    // 取得原価 = 耐用年数 × この値（減価償却費が割り切れるように）
    costPerYear: { kind: 'int', min: 2_000, max: 10_000, step: 100 },
    revenue: { kind: 'int', min: 3_000, max: 15_000, step: 100 },
    cashExpenses: { kind: 'int', min: 500, max: 8_000, step: 100 },
    ratePercent: { kind: 'choice', values: [5, 6, 8, 10] },
  },
  constraint: (p) => {
    const { cost, cashFlow, npv } = newInvestment(p)
    // CF はプラス。NPV がゼロに近すぎると判断の問題として紛らわしい
    return p.revenue! > p.cashExpenses! && cashFlow > 0 && Math.abs(npv) >= cost * 0.02
  },
  body: (p) => {
    const { years, cost, rate } = newInvestment(p)
    return [
      text(
        `D 社は新しい設備への投資を検討している。設備の取得原価は ${yen(cost)} 千円、耐用年数は ${years} 年、残存価額は 0 で、定額法で減価償却する。`,
      ),
      amountTable('投資による毎年の増分（単位：千円）', [
        ['売上高の増加', p.revenue!],
        ['現金支出費用の増加', p.cashExpenses!],
      ]),
      text(
        `${taxText}資本コストは ${formatNumber(rate * 100)}% とする。キャッシュフローは毎年末に生じる。`,
      ),
      factorBlock(rate, years),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'depreciation',
      prompt: '毎年の減価償却費を求めよ（千円）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      answer: (p) => newInvestment(p).depreciation,
    },
    {
      kind: 'numeric',
      id: 'cashFlow',
      prompt: '毎年の税引後キャッシュフローを求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => newInvestment(p).cashFlow,
      commonMistakes: [
        {
          answer: (p) => (p.revenue! - p.cashExpenses!) * (1 - TAX_RATE),
          hint: '減価償却費の節税効果を入れ忘れていない？ 税引後 CF = 税引後営業利益 + 減価償却費。',
        },
        {
          answer: (p) => {
            const { depreciation } = newInvestment(p)
            return (p.revenue! - p.cashExpenses! - depreciation) * (1 - TAX_RATE)
          },
          hint: '減価償却費を足し戻していない？ 減価償却費は現金の支出ではない。',
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
      answer: (p) => newInvestment(p).npv,
      commonMistakes: [
        {
          answer: (p) => {
            const { cashFlow, years, cost } = newInvestment(p)
            return cashFlow * years - cost
          },
          hint: 'キャッシュフローを割り引いていない？ 各年の CF に複利現価係数を掛ける。',
        },
      ],
    },
    {
      kind: 'choice',
      id: 'decision',
      prompt: 'NPV から判断すると、D 社はこの投資を行うべきか。',
      options: () => [
        { key: 'A', label: '行うべきである' },
        { key: 'B', label: '行うべきではない' },
      ],
      answer: (p) => (newInvestment(p).npv > 0 ? 'A' : 'B'),
      hints: {
        A: 'NPV がマイナスの投資は、資本コストに見合う回収ができない。',
        B: 'NPV がプラスなら、資本コストを上回るリターンが見込める。',
      },
    },
  ],
  explanation: (p) => {
    const { years, cost, depreciation, cashFlow, factors, npv } = newInvestment(p)
    const factorSum = factors.reduce((a, b) => a + b, 0)
    return [
      text(`減価償却費 = ${yen(cost)} ÷ ${years} 年 = ${yen(depreciation)} 千円`),
      text(
        `税引後 CF = (${yen(p.revenue!)} − ${yen(p.cashExpenses!)} − ${yen(depreciation)}) × (1 − ${TAX_RATE}) + ${yen(depreciation)} = ${yen(Math.round(cashFlow))} 千円`,
      ),
      text(
        `NPV = ${yen(Math.round(cashFlow))} × (${factors.map((f) => formatNumber(f, 3)).join(' + ')}) − ${yen(cost)} = ${yen(Math.round(cashFlow))} × ${formatNumber(factorSum, 3)} − ${yen(cost)} ≒ ${yen(Math.round(npv))} 千円`,
      ),
      text(
        npv > 0
          ? 'NPV がプラスなので、投資を行うべきである。'
          : 'NPV がマイナスなので、投資を行うべきではない。',
      ),
    ]
  },
}

// ---------------------------------------------------------------------------
// 取替投資

function replacement(p: Params) {
  const years = p.years!
  const newCost = years * p.newCostPerYear!
  const oldBookValue = years * p.oldBookPerYear!
  const disposal = afterTaxDisposalProceeds(p.proceeds!, oldBookValue, TAX_RATE)
  // 差額の減価償却費 = 新設備 − 旧設備（旧設備も残り年数で償却する前提）
  const depreciationDiff = (newCost - oldBookValue) / years
  const cashFlow = p.saving! * (1 - TAX_RATE) + depreciationDiff * TAX_RATE
  const rate = p.ratePercent! / 100
  const factors = discountFactorsTable(rate, years)
  const npv = netPresentValue(
    newCost - disposal,
    Array.from({ length: years }, () => cashFlow),
    { factors },
  )
  return { years, newCost, oldBookValue, disposal, depreciationDiff, cashFlow, rate, factors, npv }
}

export const replacementNpv: ProblemTemplate = {
  id: 'npv.replacement',
  topic: 'npv',
  title: '取替投資の差額キャッシュフロー',
  difficulty: 3,
  source: { kind: 'original', publishable: true },
  params: {
    years: { kind: 'int', min: 3, max: 5 },
    newCostPerYear: { kind: 'int', min: 2_000, max: 8_000, step: 100 },
    oldBookPerYear: { kind: 'int', min: 300, max: 1_500, step: 100 },
    proceeds: { kind: 'int', min: 200, max: 6_000, step: 100 },
    saving: { kind: 'int', min: 800, max: 5_000, step: 100 },
    ratePercent: { kind: 'choice', values: [5, 6, 8, 10] },
  },
  constraint: (p) => {
    const { oldBookValue, newCost, npv } = replacement(p)
    // 売却額 = 帳簿価額 だと税効果がなく、税効果の考え忘れと区別できない
    return p.proceeds! !== oldBookValue && oldBookValue < newCost && Math.abs(npv) >= newCost * 0.02
  },
  body: (p) => {
    const { years, newCost, oldBookValue, rate } = replacement(p)
    return [
      text(
        `D 社は、現在使っている旧設備を売却し、新設備に取り替えることを検討している。いずれも残りの耐用年数は ${years} 年、残存価額は 0 で、定額法で減価償却する。`,
      ),
      amountTable('設備の情報（単位：千円）', [
        ['新設備の取得原価', newCost],
        ['旧設備の帳簿価額', oldBookValue],
        ['旧設備の売却額', p.proceeds!],
        ['取替による毎年の現金支出費用の削減額', p.saving!],
      ]),
      text(
        `${taxText}資本コストは ${formatNumber(rate * 100)}% とする。旧設備の売却は投資時点（0 年目）に行う。`,
      ),
      factorBlock(rate, years),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'disposal',
      prompt: '旧設備の売却による税引後の収入を求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => replacement(p).disposal,
      commonMistakes: [
        {
          answer: (p) => p.proceeds!,
          hint: '売却損益の税効果を考えていない？ 売却益には税金がかかり、売却損は節税になる。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'cashFlow',
      prompt: '取替による毎年の差額キャッシュフローを求めよ（千円、千円未満を四捨五入）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => replacement(p).cashFlow,
      commonMistakes: [
        {
          answer: (p) =>
            p.saving! * (1 - TAX_RATE) + (replacement(p).newCost / p.years!) * TAX_RATE,
          hint: '新設備の減価償却費をそのまま使っていない？ 旧設備を使い続けた場合との差額で考える。',
        },
        {
          answer: (p) => p.saving! * (1 - TAX_RATE),
          hint: '減価償却費の増加による節税効果を入れ忘れていない？',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'npv',
      prompt: '取替投資の正味現在価値を求めよ（千円、千円未満を四捨五入。マイナスは △ を付ける）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => replacement(p).npv,
    },
  ],
  explanation: (p) => {
    const { years, newCost, oldBookValue, disposal, depreciationDiff, cashFlow, factors, npv } =
      replacement(p)
    const factorSum = factors.reduce((a, b) => a + b, 0)
    return [
      text(
        `売却の税引後収入 = ${yen(p.proceeds!)} − (${yen(p.proceeds!)} − ${yen(oldBookValue)}) × ${TAX_RATE} = ${yen(Math.round(disposal))} 千円`,
      ),
      text(
        `差額の減価償却費 = (${yen(newCost)} − ${yen(oldBookValue)}) ÷ ${years} 年 = ${formatNumber(depreciationDiff)} 千円`,
      ),
      text(
        `差額 CF = 削減額 ${yen(p.saving!)} × (1 − ${TAX_RATE}) + 差額の減価償却費 ${formatNumber(depreciationDiff)} × ${TAX_RATE} = ${yen(Math.round(cashFlow))} 千円`,
      ),
      text(
        `NPV = ${yen(Math.round(cashFlow))} × ${formatNumber(factorSum, 3)} − (${yen(newCost)} − ${yen(Math.round(disposal))}) ≒ ${yen(Math.round(npv))} 千円`,
      ),
    ]
  },
}

// ---------------------------------------------------------------------------
// 回収期間

function paybackOf(p: Params) {
  const cashFlows = [p.cf1!, p.cf2!, p.cf3!, p.cf4!, p.cf5!]
  return { cashFlows, period: paybackPeriod(p.investment!, cashFlows) }
}

export const payback: ProblemTemplate = {
  id: 'npv.payback',
  topic: 'npv',
  title: '回収期間法',
  difficulty: 1,
  source: { kind: 'original', publishable: true },
  params: {
    investment: { kind: 'int', min: 5_000, max: 20_000, step: 500 },
    cf1: { kind: 'int', min: 1_000, max: 6_000, step: 100 },
    cf2: { kind: 'int', min: 1_000, max: 6_000, step: 100 },
    cf3: { kind: 'int', min: 1_000, max: 6_000, step: 100 },
    cf4: { kind: 'int', min: 1_000, max: 6_000, step: 100 },
    cf5: { kind: 'int', min: 1_000, max: 6_000, step: 100 },
  },
  constraint: (p) => {
    const { cashFlows, period } = paybackOf(p)
    if (period === null || period < 2) return false
    // 平均で割る誤答と、四捨五入後に 0.1 年以上ずれるようにする
    const average = cashFlows.reduce((a, b) => a + b, 0) / cashFlows.length
    return Math.abs(p.investment! / average - period) >= 0.15
  },
  body: (p) => [
    text(
      `D 社は ${yen(p.investment!)} 千円の投資を検討している。投資後の税引後キャッシュフローは次のとおりで、年の途中は均等に生じるものとする。`,
    ),
    multiColumnTable(
      '税引後キャッシュフロー（単位：千円）',
      ['1 年目', '2 年目', '3 年目', '4 年目', '5 年目'],
      [['CF', ...paybackOf(p).cashFlows] as [string, ...number[]]],
    ),
  ],
  steps: [
    {
      kind: 'numeric',
      id: 'payback',
      prompt: '回収期間を求めよ（年、小数点第 2 位を四捨五入）。',
      unit: '年',
      rounding: { mode: 'halfUp', digits: 1 },
      answer: (p) => paybackOf(p).period ?? Number.NaN,
      commonMistakes: [
        {
          answer: (p) => {
            const { cashFlows } = paybackOf(p)
            return p.investment! / (cashFlows.reduce((a, b) => a + b, 0) / cashFlows.length)
          },
          hint: '平均の CF で割っていない？ 毎年の CF が違うときは、累計が投資額に届く年を探す。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const { cashFlows, period } = paybackOf(p)
    const whole = Math.floor(period!)
    const collected = cashFlows.slice(0, whole).reduce((a, b) => a + b, 0)
    const remaining = p.investment! - collected
    return [
      text(
        `${whole} 年目までの累計 CF = ${cashFlows.slice(0, whole).map(yen).join(' + ')} = ${yen(collected)} 千円。残りは ${yen(remaining)} 千円。`,
      ),
      text(
        `${whole + 1} 年目の CF ${yen(cashFlows[whole]!)} 千円のうち ${yen(remaining)} 千円で回収できるので、回収期間 = ${whole} + ${yen(remaining)} ÷ ${yen(cashFlows[whole]!)} ≒ ${formatNumber(period!, 1)} 年`,
      ),
    ]
  },
}
