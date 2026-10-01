import { motion, useReducedMotion } from 'motion/react'
import { SPRING_POP } from '@/lib/motion'
import { cn } from '@/lib/utils'

type MarkProps = {
  correct: boolean
  size?: 'sm' | 'lg'
  /** 出るまでの時間（秒）。採点結果を上から順に出すときに使う */
  delay?: number
  className?: string
}

/**
 * Tessera の ○／× マーク。淡い色の丸に黒い記号。
 * 色だけで伝えないため、必ず「正解」「不正解」の文字と一緒に使う。
 */
export function Mark({ correct, size = 'sm', delay = 0, className }: MarkProps) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.span
      initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...SPRING_POP, delay }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-pill',
        correct ? 'bg-correct text-on-correct' : 'bg-incorrect text-on-incorrect',
        size === 'sm' ? 'size-7' : 'size-12',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 16 16" fill="none" className={size === 'sm' ? 'size-3.5' : 'size-5.5'}>
        {correct ? (
          <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="2" />
        ) : (
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" />
        )}
      </svg>
    </motion.span>
  )
}
