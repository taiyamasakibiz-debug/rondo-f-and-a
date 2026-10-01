import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { Burst } from '@/components/celebrate/Burst'
import { Sheen } from '@/components/celebrate/Sheen'
import { DigitalLines } from '@/components/DigitalLines'
import { feedbackLater } from '@/feedback'
import { DURATION, EASE_OUT, SPRING_SOFT } from '@/lib/motion'
import type { Tier } from '@/progress/certification'
import { CertBadge } from './CertBadge'

/** 波紋の色。バッジの点と同じ（オレンジはいちばん上の認定だけ） */
const BURST_COLOR: Record<Tier, string> = {
  bronze: 'text-stone',
  silver: 'text-mist',
  gold: 'text-ember',
}

/** 枠線を描く時間と、バッジが押されるまでの時間（秒） */
const DRAW = 0.8
const STAMP_AT = 0.3 + DRAW * 0.7

/**
 * 認定テストに合格したときの「認定証」。
 * 枠線が一筆で描かれ、描き終わる直前にバッジが押されて波紋が広がり、光の帯が横切る。
 */
export function CertifiedCard({ tier, labName }: { tier: Tier; labName: string }) {
  const reduceMotion = useReducedMotion()
  // バッジが押される瞬間に鳴らす
  useEffect(() => feedbackLater('certified', STAMP_AT), [])
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.enter, delay: 0.2, ease: EASE_OUT }}
      className="relative flex w-full max-w-sm flex-col items-center gap-4 self-center overflow-hidden rounded-xl bg-sky-wash px-10 py-10"
    >
      <DigitalLines
        count={10}
        seed={5}
        className="pointer-events-none absolute inset-0 size-full"
      />
      {/* 一筆で描く枠線 */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-2 size-[calc(100%-1rem)] overflow-visible"
      >
        <motion.rect
          width="100%"
          height="100%"
          rx="20"
          fill="none"
          stroke="var(--ink)"
          strokeOpacity={0.35}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: DRAW, delay: 0.3, ease: EASE_OUT }}
        />
      </svg>
      <Sheen delay={STAMP_AT + 0.1} />
      <span className="relative text-[13px] font-bold tracking-caps text-ink-muted">CERTIFIED</span>
      <motion.span
        className="relative"
        initial={reduceMotion ? false : { scale: 1.6, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ ...SPRING_SOFT, stiffness: 380, damping: 16, delay: STAMP_AT }}
      >
        <CertBadge tier={tier} className="bg-white/70 px-5 py-2 text-[15px] dark:bg-transparent" />
        <Burst delay={STAMP_AT + 0.08} sparks={14} className={BURST_COLOR[tier]} />
      </motion.span>
      <span className="relative font-ja text-[13px] text-ink-muted">{labName}</span>
    </motion.div>
  )
}
