import type { JournalAnswer, Params, ProblemTemplate } from '@/engine/types'
import { text, yen } from '../helpers'

const yenText = (value: number) => `${yen(value)} 円`

// ---------------------------------------------------------------------------
// 売上（現金と掛け）

export const creditSale: ProblemTemplate = {
  id: 'journal.credit-sale',
  topic: 'journal',
  title: '現金と掛けによる売上',
  difficulty: 1,
  source: { kind: 'original', publishable: true },
  params: {
    sales: { kind: 'int', min: 100_000, max: 900_000, step: 10_000 },
    cashPercent: { kind: 'int', min: 10, max: 60, step: 10 },
  },
  body: (p) => [
    text(
      `商品を ${yenText(p.sales!)}で販売し、代金のうち ${yenText(cashOf(p))}は現金で受け取り、残額は掛けとした。この取引の仕訳を答えよ（三分法）。`,
    ),
  ],
  steps: [
    {
      kind: 'journal',
      id: 'entry',
      prompt: '仕訳',
      points: 2,
      accounts: [
        { id: 'cash', name: '現金' },
        { id: 'receivable', name: '売掛金' },
        { id: 'sales', name: '売上' },
        { id: 'purchases', name: '仕入' },
        { id: 'payable', name: '買掛金' },
      ],
      answer: (p) => ({
        debits: [
          { accountId: 'cash', amount: cashOf(p) },
          { accountId: 'receivable', amount: p.sales! - cashOf(p) },
        ],
        credits: [{ accountId: 'sales', amount: p.sales! }],
      }),
      commonMistakes: [
        {
          answer: (p) => ({
            debits: [
              { accountId: 'cash', amount: cashOf(p) },
              { accountId: 'payable', amount: p.sales! - cashOf(p) },
            ],
            credits: [{ accountId: 'sales', amount: p.sales! }],
          }),
          hint: '掛けで売ったときの代金は「売掛金」（あとで受け取る権利）。買掛金は仕入の未払い分。',
        },
      ],
    },
  ],
  explanation: (p) => [
    text(
      `（借方）現金 ${yen(cashOf(p))}、売掛金 ${yen(p.sales! - cashOf(p))} ／（貸方）売上 ${yen(p.sales!)}`,
    ),
    text('受け取った現金と、まだ受け取っていない掛け代金（売掛金）の合計が売上になる。'),
  ],
}

function cashOf(p: Params): number {
  return (p.sales! * p.cashPercent!) / 100
}

// ---------------------------------------------------------------------------
// 減価償却（間接法、期中取得）

function depreciationOf(p: Params): number {
  return (p.cost! / p.life!) * (p.months! / 12)
}

export const depreciation: ProblemTemplate = {
  id: 'journal.depreciation',
  topic: 'journal',
  title: '減価償却（間接法・月割り）',
  difficulty: 2,
  source: { kind: 'original', publishable: true },
  params: {
    life: { kind: 'choice', values: [4, 5, 6, 8] },
    // 取得原価 = 耐用年数 × 12 × この値 × 1,000（月割りの金額が割り切れるように）
    costUnit: { kind: 'int', min: 5, max: 40 },
    // 期中に取得した設備なので 12 か月未満（12 か月だと月割りの誤答と正解が同じになる）
    months: { kind: 'choice', values: [3, 6, 9] },
  },
  body: (p) => [
    text(
      `決算日に、当期に取得した備品（取得原価 ${yenText(costOf(p))}、残存価額 0、耐用年数 ${p.life} 年）の減価償却を行う。定額法・間接法で記帳し、当期の使用期間は ${p.months} か月（月割り計算）である。仕訳を答えよ。`,
    ),
  ],
  steps: [
    {
      kind: 'journal',
      id: 'entry',
      prompt: '仕訳',
      points: 2,
      accounts: [
        { id: 'depreciation', name: '減価償却費' },
        { id: 'accumulated', name: '減価償却累計額' },
        { id: 'equipment', name: '備品' },
        { id: 'cash', name: '現金' },
      ],
      answer: (p) => entry('depreciation', 'accumulated', depreciationOf(withCost(p))),
      commonMistakes: [
        {
          answer: (p) => entry('depreciation', 'equipment', depreciationOf(withCost(p))),
          hint: '間接法では備品を直接減らさず、「減価償却累計額」を使う。',
        },
        {
          answer: (p) => entry('depreciation', 'accumulated', costOf(p) / p.life!),
          hint: '月割りを忘れていない？ 当期に使ったのは一部の月だけ。',
        },
      ],
    },
  ],
  explanation: (p) => [
    text(
      `減価償却費 = ${yen(costOf(p))} ÷ ${p.life} 年 × ${p.months} / 12 = ${yen(depreciationOf(withCost(p)))} 円`,
    ),
    text(
      `（借方）減価償却費 ${yen(depreciationOf(withCost(p)))} ／（貸方）減価償却累計額 ${yen(depreciationOf(withCost(p)))}`,
    ),
  ],
}

