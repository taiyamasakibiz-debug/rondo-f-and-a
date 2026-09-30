/**
 * すべての問題テンプレートの自動チェック（npm run validate:problems）。
 * いろいろなシードで問題を作り、解けない・紛らわしい問題が混ざっていないかを確かめる。
 */
import { describe, expect, it } from 'vitest'
import { applyRounding, nearlyEqual } from '@/domain/rounding'
import { generateProblem } from '@/engine/generate'
import { expectedNumber } from '@/engine/grade'
import type { NumericStep, Params } from '@/engine/types'
import { PROBLEM_TEMPLATES } from './index'

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 1)

function roundMistake(step: NumericStep, value: number) {
  return step.rounding ? applyRounding(value, step.rounding) : value
}

it('テンプレートの id は重複しない', () => {
  const ids = PROBLEM_TEMPLATES.map((template) => template.id)
  expect(new Set(ids).size).toBe(ids.length)
})

describe.each(PROBLEM_TEMPLATES.map((template) => [template.id, template] as const))(
  '%s',
  (_, template) => {
    const problems = SEEDS.map((seed) => generateProblem(template, seed))

    it('ステップの id は重複せず、配点は正の数', () => {
      const ids = template.steps.map((step) => step.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const step of template.steps) expect(step.points ?? 1).toBeGreaterThan(0)
    })

    it('過去問をもとにした問題は公開しない設定になっている', () => {
      if (template.source.kind === 'past-exam') expect(template.source.publishable).toBe(false)
    })

    it('問題文と解説を作れる', () => {
      for (const { params } of problems) {
        expect(template.body(params).length).toBeGreaterThan(0)
        expect(template.explanation(params).length).toBeGreaterThan(0)
      }
    })

    it('数値の正解は有限の値になる', () => {
      for (const { params } of problems) {
        for (const step of template.steps) {
          if (step.kind !== 'numeric') continue
          expect(Number.isFinite(expectedNumber(step, params)), `${step.id} ${show(params)}`).toBe(
            true,
          )
        }
      }
    })

    it('よくある誤答が正解と同じ値にならない（ヒントが正解に出てしまうのを防ぐ）', () => {
      for (const { params } of problems) {
        for (const step of template.steps) {
          if (step.kind !== 'numeric') continue
          const expected = expectedNumber(step, params)
          for (const mistake of step.commonMistakes ?? []) {
            const value = roundMistake(step, mistake.answer(params))
            expect(
              nearlyEqual(value, expected),
              `${step.id}「${mistake.hint}」${show(params)}`,
            ).toBe(false)
          }
        }
      }
    })

    it('選択肢の正解は選択肢の中にあり、キーは重複しない', () => {
      for (const { params } of problems) {
        for (const step of template.steps) {
          if (step.kind !== 'choice') continue
          const keys = step.options(params).map((option) => option.key)
          expect(new Set(keys).size).toBe(keys.length)
          expect(keys).toContain(step.answer(params))
        }
      }
    })

    it('仕訳の正解は貸借が一致し、選べる科目だけを使う', () => {
      for (const { params } of problems) {
        for (const step of template.steps) {
          if (step.kind !== 'journal') continue
          const { debits, credits } = step.answer(params)
          const total = (lines: typeof debits) => lines.reduce((sum, l) => sum + l.amount, 0)
          expect(total(debits)).toBe(total(credits))
          const accountIds = new Set(step.accounts.map((account) => account.id))
          for (const line of [...debits, ...credits]) expect(accountIds).toContain(line.accountId)
        }
      }
    })
  },
)

function show(params: Params) {
  return JSON.stringify(params)
}
