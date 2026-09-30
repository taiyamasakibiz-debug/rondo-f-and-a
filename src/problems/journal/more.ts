import type { JournalAnswer, Params, ProblemTemplate } from '@/engine/types'
import { text, yen } from '../helpers'

const yenText = (value: number) => `${yen(value)} 円`

// ---------------------------------------------------------------------------
// 固定資産の売却（間接法）

function saleOf(p: Params) {
  const cost = p.life! * p.costUnit! * 10_000
  const accumulated = (cost / p.life!) * p.elapsed!
  const book = cost - accumulated
  const proceeds = (book * p.proceedsPercent!) / 100
  return { cost, accumulated, book, proceeds, gain: proceeds - book }
}

const SALE_ACCOUNTS = [
  { id: 'cash', name: '現金' },
  { id: 'equipment', name: '備品' },
  { id: 'accumulated', name: '減価償却累計額' },
  { id: 'gain', name: '固定資産売却益' },
  { id: 'loss', name: '固定資産売却損' },
  { id: 'depreciation', name: '減価償却費' },
]

function saleEntry(p: Params): JournalAnswer {
  const { cost, accumulated, proceeds, gain } = saleOf(p)
  return {
    debits: [
      { accountId: 'cash', amount: proceeds },
      { accountId: 'accumulated', amount: accumulated },
      ...(gain < 0 ? [{ accountId: 'loss', amount: -gain }] : []),
    ],
    credits: [
      { accountId: 'equipment', amount: cost },
      ...(gain > 0 ? [{ accountId: 'gain', amount: gain }] : []),
    ],
  }
}

