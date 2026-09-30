import { type FormEvent, useEffect, useId, useMemo, useState } from 'react'
import { renderSVG } from 'uqr'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useSyncStore } from '@/sync/client'
import { readPairingHash, pairingUrl } from '@/sync/pairing'
import { formatSyncKey, generateSyncKey, normalizeSyncKey } from '@/sync/protocol'

function formatTime(iso: string | null): string {
  if (!iso) return 'まだ同期していません'
  return new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 設定画面の「端末間の同期」。同期キーを作る・入力する・QR コードでほかの端末に渡す。
 * 同期するのは解答記録と設定だけで、フリーモードは端末ごと。
 */
export function SyncPanel() {
  const status = useSyncStore((state) => state.status)
  const key = useSyncStore((state) => state.key)
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
  const error = useSyncStore((state) => state.error)
  const connect = useSyncStore((state) => state.connect)
  const disconnect = useSyncStore((state) => state.disconnect)
  const syncNow = useSyncStore((state) => state.syncNow)

  const inputId = useId()
  const [input, setInput] = useState('')
  // ほかの端末の QR コードから開いたとき：#sync=… を読み取る（URL からは下の effect ですぐ消す）
  const [fromHash] = useState(() => readPairingHash(window.location.hash))
  const [inputError, setInputError] = useState<string | null>(() =>
    fromHash && !fromHash.key ? 'QR コードの同期キーを読み取れませんでした。' : null,
  )
  const [showKey, setShowKey] = useState(false)
  const [pairing, setPairing] = useState<string | null>(() => fromHash?.key ?? null)
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  useEffect(() => {
    if (!window.location.hash.startsWith('#sync=')) return
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const normalized = normalizeSyncKey(input)
    if (!normalized) {
      setInputError('同期キーは 32 文字です（区切りの - はあってもなくても大丈夫です）。')
      return
    }
    setInputError(null)
    setPairing(normalized)
  }

  const confirmPairing = async () => {
    if (!pairing) return
    const next = pairing
    setPairing(null)
    setInput('')
    await connect(next)
  }

  const start = async () => {
    await connect(generateSyncKey())
    setShowKey(true)
  }

  const confirmDisconnect = async () => {
    setDisconnectOpen(false)
    setShowKey(false)
    await disconnect()
  }

  if (status === 'loading') return <p className="text-body-sm text-ink-muted">読み込み中…</p>

  return (
    <>
      <p className="text-body-sm text-ink-body">
        スマホと PC など、同じ「同期キー」を入れた端末どうしで、解答記録と設定をまとめます。
        フリーモードの科目と仕訳は同期せず、端末ごとに保存します。
      </p>

      {key ? (
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body-sm">
            <dt className="text-ink-muted">状態</dt>
            <dd role="status">
              {status === 'syncing'
                ? '同期しています…'
                : status === 'error'
                  ? '同期できませんでした'
                  : '同期中の端末です'}
            </dd>
            <dt className="text-ink-muted">最後の同期</dt>
            <dd className="tabular-nums">{formatTime(lastSyncedAt)}</dd>
          </dl>
          {error && <p className="text-body-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => void syncNow()} disabled={status === 'syncing'}>
              今すぐ同期
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowKey((open) => !open)}>
              {showKey ? 'キーを隠す' : 'ほかの端末を追加する'}
            </Button>
          </div>
          {showKey && <KeyCard syncKey={key} />}
          <div className="flex flex-col gap-3 border-t border-line pt-8">
            <p className="text-body-sm text-ink-body">
              この端末の同期をやめます。記録はこの端末に残り、ほかの端末の同期も続きます。
            </p>
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() => setDisconnectOpen(true)}
            >
              同期をやめる
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-ink-body">
              はじめての端末では、同期キーを作ります。作ったあとに表示される QR
              コードを、ほかの端末のカメラで読み取ってください。
            </p>
            <Button type="button" className="self-start" onClick={() => void start()}>
              同期をはじめる
            </Button>
          </div>
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="flex flex-col gap-2.5 border-t border-line pt-8"
          >
            <label htmlFor={inputId} className="text-[13px] font-bold tracking-[0.1em]">
              ほかの端末の同期キーを入力する
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <input
                id={inputId}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="XXXX-XXXX-…"
                className="h-14 min-w-0 flex-1 border-0 border-b border-ink bg-transparent px-1 font-mono text-[15px] tracking-[0.05em] focus:border-b-2 focus:border-ember focus:outline-none"
              />
              <Button type="submit" variant="outline">
                つなぐ
              </Button>
            </div>
          </form>
          {error && <p className="text-body-sm text-destructive">{error}</p>}
        </div>
      )}
      {inputError && <p className="text-body-sm text-destructive">{inputError}</p>}

      <AlertDialog open={pairing !== null} onOpenChange={(open) => !open && setPairing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この端末をつなぎますか</AlertDialogTitle>
            <AlertDialogDescription>
              この端末の解答記録と設定を、同期キー {pairing && formatSyncKey(pairing).slice(0, 9)}…
              の端末とまとめます（記録は両方残り、設定はあとで変えた方にそろいます）。
              {key && key !== pairing && ' 今使っている同期キーからは切り替わります。'}
              心配なときは、先にデータを書き出しておくと安全です。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmPairing()}>つなぐ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>同期をやめますか</AlertDialogTitle>
            <AlertDialogDescription>
              この端末は同期キーを忘れます。あとでまた同期するときは、ほかの端末に表示される同期キーか
              QR コードが必要です。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>やめない</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDisconnect()}>
              同期をやめる
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function KeyCard({ syncKey }: { syncKey: string }) {
  const url = pairingUrl(syncKey)
  const qr = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderSVG(url, { border: 2 }))}`,
    [url],
  )
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(syncKey)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="flex flex-col gap-4 border border-line p-6 sm:flex-row sm:items-center sm:gap-8">
      <img
        src={qr}
        alt="同期用の QR コード"
        width={176}
        height={176}
        className="size-44 bg-white"
      />
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-body-sm text-ink-body">
          ほかの端末のカメラでこの QR コードを読み取るか、下の同期キーを入力してください。
        </p>
        <p className="font-mono text-[15px] tracking-[0.05em] break-all">
          {formatSyncKey(syncKey)}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => void copy()}
        >
          {copied ? 'コピーしました' : 'キーをコピー'}
        </Button>
        <p className="text-caption text-ink-muted">
          このキーを知っている人は、記録を読んだり書き換えたりできます。人に見せたり、SNS
          に載せたりしないでください。
        </p>
      </div>
    </div>
  )
}
