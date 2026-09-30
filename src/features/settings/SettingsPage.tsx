import { type ChangeEvent, type ReactNode, useId, useRef, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
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
import { useProgressStore } from '@/progress/store'

const GOAL_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour)

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="設定" />
      <div className="flex flex-col gap-16">
        <DailySection />
        <DataSection />
      </div>
    </>
  )
}

function Section({ en, ja, children }: { en: string; ja: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-12">
      <div className="flex flex-col gap-2">
        <h2 className="text-[28px] leading-[1.1] font-bold tracking-[-0.04em]">{en}</h2>
        <p className="text-sub-ja text-ink-muted">{ja}</p>
      </div>
      <div className="flex flex-col gap-8">{children}</div>
    </section>
  )
}

/** Tessera の TextField と同じ下線だけのセレクト */
function SelectField({
  label,
  help,
  value,
  options,
  format,
  onChange,
}: {
  label: string
  help: string
  value: number
  options: readonly number[]
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className="text-[13px] font-bold tracking-[0.1em]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-describedby={`${id}-help`}
        className="h-14 max-w-xs border-0 border-b border-ink bg-transparent px-1 text-[17px] tracking-text focus:border-b-2 focus:border-ember focus:outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {format(option)}
          </option>
        ))}
      </select>
      <span id={`${id}-help`} className="text-caption text-ink-muted">
        {help}
      </span>
    </div>
  )
}

function DailySection() {
  const settings = useProgressStore((state) => state.settings)
  const updateSettings = useProgressStore((state) => state.updateSettings)
  return (
    <Section en="Daily" ja="デイリー">
      <SelectField
        label="1 日のノルマ"
        help="この問題数を解くと、その日のデイリー達成になります。"
        value={settings.dailyGoal}
        options={GOAL_OPTIONS}
        format={(value) => `${value} 問`}
        onChange={(dailyGoal) => void updateSettings({ dailyGoal })}
      />
      <SelectField
        label="日付の切り替わり時刻"
        help="この時刻より前の解答は、前の日の分として数えます。"
        value={settings.dayStartHour}
        options={HOUR_OPTIONS}
        format={(value) => `${value}:00`}
        onChange={(dayStartHour) => void updateSettings({ dayStartHour })}
      />
    </Section>
  )
}

type Pending = { json: string; attempts: number; fileName: string } | null

function DataSection() {
  const status = useProgressStore((state) => state.status)
  const attemptCount = useProgressStore((state) => state.attempts.length)
  const exportData = useProgressStore((state) => state.exportData)
  const importData = useProgressStore((state) => state.importData)
  const resetAll = useProgressStore((state) => state.resetAll)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleExport = () => {
    const data = exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `luminous-insight-${data.exportedAt.slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage(`${data.attempts.length} 件の解答記録を書き出しました。`)
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const json = await file.text()
    // 形式の確認だけ先に行い、上書きの確認ダイアログで件数を見せる
    try {
      const attempts = (JSON.parse(json) as { attempts?: unknown[] }).attempts?.length ?? 0
      setPending({ json, attempts, fileName: file.name })
    } catch {
      setMessage('JSON として読み取れませんでした。')
    }
  }

  const confirmImport = async () => {
    if (!pending) return
    const result = await importData(pending.json)
    setPending(null)
    setMessage(result.ok ? `${result.attempts} 件の解答記録を読み込みました。` : result.message)
  }

  const confirmReset = async () => {
    await resetAll()
    setResetOpen(false)
    setMessage('すべての記録を消去しました。')
  }

  return (
    <Section en="Data" ja="データ">
      <p className="text-body-sm text-ink-body">
        記録はこの端末のブラウザの中だけに保存されています（{attemptCount}{' '}
        件）。別の端末に移すときや、バックアップを取るときは書き出してください。
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleExport} disabled={status !== 'ready'}>
          書き出す
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInput.current?.click()}
          disabled={status !== 'ready'}
        >
          読み込む
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="hidden"
          aria-hidden
          tabIndex={-1}
        />
      </div>
      <div className="flex flex-col gap-3 border-t border-line pt-8">
        <p className="text-body-sm text-ink-body">
          すべての解答記録と設定を消去します。元に戻せないので、先に書き出しておくと安全です。
        </p>
        <Button
          type="button"
          variant="destructive"
          className="self-start"
          onClick={() => setResetOpen(true)}
          disabled={status !== 'ready'}
        >
          すべて消去する
        </Button>
      </div>
      {message && (
        <p role="status" className="text-body-sm text-ink-body">
          {message}
        </p>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>記録を読み込みますか</AlertDialogTitle>
            <AlertDialogDescription>
              「{pending?.fileName}」の {pending?.attempts} 件で、今の記録（{attemptCount}{' '}
              件）と設定を置き換えます。今の記録は消えます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmImport()}>置き換える</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>すべての記録を消去しますか</AlertDialogTitle>
            <AlertDialogDescription>
              解答記録 {attemptCount} 件と設定を消去します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmReset()}>
              消去する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  )
}