export const fixedAssetSale: ProblemTemplate = {
  id: 'journal.fixed-asset-sale',
  topic: 'journal',
  title: '固定資産の売却',
  difficulty: 2,
  source: { kind: 'original', publishable: true },
  params: {
    life: { kind: 'choice', values: [5, 6, 8] },
    costUnit: { kind: 'int', min: 10, max: 60 },
    elapsed: { kind: 'int', min: 1, max: 4 },
    // 売却額は帳簿価額の何 %か。100% だと売却損益が出ない
    proceedsPercent: { kind: 'int', min: 40, max: 160, step: 10 },
  },
  // 中古の備品が取得原価以上で売れるのは不自然なので、売却額は取得原価より安くする
  constraint: (p) =>
    p.elapsed! < p.life! && p.proceedsPercent !== 100 && saleOf(p).proceeds < saleOf(p).cost,
  body: (p) => {
    const { cost, accumulated, proceeds } = saleOf(p)
    return [
      text(
        `期首に、備品（取得原価 ${yenText(cost)}、減価償却累計額 ${yenText(accumulated)}）を ${yenText(proceeds)}で売却し、代金は現金で受け取った。減価償却は間接法で記帳している。この取引の仕訳を答えよ（期首の売却なので、当期の減価償却費は計上しない）。`,
      ),
    ]
  },
  steps: [
    {
      kind: 'journal',
      id: 'entry',
      prompt: '仕訳',
      points: 2,
      accounts: SALE_ACCOUNTS,
      answer: saleEntry,
      commonMistakes: [
        {
          // 累計額を消さず、帳簿価額だけ備品を減らした
          answer: (p) => {
            const { book, proceeds, gain } = saleOf(p)
            return {
              debits: [
                { accountId: 'cash', amount: proceeds },
                ...(gain < 0 ? [{ accountId: 'loss', amount: -gain }] : []),
              ],
              credits: [
                { accountId: 'equipment', amount: book },
                ...(gain > 0 ? [{ accountId: 'gain', amount: gain }] : []),
              ],
            }
          },
          hint: '間接法では、備品は取得原価で消し、減価償却累計額も借方で消す。',
        },
        {
          // 売却益と売却損を取り違えた
          answer: (p) => {
            const entry = saleEntry(p)
            const swap = (id: string) => (id === 'gain' ? 'loss' : id === 'loss' ? 'gain' : id)
            return {
              debits: entry.debits.map((l) => ({ ...l, accountId: swap(l.accountId) })),
              credits: entry.credits.map((l) => ({ ...l, accountId: swap(l.accountId) })),
            }
          },
          hint: '帳簿価額より高く売れたら売却益（貸方）、安ければ売却損（借方）。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const { cost, accumulated, book, proceeds, gain } = saleOf(p)
    return [
      text(
        `帳簿価額 = 取得原価 ${yen(cost)} − 減価償却累計額 ${yen(accumulated)} = ${yen(book)} 円`,
      ),
      text(
        `売却額 ${yen(proceeds)} − 帳簿価額 ${yen(book)} = ${yen(gain)} 円 → ${gain > 0 ? '固定資産売却益' : '固定資産売却損'}`,
      ),
      text(
        `（借方）現金 ${yen(proceeds)}、減価償却累計額 ${yen(accumulated)}${gain < 0 ? `、固定資産売却損 ${yen(-gain)}` : ''} ／（貸方）備品 ${yen(cost)}${gain > 0 ? `、固定資産売却益 ${yen(gain)}` : ''}`,
      ),
    ]
  },
}

// ---------------------------------------------------------------------------
// 前払費用（決算整理）

const MONTH_NAMES: Record<number, string> = {
  5: '5 月',
  6: '6 月',
  7: '7 月',
  8: '8 月',
  9: '9 月',
  11: '11 月',
  12: '12 月',
  1: '1 月',
  2: '2 月',
}

/** 当期（4 月〜3 月）のうち、支払月から 3 月末までに使った月数 */
function usedMonths(startMonth: number): number {
  return ((3 - startMonth + 12) % 12) + 1
}

function prepaidOf(p: Params) {
  const premium = p.premiumUnit! * 12_000
  const used = usedMonths(p.startMonth!)
  return { premium, used, prepaid: (premium * (12 - used)) / 12 }
}

export const prepaidExpense: ProblemTemplate = {
  id: 'journal.prepaid-expense',
  topic: 'journal',
  title: '前払費用の決算整理',
  difficulty: 2,
  source: { kind: 'original', publishable: true },
  params: {
    premiumUnit: { kind: 'int', min: 5, max: 50 },
    // 4 月始まりは当期に 12 か月分を使い切って前払がない。10 月始まりは使った月数と前払の月数が
    // どちらも 6 か月になり、誤答と区別できない。どちらも除く
    startMonth: { kind: 'choice', values: [5, 6, 7, 8, 9, 11, 12, 1, 2] },
  },
  body: (p) => {
    const { premium } = prepaidOf(p)
    return [
      text(
        `当期の ${MONTH_NAMES[p.startMonth!]} 1 日に、1 年分の保険料 ${yenText(premium)}を現金で支払い、全額を保険料（費用）として処理した。決算日（3 月 31 日）に、次期分の保険料を繰り延べる仕訳を答えよ（月割り計算）。`,
      ),
    ]
  },
  steps: [
    {
      kind: 'journal',
      id: 'entry',
      prompt: '決算整理仕訳',
      points: 2,
      accounts: [
        { id: 'prepaid', name: '前払保険料' },
        { id: 'insurance', name: '保険料' },
        { id: 'accrued', name: '未払保険料' },
        { id: 'cash', name: '現金' },
      ],
      answer: (p) => ({
        debits: [{ accountId: 'prepaid', amount: prepaidOf(p).prepaid }],
        credits: [{ accountId: 'insurance', amount: prepaidOf(p).prepaid }],
      }),
      commonMistakes: [
        {
          answer: (p) => {
            const { premium, used } = prepaidOf(p)
            const amount = (premium * used) / 12
            return {
              debits: [{ accountId: 'prepaid', amount }],
              credits: [{ accountId: 'insurance', amount }],
            }
          },
          hint: '当期に使った月数ではなく、次期の分（まだ使っていない月数）を繰り延べる。',
        },
        {
          answer: (p) => ({
            debits: [{ accountId: 'insurance', amount: prepaidOf(p).prepaid }],
            credits: [{ accountId: 'prepaid', amount: prepaidOf(p).prepaid }],
          }),
          hint: '貸借が逆。費用（保険料）を減らし、資産（前払保険料）を増やす。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const { premium, used, prepaid } = prepaidOf(p)
    return [
      text(
        `${MONTH_NAMES[p.startMonth!]} 1 日から 3 月 31 日までの ${used} か月分が当期の費用。残り ${12 - used} か月分は次期の費用なので、資産（前払保険料）に振り替える。`,
      ),
      text(`前払分 = ${yen(premium)} × ${12 - used} / 12 = ${yen(prepaid)} 円`),
      text(`（借方）前払保険料 ${yen(prepaid)} ／（貸方）保険料 ${yen(prepaid)}`),
    ]
  },
}

// ---------------------------------------------------------------------------
// 貸倒れ（前期の売掛金）

function writeOffOf(p: Params) {
  const amount = p.amountUnit! * 10_000
  const allowance = p.allowanceUnit! * 10_000
  return {
    amount,
    allowance,
    covered: Math.min(amount, allowance),
    loss: Math.max(0, amount - allowance),
  }
}

function writeOffEntry(p: Params): JournalAnswer {
  const { amount, covered, loss } = writeOffOf(p)
  return {
    debits: [
      { accountId: 'allowance', amount: covered },
      ...(loss > 0 ? [{ accountId: 'badDebt', amount: loss }] : []),
    ],
    credits: [{ accountId: 'receivable', amount }],
  }
}

export const badDebtWriteOff: ProblemTemplate = {
  id: 'journal.bad-debt-write-off',
  topic: 'journal',
  title: '売掛金の貸倒れ',
  difficulty: 2,
  source: { kind: 'original', publishable: true },
  params: {
    amountUnit: { kind: 'int', min: 5, max: 60 },
    allowanceUnit: { kind: 'int', min: 5, max: 60 },
  },
  // 同じ額だと、足りる場合と足りない場合の区別がなくなる
  constraint: (p) => p.amountUnit !== p.allowanceUnit,
  body: (p) => {
    const { amount, allowance } = writeOffOf(p)
    return [
      text(
        `得意先が倒産し、前期に発生した売掛金 ${yenText(amount)}が回収できなくなった（貸倒れ）。貸倒引当金の残高は ${yenText(allowance)}である。この取引の仕訳を答えよ。`,
      ),
    ]
  },
  steps: [
    {
      kind: 'journal',
      id: 'entry',
      prompt: '仕訳',
      points: 2,
      accounts: [
        { id: 'allowance', name: '貸倒引当金' },
        { id: 'badDebt', name: '貸倒損失' },
        { id: 'provision', name: '貸倒引当金繰入' },
        { id: 'receivable', name: '売掛金' },
      ],
      answer: writeOffEntry,
      commonMistakes: [
        {
          answer: (p) => ({
            debits: [{ accountId: 'badDebt', amount: writeOffOf(p).amount }],
            credits: [{ accountId: 'receivable', amount: writeOffOf(p).amount }],
          }),
          hint: '前期の売掛金の貸倒れは、まず貸倒引当金を取り崩す。足りない分だけが貸倒損失。',
        },
        {
          // 引当金で足りる場合は、これが正解なので誤答にしない
          answer: (p) =>
            writeOffOf(p).loss > 0
              ? {
                  debits: [{ accountId: 'allowance', amount: writeOffOf(p).amount }],
                  credits: [{ accountId: 'receivable', amount: writeOffOf(p).amount }],
                }
              : null,
          hint: '取り崩せるのは引当金の残高まで。超えた分は貸倒損失にする。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const { amount, allowance, covered, loss } = writeOffOf(p)
    return [
      text(
        loss > 0
          ? `貸倒れ ${yen(amount)} 円のうち、引当金の残高 ${yen(allowance)} 円までは貸倒引当金を取り崩し、足りない ${yen(loss)} 円は貸倒損失（費用）にする。`
          : `貸倒れ ${yen(amount)} 円は、引当金の残高 ${yen(allowance)} 円の範囲内なので、全額を貸倒引当金の取り崩しでまかなう。`,
      ),
      text(
        `（借方）貸倒引当金 ${yen(covered)}${loss > 0 ? `、貸倒損失 ${yen(loss)}` : ''} ／（貸方）売掛金 ${yen(amount)}`,
      ),
    ]
  },
}
