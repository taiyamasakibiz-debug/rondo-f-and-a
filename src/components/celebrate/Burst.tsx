import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { DURATION, EASE_OUT } from '@/lib/motion'

type BurstProps = {
  /** 始まるまでの時間（秒） */
  delay?: number
  /** 火花（放射状の短い線）の本数。0 なら波紋だけ */
  sparks?: number
  /** 色は currentColor を使う（text-correct など） */
  className?: string
}

/**
 * 正解・レベルアップ・認定のときの「波紋と火花」。
 * 親（position: relative）の中央から、細い輪が広がって消え、短い線が外へ散る。
 * デジタルラインと同じく細い線だけで作り、面で塗らない（派手にしすぎない）。
 * 視差効果を減らす設定では出さない。
 */
export function Burst({ delay = 0, sparks = 10, className }: BurstProps) {
  const reduceMotion = useReducedMotion()
  if (reduceMotion) return null
  return (
    <span
      aria-hidden
      data-testid="burst"
      className={cn(
        'pointer-events-none absolute top-1/2 left-1/2 size-0 overflow-visible',
        className,
      )}
    >
      {[0, 0.12].map((offset, i) => (
        <motion.span
          key={offset}
          className="absolute -top-6 -left-6 size-12 rounded-pill border border-current"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [0.6, i === 0 ? 2.6 : 2], opacity: [0.9, 0] }}
          transition={{ duration: DURATION.burst, delay: delay + offset, ease: EASE_OUT }}
        />
      ))}
      <svg viewBox="-60 -60 120 120" className="absolute -top-15 -left-15 size-30 overflow-visible">
        {Array.from({ length: sparks }, (_, i) => {
          const angle = (i / sparks) * Math.PI * 2 + (i % 2) * 0.18
          const cos = Math.cos(angle)
          const sin = Math.sin(angle)
          const reach = i % 2 === 0 ? 52 : 42
          return (
            <motion.line
              key={i}
              stroke="currentColor"
              strokeWidth={1.2}
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{
                x1: [cos * 18, cos * (reach - 10)],
                y1: [sin * 18, sin * (reach - 10)],
                x2: [cos * 22, cos * reach],
                y2: [sin * 22, sin * reach],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: DURATION.burst * 0.8, delay: delay + 0.04, ease: EASE_OUT }}
            />
          )
        })}
      </svg>
    </span>
  )
}
