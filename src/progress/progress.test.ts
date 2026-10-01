import { describe, expect, it } from 'vitest'
import { addDays, dayKey, daysBetween } from './day'
import { levelFromXp, topicProgress, xpForAttempt } from './level'
import { buildReviewCards, dueCards, nextCard } from './review'
import { computeStreak } from './streak'
import { type Attempt, DEFAULT_SETTINGS, type Settings } from './types'

let nextId = 0
function attempt(answeredAt: string, overrides: Partial<Attempt> = {}): Attempt {
  nextId += 1
  return {
    id: `a${nextId}`,
    templateId: 'cvp.break-even.basic',
    topic: 'cvp',
    seed: nextId,
    earned: 5,
    total: 5,
    allCorrect: true,
    steps: [],
    durationMs: 60_000,
    answeredAt,
    createdAt: answeredAt,
    updatedAt: answeredAt,
    ...overrides,
  }
}

/** 端末のタイムゾーンに依存しないよう、ローカル時刻で日時を作る */
function local(day: string, hour = 12): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d!, hour).toISOString()
}

/** day の日にノルマ（既定 3 問）ぶん解いた記録 */
function goalMet(day: string, settings: Settings = DEFAULT_SETTINGS): Attempt[] {
  return Array.from({ length: settings.dailyGoal }, () => attempt(local(day)))
}

describe('day', () => {
  it('切り替わり時刻より前は前日として数える', () => {
    expect(dayKey(new Date(2026, 9, 1, 3, 59), 4)).toBe('2026-09-30')
    expect(dayKey(new Date(2026, 9, 1, 4, 0), 4)).toBe('2026-10-01')
    expect(dayKey(new Date(2026, 9, 1, 0, 30), 0)).toBe('2026-10-01')
  })

  it('日付の足し算と差（月末・年末をまたぐ）', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-09-28', '2026-10-02')).toBe(4)
  })
})

describe('computeStreak', () => {
  const now = new Date(2026, 9, 10, 12) // 2026-10-10 の昼

  it('記録がなければ 0', () => {
    expect(computeStreak([], DEFAULT_SETTINGS, now)).toMatchObject({
      current: 0,
      best: 0,
      todayCount: 0,
      todayGoalMet: false,
    })
  })

  it('ノルマを達成した日が続けば連続日数が伸びる', () => {
    const attempts = ['2026-10-08', '2026-10-09', '2026-10-10'].flatMap((d) => goalMet(d))
    expect(computeStreak(attempts, DEFAULT_SETTINGS, now)).toMatchObject({
      current: 3,
      best: 3,
      todayCount: 3,
      todayGoalMet: true,
    })
  })

  it('今日がまだ未達でも、昨日までの連続は切らない', () => {
    const attempts = [
      ...goalMet('2026-10-08'),
      ...goalMet('2026-10-09'),
      attempt(local('2026-10-10')),
    ]
    expect(computeStreak(attempts, DEFAULT_SETTINGS, now)).toMatchObject({
      current: 2,
      todayCount: 1,
      todayGoalMet: false,
    })
  })

  it('ノルマに届かない日があると 0 に戻る（1 問だけでは達成にならない）', () => {
    const attempts = [
      ...goalMet('2026-10-07'),
      attempt(local('2026-10-08')),
      ...goalMet('2026-10-09'),
    ]
    expect(computeStreak(attempts, DEFAULT_SETTINGS, now)).toMatchObject({ current: 1, best: 1 })
  })

  it('7 日続けるとフリーズがもらえ、休んだ日に自動で使われる', () => {
    const week = Array.from({ length: 7 }, (_, i) => addDays('2026-09-30', i)) // 9/30〜10/6
    const attempts = [...week.flatMap((d) => goalMet(d)), ...goalMet('2026-10-08')] // 10/7 を休む
    const state = computeStreak(attempts, DEFAULT_SETTINGS, new Date(2026, 9, 8, 12))
    expect(state).toMatchObject({ current: 8, freezes: 0, frozenDays: ['2026-10-07'] })
  })

  it('フリーズは最大 2 つまで', () => {
    const days = Array.from({ length: 28 }, (_, i) => addDays('2026-09-01', i))
    const state = computeStreak(
      days.flatMap((d) => goalMet(d)),
      DEFAULT_SETTINGS,
      new Date(2026, 8, 28, 12),
    )
    expect(state).toMatchObject({ current: 28, freezes: 2 })
  })

  it('日付の切り替わり時刻を考慮する（深夜 2 時の解答は前日）', () => {
    const lateNight = Array.from({ length: 3 }, () => attempt(local('2026-10-10', 2)))
    const state = computeStreak(lateNight, DEFAULT_SETTINGS, new Date(2026, 9, 10, 12))
    expect(state).toMatchObject({ todayCount: 0, current: 1 })
  })

  it('削除された記録は数えない', () => {
    const attempts = goalMet('2026-10-10').map((a, i) =>
      i === 0 ? { ...a, deletedAt: a.answeredAt } : a,
    )
    expect(computeStreak(attempts, DEFAULT_SETTINGS, now).todayCount).toBe(2)
  })
})

