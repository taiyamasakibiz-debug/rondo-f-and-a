import { describe, expect, it } from 'vitest'
import type { ProblemTemplate, Topic } from '@/engine/types'
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
