import { describe, expect, it } from 'vitest'
import type { ProblemTemplate, Topic } from '@/engine/types'
import { PROBLEM_TEMPLATES } from '@/problems'
import { buildDaily, dailyPracticePath, nextDailyItem } from './daily'
import { type Attempt, DEFAULT_SETTINGS } from './types'

function template(id: string, topic: Topic): ProblemTemplate {
  return {
    id,
    topic,
    title: id,
    difficulty: 1,
    source: { kind: 'original', publishable: true },
    params: {},
    body: () => [],
    steps: [],
    explanation: () => [],
  }
}

const templates = [
  template('cvp.a', 'cvp'),
  template('cvp.b', 'cvp'),
  template('npv.a', 'npv'),
  template('npv.b', 'npv'),
  template('cf.a', 'cf'),
]

let nextId = 0
function attempt(templateId: string, day: string, overrides: Partial<Attempt> = {}): Attempt {
  nextId += 1
  const [y, m, d] = day.split('-').map(Number)
  const answeredAt = new Date(y!, m! - 1, d!, 12).toISOString()
  return {
    id: `a${nextId}`,
    templateId,
    topic: templates.find((t) => t.id === templateId)?.topic ?? 'cvp',
    seed: nextId,
    earned: 5,
    total: 5,
    allCorrect: true,
    steps: [],
    durationMs: 1,
    answeredAt,
    createdAt: answeredAt,
    updatedAt: answeredAt,
    ...overrides,
  }
}

const noon = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d!, 12)
}

