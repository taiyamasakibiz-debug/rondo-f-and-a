import { describe, expect, it } from 'vitest'
import { pairingUrl, readPairingHash } from './pairing'
import { formatSyncKey, generateSyncKey } from './protocol'

describe('QR コードの URL', () => {
  it('キーは # の後ろに置き、読み取れる', () => {
    const key = generateSyncKey()
    const url = new URL(pairingUrl(key, 'https://example.test'))
    expect(url.pathname).toBe('/settings')
    expect(url.search).toBe('')
    expect(readPairingHash(url.hash)).toEqual({ key })
    expect(readPairingHash(`#sync=${formatSyncKey(key)}`)).toEqual({ key })
  })

  it('#sync= がなければ null、形がおかしければ key が null', () => {
    expect(readPairingHash('')).toBeNull()
    expect(readPairingHash('#top')).toBeNull()
    expect(readPairingHash('#sync=abc')).toEqual({ key: null })
    expect(readPairingHash('#sync=%E0%A4%A')).toEqual({ key: null })
  })
})
