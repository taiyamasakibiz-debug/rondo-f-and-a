import { describe, expect, it } from 'vitest'
import type { ProblemTemplate, Topic } from '@/engine/types'
import { PROBLEM_TEMPLATES } from '@/problems'
import { INTRO_STREAK, buildDaily, dailyPracticePath, introStatus, nextDailyItem } from './daily'
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

/** 導入期を終えた記録（同じ型を 3 回続けて全問正解）。復習の期日に響かないよう、ずっと前の日にする */
function introduced(templateId: string, day = '2026-09-01'): Attempt[] {
  return Array.from({ length: INTRO_STREAK }, () => attempt(templateId, day))
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
    // 同じ型が並んでも、数値（シード）は違う
    expect(new Set(a.items.map((item) => item.seed)).size).toBe(3)
  })

  it('日が変われば別の組み合わせになりうる（シードは必ず変わる）', () => {
    const a = buildDaily([], DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    const b = buildDaily([], DEFAULT_SETTINGS, templates, noon('2026-10-11'))
    expect(a.items.map((i) => i.seed)).not.toEqual(b.items.map((i) => i.seed))
  })

  it('はじめてのときは、新しい型を 1 つ選び、数値を変えて 3 回続けて出す（導入期）', () => {
    const plan = buildDaily([], DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    expect(plan.items.every((item) => item.reason === 'intro')).toBe(true)
    expect(new Set(plan.items.map((item) => item.templateId)).size).toBe(1)
  })

  it('復習の期日が来た問題を最初に出し、前回間違えた問題は retry とする', () => {
    const history = [
      ...introduced('cvp.a'), // 期日 9/8（期日を過ぎた日数がいちばん多い）
      ...introduced('npv.a'),
      attempt('npv.a', '2026-10-08', { earned: 1, allCorrect: false }), // 期日 10/9
    ]
    const plan = buildDaily(history, DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    expect(plan.items.slice(0, 2).map((item) => [item.templateId, item.reason])).toEqual([
      ['cvp.a', 'review'],
      ['npv.a', 'retry'],
    ])
    // 残りの 1 問は、導入（新しい型）の枠
    expect(plan.items[2]!.reason).toBe('intro')
  })

  it('新しい型は、XP が少ないラボから選ぶ', () => {
    // cvp と npv は導入済み（9/1 に 3 回続けて全問正解 → 期日 9/8 を過ぎ、10/4 に解き直して期日 10/18）。cf は未経験
    const history = [
      ...introduced('cvp.a'),
      ...introduced('npv.a'),
      attempt('cvp.a', '2026-10-04'),
      attempt('npv.a', '2026-10-04'),
    ]
    const settings = { ...DEFAULT_SETTINGS, dailyGoal: 1 }
    const plan = buildDaily(history, settings, templates, noon('2026-10-08'))
    expect(plan.items[0]).toMatchObject({ topic: 'cf', reason: 'intro' })

    // 期日の 10/18 になると、ノルマが 1 問なら復習が優先される
    const dueDay = buildDaily(history, settings, templates, noon('2026-10-18'))
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
  it('復習が溜まっていても、導入（新しい型）の枠を 1 問は残す', () => {
    const history = ['cvp.a', 'cvp.b', 'npv.a'].flatMap((id) => [
      ...introduced(id),
      attempt(id, '2026-10-01', { earned: 1, allCorrect: false }),
    ])
    const plan = buildDaily(history, DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    expect(plan.phase).toBe('mastery')
    expect(plan.items.map((item) => item.reason)).toEqual(['retry', 'retry', 'intro'])
  })

  it('新しい問題は、次の単元（前提が済んだいちばん手前の単元）から出す', () => {
    const plan = buildDaily([], DEFAULT_SETTINGS, PROBLEM_TEMPLATES, noon('2026-10-10'))
    // いちばん手前は財務諸表・仕訳基礎（仕訳ラボの問題）。その型を 3 回続ける
    expect(plan.items.map((item) => [item.topic, item.reason])).toEqual([
      ['journal', 'intro'],
      ['journal', 'intro'],
      ['journal', 'intro'],
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

describe('導入期（ブロック練習）', () => {
  it('3 回続けて全問正解するまでは導入中。一度届けば、あとで間違えても導入済み', () => {
    const status = introStatus([
      attempt('cvp.a', '2026-10-01'),
      attempt('cvp.a', '2026-10-01', { earned: 1, allCorrect: false }),
      attempt('cvp.a', '2026-10-02'),
      attempt('npv.a', '2026-10-01'),
      attempt('npv.a', '2026-10-01'),
      attempt('npv.a', '2026-10-01'),
      attempt('npv.a', '2026-10-02', { earned: 0, allCorrect: false }),
    ])
    expect(status.get('cvp.a')).toMatchObject({ introduced: false, need: 2 })
    expect(status.get('npv.a')).toMatchObject({ introduced: true, need: 0 })
  })

  it('翌日は、導入中の型の続きを、足りない回数だけ出す', () => {
    // 10/9 に cvp.a を 1 回正解 → あと 2 回
    const history = [attempt('cvp.a', '2026-10-09')]
    const plan = buildDaily(history, DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    expect(plan.items.map((item) => [item.templateId, item.reason])).toEqual([
      ['cvp.a', 'intro'],
      ['cvp.a', 'intro'],
      [plan.items[2]!.templateId, 'new'],
    ])
    expect(plan.items[2]!.templateId).not.toBe('cvp.a')
  })

  it('導入中に間違えると、また 3 回続ける', () => {
    const history = [
      attempt('cvp.a', '2026-10-09'),
      attempt('cvp.a', '2026-10-09', { earned: 1, allCorrect: false }),
    ]
    const plan = buildDaily(history, DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    expect(plan.items.every((item) => item.templateId === 'cvp.a' && item.reason === 'intro')).toBe(
      true,
    )
  })

  it('導入を終えた型は、ほかの型と混ぜて出す（同じ型は 1 日 1 回）', () => {
    const history = introduced('cvp.a', '2026-10-09')
    const plan = buildDaily(history, DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    expect(plan.items.filter((item) => item.templateId === 'cvp.a').length).toBeLessThanOrEqual(1)
  })

  it('ずっと前に 1 回だけ解いた型は、導入の続きとしては出さない', () => {
    // 15 日前に 1 回だけ解いた cvp.a は、導入の続きにしない（新しい型の導入になる）
    const history = [attempt('cvp.a', '2026-09-25')]
    const plan = buildDaily(history, DEFAULT_SETTINGS, templates, noon('2026-10-10'))
    const intro = plan.items.filter((item) => item.reason === 'intro')
    expect(intro.length).toBeGreaterThan(0)
    expect(intro.every((item) => item.templateId !== 'cvp.a')).toBe(true)
  })

  it('維持期間と直前期は、導入期の出し方をしない', () => {
    const history = [attempt('cvp.a', '2027-05-01')]
    const plan = buildDaily(history, DEFAULT_SETTINGS, templates, noon('2027-05-10'))
    expect(plan.phase).toBe('maintenance')
    expect(plan.items.some((item) => item.reason === 'intro')).toBe(false)
  })
})
