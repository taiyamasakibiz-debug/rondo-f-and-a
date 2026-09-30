import 'fake-indexeddb/auto'
import { createStore, set } from 'idb-keyval'
import { describe, expect, it } from 'vitest'
import { createIndexedDbRepository, createMemoryRepository } from '@/data/repository'
import { type NewAttempt, createProgressStore } from './store'
import { DEFAULT_SETTINGS } from './types'

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

describe('書き出しと読み込み', () => {
  it('書き出したデータを読み込むと、同じ記録と設定に戻る', async () => {
    const source = createProgressStore(createMemoryRepository())
    await source.getState().load()
    await source.getState().recordAttempt(newAttempt)
    await source.getState().updateSettings({ dayStartHour: 5 })
    const json = JSON.stringify(source.getState().exportData())

    const target = createProgressStore(createMemoryRepository())
    await target.getState().load()
    expect(await target.getState().importData(json)).toEqual({ ok: true, attempts: 1 })
    expect(target.getState().attempts).toEqual(source.getState().attempts)
    expect(target.getState().settings).toEqual(source.getState().settings)
  })

  it('JSON でないデータや、形式の違うデータは読み込まない', async () => {
    const store = createProgressStore(createMemoryRepository())
    await store.getState().load()
    await store.getState().recordAttempt(newAttempt)

    expect((await store.getState().importData('not json')).ok).toBe(false)
    expect((await store.getState().importData('{"app":"other"}')).ok).toBe(false)
    // 失敗しても今のデータは残る
    expect(store.getState().attempts).toHaveLength(1)
  })

  it('初期化するとすべて消えて、設定も既定値に戻る', async () => {
    const repository = createMemoryRepository()
    const store = createProgressStore(repository)
    await store.getState().load()
    await store.getState().recordAttempt(newAttempt)
    await store.getState().updateSettings({ dailyGoal: 10 })
    await store.getState().resetAll()

    expect(store.getState().attempts).toEqual([])
    expect(store.getState().settings).toEqual(DEFAULT_SETTINGS)
    expect(await repository.load()).toEqual({ attempts: [], settings: DEFAULT_SETTINGS })
  })
})
