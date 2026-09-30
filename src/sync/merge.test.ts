import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Attempt } from '../progress/types'
import { mergeAttempts, mergeSettings, newerAttempts } from './merge'

function attempt(id: string, updatedAt: string, overrides: Partial<Attempt> = {}): Attempt {
  return {
    id,
    templateId: 'cvp.break-even.basic',
    topic: 'cvp',
    seed: 1,
    earned: 5,
    total: 5,
    allCorrect: true,
    steps: [],
    durationMs: 1,
    answeredAt: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt,
    ...overrides,
  }
}

const T1 = '2026-10-01T01:00:00.000Z'
const T2 = '2026-10-01T02:00:00.000Z'

describe('mergeAttempts', () => {
  it('2 台で別々に解いた記録は、両方残る', () => {
    const merged = mergeAttempts([attempt('pc', T1)], [attempt('phone', T1)])
    expect(merged.map((a) => a.id).sort()).toEqual(['pc', 'phone'])
  })

  it('同じ記録なら新しい方を使う', () => {
    const merged = mergeAttempts([attempt('a', T1)], [attempt('a', T2, { earned: 1 })])
    expect(merged).toEqual([attempt('a', T2, { earned: 1 })])
  })

  it('消した記録（deletedAt）は、古い方の端末からの同期で戻らない', () => {
    const deleted = attempt('a', T2, { deletedAt: T2 })
    expect(mergeAttempts([deleted], [attempt('a', T1)])).toEqual([deleted])
    expect(mergeAttempts([attempt('a', T1)], [deleted])).toEqual([deleted])
  })

  it('同じ時刻なら、削除の印がある方を優先する', () => {
    const deleted = attempt('a', T1, { deletedAt: T1 })
    expect(mergeAttempts([deleted], [attempt('a', T1)])).toEqual([deleted])
    expect(mergeAttempts([attempt('a', T1)], [deleted])).toEqual([deleted])
  })

  it('解答日時の順に並べる', () => {
    const late = attempt('late', T1, { answeredAt: '2026-10-02T00:00:00.000Z' })
    const early = attempt('early', T1, { answeredAt: '2026-09-30T00:00:00.000Z' })
    expect(mergeAttempts([late], [early]).map((a) => a.id)).toEqual(['early', 'late'])
  })
})

describe('newerAttempts', () => {
  it('手元にない記録と、手元より新しい記録だけを返す', () => {
    const local = [attempt('same', T1), attempt('old', T1)]
    const remote = [attempt('same', T1), attempt('old', T2), attempt('new', T1)]
    expect(newerAttempts(local, remote).map((a) => a.id)).toEqual(['old', 'new'])
  })
})

describe('mergeSettings', () => {
  it('新しく変えた方を使う', () => {
    const older = { ...DEFAULT_SETTINGS, dailyGoal: 5, updatedAt: T1 }
    const newer = { ...DEFAULT_SETTINGS, dailyGoal: 7, updatedAt: T2 }
    expect(mergeSettings(older, newer)).toEqual(newer)
    expect(mergeSettings(newer, older)).toEqual(newer)
    expect(mergeSettings(older, null)).toEqual(older)
  })
})
