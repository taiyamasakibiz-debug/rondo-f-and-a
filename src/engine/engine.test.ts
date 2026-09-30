import { describe, expect, it } from 'vitest'
import { generateProblem } from './generate'
import { gradeProblem, gradeStep } from './grade'
import { formatNumber, isNegative, parseNumber, toggleSign } from './numbers'
import { createRandom } from './random'
import type { ChoiceStep, JournalStep, NumericStep, ProblemTemplate } from './types'

describe('parseNumber', () => {
  it.each([
    ['1234', 1234],
    ['1,234', 1234],
    ['１２３４', 1234],
    [' 12.5 ', 12.5],
    ['21.7%', 21.7],
    ['7,500千円', 7500],
    ['3.2回', 3.2],
    ['-500', -500],
    ['△500', -500],
    ['▲1,000', -1000],
    ['－５００', -500],
    ['.5', 0.5],
    ['-0', 0],
  ] as const)('"%s" → %s', (input, expected) => {
    expect(parseNumber(input)).toBe(expected)
  })

  it.each(['', 'abc', '1.2.3', '12a', '--5', '△'])('"%s" は読めない', (input) => {
    expect(parseNumber(input)).toBeNull()
  })
})

describe('toggleSign', () => {
  it('△ を付けたり外したりする', () => {
    expect(toggleSign('500')).toBe('△500')
    expect(toggleSign('△500')).toBe('500')
    expect(toggleSign('-500')).toBe('500')
    expect(toggleSign('')).toBe('△')
    expect(parseNumber(toggleSign('1,200'))).toBe(-1200)
  })

  it('isNegative はマイナスの記号で始まる入力を見分ける', () => {
    expect(isNegative('▲3')).toBe(true)
    expect(isNegative(' △3')).toBe(true)
    expect(isNegative('3')).toBe(false)
  })
})

describe('formatNumber', () => {
  it('桁区切りを付け、マイナスは △ で表す', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber(-500)).toBe('△500')
    expect(formatNumber(21.7, 1)).toBe('21.7')
    expect(formatNumber(20, 1)).toBe('20.0')
    expect(formatNumber(123000, -3)).toBe('123,000')
  })
})

describe('createRandom', () => {
  it('同じシードからは同じ数列になる', () => {
    const a = createRandom(42)
    const b = createRandom(42)
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
  })

  it('int は範囲内で step 刻み', () => {
    const random = createRandom(1)
    for (let i = 0; i < 500; i += 1) {
      const value = random.int(10, 50, 5)
      expect(value).toBeGreaterThanOrEqual(10)
      expect(value).toBeLessThanOrEqual(50)
      expect(value % 5).toBe(0)
    }
  })
})

const numericStep: NumericStep = {
  kind: 'numeric',
  id: 'ratio',
  prompt: '比率',
  unit: '%',
  rounding: { mode: 'halfUp', digits: 1 },
  answer: (p) => (p.a! / p.b!) * 100,
  commonMistakes: [{ answer: (p) => (p.b! / p.a!) * 100, hint: '分子と分母が逆' }],
}

const choiceStep: ChoiceStep = {
  kind: 'choice',
  id: 'pick',
  prompt: '選べ',
  options: () => [
    { key: 'A', label: '流動比率' },
    { key: 'B', label: '自己資本比率' },
  ],
  answer: () => 'B',
  hints: { A: '短期の安全性ではなく長期の安全性' },
}

const journalStep: JournalStep = {
  kind: 'journal',
  id: 'entry',
  prompt: '仕訳せよ',
  accounts: [
    { id: 'cash', name: '現金' },
    { id: 'ar', name: '売掛金' },
    { id: 'sales', name: '売上' },
  ],
  answer: () => ({
    debits: [
      { accountId: 'cash', amount: 300 },
      { accountId: 'ar', amount: 700 },
    ],
    credits: [{ accountId: 'sales', amount: 1000 }],
  }),
}

describe('gradeStep（数値）', () => {
  const params = { a: 1, b: 3 } // 33.333…% → 33.3%

  it('端数処理を当てて正解と比べる', () => {
    expect(gradeStep(numericStep, params, { kind: 'numeric', raw: '33.3' }).correct).toBe(true)
    expect(gradeStep(numericStep, params, { kind: 'numeric', raw: '33.3%' }).correct).toBe(true)
    // 指定より細かく答えても、同じ丸めを当てて一致すれば正解
    expect(gradeStep(numericStep, params, { kind: 'numeric', raw: '33.33' }).correct).toBe(true)
    expect(gradeStep(numericStep, params, { kind: 'numeric', raw: '33.4' }).correct).toBe(false)
  })

  it('よくある誤答ならヒントを返す', () => {
    const result = gradeStep(numericStep, params, { kind: 'numeric', raw: '300' })
    expect(result.correct).toBe(false)
    expect(result.hint).toBe('分子と分母が逆')
  })

  it('読めない入力は invalidInput', () => {
    const result = gradeStep(numericStep, params, { kind: 'numeric', raw: 'わからない' })
    expect(result).toMatchObject({ correct: false, invalidInput: true, earned: 0 })
  })

  it('正解の表示に単位と桁を付ける', () => {
    expect(gradeStep(numericStep, params, { kind: 'numeric', raw: '' }).expected).toBe('33.3%')
  })
})

