import type { RoundingRule } from '@/domain/rounding'

export type Topic = 'journal' | 'analysis' | 'cf' | 'cvp' | 'npv'

/** 問題の数値パラメータ。すべて数値で持つ（税率 30% なら 0.3、など） */
export type Params = Readonly<Record<string, number>>

export type ParamSpec = Readonly<
  Record<
    string,
    | { kind: 'int'; min: number; max: number; step?: number }
    | { kind: 'choice'; values: readonly number[] }
  >
>

/** 問題文・解説の部品 */
export type Block =
  | { type: 'text'; text: string }
  | {
      type: 'table'
      caption?: string
      headers: readonly string[]
      rows: readonly (readonly string[])[]
    }
  | {
      /** 複数の系列を重ねたレーダーチャート。values は軸ごとに 0〜1 に正規化した値 */
      type: 'radar'
      caption?: string
      axes: readonly string[]
      series: readonly { label: string; values: readonly number[] }[]
    }

export type Unit = '千円' | '円' | '%' | '回' | '倍' | '年'

type StepBase = {
  id: string
  prompt: string
  /** 配点。省略すると 1 */
  points?: number
}

export type NumericStep = StepBase & {
  kind: 'numeric'
  unit?: Unit
  /** 端数処理。正解とユーザーの答えの両方に当ててから比べる */
  rounding?: RoundingRule
  answer: (p: Params) => number
  /** よくある誤答。ユーザーの答えが一致したら hint を出す */
  commonMistakes?: readonly { answer: (p: Params) => number; hint: string }[]
}

export type ChoiceOption = { key: string; label: string }

export type ChoiceStep = StepBase & {
  kind: 'choice'
  options: (p: Params) => readonly ChoiceOption[]
  answer: (p: Params) => string
  /** 誤答の選択肢ごとのヒント */
  hints?: Readonly<Record<string, string>>
}

export type JournalLine = { accountId: string; amount: number }
export type JournalAnswer = { debits: readonly JournalLine[]; credits: readonly JournalLine[] }

export type JournalStep = StepBase & {
  kind: 'journal'
  /** 選べる勘定科目 */
  accounts: readonly { id: string; name: string }[]
  answer: (p: Params) => JournalAnswer
  /** よくある誤答。ユーザーの仕訳が一致したら hint を出す */
  commonMistakes?: readonly { answer: (p: Params) => JournalAnswer; hint: string }[]
}

export type StepTemplate = NumericStep | ChoiceStep | JournalStep

export type ProblemSource = {
  kind: 'original' | 'past-exam' | 'ai-generated'
  note?: string
  /** 公開版に含めてよいか（過去問をもとにしたものは false） */
  publishable: boolean
}

export type ProblemTemplate = {
  /** 例: "cvp.break-even.basic" */
  id: string
  topic: Topic
  title: string
  difficulty: 1 | 2 | 3
  source: ProblemSource
  params: ParamSpec
  /** パラメータの組み合わせが問題として自然か。false なら引き直す */
  constraint?: (p: Params) => boolean
  body: (p: Params) => readonly Block[]
  steps: readonly StepTemplate[]
  explanation: (p: Params) => readonly Block[]
}