function costOf(p: Params): number {
  return p.life! * 12 * p.costUnit! * 1_000
}

function withCost(p: Params): Params {
  return { ...p, cost: costOf(p) }
}

// ---------------------------------------------------------------------------
// 貸倒引当金（差額補充法）

function allowanceOf(p: Params) {
  const required = (p.receivables! * p.ratePercent!) / 100
  return { required, provision: required - p.balance! }
}

export const allowance: ProblemTemplate = {
  id: 'journal.allowance',
  topic: 'journal',
  title: '貸倒引当金の設定（差額補充法）',
  difficulty: 2,
  source: { kind: 'original', publishable: true },
  params: {
    receivables: { kind: 'int', min: 500_000, max: 5_000_000, step: 100_000 },
    ratePercent: { kind: 'int', min: 1, max: 5 },
    balance: { kind: 'int', min: 1_000, max: 60_000, step: 1_000 },
  },
  constraint: (p) => allowanceOf(p).provision > 0,
  body: (p) => [
    text(
      `決算日の売掛金の残高は ${yenText(p.receivables!)}である。この期末残高に対して ${p.ratePercent}% の貸倒引当金を差額補充法で設定する。貸倒引当金の残高は ${yenText(p.balance!)}である。仕訳を答えよ。`,
    ),
  ],
  steps: [
    {
      kind: 'journal',
      id: 'entry',
      prompt: '仕訳',
      points: 2,
      accounts: [
        { id: 'provision', name: '貸倒引当金繰入' },
        { id: 'allowance', name: '貸倒引当金' },
        { id: 'receivable', name: '売掛金' },
        { id: 'badDebt', name: '貸倒損失' },
      ],
      answer: (p) => entry('provision', 'allowance', allowanceOf(p).provision),
      commonMistakes: [
        {
          answer: (p) => entry('provision', 'allowance', allowanceOf(p).required),
          hint: '差額補充法では、残っている引当金との差額だけを繰り入れる。',
        },
        {
          answer: (p) => entry('badDebt', 'receivable', allowanceOf(p).provision),
          hint: '実際に貸し倒れたわけではない。将来に備えて「貸倒引当金」を積む。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const { required, provision } = allowanceOf(p)
    return [
      text(`必要な引当金 = ${yen(p.receivables!)} × ${p.ratePercent}% = ${yen(required)} 円`),
      text(`繰入額 = ${yen(required)} − 残高 ${yen(p.balance!)} = ${yen(provision)} 円`),
      text(`（借方）貸倒引当金繰入 ${yen(provision)} ／（貸方）貸倒引当金 ${yen(provision)}`),
    ]
  },
}

function entry(debit: string, credit: string, amount: number): JournalAnswer {
  return {
    debits: [{ accountId: debit, amount }],
    credits: [{ accountId: credit, amount }],
  }
}
