import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { Burst } from '@/components/celebrate/Burst'
import { Sheen } from '@/components/celebrate/Sheen'
import { DigitalLines } from '@/components/DigitalLines'
import { DURATION, EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Mark } from './Mark'

type AnswerFeedbackProps = {
  correct: boolean
  title: string
  /** 正解の演出（波紋と光の帯）を出すか。省略すると正解のときに出す */
  celebrate?: boolean
  children?: ReactNode
}

/**
 * Tessera の AnswerFeedback。回答直後の結果バナー。
 * 淡いグラデーションに白いデジタルラインを重ね、不正解でも大きな赤い面は作らない。
 * 正解のときは ○ から波紋と火花が広がり、光の帯が一度だけ横切る。
 */
export function AnswerFeedback({
  correct,
  title,
  celebrate = correct,
  children,
}: AnswerFeedbackProps) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      role="status"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.enter, ease: EASE_OUT }}
      className={cn(
        'relative flex items-start gap-5 overflow-hidden rounded-lg p-6 md:p-8',
        correct ? 'bg-correct-wash' : 'bg-incorrect-wash',
      )}
    >
      <DigitalLines
        count={10}
        seed={correct ? 3 : 11}
        className="pointer-events-none absolute inset-0 size-full"
      />
      {celebrate && <Sheen delay={0.15} />}
      <span className="relative">
        <Mark correct={correct} size="lg" />
        {celebrate && <Burst delay={0.12} className="text-correct" />}
      </span>
      <div className="relative flex flex-col gap-2">
        <span
          className={cn(
            'text-[13px] font-bold tracking-caps',
            correct ? 'text-correct-text' : 'text-incorrect-text',
          )}
        >
          {correct ? 'CORRECT' : 'INCORRECT'}
        </span>
        <span className="font-ja text-2xl font-bold tracking-ja">{title}</span>
        {children && <div className="text-body-sm text-ink-body">{children}</div>}
      </div>
    </motion.div>
  )
}
