import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { feedback } from '@/feedback'
import { useFeedbackPreferences } from '@/feedback/preferences'
import { cn } from '@/lib/utils'

/** オン・オフのスイッチ（Tessera のピル型） */
function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string
  help: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex flex-col gap-1">
        <span id={`${id}-label`} className="text-[13px] font-bold tracking-[0.1em]">
          {label}
        </span>
        <span id={`${id}-help`} className="text-caption text-ink-muted">
          {help}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-help`}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-8 w-14 shrink-0 rounded-pill border transition-colors focus-visible:ring-2 focus-visible:ring-ember focus-visible:outline-none',
          checked ? 'border-ink bg-ink' : 'border-line bg-fog',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-1 left-1 size-5.5 rounded-pill transition-transform duration-200',
            checked ? 'translate-x-6 bg-on-ink' : 'bg-ink-muted',
          )}
        />
      </button>
    </div>
  )
}

function Volume({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-4 pl-1">
      <label htmlFor={id} className="w-20 shrink-0 text-caption text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="h-1.5 flex-1 accent-ink disabled:opacity-40"
      />
      <span className="w-10 text-right text-caption text-ink-muted tabular-nums">
        {Math.round(value * 100)}
      </span>
    </div>
  )
}

/**
 * 設定画面の「効果音と BGM」。端末ごとの好みなので、ほかの端末とは同期しない。
 */
export function FeedbackPanel() {
  const preferences = useFeedbackPreferences()
  const { update } = preferences
  return (
    <>
      <div className="flex flex-col gap-4">
        <Toggle
          label="効果音"
          help="採点・レベルアップ・ストリーク・認定のときに鳴らします。"
          checked={preferences.se}
          onChange={(se) => update({ se })}
        />
        <Volume
          label="効果音の音量"
          value={preferences.seVolume}
          disabled={!preferences.se}
          onChange={(seVolume) => update({ seVolume })}
        />
      </div>
      <div className="flex flex-col gap-4">
        <Toggle
          label="BGM"
          help="ゆっくりした環境音楽を流します。毎回少しずつ違う曲になります。"
          checked={preferences.bgm}
          onChange={(bgm) => update({ bgm })}
        />
        <Volume
          label="BGM の音量"
          value={preferences.bgmVolume}
          disabled={!preferences.bgm}
          onChange={(bgmVolume) => update({ bgmVolume })}
        />
      </div>
      <p className="text-caption text-ink-muted">
        iPhone では、マナーモードのときは効果音と BGM が鳴りません。効果音と BGM
        の設定は、この端末だけに保存されます。
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => feedback('correct')}>
          正解の音を試す
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => feedback('levelUp')}>
          レベルアップの音を試す
        </Button>
      </div>
    </>
  )
}
