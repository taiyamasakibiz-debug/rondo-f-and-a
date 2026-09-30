import { computeIndicators } from '@/domain/analysis/indicators'
import { formatNumber } from '@/engine/numbers'
import type { Params, ProblemTemplate } from '@/engine/types'
import { amountTable, multiColumnTable, text, yen } from '../helpers'
import { companyOf, companyParams, isReasonableCompany } from './company'

/** 期首（前期末）の売上債権だけが違う B/S を作り、期首と期末の平均で回転率を出す */
function caseOf(p: Params) {
  const company = companyOf(p)
  const previousBalanceSheet = { ...company.balanceSheet, receivables: p.receivablesOpen! }
  const average = computeIndicators({
    ...company,
    previousBalanceSheet,
    basis: 'average',
  }).receivablesTurnover!
  const ending = computeIndicators(company).receivablesTurnover!
  return {
    sales: company.incomeStatement.sales,
    open: p.receivablesOpen!,
    close: company.balanceSheet.receivables,
    average,
    ending,
    days: 365 / average,
  }
}

export const receivableTurnoverDays: ProblemTemplate = {
  id: 'analysis.receivable-turnover-days',
  topic: 'analysis',
  title: '売上債権回転率と回転日数（期首・期末の平均）',
  difficulty: 2,
  source: { kind: 'original', publishable: true },
  params: {
    ...companyParams,
    receivablesOpen: { kind: 'int', min: 800, max: 5_000, step: 100 },
  },
  // 期首と期末が同じだと、期末の値で計算しても正解と同じになる
  constraint: (p) => isReasonableCompany(p) && p.receivablesOpen !== p.receivables,
  body: (p) => {
    const c = caseOf(p)
    return [
      text(
        'D 社の売上債権と売上高は次のとおりである。回転率・回転日数は期首と期末の平均を用い、1 年を 365 日とする。',
      ),
      multiColumnTable(
        '貸借対照表（抜粋、単位：千円）',
        ['前期末', '当期末'],
        [['売上債権', c.open, c.close]],
      ),
      amountTable('損益計算書（抜粋、単位：千円）', [['売上高', c.sales]]),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'turnover',
      prompt: '売上債権回転率を求めよ（回、小数点第 3 位を四捨五入）。',
      unit: '回',
      rounding: { mode: 'halfUp', digits: 2 },
      answer: (p) => caseOf(p).average,
      commonMistakes: [
        {
          answer: (p) => caseOf(p).ending,
          hint: '期末の残高だけで割っていない？ この問題は期首と期末の平均を使う。',
        },
      ],
    },
    {
      kind: 'numeric',
      id: 'days',
      prompt: '売上債権回転日数を求めよ（日、小数点第 2 位を四捨五入）。',
      unit: '日',
      rounding: { mode: 'halfUp', digits: 1 },
      points: 2,
      answer: (p) => caseOf(p).days,
      commonMistakes: [
        {
          answer: (p) => 365 / caseOf(p).ending,
          hint: '期末の残高で計算していない？ 期首と期末の平均を使う。',
        },
        {
          answer: (p) => caseOf(p).average * 365,
          hint: '回転日数 = 365 ÷ 回転率。掛けるのではなく割る。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const c = caseOf(p)
    const averageBalance = (c.open + c.close) / 2
    return [
      text(
        `平均の売上債権 = (${yen(c.open)} + ${yen(c.close)}) ÷ 2 = ${formatNumber(averageBalance)} 千円`,
      ),
      text(
        `売上債権回転率 = 売上高 ${yen(c.sales)} ÷ ${formatNumber(averageBalance)} ≒ ${formatNumber(c.average, 2)} 回`,
      ),
      text(
        `売上債権回転日数 = 365 ÷ ${formatNumber(c.average, 2)} ≒ ${formatNumber(c.days, 1)} 日（売上から回収までにかかる日数の目安）`,
      ),
    ]
  },
}
