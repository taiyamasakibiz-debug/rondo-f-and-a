import { applyRounding, nearlyEqual } from '@/domain/rounding'
import type { Problem } from './generate'
import { formatWithUnit, parseNumber } from './numbers'
import type {
  ChoiceStep,
  JournalAnswer,
  JournalStep,
  NumericStep,
  Params,
  StepTemplate,
  WrittenStep,
} from './types'

/** ユーザーの答え */
export type StepInput =
  | { kind: 'numeric'; raw: string }
  | { kind: 'choice'; key: string | null }
  | { kind: 'journal'; answer: JournalAnswer }
  | { kind: 'written'; text: string }

export type StepResult = {
  stepId: string
  correct: boolean
  points: number
  earned: number
  /** 正解の表示用テキスト */
  expected: string
  /** 間違えた原因の推定（よくある誤答に一致したとき） */
  hint?: string
  /** 入力が読み取れなかった（数値でない、未選択など） */
  invalidInput: boolean
}

export type ProblemResult = {
  steps: StepResult[]
  earned: number
  total: number
  /** 0〜1 */
  score: number
  allCorrect: boolean
}

export function gradeStep(step: StepTemplate, params: Params, input: StepInput): StepResult {
  switch (step.kind) {
    case 'numeric':
      if (input.kind !== 'numeric') throw mismatch(step, input)
      return gradeNumeric(step, params, input.raw)
    case 'choice':
      if (input.kind !== 'choice') throw mismatch(step, input)
      return gradeChoice(step, params, input.key)
    case 'journal':
      if (input.kind !== 'journal') throw mismatch(step, input)
      return gradeJournal(step, params, input.answer)
    case 'written':
      if (input.kind !== 'written') throw mismatch(step, input)
      return gradeWritten(step, params, input.text)
  }
}

/** ステップごとの答えから 1 問を採点する。答えがないステップは不正解 */
export function gradeProblem(
  problem: Problem,
  inputs: Readonly<Record<string, StepInput | undefined>>,
): ProblemResult {
  const steps = problem.template.steps.map((step) =>
    gradeStep(step, problem.params, inputs[step.id] ?? emptyInput(step)),
  )
  const earned = steps.reduce((total, step) => total + step.earned, 0)
  const total = steps.reduce((total, step) => total + step.points, 0)
  return {
    steps,
    earned,
    total,
    score: total === 0 ? 0 : earned / total,
    allCorrect: steps.every((step) => step.correct),
  }
}

/** 数値の正解（端数処理を当てたもの） */
export function expectedNumber(step: NumericStep, params: Params): number {
  return round(step, step.answer(params))
}

function gradeNumeric(step: NumericStep, params: Params, raw: string): StepResult {
  const expected = expectedNumber(step, params)
  const base = {
    stepId: step.id,
    points: step.points ?? 1,
    expected: formatWithUnit(expected, step.unit, step.rounding?.digits),
  }
  const parsed = parseNumber(raw)
  if (parsed === null) return { ...base, correct: false, earned: 0, invalidInput: true }

  const answer = round(step, parsed)
  if (nearlyEqual(answer, expected)) {
    return { ...base, correct: true, earned: base.points, invalidInput: false }
  }
  const mistake = step.commonMistakes?.find((m) =>
    nearlyEqual(round(step, m.answer(params)), answer),
  )
  return { ...base, correct: false, earned: 0, invalidInput: false, hint: mistake?.hint }
}

function gradeChoice(step: ChoiceStep, params: Params, key: string | null): StepResult {
  const answerKey = step.answer(params)
  const option = step.options(params).find((o) => o.key === answerKey)
  const base = {
    stepId: step.id,
    points: step.points ?? 1,
    expected: option ? `${option.key}. ${option.label}` : answerKey,
  }
  if (key === null) return { ...base, correct: false, earned: 0, invalidInput: true }
  const correct = key === answerKey
  return {
    ...base,
    correct,
    earned: correct ? base.points : 0,
    invalidInput: false,
    hint: correct ? undefined : step.hints?.[key],
  }
}