describe('buildDaily', () => {
  it('ノルマの数だけ選び、同じ日なら何度計算しても同じ問題になる', () => {
    const a = buildDaily([], DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    const b = buildDaily([], DEFAULT_SETTINGS, templates, new Date(2026, 9, 10, 23))
    expect(a.items).toHaveLength(3)
    expect(a.items).toEqual(b.items)
    expect(new Set(a.items.map((item) => item.templateId)).size).toBe(3)
  })

  it('日が変われば別の組み合わせになりうる（シードは必ず変わる）', () => {
    const a = buildDaily([], DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    const b = buildDaily([], DEFAULT_SETTINGS, templates, noon('2026-10-11'))
    expect(a.items.map((i) => i.seed)).not.toEqual(b.items.map((i) => i.seed))
  })

  it('はじめてのときは、ラボが偏らないように新しい問題を選ぶ', () => {
    const plan = buildDaily([], DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    expect(plan.items.every((item) => item.reason === 'new')).toBe(true)
    expect(new Set(plan.items.map((item) => item.topic)).size).toBe(3)
  })

  it('復習の期日が来た問題を最初に出し、前回間違えた問題は retry とする', () => {
    const history = [
      attempt('npv.a', '2026-10-08', { earned: 1, allCorrect: false }), // 期日 10/9
      attempt('cvp.a', '2026-10-09'), // 期日 10/10
    ]
    const plan = buildDaily(history, DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    expect(plan.items.slice(0, 2).map((item) => [item.templateId, item.reason])).toEqual([
      ['npv.a', 'retry'],
      ['cvp.a', 'review'],
    ])
    expect(plan.items[2]!.reason).toBe('new')
  })

  it('新しい問題は、XP が少ないラボから選ぶ', () => {
    // cvp と npv は 2 回ずつ全問正解（10/6 の 2 回目で間隔 3 日 → 期日 10/9）。cf は未経験
    const history = [
      attempt('cvp.a', '2026-10-05'),
      attempt('cvp.a', '2026-10-06'),
      attempt('npv.a', '2026-10-05'),
      attempt('npv.a', '2026-10-06'),
    ]
    const settings = { ...DEFAULT_SETTINGS, dailyGoal: 1 }
    const plan = buildDaily(history, settings, templates, noon('2026-10-08'))
    expect(plan.items[0]).toMatchObject({ topic: 'cf', reason: 'new' })

    // 期日の 10/9 になると復習が優先される
    const dueDay = buildDaily(history, settings, templates, noon('2026-10-09'))
    expect(dueDay.items[0]!.reason).toBe('review')
  })

  it('今日解いた問題は「済み」になり、解いてもリストは変わらない', () => {
    const before = buildDaily([], DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    const first = before.items[0]!
    const solved = attempt(first.templateId, '2026-10-10', {
      seed: first.seed,
      earned: 0,
      allCorrect: false,
    })

    const after = buildDaily([solved], DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    expect(after.items.map((i) => [i.templateId, i.seed])).toEqual(
      before.items.map((i) => [i.templateId, i.seed]),
    )
    expect(after.items[0]!.attempt).toEqual(solved)
    expect(after.doneCount).toBe(1)
    expect(after.complete).toBe(false)
    expect(nextDailyItem(after)).toEqual(after.items[1])
  })

  it('すべて解くと complete になる', () => {
    const plan = buildDaily([], DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    const solved = plan.items.map((item) =>
      attempt(item.templateId, '2026-10-10', { seed: item.seed }),
    )
    const done = buildDaily(solved, DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    expect(done).toMatchObject({ doneCount: 3, complete: true })
    expect(nextDailyItem(done)).toBeUndefined()
  })

  it('問題数よりノルマが多ければ、ある問題だけを出す', () => {
    const plan = buildDaily(
      [],
      { ...DEFAULT_SETTINGS, dailyGoal: 10 },
      templates,
      noon('2026-10-10'),
    )
    expect(plan.items).toHaveLength(templates.length)
  })

  it('もう存在しない問題の記録は無視する', () => {
    const history = [attempt('removed.template', '2026-10-01')]
    const plan = buildDaily(history, DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    expect(plan.items.map((item) => item.templateId)).not.toContain('removed.template')
  })

  it('デイリーの問題を開く URL', () => {
    expect(dailyPracticePath({ templateId: 'cvp.a', topic: 'cvp', seed: 12, reason: 'new' })).toBe(
      '/labs/cvp/practice?template=cvp.a&seed=12&from=daily',
    )
  })
})

describe('マスター期間のデイリー', () => {
  it('復習が溜まっていても、新しい問題を 1 問は残す', () => {
    const history = ['cvp.a', 'cvp.b', 'npv.a'].map((id) =>
      attempt(id, '2026-10-01', { earned: 1, allCorrect: false }),
    )
    const plan = buildDaily(history, DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    expect(plan.phase).toBe('mastery')
    expect(plan.items.map((item) => item.reason)).toEqual(['retry', 'retry', 'new'])
  })

  it('新しい問題は、次の単元（前提が済んだいちばん手前の単元）から出す', () => {
    const plan = buildDaily([], DEFAULT_SETTINGS, PROBLEM_TEMPLATES, noon('2026-10-10'))
    // いちばん手前は財務諸表・仕訳基礎（仕訳ラボの問題）
    expect(plan.items.map((item) => [item.topic, item.reason])).toEqual([
      ['journal', 'new'],
      ['journal', 'new'],
      ['journal', 'new'],
    ])
  })
})

describe('維持期間のデイリー', () => {
  const day = '2027-05-10'

  it('新しい問題は出さず、解いたことのある問題を、古い順に出す', () => {
    const history = [
      attempt('cvp.a', '2027-04-01'),
      attempt('npv.a', '2027-04-02'),
      attempt('cf.a', '2027-04-03'),
    ]
    const plan = buildDaily(history, DEFAULT_SETTINGS, templates, noon(day))
    expect(plan.phase).toBe('maintenance')
    expect(plan.items.some((item) => item.reason === 'new')).toBe(false)
    expect(plan.items.map((item) => item.templateId).sort()).toEqual(['cf.a', 'cvp.a', 'npv.a'])
  })

  it('まだ何も解いていなければ、新しい問題を出す', () => {
    const plan = buildDaily([], DEFAULT_SETTINGS, templates, noon(day))
    expect(plan.items.every((item) => item.reason === 'new')).toBe(true)
  })

  it('解いたことのある問題が足りなくても、新しい問題より先に、解いたことのある問題を出す', () => {
    const history = [attempt('cvp.a', '2027-04-01')]
    const plan = buildDaily(history, DEFAULT_SETTINGS, templates, noon(day))
    expect(plan.items[0]).toMatchObject({ templateId: 'cvp.a' })
  })
})

describe('直前期のデイリー', () => {
  const day = '2027-08-10'
  const hard = { ...template('cvp.hard', 'cvp'), difficulty: 3 as const }
  const pool = [...templates, hard, { ...template('npv.hard', 'npv'), difficulty: 3 as const }]

  it('本番形式（難易度 3 など）を 7 割、弱点を 3 割で出す', () => {
    const history = [
      attempt('cvp.a', '2027-08-01', { earned: 1, allCorrect: false }),
      attempt('cvp.hard', '2027-08-01'),
    ]
    const plan = buildDaily(history, DEFAULT_SETTINGS, pool, noon(day))
    expect(plan.phase).toBe('final')
    expect(plan.items.map((item) => [item.templateId, item.reason])).toEqual([
      ['cvp.a', 'retry'],
      ['npv.hard', 'exam'],
      ['cvp.hard', 'exam'],
    ])
  })

  it('本番形式の問題は、まだ解いていないものを先に、解いたものは得点率が低い順に出す', () => {
    const history = [
      attempt('cvp.hard', '2027-08-01', { earned: 5, allCorrect: true }),
      attempt('npv.hard', '2027-08-01', { earned: 2, allCorrect: false }),
    ]
    const plan = buildDaily(history, { ...DEFAULT_SETTINGS, dailyGoal: 2 }, pool, noon(day))
    const exams = plan.items.filter((item) => item.reason === 'exam' || item.reason === 'retry')
    expect(exams[0]!.templateId).toBe('npv.hard')
  })

  it('本番形式の問題がなければ、弱点と、しばらく解いていない問題で埋める', () => {
    const plan = buildDaily([], DEFAULT_SETTINGS, templates, noon(day))
    expect(plan.items).toHaveLength(3)
    expect(plan.items.some((item) => item.reason === 'exam')).toBe(false)
  })
})
