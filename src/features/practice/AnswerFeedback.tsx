import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { DigitalLines } from '@/components/DigitalLines'
import { cn } from '@/lib/utils'
import { Mark } from './Mark'

type AnswerFeedbackProps = {
  correct: boolean
  title: string
  children?: ReactNode
}

/**
 * Tessera の AnswerFeedback。回答直後の結果バナー。
 * 淡いグラデーションに白いデジタルラインを重ね、不正解でも大きな赤い面は作らない。
 */
export function AnswerFeedback({ correct, title, children }: AnswerFeedbackProps) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      role="status"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
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
      <Mark correct={correct} size="lg" className="relative" />
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
