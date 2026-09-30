import { createStore as createIdbStore, del, get as idbGet, set as idbSet } from 'idb-keyval'
import { create } from 'zustand'
import { type createProgressStore, useProgressStore } from '@/progress/store'
import {
  type SyncRequest,
  type SyncResponse,
  normalizeSyncKey,
  syncResponseSchema,
} from './protocol'

/**
 * 端末間の同期（スマホと PC など）。ログインの代わりに「同期キー」を共有した端末どうしで、
 * 解答記録と設定だけをサーバー（Cloudflare Durable Objects）経由でまとめる。
 * フリーモードは同期しない。
 *
 * 1 回の同期：前回の同期のあとに変わった記録と今の設定を送り、
 * ほかの端末が送った記録を受け取って取り込む（まとめ方は merge.ts）。
 */

export type SyncConfig = {
  key: string
  /** サーバーの通し番号。ここより後の変更だけを受け取る */
  cursor: number
  /** 前回送り始めた時刻（この端末の時計）。null ならすべて送る */
  pushedAt: string | null
  lastSyncedAt: string | null
}

export type SyncConfigStorage = {
  load(): Promise<SyncConfig | null>
  save(config: SyncConfig): Promise<void>
  clear(): Promise<void>
}

export type SyncTransport = (key: string, request: SyncRequest) => Promise<SyncResponse>

export type SyncStatus = 'loading' | 'off' | 'idle' | 'syncing' | 'error'

type SyncState = {
  status: SyncStatus
  key: string | null
  lastSyncedAt: string | null
  error: string | null
  /** 保存してある同期キーを読み込み、同期を始める */
  init(): Promise<void>
  /** 同期キーで同期を始める（新しく作ったキーでも、ほかの端末のキーでもよい） */
  connect(key: string): Promise<boolean>
  /** この端末の同期をやめる（サーバーと、ほかの端末のデータはそのまま） */
  disconnect(): Promise<void>
  syncNow(): Promise<boolean>
  /** 前回送ったあとに、この端末で変わったものがあるか */
  hasLocalChanges(): boolean
}

/** 1 回に送る記録の数（サーバーの上限 5,000 件より小さく） */
const PUSH_BATCH = 1_000
const DEBOUNCE_MS = 3_000
const INTERVAL_MS = 5 * 60_000

export class SyncError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

export function createIndexedDbSyncConfigStorage(
  dbName = 'luminous-insight-sync',
): SyncConfigStorage {
  const store = createIdbStore(dbName, 'config')
  return {
    load: async () => (await idbGet<SyncConfig>('config', store)) ?? null,
    save: (config) => idbSet('config', config, store),
    clear: () => del('config', store),
  }
}

export function createMemorySyncConfigStorage(): SyncConfigStorage {
  let config: SyncConfig | null = null
  return {
    load: async () => config,
    save: async (next) => {
      config = next
    },
    clear: async () => {
      config = null
    },
  }
}

export const fetchTransport: SyncTransport = async (key, request) => {
  const response = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new SyncError(`同期に失敗しました（${response.status}）`, response.status)
  const parsed = syncResponseSchema.safeParse(await response.json())
  if (!parsed.success) throw new SyncError('サーバーから届いたデータの形が正しくありません')
  return parsed.data
}

type ProgressStore = ReturnType<typeof createProgressStore>

