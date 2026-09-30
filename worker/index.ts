import { DurableObject } from 'cloudflare:workers'
import {
  type SyncRequest,
  type SyncStorage,
  handleSync,
  normalizeSyncKey,
  syncRequestSchema,
} from '../src/sync/protocol'

/**
 * Cloudflare Workers の入り口。
 * - /api/sync：端末間の同期（解答記録と設定）。同期キーごとに 1 つの Durable Object にデータを置く
 * - それ以外：Vite でビルドした静的ファイル（wrangler.jsonc の run_worker_first で /api/* だけがここに来る）
 */
export type Env = {
  ASSETS: Fetcher
  SYNC: DurableObjectNamespace<SyncRoom>
}

/** 1 回の同期で受け付ける大きさの上限 */
const MAX_BODY_BYTES = 4 * 1024 * 1024
/** Durable Objects のストレージは 1 回の put で 128 件まで */
const PUT_BATCH = 128

export class SyncRoom extends DurableObject<Env> {
  async sync(request: SyncRequest) {
    return handleSync(storageOf(this.ctx.storage), request)
  }
}

function storageOf(storage: DurableObjectStorage): SyncStorage {
  return {
    get: (key) => storage.get(key),
    async put(entries) {
      const list = Object.entries(entries)
      for (let i = 0; i < list.length; i += PUT_BATCH) {
        await storage.put(Object.fromEntries(list.slice(i, i + PUT_BATCH)))
      }
    },
    list: (options) => storage.list(options),
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** 同期キーそのものではなく、ハッシュで Durable Object を選ぶ（キーをどこにも残さないため） */
async function roomName(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function handleSyncRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const header = request.headers.get('Authorization') ?? ''
  const key = normalizeSyncKey(header.replace(/^Bearer\s+/i, ''))
  if (!key) return json({ error: 'invalid_key' }, 401)

  const length = Number(request.headers.get('Content-Length') ?? 0)
  if (length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413)
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413)

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  const parsed = syncRequestSchema.safeParse(raw)
  if (!parsed.success) return json({ error: 'invalid_body' }, 400)

  const room = env.SYNC.get(env.SYNC.idFromName(await roomName(key)))
  return json(await room.sync(parsed.data))
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/sync') return handleSyncRequest(request, env)
    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404)
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
