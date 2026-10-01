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
import {
  type Backup,
  createBackup,
  describeBackup,
  parseBackup,
  restoreBackup,
} from '@/data/backup'
import { useLedgerStore } from '@/ledger/store'
import { PHASE_LABELS } from '@/progress/phase'
import { usePhase } from '@/progress/hooks'
import { useProgressStore } from '@/progress/store'
import { liveAttempts } from '@/progress/types'
import { FeedbackPanel } from './FeedbackPanel'
import { SyncPanel } from './SyncPanel'

const GOAL_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour)

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="設定" />
      <div className="flex flex-col gap-16">
        <DailySection />
        <ScheduleSection />
        <Section en="Sound" ja="効果音と BGM">
          <FeedbackPanel />
        </Section>
        <Section en="Sync" ja="端末間の同期">
          <SyncPanel />
        </Section>
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

/** Tessera の TextField と同じ下線だけの日付・月の入力 */
function DateField({
  label,
  help,
  type,
  value,
  onChange,
}: {
  label: string
  help: string
  type: 'month' | 'date'
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className="text-[13px] font-bold tracking-[0.1em]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        // 入力の途中で消したときは、変えない
        onChange={(event) => event.target.value && onChange(event.target.value)}
        aria-describedby={`${id}-help`}
        className="h-14 max-w-xs border-0 border-b border-ink bg-transparent px-1 text-[17px] tracking-text focus:border-b-2 focus:border-ember focus:outline-none"
      />
      <span id={`${id}-help`} className="text-caption text-ink-muted">
        {help}
      </span>
    </div>
  )
}

function ScheduleSection() {
  const settings = useProgressStore((state) => state.settings)
  const updateSettings = useProgressStore((state) => state.updateSettings)
  const { phase, endsOn, daysLeft } = usePhase()
  const label = PHASE_LABELS[phase]
  return (
    <Section en="Schedule" ja="学習スケジュール">
      <div className="flex flex-col gap-1 rounded-md bg-fog p-5">
        <span className="text-caption text-ink-muted">今の局面</span>
        <span className="font-ja text-[17px] font-bold tracking-ja">
          {label.name}
          {daysLeft !== null && endsOn && (
            <span className="ml-3 text-label font-normal text-ink-muted tabular-nums">
              {endsOn} まで あと {daysLeft} 日
            </span>
          )}
        </span>
        <span className="text-caption text-ink-muted">{label.description}</span>
      </div>
      <DateField
        label="財務・会計をマスターしたい月"
        help="この月の末日までが「マスター期間」です。そのあとは「維持期間」になり、新しい問題は出さずに復習の間隔を長くします。"
        type="month"
        value={settings.masteryMonth}
        onChange={(masteryMonth) => void updateSettings({ masteryMonth })}
      />
      <DateField
        label="1 次試験の日"
        help="この日の 30 日前から「直前期」になり、本番形式の問題と弱点の復習を中心に出します。日付は仮です。決まったら変えてください。"
        type="date"
        value={settings.firstExamDate}
        onChange={(firstExamDate) => void updateSettings({ firstExamDate })}
      />
      <DateField
        label="2 次試験の日"
        help="この日までが直前期です。"
        type="date"
        value={settings.secondExamDate}
        onChange={(secondExamDate) => void updateSettings({ secondExamDate })}
      />
    </Section>
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

type Pending = { backup: Backup; fileName: string } | null

function DataSection() {
  const status = useProgressStore((state) => state.status)
  const attemptCount = useProgressStore((state) => liveAttempts(state.attempts).length)
  const ledgerStatus = useLedgerStore((state) => state.status)
  // 書き出し・読み込みは、解答記録とフリーモードの両方を読み込み終えてから
  const ready = status === 'ready' && ledgerStatus === 'ready'
  const resetAll = useProgressStore((state) => state.resetAll)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleExport = () => {
    const progress = useProgressStore.getState()
    const ledger = useLedgerStore.getState()
    const data = createBackup(
      { attempts: progress.attempts, settings: progress.settings },
      { accounts: ledger.accounts, entries: ledger.entries },
    )
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `luminous-insight-${data.exportedAt.slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage(
      `解答記録 ${liveAttempts(data.attempts).length} 件と、フリーモードの仕訳 ${data.ledger.entries.length} 件を書き出しました。`,
    )
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const parsed = parseBackup(await file.text())
    if (!parsed.ok) {
      setMessage(parsed.message)
      return
    }
    // 置き換える前に、確認ダイアログで何が変わるかを見せる
    setPending({ backup: parsed.backup, fileName: file.name })
  }

  const confirmImport = async () => {
    if (!pending) return
    const { backup } = pending
    setPending(null)
    try {
      await restoreBackup(backup, {
        replaceProgress: useProgressStore.getState().replaceAll,
        replaceLedger: useLedgerStore.getState().replaceAll,
      })
      setMessage(`読み込みました（${describeBackup(backup)}）。`)
    } catch (error) {
      console.error('バックアップの読み込みに失敗しました', error)
      setMessage('読み込みの途中で保存に失敗しました。もう一度試してください。')
    }
  }

  const confirmReset = async () => {
    await resetAll()
    setResetOpen(false)
    setMessage('すべての記録を消去しました。')
  }

  return (
    <Section en="Data" ja="データ">
      <p className="text-body-sm text-ink-body">
        解答記録（{attemptCount}{' '}
        件）・設定・フリーモードの科目と仕訳は、この端末のブラウザの中に保存されています（同期している端末では、解答記録と設定はサーバーにも保存されます）。バックアップを取るときは書き出してください。
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleExport} disabled={!ready}>
          書き出す
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInput.current?.click()}
          disabled={!ready}
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
          すべての解答記録と設定を消去します（フリーモードは、フリーモードの科目マスターから初期化できます）。元に戻せないので、先に書き出しておくと安全です。
        </p>
        <Button
          type="button"
          variant="destructive"
          className="self-start"
          onClick={() => setResetOpen(true)}
          disabled={!ready}
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
              「{pending?.fileName}」の内容（{pending && describeBackup(pending.backup)}
              ）で、今のデータを置き換えます。置き換えたデータは元に戻せません。
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
