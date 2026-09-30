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
} from './types'

/** ユーザーの答え */
export type StepInput =
  | { kind: 'numeric'; raw: string }
  | { kind: 'choice'; key: string | null }
  | { kind: 'journal'; answer: JournalAnswer }

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
  const mistake = step.commonMistakes?.find((m) => sameJournal(answer, m.answer(params)))
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
  }
}

function mismatch(step: StepTemplate, input: StepInput): Error {
  return new Error(`ステップ「${step.id}」（${step.kind}）に ${input.kind} の答えが渡されました`)
}
