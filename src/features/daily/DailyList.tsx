import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router'
import { ARROW_HOVER } from '@/components/ArrowDot'
import { findLab } from '@/features/labs/labs'
import { Mark } from '@/features/practice/Mark'
import { cn } from '@/lib/utils'
import { findTemplate } from '@/problems'
import { type DailyItem, type DailyReason, dailyPracticePath } from '@/progress/daily'

const REASON_LABELS: Record<DailyReason, { en: string; ja: string }> = {
  review: { en: 'REVIEW', ja: '復習の期日' },
  retry: { en: 'RETRY', ja: '前回の間違い' },
  new: { en: 'NEW', ja: 'はじめての問題' },
  practice: { en: 'PRACTICE', ja: 'しばらくぶり' },
  exam: { en: 'EXAM', ja: '本番形式' },
  intro: { en: 'INTRO', ja: '導入（同じ型を続けて）' },
}

/** 今日のデイリーの問題の一覧。ホームとデイリーのページで使う */
export function DailyList({ items }: { items: readonly DailyItem[] }) {
  const reduceMotion = useReducedMotion()
  return (
    <ol className="flex flex-col">
      {items.map((item, index) => {
        const template = findTemplate(item.templateId)
        const lab = findLab(item.topic)
        const reason = REASON_LABELS[item.reason]
        const done = item.attempt !== undefined
        return (
          <motion.li
            key={`${item.templateId}:${item.seed}`}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-line last:border-b"
          >
            <Link
              to={dailyPracticePath(item)}
              className="group flex items-center gap-4 py-5 md:gap-6"
              aria-label={`${index + 1} 問目：${template?.title ?? item.templateId}（${reason.ja}）${done ? '、解答済み' : ''}`}
            >
              <span className="w-8 shrink-0 text-[13px] font-bold tracking-caps text-ink-muted">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-4">
                <span className="flex shrink-0 gap-2">
                  <span className="rounded-pill border border-line px-3 py-1 text-[11px] font-bold tracking-[0.1em]">
                    {lab?.nameEn.toUpperCase()}
                  </span>
                  <span
                    className={cn(
                      'rounded-pill px-3 py-1 text-[11px] font-bold tracking-[0.1em]',
                      item.reason === 'new' || item.reason === 'intro'
                        ? 'bg-sky-50'
                        : 'border border-line',
                    )}
                  >
                    {reason.en}
                  </span>
                </span>
                <span
                  className={cn(
                    'truncate text-[15px] font-medium tracking-text',
                    !done && 'group-hover:text-ember-text',
                  )}
                >
                  {template?.title ?? item.templateId}
                </span>
              </div>
              {done ? (
                <span className="flex shrink-0 items-center gap-3">
                  <span
                    className={cn(
                      'text-[13px] font-bold tracking-[0.1em] tabular-nums',
                      item.attempt!.allCorrect ? 'text-correct-text' : 'text-incorrect-text',
                    )}
                  >
                    {item.attempt!.allCorrect
                      ? '全問正解'
                      : `${item.attempt!.earned} / ${item.attempt!.total} 点`}
                  </span>
                  <Mark correct={item.attempt!.allCorrect} />
                </span>
              ) : (
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-pill border border-ink',
                    ARROW_HOVER,
                  )}
                  aria-hidden
                >
                  <ArrowRight className="size-4" />
                </span>
              )}
            </Link>
          </motion.li>
        )
      })}
    </ol>
  )
}
