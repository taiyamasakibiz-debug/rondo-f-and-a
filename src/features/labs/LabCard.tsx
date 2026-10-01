import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router'
import { useTopicProgress } from '@/progress/hooks'
import type { Lab } from './labs'

type LabCardProps = {
  lab: Lab
  index: number
}

// Tessera のカード：番号、英字タイトル、和文サブ見出し、説明、右下の丸い矢印
export function LabCard({ lab, index }: LabCardProps) {
  const reduceMotion = useReducedMotion()
  const progress = useTopicProgress(lab.id)
  const number = String(index + 1).padStart(2, '0')

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <Link
        to={`/labs/${lab.id}`}
        className="group flex h-full min-h-60 flex-col gap-4 rounded-xl bg-fog p-8 transition-colors hover:bg-sky-50"
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold tracking-caps text-ink-muted">{number}</span>
          <span className="flex items-center gap-2">
            <span className="rounded-pill border border-line px-3 py-1 text-[11px] font-bold tracking-[0.1em]">
              LV.{progress.level}
            </span>
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[28px] leading-[1.1] font-bold tracking-[-0.04em]">
            {lab.nameEn}
          </span>
          <span className="font-ja text-[15px] font-bold tracking-ja">{lab.name}</span>
        </div>
        <p className="flex-1 text-body-sm text-ink-body">{lab.description}</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-caption text-ink-muted tabular-nums">
            <span>
              {progress.nextLevelXp === null
                ? '最大レベル'
                : `次のレベルまで ${progress.nextLevelXp - progress.xp} XP`}
            </span>
            <span>
              熟練度 {progress.mastery === null ? '—' : `${Math.round(progress.mastery * 100)}%`}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`${lab.name}の次のレベルまでの進み具合`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.progress * 100)}
            className="h-1 overflow-hidden rounded-pill bg-line"
          >
            <motion.div
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${progress.progress * 100}%` }}
              transition={{ duration: 0.8, delay: 0.2 + index * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-pill bg-ink"
            />
          </div>
        </div>
        <span className="flex size-12 items-center justify-center self-end rounded-pill bg-ink text-on-ink transition-transform duration-300 group-hover:translate-x-1">
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </Link>
    </motion.div>
  )
}
