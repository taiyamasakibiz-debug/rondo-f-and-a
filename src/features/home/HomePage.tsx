import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { DigitalLines } from '@/components/DigitalLines'
import { Button } from '@/components/ui/button'
import { DailyList } from '@/features/daily/DailyList'
import { useDaily } from '@/features/daily/useDaily'
import { LabCard } from '@/features/labs/LabCard'
import { LABS } from '@/features/labs/labs'
import { useStreak } from '@/progress/hooks'
import { dailyPracticePath, nextDailyItem } from '@/progress/daily'
import { useProgressStore } from '@/progress/store'

export function HomePage() {
  const streak = useStreak()
  const dailyGoal = useProgressStore((state) => state.settings.dailyGoal)
  const status = useProgressStore((state) => state.status)
  const plan = useDaily()
  const next = nextDailyItem(plan)
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
              <dd className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold tracking-snug tabular-nums">
                  {streak.todayCount}
                </span>
                <span className="font-ja text-[15px] text-ink-body">問</span>
                <span className="font-ja text-[13px] text-ink-muted">
                  （ノルマ {dailyGoal} 問{streak.todayGoalMet ? '・達成' : ''}）
                </span>
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
          {status !== 'loading' && (
            <Button asChild size="lg" className="mt-2 self-start pr-2">
              <Link to={next ? dailyPracticePath(next) : '/daily'}>
                {plan.complete
                  ? '今日の結果を見る'
                  : plan.doneCount === 0
                    ? 'はじめる'
                    : 'つづける'}
                {/* 画面の中でオレンジを置くのはここだけ（Tessera：オレンジは点） */}
                <span
                  data-icon="inline-end"
                  className="flex size-10 items-center justify-center rounded-pill bg-ember text-[#121213]"
                >
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            </Button>
          )}
        </div>
      </section>

      <section aria-labelledby="daily-heading" className="mb-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h2 id="daily-heading" className="flex items-baseline gap-4">
              <span className="text-[13px] font-bold tracking-caps text-ink-muted">01</span>
              <span className="text-[32px] leading-[1.1] font-bold tracking-[-0.04em] md:text-[44px]">
                Daily
              </span>
            </h2>
            <p className="text-sub-ja text-ink-muted">今日のおすすめ {plan.items.length} 問</p>
          </div>
          <span className="text-label tabular-nums">
            {plan.doneCount} / {plan.items.length} 済み
          </span>
        </div>
        {status !== 'loading' && <DailyList items={plan.items} />}
      </section>

      <section aria-labelledby="labs-heading">
        <div className="mb-8 flex flex-col gap-2">
          <h2 id="labs-heading" className="flex items-baseline gap-4">
            <span className="text-[13px] font-bold tracking-caps text-ink-muted">02</span>
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
