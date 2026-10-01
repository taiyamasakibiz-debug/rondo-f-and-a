import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildLines } from './buildLines'

/** 要素の大きさを測る（ResizeObserver がない環境では画面の大きさ） */
function useSize(ref: React.RefObject<SVGSVGElement | null>) {
  const [size, setSize] = useState(() => ({
    width: typeof window === 'undefined' ? 1200 : window.innerWidth,
    height: typeof window === 'undefined' ? 800 : window.innerHeight,
  }))
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      // スマホのアドレスバーの出し入れなど、小さな変化では作り直さない
      setSize((prev) =>
        Math.abs(prev.width - width) < 2 && Math.abs(prev.height - height) < 80
          ? prev
          : { width, height },
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}

/**
 * 背景に流れ続けるデジタルライン（Tessera の白い細線の束）。
 * 線はゆっくり波打ち続ける。視差効果を減らす設定では止めて表示する。
 */
export function AmbientLines({ seed = 7, className }: { seed?: number; className?: string }) {
  const reduceMotion = useReducedMotion()
  const ref = useRef<SVGSVGElement>(null)
  const { width, height } = useSize(ref)
  const lines = useMemo(() => buildLines(width, height, seed), [width, height, seed])

  return (
    <svg
      ref={ref}
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      fill="none"
      className={className}
    >
      {lines.map((line) => (
        <motion.path
          key={line.id}
          d={line.from}
          stroke="var(--line-digital)"
          strokeOpacity={line.opacity}
          strokeWidth={line.width}
          vectorEffect="non-scaling-stroke"
          animate={reduceMotion ? undefined : { d: [line.from, line.to, line.from] }}
          transition={{
            duration: line.duration,
            delay: line.delay,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
      ))}
    </svg>
  )
}
