import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { AnswerFeedback } from '@/features/practice/AnswerFeedback'
import { dailyPracticePath, nextDailyItem } from '@/progress/daily'
import { useStreak } from '@/progress/hooks'
import { useProgressStore } from '@/progress/store'
import { DailyList } from './DailyList'
import { useDaily } from './useDaily'

export function DailyPage() {
  const status = useProgressStore((state) => state.status)
  const plan = useDaily()
  const streak = useStreak()
  const next = nextDailyItem(plan)

  return (
    <>
      <PageHeader
        title="Daily"
        subtitle="今日のデイリー"
        description="復習の期日が来た問題と、まだ解いていない問題から選んだ今日のおすすめです。1 日の間は同じ問題が並びます。ストリークは、この一覧以外の問題を解いても数えます。"
      />
      {status === 'loading' ? null : (
        <div className="flex flex-col gap-10">
          {plan.complete && (
            <AnswerFeedback correct title="今日のデイリー達成">
              ストリークは {streak.current} 日になりました。明日も続けましょう。
            </AnswerFeedback>
          )}
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[13px] font-bold tracking-caps text-ink-muted">
              {plan.day.replaceAll('-', '.')}
            </span>
            <span className="text-label tabular-nums">
              {plan.doneCount} / {plan.items.length} 問
            </span>
          </div>
          <DailyList items={plan.items} />
          {next && (
            <Button asChild size="lg" className="self-start pr-2">
              <Link to={dailyPracticePath(next)}>
                {plan.doneCount === 0 ? 'はじめる' : 'つづける'}
                <span
                  data-icon="inline-end"
                  className="flex size-10 items-center justify-center rounded-pill bg-on-ink text-ink"
                >
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            </Button>
          )}
        </div>
      )}
    </>
  )
}
