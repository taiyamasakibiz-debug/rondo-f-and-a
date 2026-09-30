import {
  type IndirectCashFlowInput,
  type OperatingLineId,
  indirectCashFlowStatement,
} from '@/domain/cashflow/indirect'
import { emptyBalanceSheet, emptyIncomeStatement } from '@/domain/statements'
import type { NumericStep, Params, ProblemTemplate } from '@/engine/types'
import { amountTable, multiColumnTable, text, yen } from '../helpers'

const signNote = 'キャッシュフローを減らす項目は △ を付けて答えること。'

function line(input: IndirectCashFlowInput, id: OperatingLineId): number {
  const statement = indirectCashFlowStatement(input)
  return [...statement.operatingAdjustments, ...statement.operatingPayments].find(
    (item) => item.id === id,
  )!.amount
}

function amountStep(
  id: string,
  prompt: string,
  answer: (p: Params) => number,
  commonMistakes: NumericStep['commonMistakes'] = [],
  points = 1,
): NumericStep {
  return {
    kind: 'numeric',
    id,
    prompt,
    unit: '千円',
    rounding: { mode: 'halfUp', digits: 0 },
    points,
    answer,
    commonMistakes,
  }
}

// ---------------------------------------------------------------------------
// 運転資本の増減

function workingCapitalInput(p: Params): IndirectCashFlowInput {
  return {
    // 税引前当期純利益だけを使うので、売上高に置いて段階利益を作る
    incomeStatement: {
      ...emptyIncomeStatement(),
      sales: p.profitBeforeTax!,
      incomeTaxes: p.taxes!,
    },
    openingBalanceSheet: {
      ...emptyBalanceSheet(),
      receivables: p.arOpen!,
      inventories: p.invOpen!,
      payables: p.apOpen!,
    },
    closingBalanceSheet: {
      ...emptyBalanceSheet(),
      receivables: p.arClose!,
      inventories: p.invClose!,
      payables: p.apClose!,
    },
    depreciation: p.depreciation!,
  }
}

