import { indirectCashFlowStatement } from '@/domain/cashflow/indirect'
import { emptyBalanceSheet, emptyIncomeStatement } from '@/domain/statements'
import type { NumericStep, Params, ProblemTemplate } from '@/engine/types'
import { amountTable, multiColumnTable, text, yen } from '../helpers'

const signNote = 'キャッシュフローを減らす項目は △ を付けて答えること。'

function amountStep(step: Omit<NumericStep, 'kind' | 'unit' | 'rounding'>): NumericStep {
  return { kind: 'numeric', unit: '千円', rounding: { mode: 'halfUp', digits: 0 }, ...step }
}

// ---------------------------------------------------------------------------
// 法人税等の支払額

/** 法人税等の支払額 = 期首の未払法人税等 + 当期の法人税等 − 期末の未払法人税等 */
function taxesPaid(p: Params): number {
  return p.payableOpen! + p.taxes! - p.payableClose!
}

export const incomeTaxesPaid: ProblemTemplate = {
  id: 'cf.income-taxes-paid',
  topic: 'cf',
  title: '法人税等の支払額',
  difficulty: 2,
  source: { kind: 'original', publishable: true },
  params: {
    taxes: { kind: 'int', min: 200, max: 3_000, step: 10 },
    payableOpen: { kind: 'int', min: 50, max: 1_500, step: 10 },
    payableClose: { kind: 'int', min: 50, max: 1_500, step: 10 },
  },
  // 期首と期末が同じだと、損益計算書の金額をそのまま答えても正解になってしまう
  constraint: (p) => p.payableOpen !== p.payableClose && taxesPaid(p) > 0,
  body: (p) => [
    text('D 社の当期の法人税等に関する資料は次のとおりである。'),
    amountTable('損益計算書（抜粋、単位：千円）', [['法人税、住民税及び事業税', p.taxes!]]),
    multiColumnTable(
      '貸借対照表（抜粋、単位：千円）',
      ['前期末', '当期末'],
      [['未払法人税等', p.payableOpen!, p.payableClose!]],
    ),
    text(signNote),
  ],
  steps: [
    amountStep({
      id: 'taxesPaid',
      prompt:
        '営業活動によるキャッシュフローの「法人税等の支払額」の欄に記入する金額を求めよ（千円）。',
      points: 2,
      answer: (p) => -taxesPaid(p),
      commonMistakes: [
        {
          answer: (p) => -p.taxes!,
          hint: '損益計算書の金額をそのまま使っていない？ 未払法人税等の増減で、実際に払った額を出す。',
        },
        {
          answer: (p) => taxesPaid(p),
          hint: '支払いはキャッシュの減少なので △ を付ける。',
        },
        {
          answer: (p) => -(p.payableClose! + p.taxes! - p.payableOpen!),
          hint: '期首と期末が逆になっていない？ 支払額 = 期首の未払 + 当期の計上額 − 期末の未払。',
        },
      ],
    }),
  ],
  explanation: (p) => [
    text(
      `支払額 = 期首の未払法人税等 ${yen(p.payableOpen!)} + 当期の法人税等 ${yen(p.taxes!)} − 期末の未払法人税等 ${yen(p.payableClose!)} = ${yen(taxesPaid(p))} 千円`,
    ),
    text(
      '前期分の未払（期首残高）を当期に払い、当期分のうち期末に残っている未払はまだ払っていない、と考える。CF 計算書にはマイナス（△）で記入する。',
    ),
  ],
}

// ---------------------------------------------------------------------------
// 投資 CF・財務 CF と期末の現金

function statementOf(p: Params) {
  const investing = [
    { label: '有形固定資産の取得による支出', amount: -p.capex! },
    { label: '有形固定資産の売却による収入', amount: p.saleProceeds! },
  ]
  const financing = [
    { label: '長期借入れによる収入', amount: p.borrowing! },
    { label: '長期借入金の返済による支出', amount: -p.repayment! },
    { label: '配当金の支払額', amount: -p.dividends! },
  ]
  const statement = indirectCashFlowStatement({
    // 営業 CF は与えるので、税引前当期純利益に置いてそのまま使う
    incomeStatement: { ...emptyIncomeStatement(), sales: p.operatingCashFlow! },
    openingBalanceSheet: emptyBalanceSheet(),
    closingBalanceSheet: emptyBalanceSheet(),
    depreciation: 0,
    investingActivities: investing,
    financingActivities: financing,
  })
  return {
    investing,
    financing,
    statement,
    closingCash: p.openingCash! + statement.netChangeInCash,
  }
}