describe('レベルと熟練度', () => {
  it('XP は得点率 × 10、全問正解で +5', () => {
    expect(xpForAttempt({ earned: 5, total: 5, allCorrect: true })).toBe(15)
    expect(xpForAttempt({ earned: 3, total: 5, allCorrect: false })).toBe(6)
    expect(xpForAttempt({ earned: 0, total: 5, allCorrect: false })).toBe(0)
  })

  it('XP からレベルと次のレベルまでの進み具合を出す', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, nextLevelXp: 30, progress: 0 })
    expect(levelFromXp(45)).toMatchObject({ level: 2, currentLevelXp: 30, nextLevelXp: 80 })
    expect(levelFromXp(45).progress).toBeCloseTo(0.3)
    expect(levelFromXp(5000)).toMatchObject({ level: 10, nextLevelXp: null, progress: 1 })
  })

  it('論点ごとに集計し、熟練度は新しい解答ほど重く数える', () => {
    const attempts = [
      attempt(local('2026-10-01'), { earned: 0, allCorrect: false }),
      attempt(local('2026-10-02')),
      attempt(local('2026-10-03'), { topic: 'npv', templateId: 'npv.x' }),
    ]
    const cvp = topicProgress(attempts, 'cvp')
    expect(cvp.attempts).toBe(2)
    expect(cvp.xp).toBe(15)
    // 新しい満点（重み 1）と古い 0 点（重み 0.85）→ 1 / 1.85
    expect(cvp.mastery).toBeCloseTo(1 / 1.85)
    expect(topicProgress(attempts, 'analysis').mastery).toBeNull()
  })
})

describe('復習スケジュール', () => {
  const base = { templateId: 't', total: 5 }

  it('マスター期間は、全問正解が続くと間隔が 1 → 3 → 7 → 14 → 30 日と伸びて、30 日で止まる', () => {
    const good = { ...base, earned: 5, allCorrect: true }
    let card = nextCard(undefined, good, '2026-10-01')
    expect(card).toMatchObject({ intervalDays: 1, dueDay: '2026-10-02' })
    const intervals = [card.intervalDays]
    for (let i = 0; i < 6; i += 1) {
      card = nextCard(card, good, card.dueDay)
      intervals.push(card.intervalDays)
    }
    expect(intervals).toEqual([1, 3, 7, 14, 30, 30, 30])
  })

  it('維持期間は、間隔が 14 → 30 → 45 日と伸びる', () => {
    const good = { ...base, earned: 5, allCorrect: true }
    const first = nextCard(undefined, good, '2027-05-01', 'maintenance')
    const second = nextCard(first, good, first.dueDay, 'maintenance')
    const third = nextCard(second, good, second.dueDay, 'maintenance')
    expect([first, second, third].map((card) => card.intervalDays)).toEqual([14, 30, 45])
  })

  it('間違えたときは、局面にかかわらず翌日にもう一度出す', () => {
    const good = nextCard(
      undefined,
      { ...base, earned: 5, allCorrect: true },
      '2027-05-01',
      'maintenance',
    )
    const bad = nextCard(
      good,
      { ...base, earned: 0, allCorrect: false },
      '2027-05-20',
      'maintenance',
    )
    expect(bad).toMatchObject({ streak: 0, intervalDays: 1, dueDay: '2027-05-21' })
  })

  it('解答記録からは、解答した日の局面の間隔表を使う（局面が変わっても過去の間隔は変わらない）', () => {
    // 3 月（マスター期間）に 1 回、5 月（維持期間）に 1 回、全問正解
    const attempts = [
      attempt(local('2027-03-30'), { templateId: 'a' }),
      attempt(local('2027-05-01'), { templateId: 'a' }),
    ]
    const [card] = [...buildReviewCards(attempts, DEFAULT_SETTINGS).values()]
    // 2 回目は維持期間の表の 2 番目（30 日）
    expect(card).toMatchObject({ streak: 2, intervalDays: 30, dueDay: '2027-05-31' })
  })

  it('6 割未満なら翌日にもう一度出し、易しさを下げる', () => {
    const good = nextCard(undefined, { ...base, earned: 5, allCorrect: true }, '2026-10-01')
    const bad = nextCard(good, { ...base, earned: 1, allCorrect: false }, '2026-10-02')
    expect(bad).toMatchObject({ streak: 0, intervalDays: 1, lapses: 1, dueDay: '2026-10-03' })
    expect(bad.ease).toBeCloseTo(2.3)
  })

  it('易しさは 1.3 より下がらない', () => {
    let card = nextCard(undefined, { ...base, earned: 0, allCorrect: false }, '2026-10-01')
    for (let i = 0; i < 20; i += 1) {
      card = nextCard(card, { ...base, earned: 0, allCorrect: false }, '2026-10-01')
    }
    expect(card.ease).toBe(1.3)
  })

  it('解答記録から期日の来たカードを、期日を過ぎた日数が多い順に並べる', () => {
    const attempts = [
      attempt(local('2026-10-01'), { templateId: 'a' }), // 期日 10/2
      attempt(local('2026-10-03'), { templateId: 'b' }), // 期日 10/4
      attempt(local('2026-10-05'), { templateId: 'c' }), // 期日 10/6
    ]
    const cards = buildReviewCards(attempts, DEFAULT_SETTINGS)
    expect(dueCards(cards, '2026-10-05').map((card) => card.templateId)).toEqual(['a', 'b'])
  })
})
