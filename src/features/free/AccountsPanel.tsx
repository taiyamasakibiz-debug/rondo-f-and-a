import { type FormEvent, useId, useState } from 'react'
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
import {
  CATEGORIES,
  type Category,
  MAJOR_CATEGORY_LABELS,
  type MajorCategory,
  suggestCategory,
} from '@/domain/accounting/categories'
import { accountsByMajor, useLedgerStore } from '@/ledger/store'
import { Panel } from './Panel'

const MAJORS = Object.keys(MAJOR_CATEGORY_LABELS) as MajorCategory[]
const CATEGORY_ENTRIES = Object.entries(CATEGORIES) as [Category, (typeof CATEGORIES)[Category]][]

export function AccountsPanel() {
  const accounts = useLedgerStore((state) => state.accounts)
  const addAccount = useLedgerStore((state) => state.addAccount)
  const removeAccount = useLedgerStore((state) => state.removeAccount)
  const startWithStarterAccounts = useLedgerStore((state) => state.startWithStarterAccounts)
  const reset = useLedgerStore((state) => state.reset)
  const nameId = useId()
  const categoryId = useId()
  const [name, setName] = useState('')
  // 区分は必ずユーザーが選ぶ。名前からの推測は、まだ選んでいないときの初期値の提案だけ
  const [category, setCategory] = useState<Category | ''>('')
  const [touchedCategory, setTouchedCategory] = useState(false)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  const handleName = (value: string) => {
    setName(value)
    if (!touchedCategory) setCategory(suggestCategory(value) ?? '')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!category) {
      setMessage({ error: true, text: '区分を選んでください。' })
      return
    }
    const result = await addAccount(name, category)
    if (!result.ok) {
      setMessage({ error: true, text: result.message })
      return
    }
    setMessage({ error: false, text: `「${name.trim()}」を追加しました。` })
    setName('')
    setCategory('')
    setTouchedCategory(false)
  }

  const groups = accountsByMajor(accounts)

  return (
    <Panel id="accounts">
      {accounts.length === 0 && (
        <div className="flex flex-col gap-3 rounded-md bg-sky-50 p-5">
          <p className="text-body-sm text-ink-body">
            現金預金・売掛金・売上高・売上原価など、よく使う 20 の科目をまとめて用意できます。
          </p>
          <Button
            type="button"
            className="self-start"
            onClick={() => void startWithStarterAccounts()}
          >
            標準の科目で始める
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="flex flex-col gap-2.5">
          <label htmlFor={nameId} className="text-[13px] font-bold tracking-[0.1em]">
            科目名
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={30}
            autoComplete="off"
            onChange={(event) => handleName(event.target.value)}
            className="h-12 border-0 border-b border-ink bg-transparent px-1 text-[16px] tracking-text focus:border-b-2 focus:border-ember focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-2.5">
          <label htmlFor={categoryId} className="text-[13px] font-bold tracking-[0.1em]">
            区分
          </label>
          <select
            id={categoryId}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as Category | '')
              setTouchedCategory(true)
            }}
            className="h-12 border-0 border-b border-ink bg-transparent px-1 text-[15px] tracking-text focus:border-b-2 focus:border-ember focus:outline-none"
          >
            <option value="">区分を選ぶ</option>
            {MAJORS.map((major) => (
              <optgroup key={major} label={MAJOR_CATEGORY_LABELS[major]}>
                {CATEGORY_ENTRIES.filter(([, def]) => def.major === major).map(([key, def]) => (
                  <option key={key} value={key}>
                    {def.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <Button type="submit">追加する</Button>
      </form>
      {message && (
        <p role={message.error ? 'alert' : 'status'} className="text-body-sm text-ink-body">
          {message.text}
        </p>
      )}

      {accounts.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {MAJORS.filter((major) => groups.has(major)).map((major) => (
            <div key={major} className="flex flex-col">
              <span className="border-b border-line pb-2 text-[13px] font-bold tracking-[0.1em]">
                {MAJOR_CATEGORY_LABELS[major]}
              </span>
              {groups.get(major)!.map((account) => (
                <div
                  key={account.id}
                  className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2 text-[14px]"
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{account.name}</span>
                    <span className="text-caption text-ink-muted">
                      {CATEGORIES[account.category].label}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-caption text-ink-muted hover:text-ink"
                    onClick={async () => {
                      const result = await removeAccount(account.id)
                      setMessage(
                        result.ok
                          ? { error: false, text: `「${account.name}」を削除しました。` }
                          : { error: true, text: result.message },
                      )
                    }}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {accounts.length > 0 && (
        <div className="border-t border-line pt-6">
          <Button type="button" variant="destructive" onClick={() => setResetOpen(true)}>
            フリーモードを初期化する
          </Button>
        </div>
      )}

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>フリーモードを初期化しますか</AlertDialogTitle>
            <AlertDialogDescription>
              すべての勘定科目と仕訳を消去します。解答記録や設定は消えません。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                void reset()
                setResetOpen(false)
              }}
            >
              初期化する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  )
}
