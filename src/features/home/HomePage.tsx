import { DigitalLines } from '@/components/DigitalLines'
import { LabCard } from '@/features/labs/LabCard'
import { LABS } from '@/features/labs/labs'
import { useStreak } from '@/progress/hooks'
import { useProgressStore } from '@/progress/store'

// 今日のデイリー、ストリーク、レベル一覧はフェーズ 5 で作る
export function HomePage() {
  const streak = useStreak()
  const dailyGoal = useProgressStore((state) => state.settings.dailyGoal)
  return (
    <>
      <section className="relative -mx-4 mb-16 overflow-hidden bg-sky-wash px-5 py-16 md:mx-0 md:rounded-xl md:px-16 md:py-24">
        <DigitalLines className="pointer-events-none absolute inset-0 size-full" />
        <div className="relative flex flex-col gap-6">
          <p className="font-ja text-lg font-bold tracking-ja text-ink-muted md:text-2xl">
            今日のデイリー
          </p>
          <h1 className="text-[52px] leading-[0.95] font-bold tracking-tight md:text-[96px]">
            Daily
            <br />
            Training.
          </h1>
          <dl className="flex flex-wrap gap-x-10 gap-y-4">
            <div className="flex flex-col gap-1">
              <dt className="text-[13px] font-bold tracking-caps text-ink-muted">TODAY</dt>
              <dd className="text-[28px] font-bold tracking-snug tabular-nums">
                {streak.todayCount} / {dailyGoal}
                <span className="ml-2 font-ja text-[15px] text-ink-body">問</span>
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[13px] font-bold tracking-caps text-ink-muted">STREAK</dt>
              <dd className="text-[28px] font-bold tracking-snug tabular-nums">
                {streak.current}
                <span className="ml-2 font-ja text-[15px] text-ink-body">日</span>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="labs-heading">
        <div className="mb-8 flex flex-col gap-2">
          <h2 id="labs-heading" className="flex items-baseline gap-4">
            <span className="text-[13px] font-bold tracking-caps text-ink-muted">01</span>
            <span className="text-[32px] leading-[1.1] font-bold tracking-[-0.04em] md:text-[44px]">
              Labs
            </span>
          </h2>
          <p className="text-sub-ja text-ink-muted">ラボ</p>
        </div>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LABS.map((lab, index) => (
            <li key={lab.id}>
              <LabCard lab={lab} index={index} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
