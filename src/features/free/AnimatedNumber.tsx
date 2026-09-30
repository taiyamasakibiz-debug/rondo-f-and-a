import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { formatNumber } from '@/engine/numbers'

/** 値が変わると、前の値からなめらかに数え上げる（別のウィンドウでの記帳にも反応する） */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const reduceMotion = useReducedMotion()
  const [shown, setShown] = useState(value)
  const previous = useRef(value)

  useEffect(() => {
    const from = previous.current
    previous.current = value
    if (reduceMotion || from === value) {
      setShown(value)
      return
    }
    const controls = animate(from, value, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setShown(Math.round(latest)),
    })
    return () => controls.stop()
  }, [value, reduceMotion])

  return (
    <span className={className} aria-label={formatNumber(value)}>
      <span aria-hidden>{formatNumber(shown)}</span>
    </span>
  )
}
