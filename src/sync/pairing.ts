import { normalizeSyncKey } from './protocol'

/** ほかの端末で開くと、同期キーを読み取る URL。キーはサーバーに送られない # の後ろに置く */
export function pairingUrl(key: string, origin = window.location.origin): string {
  return `${origin}/settings#sync=${key}`
}

/**
 * URL の #sync=… を読む。#sync= がなければ null、
 * あっても形が正しくなければ { key: null }
 */
export function readPairingHash(hash: string): { key: string | null } | null {
  const match = /^#sync=([^&]*)/.exec(hash)
  if (!match) return null
  try {
    return { key: normalizeSyncKey(decodeURIComponent(match[1]!)) }
  } catch {
    return { key: null }
  }
}