describe('gradeStep（選択肢）', () => {
  it('正解の選択肢なら正解、誤答にはヒント', () => {
    expect(gradeStep(choiceStep, {}, { kind: 'choice', key: 'B' }).correct).toBe(true)
    const wrong = gradeStep(choiceStep, {}, { kind: 'choice', key: 'A' })
    expect(wrong).toMatchObject({ correct: false, hint: '短期の安全性ではなく長期の安全性' })
    expect(wrong.expected).toBe('B. 自己資本比率')
  })

  it('未選択は invalidInput', () => {
    expect(gradeStep(choiceStep, {}, { kind: 'choice', key: null }).invalidInput).toBe(true)
  })
})

describe('gradeStep（仕訳）', () => {
  it('行の順番や分け方が違っても、科目ごとの合計が合えば正解', () => {
    const answer = {
      debits: [
        { accountId: 'ar', amount: 700 },
        { accountId: 'cash', amount: 100 },
        { accountId: 'cash', amount: 200 },
      ],
      credits: [{ accountId: 'sales', amount: 1000 }],
    }
    expect(gradeStep(journalStep, {}, { kind: 'journal', answer }).correct).toBe(true)
  })

  it('金額や科目、貸借が違えば不正解', () => {
    const wrongAmount = {
      debits: [{ accountId: 'cash', amount: 1000 }],
      credits: [{ accountId: 'sales', amount: 1000 }],
    }
    const swapped = {
      debits: [{ accountId: 'sales', amount: 1000 }],
      credits: [
        { accountId: 'cash', amount: 300 },
        { accountId: 'ar', amount: 700 },
      ],
    }
    expect(gradeStep(journalStep, {}, { kind: 'journal', answer: wrongAmount }).correct).toBe(false)
    expect(gradeStep(journalStep, {}, { kind: 'journal', answer: swapped }).correct).toBe(false)
  })

  it('正解の表示に科目名を使う', () => {
    const result = gradeStep(
      journalStep,
      {},
      {
        kind: 'journal',
        answer: { debits: [], credits: [] },
      },
    )
    expect(result.invalidInput).toBe(true)
    expect(result.expected).toBe('（借方）現金 300、売掛金 700 ／（貸方）売上 1,000')
  })

  it('答えの種類がステップと違えばエラー', () => {
    expect(() => gradeStep(journalStep, {}, { kind: 'numeric', raw: '1' })).toThrow()
  })
})

const template: ProblemTemplate = {
  id: 'test.template',
  topic: 'cvp',
  title: 'テスト',
  difficulty: 1,
  source: { kind: 'original', publishable: true },
  params: { a: { kind: 'int', min: 1, max: 9 }, b: { kind: 'choice', values: [3, 7] } },
  constraint: (p) => p.a! < p.b!,
  body: () => [],
  steps: [numericStep, { ...choiceStep, points: 2 }],
  explanation: () => [],
}

describe('generateProblem', () => {
  it('同じシードなら同じパラメータになり、制約を満たす', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const problem = generateProblem(template, seed)
      expect(problem.params).toEqual(generateProblem(template, seed).params)
      expect(problem.params.a!).toBeLessThan(problem.params.b!)
    }
  })

  it('制約を満たせないテンプレートはエラーにする', () => {
    expect(() => generateProblem({ ...template, constraint: () => false }, 1)).toThrow()
  })
})

describe('gradeProblem', () => {
  it('ステップの配点で部分点を出す', () => {
    const problem = { template, seed: 0, params: { a: 1, b: 3 } }
    const result = gradeProblem(problem, {
      ratio: { kind: 'numeric', raw: '0' },
      pick: { kind: 'choice', key: 'B' },
    })
    expect(result).toMatchObject({ earned: 2, total: 3, allCorrect: false })
    expect(result.score).toBeCloseTo(2 / 3)
  })

  it('答えていないステップは不正解として数える', () => {
    const problem = { template, seed: 0, params: { a: 1, b: 3 } }
    const result = gradeProblem(problem, { pick: { kind: 'choice', key: 'B' } })
    expect(result.steps[0]).toMatchObject({ correct: false, invalidInput: true })
  })
})
