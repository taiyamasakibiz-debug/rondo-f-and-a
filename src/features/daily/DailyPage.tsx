import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowDot } from '@/components/ArrowDot'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { feedbackLater } from '@/feedback'
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
  // 最後の問題を解いて来たときだけ、達成の演出を出す（あとで開き直したときは静かに表示する）
  const location = useLocation()
  const justCompleted =
    (location.state as { justCompleted?: boolean } | null)?.justCompleted === true
  useEffect(() => (justCompleted ? feedbackLater('correct', 0.1) : undefined), [justCompleted])

  return (
    <>
      <PageHeader
        title="Daily"
        subtitle="今日のデイリー"
        description="復習の期日が来た問題と、新しい問題から選んだ今日のおすすめです。"
      />
      {status === 'loading' ? null : (
        <div className="flex flex-col gap-10">
          {plan.complete && (
            <AnswerFeedback correct celebrate={justCompleted} title="今日のデイリー達成">
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
                <ArrowDot />
              </Link>
            </Button>
          )}
        </div>
      )}
    </>
  )
}