/** 仕訳は、借方・貸方それぞれの科目ごとの合計が一致すれば正解（行の順番・分け方は問わない） */
function gradeJournal(step: JournalStep, params: Params, answer: JournalAnswer): StepResult {
  const expected = step.answer(params)
  const names = new Map(step.accounts.map((a) => [a.id, a.name]))
  const base = {
    stepId: step.id,
    points: step.points ?? 1,
    expected: describeJournal(expected, names),
  }
  if (answer.debits.length === 0 && answer.credits.length === 0) {
    return { ...base, correct: false, earned: 0, invalidInput: true }
  }
  if (sameJournal(answer, expected)) {
    return { ...base, correct: true, earned: base.points, invalidInput: false }
  }
  const mistake = step.commonMistakes?.find((m) => {
    const wrong = m.answer(params)
    return wrong !== null && sameJournal(answer, wrong)
  })
  return { ...base, correct: false, earned: 0, invalidInput: false, hint: mistake?.hint }
}

/** 借方・貸方それぞれで、科目ごとの合計が一致するか */
export function sameJournal(a: JournalAnswer, b: JournalAnswer): boolean {
  return (
    sameTotals(totalsByAccount(a.debits), totalsByAccount(b.debits)) &&
    sameTotals(totalsByAccount(a.credits), totalsByAccount(b.credits))
  )
}

function totalsByAccount(lines: JournalAnswer['debits']): Map<string, number> {
  const totals = new Map<string, number>()
  for (const line of lines)
    totals.set(line.accountId, (totals.get(line.accountId) ?? 0) + line.amount)
  return totals
}

function sameTotals(a: Map<string, number>, b: Map<string, number>): boolean {
  const nonZero = (m: Map<string, number>) => [...m].filter(([, amount]) => amount !== 0)
  const left = nonZero(a)
  return left.length === nonZero(b).length && left.every(([id, amount]) => b.get(id) === amount)
}

function describeJournal(answer: JournalAnswer, names: Map<string, string>): string {
  const side = (lines: JournalAnswer['debits']) =>
    lines.map((l) => `${names.get(l.accountId) ?? l.accountId} ${l.amount.toLocaleString('ja-JP')}`)
  return `（借方）${side(answer.debits).join('、')} ／（貸方）${side(answer.credits).join('、')}`
}

function round(step: NumericStep, value: number): number {
  return step.rounding ? applyRounding(value, step.rounding) : value
}

function emptyInput(step: StepTemplate): StepInput {
  switch (step.kind) {
    case 'numeric':
      return { kind: 'numeric', raw: '' }
    case 'choice':
      return { kind: 'choice', key: null }
    case 'journal':
      return { kind: 'journal', answer: { debits: [], credits: [] } }
    case 'written':
      return { kind: 'written', text: '' }
  }
}

/** 記述の字数。空白と改行は数えない（答案用紙のマス目に合わせる） */
export function writtenLength(text: string): number {
  return [...text.replace(/\s/g, '')].length
}

/** キーワードごとの判定（画面で、どのポイントを満たしたかを見せるため） */
export function matchKeywords(
  step: WrittenStep,
  params: Params,
  text: string,
): { label: string; matched: boolean }[] {
  const normalized = text.normalize('NFKC')
  return step.keywords(params).map((keyword) => ({
    label: keyword.label,
    matched: keyword.anyOf.some((word) => normalized.includes(word.normalize('NFKC'))),
  }))
}

/**
 * 記述の目安の採点：満たしたキーワードの割合で部分点。字数を超えたら 0 点。
 * 表記ゆれや言い換えは拾いきれないので、模範解答と見比べて自分でも確かめる前提。
 */
function gradeWritten(step: WrittenStep, params: Params, text: string): StepResult {
  const points = step.points ?? 1
  const base = { stepId: step.id, points, expected: step.modelAnswer(params) }
  if (writtenLength(text) === 0) return { ...base, correct: false, earned: 0, invalidInput: true }
  if (writtenLength(text) > step.maxLength) {
    return {
      ...base,
      correct: false,
      earned: 0,
      invalidInput: false,
      hint: `字数（${step.maxLength}字）を超えています。`,
    }
  }
  const matches = matchKeywords(step, params, text)
  const matched = matches.filter((m) => m.matched).length
  const missing = matches.filter((m) => !m.matched).map((m) => m.label)
  return {
    ...base,
    correct: missing.length === 0,
    earned: matches.length === 0 ? points : (points * matched) / matches.length,
    invalidInput: false,
    hint: missing.length > 0 ? `足りない観点：${missing.join('、')}` : undefined,
  }
}

function mismatch(step: StepTemplate, input: StepInput): Error {
  return new Error(`ステップ「${step.id}」（${step.kind}）に ${input.kind} の答えが渡されました`)
}
