/**
 * 同じ端末で開いた複数のウィンドウの同期（docs/DESIGN.md §2：第一の設計思想）。
 * 保存先を変更したウィンドウが「どの種類のデータが変わったか」だけを知らせ、
 * 受け取ったウィンドウは保存先から読み直す（データそのものは送らない）。
 */

/** 変わったデータの種類。仕訳ラボのフリーモードは 'ledger' を使う */
export type SyncScope = 'progress' | 'ledger'

export type SyncMessage = {
  kind: 'changed'
  scope: SyncScope
  /** 知らせたウィンドウ（自分の知らせを無視するため） */
  source: string
}

export type SyncChannel = {
  /** ほかのウィンドウに、scope のデータが変わったことを知らせる */
  notify(scope: SyncScope): void
  /** ほかのウィンドウからの知らせを受け取る。戻り値で受け取りをやめる */
  subscribe(listener: (message: SyncMessage) => void): () => void
  close(): void
}

const CHANNEL_NAME = 'luminous-insight-sync'

function isSyncMessage(value: unknown): value is SyncMessage {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Record<string, unknown>
  return (
    message.kind === 'changed' &&
    (message.scope === 'progress' || message.scope === 'ledger') &&
    typeof message.source === 'string'
  )
}

/** BroadcastChannel による同期。使えない環境では何もしない */
export function createBroadcastSync(name = CHANNEL_NAME): SyncChannel {
  if (typeof BroadcastChannel === 'undefined') return createNoopSync()
  const source = crypto.randomUUID()
  const channel = new BroadcastChannel(name)
  const listeners = new Set<(message: SyncMessage) => void>()
  channel.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (!isSyncMessage(event.data) || event.data.source === source) return
    for (const listener of listeners) listener(event.data)
  })
  return {
    notify: (scope) =>
      channel.postMessage({ kind: 'changed', scope, source } satisfies SyncMessage),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close: () => channel.close(),
  }
}

export function createNoopSync(): SyncChannel {
  return { notify: () => {}, subscribe: () => () => {}, close: () => {} }
}

/**
 * テスト用：同じプロセスの中で複数の「ウィンドウ」をつなぐ。
 * BroadcastChannel と同じく、知らせは非同期に、自分以外にだけ届く。
 */
export function createMemorySyncHub() {
  const windows = new Set<{ source: string; deliver: (message: SyncMessage) => void }>()
  return {
    connect(): SyncChannel {
      const source = crypto.randomUUID()
      const listeners = new Set<(message: SyncMessage) => void>()
      const entry = {
        source,
        deliver: (message: SyncMessage) => listeners.forEach((listener) => listener(message)),
      }
      windows.add(entry)
      return {
        notify(scope) {
          const message: SyncMessage = { kind: 'changed', scope, source }
          for (const other of windows) {
            if (other.source !== source) queueMicrotask(() => other.deliver(message))
          }
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        close: () => windows.delete(entry),
      }
    },
  }
}