export const workingCapital: ProblemTemplate = {
  id: 'cf.working-capital',
  topic: 'cf',
  title: '運転資本の増減と営業キャッシュフロー',
  difficulty: 1,
  source: { kind: 'original', publishable: true },
  params: {
    profitBeforeTax: { kind: 'int', min: 500, max: 5_000, step: 50 },
    taxes: { kind: 'int', min: 100, max: 1_500, step: 10 },
    depreciation: { kind: 'int', min: 200, max: 2_000, step: 50 },
    arOpen: { kind: 'int', min: 1_000, max: 6_000, step: 50 },
    arClose: { kind: 'int', min: 1_000, max: 6_000, step: 50 },
    invOpen: { kind: 'int', min: 500, max: 4_000, step: 50 },
    invClose: { kind: 'int', min: 500, max: 4_000, step: 50 },
    apOpen: { kind: 'int', min: 500, max: 4_000, step: 50 },
    apClose: { kind: 'int', min: 500, max: 4_000, step: 50 },
  },
  // 増減がゼロだと符号の取り違えと区別できない。資産の増減が打ち消し合うのも避ける
  constraint: (p) =>
    p.arOpen !== p.arClose &&
    p.invOpen !== p.invClose &&
    p.apOpen !== p.apClose &&
    p.taxes! < p.profitBeforeTax! &&
    p.arClose! - p.arOpen! + (p.invClose! - p.invOpen!) !== 0,
  body: (p) => [
    text('D 社の当期の資料は次のとおりである。間接法で営業活動によるキャッシュフローを求める。'),
    multiColumnTable(
      '貸借対照表（抜粋、単位：千円）',
      ['前期末', '当期末'],
      [
        ['売上債権', p.arOpen!, p.arClose!],
        ['棚卸資産', p.invOpen!, p.invClose!],
        ['仕入債務', p.apOpen!, p.apClose!],
      ],
    ),
    amountTable('その他の資料（単位：千円）', [
      ['税引前当期純利益', p.profitBeforeTax!],
      ['減価償却費', p.depreciation!],
      ['法人税等の支払額', p.taxes!],
    ]),
    text(signNote),
  ],
  steps: [
    amountStep(
      'receivables',
      '「売上債権の増減額」の欄に記入する金額を求めよ（千円）。',
      (p) => line(workingCapitalInput(p), 'receivablesChange'),
      [
        {
          answer: (p) => -line(workingCapitalInput(p), 'receivablesChange'),
          hint: '符号が逆になっていない？ 資産が増えると、その分キャッシュは減る。',
        },
      ],
    ),
    amountStep(
      'inventories',
      '「棚卸資産の増減額」の欄に記入する金額を求めよ（千円）。',
      (p) => line(workingCapitalInput(p), 'inventoriesChange'),
      [
        {
          answer: (p) => -line(workingCapitalInput(p), 'inventoriesChange'),
          hint: '符号が逆になっていない？ 在庫が増えると、その分キャッシュは減る。',
        },
      ],
    ),
    amountStep(
      'payables',
      '「仕入債務の増減額」の欄に記入する金額を求めよ（千円）。',
      (p) => line(workingCapitalInput(p), 'payablesChange'),
      [
        {
          answer: (p) => -line(workingCapitalInput(p), 'payablesChange'),
          hint: '符号が逆になっていない？ 負債が増える（支払いを待ってもらう）と、キャッシュは増える。',
        },
      ],
    ),
    amountStep(
      'operatingCashFlow',
      '営業活動によるキャッシュフローを求めよ（千円）。',
      (p) => indirectCashFlowStatement(workingCapitalInput(p)).operatingCashFlow,
      [
        {
          answer: (p) =>
            indirectCashFlowStatement(workingCapitalInput(p)).operatingCashFlow + p.taxes!,
          hint: '法人税等の支払額を差し引き忘れていない？',
        },
      ],
      2,
    ),
  ],
  explanation: (p) => {
    const input = workingCapitalInput(p)
    const statement = indirectCashFlowStatement(input)
    return [
      text(
        '資産（売上債権・棚卸資産）の増加はキャッシュのマイナス、負債（仕入債務）の増加はプラスとして調整する。',
      ),
      ...statement.operatingAdjustments
        .filter((item) => item.amount !== 0)
        .map((item) => text(`${item.label}：${yen(item.amount)}`)),
      text(
        `小計 ${yen(statement.subtotal)} − 法人税等の支払額 ${yen(p.taxes!)} = ${yen(statement.operatingCashFlow)} 千円`,
      ),
    ]
  },
}

// ---------------------------------------------------------------------------
// 引当金・利息・売却益の調整

function adjustmentsInput(p: Params): IndirectCashFlowInput {
  return {
    incomeStatement: {
      ...emptyIncomeStatement(),
      sales: p.profitBeforeTax!,
      interestAndDividendIncome: p.interestIncome!,
      interestExpense: p.interestExpense!,
      incomeTaxes: p.taxes!,
    },
    openingBalanceSheet: {
      ...emptyBalanceSheet(),
      allowanceForDoubtfulAccounts: -p.allowanceOpen!,
    },
    closingBalanceSheet: {
      ...emptyBalanceSheet(),
      allowanceForDoubtfulAccounts: -(p.allowanceOpen! + p.allowanceIncrease!),
    },
    depreciation: p.depreciation!,
    gainOnSaleOfFixedAssets: p.gainOnSale!,
  }
}