export function createSyncStore({
  progress,
  storage,
  transport,
  now = () => new Date(),
}: {
  progress: ProgressStore
  storage: SyncConfigStorage
  transport: SyncTransport
  now?: () => Date
}) {
  let config: SyncConfig | null = null
  let running: Promise<boolean> | null = null
  let again = false

  return create<SyncState>()((set) => {
    const hasLocalChanges = () => {
      if (!config) return false
      const since = config.pushedAt
      if (since === null) return true
      const { attempts, settings } = progress.getState()
      return settings.updatedAt > since || attempts.some((attempt) => attempt.updatedAt > since)
    }

    /** 解答記録を読み込み終えるまで待つ（読み込み前に送ると、記録を送りもらす） */
    const waitForProgress = () =>
      new Promise<void>((resolve, reject) => {
        const check = (status: string) => {
          if (status === 'loading') return false
          unsubscribe?.()
          if (status === 'ready') resolve()
          else reject(new SyncError('記録を読み込めなかったので、同期を止めました。'))
          return true
        }
        let unsubscribe: (() => void) | undefined
        if (check(progress.getState().status)) return
        unsubscribe = progress.subscribe((state) => void check(state.status))
      })

    const runOnce = async (): Promise<void> => {
      await waitForProgress()
      if (!config) return
      const startedAt = now()
      const since = config.pushedAt
      const { attempts, settings } = progress.getState()
      const pending = since === null ? attempts : attempts.filter((a) => a.updatedAt > since)
      const batches: (typeof attempts)[] = []
      for (let i = 0; i < pending.length; i += PUSH_BATCH) {
        batches.push(pending.slice(i, i + PUSH_BATCH))
      }
      if (batches.length === 0) batches.push([])

      let cursor = config.cursor
      for (const batch of batches) {
        const response = await transport(config.key, { attempts: batch, settings, since: cursor })
        await progress.getState().mergeRemote(response)
        // サーバーのデータが作り直されていたら、はじめからやり直す
        if (response.cursor < cursor) {
          config = { ...config, cursor: 0, pushedAt: null }
          await storage.save(config)
          again = true
          return
        }
        cursor = response.cursor
      }
      config = {
        ...config,
        cursor,
        // 同期の途中（送る記録を選んだあと）に同じ時刻で増えた記録も、次回送る
        pushedAt: new Date(startedAt.getTime() - 1).toISOString(),
        lastSyncedAt: now().toISOString(),
      }
      await storage.save(config)
    }

    const syncNow = (): Promise<boolean> => {
      if (!config) return Promise.resolve(false)
      if (running) {
        // 同期の途中に変わったものは、終わってからもう一度送る
        again = true
        return running
      }
      set({ status: 'syncing', error: null })
      running = (async () => {
        try {
          do {
            again = false
            await runOnce()
          } while (again && config)
          if (!config) return false
          set({ status: 'idle', lastSyncedAt: config.lastSyncedAt, error: null })
          return true
        } catch (error) {
          console.error('同期に失敗しました', error)
          const message =
            error instanceof SyncError
              ? error.message
              : '同期できませんでした。通信状態を確かめてください。'
          set({ status: config ? 'error' : 'off', error: message })
          return false
        } finally {
          running = null
        }
      })()
      return running
    }

    return {
      status: 'loading',
      key: null,
      lastSyncedAt: null,
      error: null,

      async init() {
        await running
        config = await storage.load()
        if (!config) {
          set({ status: 'off', key: null, lastSyncedAt: null, error: null })
          return
        }
        set({ status: 'idle', key: config.key, lastSyncedAt: config.lastSyncedAt })
        await syncNow()
      },

      async connect(input) {
        const key = normalizeSyncKey(input)
        if (!key) {
          set({ error: '同期キーの形が正しくありません。' })
          return false
        }
        if (config?.key === key) return syncNow()
        await running
        config = { key, cursor: 0, pushedAt: null, lastSyncedAt: null }
        await storage.save(config)
        set({ status: 'idle', key, lastSyncedAt: null, error: null })
        return syncNow()
      },

      async disconnect() {
        await running
        config = null
        await storage.clear()
        set({ status: 'off', key: null, lastSyncedAt: null, error: null })
      },

      syncNow,
      hasLocalChanges,
    }
  })
}

export const useSyncStore = createSyncStore({
  progress: useProgressStore,
  storage: createIndexedDbSyncConfigStorage(),
  transport: fetchTransport,
})

/**
 * 同期のきっかけ：起動時・この端末で記録や設定が変わったとき（少し待ってまとめる）・
 * 画面に戻ってきたとき・オンラインに戻ったとき・5 分ごと。
 * 戻り値で止める（テスト用）。
 */
export function startAutoSync(
  store: typeof useSyncStore = useSyncStore,
  progress: ProgressStore = useProgressStore,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const syncIfOn = () => {
    const { status } = store.getState()
    if (status === 'idle' || status === 'error') void store.getState().syncNow()
  }

  const unsubscribe = progress.subscribe((state, previous) => {
    if (state.attempts === previous.attempts && state.settings === previous.settings) return
    // ほかの端末から取り込んだだけの変更では送らない
    if (!store.getState().hasLocalChanges()) return
    clearTimeout(timer)
    timer = setTimeout(syncIfOn, DEBOUNCE_MS)
  })
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    // ほかのウィンドウで同期を始めた・やめた場合もあるので、設定から読み直す
    void store.getState().init()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', syncIfOn)
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible') syncIfOn()
  }, INTERVAL_MS)

  void store.getState().init()

  return () => {
    unsubscribe()
    clearTimeout(timer)
    clearInterval(interval)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', syncIfOn)
  }
}
