import { describe, expect, it } from 'vitest'
import { findTemplate } from '@/problems'
import { generateProblem } from './generate'
import { examScore, gradeProblem, withSelfGrades } from './grade'

// 同業他社との比較：選択（2 点）と記述（2 点）
const problem = generateProblem(findTemplate('analysis.compare-peer')!, 1)
const choice = problem.template.steps.find((step) => step.kind === 'choice')!
const written = problem.template.steps.find((step) => step.kind === 'written')!
const correctKey = choice.kind === 'choice' ? choice.answer(problem.params) : ''

/** 選択は正解、記述は何も書かない（目安の採点で 0 点） */
const result = gradeProblem(problem, {
  [choice.id]: { kind: 'choice', key: correctKey },
  [written.id]: { kind: 'written', text: '収益性が低い' },
})

describe('記述の自己採点', () => {
  it('〇 は満点、△ は半分、✕ は 0 点で、キーワードの目安の点を置き換える', () => {
    const good = withSelfGrades(result, { [written.id]: 'good' })
    expect(good).toMatchObject({ earned: 4, total: 4, allCorrect: true })
    const partial = withSelfGrades(result, { [written.id]: 'partial' })
    expect(partial).toMatchObject({ earned: 3, total: 4, allCorrect: false })
    const poor = withSelfGrades(result, { [written.id]: 'poor' })
    expect(poor).toMatchObject({ earned: 2, total: 4, allCorrect: false })
  })

  it('自己採点を付けていない小問は、そのまま', () => {
    expect(withSelfGrades(result, {})).toEqual(result)
    const writtenStep = withSelfGrades(result, { [written.id]: 'good' }).steps.find(
      (step) => step.stepId === written.id,
    )!
    expect(writtenStep).toMatchObject({ correct: true, hint: undefined })
  })
})

describe('認定テストの採点（examScore）', () => {
  it('記述の小問は、得点にも満点にも入れない', () => {
    expect(examScore(problem, result)).toEqual({ earned: 2, total: 2, allCorrect: true })
  })

  it('記述のない問題は、そのまま', () => {
    const numeric = generateProblem(findTemplate('cvp.break-even.basic')!, 1)
    const graded = gradeProblem(numeric, {})
    expect(examScore(numeric, graded)).toMatchObject({ earned: 0, total: graded.total })
  })
})
