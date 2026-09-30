import { describe, expect, it, vi } from 'vitest'
import { type Repository, createMemoryRepository } from '@/data/repository'
import { createBroadcastSync, createMemorySyncHub } from '@/data/sync'
import { type NewAttempt, createProgressStore } from './store'
import { DEFAULT_SETTINGS, liveAttempts, settingsValues } from './types'

const newAttempt: NewAttempt = {
  templateId: 'cvp.break-even.basic',
  topic: 'cvp',
  seed: 1,
  earned: 5,
  total: 5,
  allCorrect: true,
  steps: [],
  durationMs: 1,
}

/** 同じ保存先（IndexedDB の代わり）を共有する 2 つのウィンドウ */
async function twoWindows(repository: Repository = createMemoryRepository()) {
  const hub = createMemorySyncHub()
  const a = createProgressStore(repository, hub.connect())
  const b = createProgressStore(repository, hub.connect())
  await a.getState().load()
  await b.getState().load()
  return { a, b }
}

describe('複数ウィンドウの同期', () => {
  it('一方のウィンドウで解くと、もう一方にも記録が届く', async () => {
    const { a, b } = await twoWindows()
    const saved = await a.getState().recordAttempt(newAttempt)
    await vi.waitFor(() => expect(b.getState().attempts).toEqual([saved]))
  })

  it('設定の変更、読み込み、全消去も届く', async () => {
    const { a, b } = await twoWindows()
    await a.getState().updateSettings({ dailyGoal: 7 })
    await vi.waitFor(() => expect(b.getState().settings.dailyGoal).toBe(7))

    await a.getState().recordAttempt(newAttempt)
    await vi.waitFor(() => expect(b.getState().attempts).toHaveLength(1))
    await b.getState().resetAll()
    await vi.waitFor(() => {
      expect(liveAttempts(a.getState().attempts)).toEqual([])
      expect(settingsValues(a.getState().settings)).toEqual(settingsValues(DEFAULT_SETTINGS))
    })
  })

  it('両方のウィンドウで続けて解いても、どちらの記録も残る', async () => {
    const { a, b } = await twoWindows()
    await Promise.all([
      a.getState().recordAttempt({ ...newAttempt, seed: 1 }),
      b.getState().recordAttempt({ ...newAttempt, seed: 2 }),
      a.getState().recordAttempt({ ...newAttempt, seed: 3 }),
    ])
    await vi.waitFor(() => {
      expect(
        a
          .getState()
          .attempts.map((x) => x.seed)
          .sort(),
      ).toEqual([1, 2, 3])
      expect(
        b
          .getState()
          .attempts.map((x) => x.seed)
          .sort(),
      ).toEqual([1, 2, 3])
    })
  })

  it('読み直しの途中で解いても、その記録は画面から消えない', async () => {
    const memory = createMemoryRepository()
    // 読み込みを手動で止められる保存先
    let releaseLoad: () => void = () => {}
    let gate: Promise<void> | null = null
    const slow: Repository = {
      ...memory,
      async load() {
        const data = await memory.load() // 古いデータを先に読む
        if (gate) await gate
        return data
      },
    }
    const hub = createMemorySyncHub()
    const a = createProgressStore(slow, hub.connect())
    const other = hub.connect()
    await a.getState().load()

    // ほかのウィンドウの知らせで読み直しが始まり、止まっている間に解く
    gate = new Promise((resolve) => (releaseLoad = resolve))
    other.notify('progress')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const recording = a.getState().recordAttempt(newAttempt)
    expect(a.getState().attempts).toHaveLength(1)

    releaseLoad()
    gate = null
    await recording
    expect(a.getState().attempts).toHaveLength(1)
    expect((await memory.load()).attempts).toHaveLength(1)
  })

  it('記録以外の種類の知らせでは読み直さない', async () => {
    const memory = createMemoryRepository()
    const load = vi.fn(memory.load)
    const hub = createMemorySyncHub()
    const a = createProgressStore({ ...memory, load }, hub.connect())
    await a.getState().load()
    hub.connect().notify('ledger')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(load).toHaveBeenCalledTimes(1)
  })
})

describe('createBroadcastSync', () => {
  it('BroadcastChannel で、自分以外のウィンドウにだけ知らせる', async () => {
    const name = `test-${crypto.randomUUID()}`
    const a = createBroadcastSync(name)
    const b = createBroadcastSync(name)
    const received = { a: vi.fn(), b: vi.fn() }
    a.subscribe(received.a)
    b.subscribe(received.b)

    a.notify('progress')
    await vi.waitFor(() =>
      expect(received.b).toHaveBeenCalledWith(expect.objectContaining({ scope: 'progress' })),
    )
    expect(received.a).not.toHaveBeenCalled()
    a.close()
    b.close()
  })
})
