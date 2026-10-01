import { motion, useReducedMotion } from 'motion/react'
import { DURATION, EASE_OUT } from '@/lib/motion'

/**
 * カードの上を一度だけ横切る光の帯（正解・認定のとき）。
 * 親は position: relative と overflow: hidden にしておく。
 */
export function Sheen({ delay = 0 }: { delay?: number }) {
  const reduceMotion = useReducedMotion()
  if (reduceMotion) return null
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/70 to-transparent dark:via-white/10"
      initial={{ x: '-120%' }}
      animate={{ x: '420%' }}
      transition={{ duration: DURATION.fill, delay, ease: EASE_OUT }}
    />
  )
}
