import 'fake-indexeddb/auto'
import { createStore, set } from 'idb-keyval'
import { describe, expect, it } from 'vitest'
import { createIndexedDbRepository, createMemoryRepository } from '@/data/repository'
import { type NewAttempt, createProgressStore } from './store'
import { DEFAULT_SETTINGS, liveAttempts, settingsValues } from './types'

const newAttempt: NewAttempt = {
  templateId: 'cvp.break-even.basic',
  topic: 'cvp',
  seed: 123,
  earned: 3,
  total: 5,
  allCorrect: false,
  steps: [{ stepId: 'a', correct: true }],
  durationMs: 45_000,
}

let dbCount = 0
const freshDbName = () => `test-db-${(dbCount += 1)}`

describe('IndexedDB の保存先', () => {
  it('記録と設定を保存し、読み直せる', async () => {
    const name = freshDbName()
    const store = createProgressStore(createIndexedDbRepository(name))
    await store.getState().load()
    const saved = await store.getState().recordAttempt(newAttempt, new Date('2026-10-01T03:00:00Z'))
    await store.getState().updateSettings({ dailyGoal: 5 })

    // 別のインスタンスで読み直す（アプリを開き直したのと同じ）
    const reopened = createProgressStore(createIndexedDbRepository(name))
    await reopened.getState().load()
    expect(reopened.getState().status).toBe('ready')
    expect(reopened.getState().attempts).toEqual([saved])
    expect(reopened.getState().settings.dailyGoal).toBe(5)
  })

  it('形が壊れた記録は読み飛ばす', async () => {
    const name = freshDbName()
    await set('attempt:broken', { id: 'broken' }, createStore(name, 'progress'))
    const store = createProgressStore(createIndexedDbRepository(name))
    await store.getState().load()
    expect(store.getState()).toMatchObject({ status: 'ready', attempts: [] })
  })
})

describe('置き換えと初期化', () => {
  it('すべて置き換えられる（バックアップの読み込み用。形式の確認は backup.test.ts）', async () => {
    const source = createProgressStore(createMemoryRepository())
    await source.getState().load()
    await source.getState().recordAttempt(newAttempt)

    const repository = createMemoryRepository()
    const target = createProgressStore(repository)
    await target.getState().load()
    await target.getState().replaceAll({
      attempts: source.getState().attempts,
      settings: { ...DEFAULT_SETTINGS, dailyGoal: 9 },
    })
    expect(target.getState().attempts).toEqual(source.getState().attempts)
    expect((await repository.load()).settings.dailyGoal).toBe(9)
  })

  it('初期化するとすべて消えて、設定も既定値に戻る', async () => {
    const repository = createMemoryRepository()
    const store = createProgressStore(repository)
    await store.getState().load()
    await store.getState().recordAttempt(newAttempt)
    await store.getState().updateSettings({ dailyGoal: 10 })
    await store.getState().resetAll()

    expect(liveAttempts(store.getState().attempts)).toEqual([])
    expect(settingsValues(store.getState().settings)).toEqual(settingsValues(DEFAULT_SETTINGS))
    // 保存先にも、記録は削除の印つきで残り（ほかの端末に削除を伝えるため）、設定は既定値に戻る
    const saved = await repository.load()
    expect(liveAttempts(saved.attempts)).toEqual([])
    expect(saved.attempts.every((attempt) => attempt.deletedAt)).toBe(true)
    expect(settingsValues(saved.settings)).toEqual(settingsValues(DEFAULT_SETTINGS))
  })
})

describe('ほかの端末からの取り込み（mergeRemote）', () => {
  it('手元にない記録と、新しい設定を取り込む。何も変わらなければ false', async () => {
    const repository = createMemoryRepository()
    const store = createProgressStore(repository)
    await store.getState().load()
    const mine = await store.getState().recordAttempt(newAttempt)
    const theirs = { ...mine, id: 'from-phone', seed: 999 }
    const newerSettings = {
      ...DEFAULT_SETTINGS,
      dailyGoal: 8,
      updatedAt: '2999-01-01T00:00:00.000Z',
    }

    expect(
      await store.getState().mergeRemote({ attempts: [mine, theirs], settings: newerSettings }),
    ).toBe(true)
    expect(
      store
        .getState()
        .attempts.map((a) => a.id)
        .sort(),
    ).toEqual([mine.id, 'from-phone'].sort())
    expect(store.getState().settings.dailyGoal).toBe(8)
    expect((await repository.load()).attempts).toHaveLength(2)

    expect(await store.getState().mergeRemote({ attempts: [theirs], settings: null })).toBe(false)
  })

  it('ほかの端末で消した記録は、手元でも消える', async () => {
    const store = createProgressStore(createMemoryRepository())
    await store.getState().load()
    const mine = await store.getState().recordAttempt(newAttempt)
    const deleted = {
      ...mine,
      deletedAt: '2999-01-01T00:00:00.000Z',
      updatedAt: '2999-01-01T00:00:00.000Z',
    }
    await store.getState().mergeRemote({ attempts: [deleted], settings: null })
    expect(liveAttempts(store.getState().attempts)).toEqual([])
  })
})

describe('記録した解答の採点を直す（updateAttemptScore）', () => {
  it('採点を直して保存し、更新日時を新しくする', async () => {
    const repository = createMemoryRepository()
    const store = createProgressStore(repository)
    await store.getState().load()
    const recorded = await store
      .getState()
      .recordAttempt(newAttempt, new Date('2026-10-01T03:00:00Z'))
    await store.getState().updateAttemptScore(
      recorded.id,
      {
        earned: 5,
        total: 5,
        allCorrect: true,
        steps: [{ stepId: 'a', correct: true, selfGrade: 'good' }],
      },
      new Date('2026-10-01T03:05:00Z'),
    )
    const [updated] = store.getState().attempts
    expect(updated).toMatchObject({
      id: recorded.id,
      earned: 5,
      allCorrect: true,
      answeredAt: recorded.answeredAt,
      updatedAt: '2026-10-01T03:05:00.000Z',
    })
    expect(updated!.steps[0]!.selfGrade).toBe('good')
    // 保存先にも反映されている
    const saved = await repository.load()
    expect(saved.attempts[0]).toMatchObject({ earned: 5, updatedAt: '2026-10-01T03:05:00.000Z' })
  })

  it('見つからない記録なら何もしない', async () => {
    const store = createProgressStore(createMemoryRepository())
    await store.getState().load()
    await store
      .getState()
      .updateAttemptScore('missing', { earned: 1, total: 1, allCorrect: true, steps: [] })
    expect(store.getState().attempts).toEqual([])
  })
})
