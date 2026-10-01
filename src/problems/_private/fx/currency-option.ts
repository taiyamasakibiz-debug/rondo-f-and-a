import type { Params, ProblemTemplate } from '@/engine/types'
import { text, yen } from '../../helpers'

/**
 * 為替・デリバティブ 型 2：通貨オプション（ドルのコール／プット）の行使の判断と、プレミアムを含めた金額。
 * 下書きは NotebookLM（docs/prompts/notebooklm-new-units-brief.md）。過去問の構造を参考にしたので公開しない。
 *
 * - ドルのコール（輸入）：直物が行使価格より円安（高い）なら行使する
 * - ドルのプット（輸出）：直物が行使価格より円高（安い）なら行使する
 * - プレミアムは払ったら戻らない。行使の判断には関係ないが、最終的な金額には必ず含める
 * 直物と行使価格の差（−10〜+10 円、0 を除く）の正負で、行使・放棄が半々になる。
 */
function model(p: Params) {
  const isCall = p.optionType === 1
  const spot = p.strike! + p.spotDiff!
  const premium = p.amount! * p.premiumRate!
  const exercise = isCall ? spot > p.strike! : spot < p.strike!
  const rate = exercise ? p.strike! : spot
  const otherRate = exercise ? spot : p.strike!
  const base = p.amount! * rate
  // 輸入は支払額にプレミアムを足し、輸出は受取額からプレミアムを引く
  const net = isCall ? base + premium : base - premium
  return { isCall, spot, premium, exercise, base, net, wrongActionBase: p.amount! * otherRate }
}

export const currencyOption: ProblemTemplate = {
  id: 'fx.currency-option',
  topic: 'npv',
  title: '通貨オプションの行使とプレミアム',
  difficulty: 2,
  source: {
    kind: 'past-exam',
    note: '1 次試験 財務・会計（令和 5 年度 第 18 問、令和 6 年度 第 18 問など）の通貨オプションの構造を参考。文章は独自',
    publishable: false,
  },
  params: {
    // 1 = ドルのコール（輸入で、ドルを買う権利）、2 = ドルのプット（輸出で、ドルを売る権利）
    optionType: { kind: 'choice', values: [1, 2] },
    amount: { kind: 'int', min: 100, max: 500, step: 50 },
    strike: { kind: 'int', min: 140, max: 150 },
    premiumRate: { kind: 'int', min: 2, max: 5 },
    spotDiff: { kind: 'int', min: -10, max: 10 },
  },
  constraint: (p) => p.spotDiff !== 0,
  body: (p) => {
    const m = model(p)
    return [
      text(
        `L 社は、将来の${m.isCall ? '輸入代金の支払い（ドルを買う）' : '輸出代金の受け取り（ドルを売る）'}の為替リスクをヘッジするため、通貨オプションを購入した。`,
      ),
      {
        type: 'table',
        caption: '通貨オプションの契約',
        headers: ['項目', '内容'],
        rows: [
          [
            '種類',
            m.isCall
              ? 'ドルのコール・オプション（ドルを買う権利）'
              : 'ドルのプット・オプション（ドルを売る権利）',
          ],
          ['対象金額', `${yen(p.amount!)} 千ドル`],
          ['権利行使価格', `1 ドル = ${p.strike} 円`],
          ['プレミアム（オプション料）', `1 ドルあたり ${p.premiumRate} 円（購入時に支払い済み）`],
        ],
      },
      text(
        `決済日の直物レートは 1 ドル = ${m.spot} 円であった。L 社は、権利を行使するか放棄するかを決める。権利を放棄した場合は、直物レートで${m.isCall ? 'ドルを買う' : 'ドルを売る'}。`,
      ),
    ]
  },
  steps: [
    {
      kind: 'numeric',
      id: 'premium',
      prompt: '設問 1：L 社が支払ったプレミアムの総額を求めよ（千円）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 2,
      answer: (p) => model(p).premium,
    },
    {
      kind: 'choice',
      id: 'action',
      prompt: '設問 2：決済日に L 社がとるべき行動はどれか。',
      points: 2,
      options: () => [
        { key: 'A', label: '権利を行使する' },
        { key: 'B', label: '権利を放棄する' },
      ],
      answer: (p) => (model(p).exercise ? 'A' : 'B'),
      hints: {
        A: '直物レートの方が有利なので、権利を放棄して直物で取引する。コール（ドルを買う）は円高なら、プット（ドルを売る）は円安なら、直物の方が得。プレミアムは払ったら戻らないので、行使の判断には関係しない。',
        B: '権利行使価格の方が有利なので、権利を行使する。コール（ドルを買う）は円安なら、プット（ドルを売る）は円高なら、行使した方が得。プレミアムは払ったら戻らないので、行使の判断には関係しない。',
      },
    },
    {
      kind: 'numeric',
      id: 'net',
      prompt:
        '設問 3：設問 2 の行動をとったときの、プレミアムを含めた円での実質的な金額（輸入なら支払額、輸出なら受取額）を求めよ（千円）。',
      unit: '千円',
      rounding: { mode: 'halfUp', digits: 0 },
      points: 3,
      answer: (p) => model(p).net,
      commonMistakes: [
        {
          answer: (p) => model(p).base,
          hint: 'プレミアムを入れ忘れていない？ プレミアムは権利を放棄しても戻らないので、必ず含める。',
        },
        {
          answer: (p) => {
            const m = model(p)
            return m.isCall ? m.base - m.premium : m.base + m.premium
          },
          hint: 'プレミアムの向きが逆になっていない？ 輸入（支払い）は支払額に足し、輸出（受け取り）は受取額から引く。',
        },
        {
          answer: (p) => {
            const m = model(p)
            return m.isCall ? m.wrongActionBase + m.premium : m.wrongActionBase - m.premium
          },
          hint: '行使・放棄を逆にしていない？ コールは円安で、プットは円高で行使する。',
        },
      ],
    },
  ],
  explanation: (p) => {
    const m = model(p)
    return [
      text(
        `プレミアムの総額 = ${yen(p.amount!)} 千ドル × ${p.premiumRate} 円 = ${yen(m.premium)} 千円（払ったら戻らない）`,
      ),
      text(
        `直物 ${m.spot} 円と権利行使価格 ${p.strike} 円を比べる。${m.isCall ? 'ドルを買う（コール）ので、安い方が得' : 'ドルを売る（プット）ので、高い方が得'}。→ 権利を${m.exercise ? '行使する' : '放棄する'}。`,
      ),
      text(
        `${m.isCall ? '支払額' : '受取額'} = ${yen(p.amount!)} 千ドル × ${m.exercise ? p.strike : m.spot} 円 ${m.isCall ? '+' : '−'} プレミアム ${yen(m.premium)} = ${yen(m.net)} 千円`,
      ),
    ]
  },
}