export const investingAndFinancing: ProblemTemplate = {
  id: 'cf.investing-financing',
  topic: 'cf',
  title: '投資 CF・財務 CF と期末の現金',
  difficulty: 1,
  source: { kind: 'original', publishable: true },
  params: {
    operatingCashFlow: { kind: 'int', min: 500, max: 5_000, step: 50 },
    capex: { kind: 'int', min: 300, max: 4_000, step: 50 },
    saleProceeds: { kind: 'int', min: 50, max: 800, step: 10 },
    borrowing: { kind: 'int', min: 0, max: 3_000, step: 100 },
    repayment: { kind: 'int', min: 100, max: 2_000, step: 50 },
    dividends: { kind: 'int', min: 50, max: 500, step: 10 },
    openingCash: { kind: 'int', min: 1_000, max: 6_000, step: 100 },
  },
  constraint: (p) => {
    const { statement, closingCash } = statementOf(p)
    return (
      closingCash > 0 &&
      statement.financingCashFlow !== 0 &&
      // 符号の取り違えが正解と同じにならないように
      statement.investingCashFlow !== 0
    )
  },
  body: (p) => [
    text('D 社の当期のキャッシュフローに関する資料は次のとおりである。'),
    amountTable('資料（単位：千円）', [
      ['営業活動によるキャッシュフロー', p.operatingCashFlow!],
      ['有形固定資産の取得', p.capex!],
      ['有形固定資産の売却による入金', p.saleProceeds!],
      ['長期借入れ', p.borrowing!],
      ['長期借入金の返済', p.repayment!],
      ['配当金の支払い', p.dividends!],
      ['期首の現金及び現金同等物', p.openingCash!],
    ]),
    text(signNote),
  ],
  steps: [
    amountStep({
      id: 'investing',
      prompt: '投資活動によるキャッシュフローを求めよ（千円）。',
      answer: (p) => statementOf(p).statement.investingCashFlow,
      commonMistakes: [
        {
          answer: (p) => p.capex! + p.saleProceeds!,
          hint: '取得による支出はキャッシュの減少（マイナス）。売却による収入だけがプラス。',
        },
      ],
    }),
    amountStep({
      id: 'financing',
      prompt: '財務活動によるキャッシュフローを求めよ（千円）。',
      answer: (p) => statementOf(p).statement.financingCashFlow,
      commonMistakes: [
        {
          answer: (p) => p.borrowing! - p.repayment!,
          hint: '配当金の支払いを忘れていない？ 配当金の支払いは財務活動に入る。',
        },
      ],
    }),
    amountStep({
      id: 'closingCash',
      prompt: '期末の現金及び現金同等物の残高を求めよ（千円）。',
      points: 2,
      answer: (p) => statementOf(p).closingCash,
      commonMistakes: [
        {
          answer: (p) => statementOf(p).statement.netChangeInCash,
          hint: '増減額だけを答えていない？ 期首の残高に増減額を足す。',
        },
      ],
    }),
  ],
  explanation: (p) => {
    const { investing, financing, statement, closingCash } = statementOf(p)
    const list = (items: { label: string; amount: number }[]) =>
      items.map((item) => `${item.label} ${yen(item.amount)}`).join('、')
    return [
      text(
        `投資活動によるキャッシュフロー：${list(investing)} → ${yen(statement.investingCashFlow)} 千円`,
      ),
      text(
        `財務活動によるキャッシュフロー：${list(financing)} → ${yen(statement.financingCashFlow)} 千円`,
      ),
      text(
        `増減額 = ${yen(statement.operatingCashFlow)} + ${yen(statement.investingCashFlow)} + ${yen(statement.financingCashFlow)} = ${yen(statement.netChangeInCash)} 千円。期末の残高 = 期首 ${yen(p.openingCash!)} + ${yen(statement.netChangeInCash)} = ${yen(closingCash)} 千円`,
      ),
    ]
  },
}
