import { describe, expect, it } from 'vitest'
import { createMemoryRepository } from '@/data/repository'
import { createProgressStore, type NewAttempt } from '@/progress/store'
import { liveAttempts } from '@/progress/types'
import { createMemorySyncConfigStorage, createSyncStore, type SyncTransport } from './client'
import {
  type SyncStorage,
  createMemorySyncStorage,
  generateSyncKey,
  handleSync,
  syncRequestSchema,
  syncResponseSchema,
} from './protocol'

/** Worker と同じく、同期キーごとに別の保存先を使うサーバー（通信の代わりに JSON を通す） */
function createServer() {
  const rooms = new Map<string, SyncStorage>()
  let requests = 0
  const transport: SyncTransport = async (key, request) => {
    requests += 1
    const room = rooms.get(key) ?? createMemorySyncStorage()
    rooms.set(key, room)
    const body = syncRequestSchema.parse(JSON.parse(JSON.stringify(request)))
    return syncResponseSchema.parse(JSON.parse(JSON.stringify(await handleSync(room, body))))
  }
  return { transport, requests: () => requests }
}

async function createDevice(transport: SyncTransport) {
  const progress = createProgressStore(createMemoryRepository())
  await progress.getState().load()
  const sync = createSyncStore({ progress, storage: createMemorySyncConfigStorage(), transport })
  await sync.getState().init()
  return { progress, sync }
}

const input: NewAttempt = {
  templateId: 'cvp.break-even.basic',
  topic: 'cvp',
  seed: 1,
  earned: 5,
  total: 5,
  allCorrect: true,
  steps: [],
  durationMs: 1,
}

describe('端末間の同期', () => {
  it('同期キーを共有すると、PC とスマホの解答記録がまとまる', async () => {
    const server = createServer()
    const pc = await createDevice(server.transport)
    const phone = await createDevice(server.transport)
    await pc.progress.getState().recordAttempt({ ...input, seed: 1 })
    await phone.progress.getState().recordAttempt({ ...input, seed: 2 })

    const key = generateSyncKey()
    expect(await pc.sync.getState().connect(key)).toBe(true)
    expect(await phone.sync.getState().connect(key)).toBe(true)
    await pc.sync.getState().syncNow()

    for (const device of [pc, phone]) {
      const seeds = liveAttempts(device.progress.getState().attempts).map((a) => a.seed)
      expect(seeds.sort()).toEqual([1, 2])
      expect(device.sync.getState()).toMatchObject({ status: 'idle', key })
    }
  })

  it('消去（すべて消去・読み込みでの置き換え）も、ほかの端末に届く', async () => {
    const server = createServer()
    const pc = await createDevice(server.transport)
    const phone = await createDevice(server.transport)
    const key = generateSyncKey()
    await pc.sync.getState().connect(key)
    await phone.sync.getState().connect(key)
    await pc.progress.getState().recordAttempt(input)
    await pc.sync.getState().syncNow()
    await phone.sync.getState().syncNow()
    expect(liveAttempts(phone.progress.getState().attempts)).toHaveLength(1)

    await phone.progress.getState().resetAll(new Date(Date.now() + 1000))
    await phone.sync.getState().syncNow()
    await pc.sync.getState().syncNow()
    expect(liveAttempts(pc.progress.getState().attempts)).toHaveLength(0)
  })

  it('設定は、あとで変えた方にそろう', async () => {
    const server = createServer()
    const pc = await createDevice(server.transport)
    const phone = await createDevice(server.transport)
    const key = generateSyncKey()
    await pc.sync.getState().connect(key)
    await phone.sync.getState().connect(key)

    await phone.progress.getState().updateSettings({ dailyGoal: 8 })
    await phone.sync.getState().syncNow()
    await pc.sync.getState().syncNow()
    expect(pc.progress.getState().settings.dailyGoal).toBe(8)
  })

  it('取り込んだだけのときは「この端末の変更」として扱わない', async () => {
    const server = createServer()
    const pc = await createDevice(server.transport)
    const phone = await createDevice(server.transport)
    const key = generateSyncKey()
    await pc.sync.getState().connect(key)
    await phone.sync.getState().connect(key)
    // テストは速いので、同じミリ秒にならないよう少し前に解いたことにする
    await pc.progress.getState().recordAttempt(input, new Date(Date.now() - 1000))
    await pc.sync.getState().syncNow()
    await phone.sync.getState().syncNow()
    expect(phone.sync.getState().hasLocalChanges()).toBe(false)

    await phone.progress.getState().recordAttempt(input)
    expect(phone.sync.getState().hasLocalChanges()).toBe(true)
  })

  it('形の正しくないキーでは始めない', async () => {
    const server = createServer()
    const pc = await createDevice(server.transport)
    expect(await pc.sync.getState().connect('abc')).toBe(false)
    expect(pc.sync.getState()).toMatchObject({ status: 'off', key: null })
    expect(server.requests()).toBe(0)
  })

  it('通信に失敗したらエラーを表示し、次の同期で送り直す', async () => {
    const server = createServer()
    let offline = true
    const transport: SyncTransport = (key, request) =>
      offline ? Promise.reject(new Error('offline')) : server.transport(key, request)
    const pc = await createDevice(transport)
    const phone = await createDevice(server.transport)
    const key = generateSyncKey()
    await pc.progress.getState().recordAttempt(input)
    expect(await pc.sync.getState().connect(key)).toBe(false)
    expect(pc.sync.getState().status).toBe('error')

    offline = false
    expect(await pc.sync.getState().syncNow()).toBe(true)
    await phone.sync.getState().connect(key)
    expect(liveAttempts(phone.progress.getState().attempts)).toHaveLength(1)
  })

  it('同期をやめると、キーを忘れる（記録は残る）', async () => {
    const server = createServer()
    const pc = await createDevice(server.transport)
    await pc.progress.getState().recordAttempt(input)
    await pc.sync.getState().connect(generateSyncKey())
    await pc.sync.getState().disconnect()
    expect(pc.sync.getState()).toMatchObject({ status: 'off', key: null })
    expect(await pc.sync.getState().syncNow()).toBe(false)
    expect(liveAttempts(pc.progress.getState().attempts)).toHaveLength(1)
  })
})