export const adjustments: ProblemTemplate = {
  id: 'cf.adjustments',
  topic: 'cf',
  title: '非資金項目と営業外損益の調整',
  difficulty: 2,
  source: { kind: 'original', publishable: true },
  params: {
    profitBeforeTax: { kind: 'int', min: 800, max: 6_000, step: 50 },
    depreciation: { kind: 'int', min: 200, max: 2_000, step: 50 },
    allowanceOpen: { kind: 'int', min: 20, max: 200, step: 5 },
    allowanceIncrease: { kind: 'int', min: 5, max: 80, step: 5 },
    interestIncome: { kind: 'int', min: 10, max: 150, step: 5 },
    interestExpense: { kind: 'int', min: 20, max: 300, step: 5 },
    gainOnSale: { kind: 'int', min: 50, max: 800, step: 10 },
    taxes: { kind: 'int', min: 100, max: 1_500, step: 10 },
  },
  constraint: (p) => p.taxes! < p.profitBeforeTax! && p.interestIncome !== p.interestExpense,
  body: (p) => [
    text(
      'D 社の当期の資料は次のとおりである。売上債権・棚卸資産・仕入債務は前期末と当期末で変わらず、貸倒れの発生はなかった。利息の受払額は損益計算書の金額と同じである。',
    ),
    amountTable('損益計算書の資料（単位：千円）', [
      ['税引前当期純利益', p.profitBeforeTax!],
      ['減価償却費', p.depreciation!],
      ['貸倒引当金繰入額', p.allowanceIncrease!],
      ['受取利息・配当金', p.interestIncome!],
      ['支払利息', p.interestExpense!],
      ['固定資産売却益', p.gainOnSale!],
    ]),
    multiColumnTable(
      '貸借対照表（抜粋、単位：千円）',
      ['前期末', '当期末'],
      [['貸倒引当金', p.allowanceOpen!, p.allowanceOpen! + p.allowanceIncrease!]],
    ),
    amountTable('その他の資料（単位：千円）', [['法人税等の支払額', p.taxes!]]),
    text(signNote),
  ],
  steps: [
    amountStep(
      'allowance',
      '「貸倒引当金の増減額」の欄に記入する金額を求めよ（千円）。',
      (p) => line(adjustmentsInput(p), 'allowanceIncrease'),
      [
        {
          answer: (p) => p.allowanceIncrease! * 2,
          hint: '繰入額と引当金の増加を両方足していない？ 同じものなので 1 回だけ足し戻す。',
        },
        {
          answer: (p) => -p.allowanceIncrease!,
          hint: '符号が逆になっていない？ 引当金の繰入は現金が出ていかない費用なので、足し戻す。',
        },
      ],
    ),
    amountStep(
      'subtotal',
      '営業活動によるキャッシュフローの「小計」を求めよ（千円）。',
      (p) => indirectCashFlowStatement(adjustmentsInput(p)).subtotal,
      [
        {
          answer: (p) =>
            indirectCashFlowStatement(adjustmentsInput(p)).subtotal + 2 * p.gainOnSale!,
          hint: '固定資産売却益を足していない？ 売却益は投資活動の区分で扱うので、営業 CF からは差し引く。',
        },
        {
          answer: (p) =>
            indirectCashFlowStatement(adjustmentsInput(p)).subtotal +
            p.interestIncome! -
            p.interestExpense!,
          hint: '受取利息・支払利息の調整を忘れていない？ 小計の上ではいったん取り除き、小計の下で実際の受払額を記入する。',
        },
      ],
      2,
    ),
    amountStep(
      'operatingCashFlow',
      '営業活動によるキャッシュフローを求めよ（千円）。',
      (p) => indirectCashFlowStatement(adjustmentsInput(p)).operatingCashFlow,
      [],
      2,
    ),
  ],
  explanation: (p) => {
    const statement = indirectCashFlowStatement(adjustmentsInput(p))
    return [
      ...statement.operatingAdjustments
        .filter((item) => item.amount !== 0)
        .map((item) => text(`${item.label}：${yen(item.amount)}`)),
      text(`小計 = ${yen(statement.subtotal)} 千円`),
      ...statement.operatingPayments.map((item) => text(`${item.label}：${yen(item.amount)}`)),
      text(`営業活動によるキャッシュフロー = ${yen(statement.operatingCashFlow)} 千円`),
      text(
        '貸倒引当金繰入額は、引当金の増加額と同じもの（当期は貸倒れがない）。二重に足さないように注意する。',
      ),
    ]
  },
}
