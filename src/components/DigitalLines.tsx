import { motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { seededRandom } from '@/lib/seededRandom'

type DigitalLinesProps = {
  /** 線の本数 */
  count?: number
  /** 同じ seed なら毎回同じ線になる */
  seed?: number
  className?: string
}

const WIDTH = 1200
const HEIGHT = 400

/**
 * Tessera のデジタルライン。sky-wash の上に重ねる白い細線の束。
 * 線幅は 0.7〜1.2px、不透明度は 0.45〜0.95 で揺らす。
 */
export function DigitalLines({ count = 14, seed = 7, className }: DigitalLinesProps) {
  const reduceMotion = useReducedMotion()

  const paths = useMemo(() => {
    const random = seededRandom(seed)
    return Array.from({ length: count }, (_, i) => {
      const startY = HEIGHT * (0.5 + random() * 0.25)
      const endY = HEIGHT * (0.05 + random() * 0.3)
      const c1x = WIDTH * (0.25 + random() * 0.2)
      const c1y = startY - HEIGHT * random() * 0.2
      const c2x = WIDTH * (0.6 + random() * 0.2)
      const c2y = endY + HEIGHT * random() * 0.15
      return {
        id: i,
        d: `M-20 ${startY} C${c1x} ${c1y} ${c2x} ${c2y} ${WIDTH + 20} ${endY}`,
        opacity: 0.45 + random() * 0.5,
        width: 0.7 + random() * 0.5,
      }
    })
  }, [count, seed])

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
      className={className}
    >
      {paths.map((path) => (
        <motion.path
          key={path.id}
          d={path.d}
          stroke="var(--line-digital)"
          strokeOpacity={path.opacity}
          strokeWidth={path.width}
          vectorEffect="non-scaling-stroke"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, delay: path.id * 0.05, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </svg>
  )
}
