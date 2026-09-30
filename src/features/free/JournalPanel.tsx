import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type FormEvent, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { JournalAnswer } from '@/engine/types'
import { JournalField } from '@/features/practice/JournalField'
import { useLedgerStore } from '@/ledger/store'
import type { LedgerEntry } from '@/ledger/types'
import { Panel } from './Panel'

const EMPTY: JournalAnswer = { debits: [], credits: [] }

export function JournalPanel() {
  const accounts = useLedgerStore((state) => state.accounts)
  const entries = useLedgerStore((state) => state.entries)
  const addEntry = useLedgerStore((state) => state.addEntry)
  const closeBooks = useLedgerStore((state) => state.closeBooks)
  const startWithStarterAccounts = useLedgerStore((state) => state.startWithStarterAccounts)
  const descriptionId = useId()
  const [description, setDescription] = useState('')
  const [answer, setAnswer] = useState<JournalAnswer>(EMPTY)
  // 記帳したら入力欄を空に戻すため、JournalField を作り直す
  const [formKey, setFormKey] = useState(0)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const result = await addEntry({ description, ...answer })
    if (!result.ok) {
      setMessage({ error: true, text: result.message })
      return
    }
    setDescription('')
    setAnswer(EMPTY)
    setFormKey((key) => key + 1)
    setMessage({ error: false, text: '記帳しました。' })
  }

  const handleClose = async () => {
    const result = await closeBooks()
    setMessage(
      result.ok
        ? { error: false, text: '決算振替を記帳しました。' }
        : { error: true, text: result.message },
    )
  }

  return (
    <Panel id="journal">
      {accounts.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-md bg-sky-50 p-5">
          <p className="text-body-sm text-ink-body">
            記帳するには勘定科目が必要です。よく使う 20 の科目をまとめて用意するか、科目マスターで 1
            つずつ作成してください。
          </p>
          <Button
            type="button"
            className="self-start"
            onClick={() => void startWithStarterAccounts()}
          >
            標準の科目で始める
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <label htmlFor={descriptionId} className="text-[13px] font-bold tracking-[0.1em]">
              取引の説明
            </label>
            <input
              id={descriptionId}
              type="text"
              value={description}
              maxLength={100}
              autoComplete="off"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="例：商品を掛けで仕入れた"
              className="h-12 border-0 border-b border-ink bg-transparent px-1 text-[16px] tracking-text placeholder:text-ink-muted focus:border-b-2 focus:border-ember focus:outline-none"
            />
          </div>
          <JournalField
            key={formKey}
            id="free-entry"
            prompt="仕訳"
            accounts={accounts}
            onChange={setAnswer}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">記帳する</Button>
            <Button type="button" variant="outline" onClick={() => void handleClose()}>
              決算振替
            </Button>
          </div>
          {message && (
            <p
              role={message.error ? 'alert' : 'status'}
              className={message.error ? 'text-body-sm text-ink' : 'text-body-sm text-ink-muted'}
            >
              {message.text}
            </p>
          )}
        </form>
      )}
      <JournalBook entries={entries} />
    </Panel>
  )
}

function JournalBook({ entries }: { entries: readonly LedgerEntry[] }) {
  const accounts = useLedgerStore((state) => state.accounts)
  const reverseEntry = useLedgerStore((state) => state.reverseEntry)
  const deleteEntry = useLedgerStore((state) => state.deleteEntry)
  const restoreEntry = useLedgerStore((state) => state.restoreEntry)
  const reduceMotion = useReducedMotion()
  const [deleted, setDeleted] = useState<LedgerEntry | null>(null)
  const nameOf = (id: string) => accounts.find((account) => account.id === id)?.name ?? '不明な科目'

  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-6">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-bold tracking-[0.1em]">仕訳帳</span>
        <span className="text-caption text-ink-muted">{entries.length} 件</span>
      </div>
      {deleted && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-md bg-fog px-4 py-3"
        >
          <span className="text-body-sm">「{deleted.description}」を削除しました。</span>
          <button
            type="button"
            className="text-tag underline underline-offset-4"
            onClick={() => {
              void restoreEntry(deleted)
              setDeleted(null)
            }}
          >
            元に戻す
          </button>
        </div>
      )}
      <ol className="flex flex-col">
        <AnimatePresence initial={false}>
          {[...entries].reverse().map((entry) => (
            <motion.li
              key={entry.id}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-2 border-b border-line-soft py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-2 text-[14px] font-bold tracking-text">
                  {entry.kind !== 'normal' && (
                    <span className="rounded-pill border border-line px-2.5 py-0.5 text-[10px] tracking-[0.1em]">
                      {entry.kind === 'closing' ? 'CLOSING' : 'REVERSAL'}
                    </span>
                  )}
                  {entry.description}
                </span>
                <span className="flex shrink-0 gap-3 text-caption">
                  {entry.kind === 'normal' && (
                    <button
                      type="button"
                      className="text-ink-muted hover:text-ink"
                      onClick={() => void reverseEntry(entry.id)}
                    >
                      取消
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-ink-muted hover:text-ink"
                    onClick={() => {
                      void deleteEntry(entry.id)
                      setDeleted(entry)
                    }}
                  >
                    削除
                  </button>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[13px] tabular-nums">
                <div className="flex flex-col gap-1">
                  {entry.debits.map((line, i) => (
                    <span key={i} className="flex justify-between gap-2">
                      <span className="text-ink-body">{nameOf(line.accountId)}</span>
                      <span>{line.amount.toLocaleString('ja-JP')}</span>
                    </span>
                  ))}
                </div>
                <div className="flex flex-col gap-1">
                  {entry.credits.map((line, i) => (
                    <span key={i} className="flex justify-between gap-2">
                      <span className="text-ink-body">{nameOf(line.accountId)}</span>
                      <span>{line.amount.toLocaleString('ja-JP')}</span>
                    </span>
                  ))}
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  )
}
