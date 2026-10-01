import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { AmbientLines } from '@/components/AmbientLines'
import { EASE_OUT } from '@/lib/motion'
import { useSyncStore } from '@/sync/client'
import { SPLASH_DURATION_MS, syncStatusLabel } from './splashState'

/**
 * 起動画面：ロゴとアイコンだけを、少しのあいだ出す。時間が来たら onDone でホームに切り替わる。
 * 同期はこの画面を出した時点で裏で始まっていて、その状態を下に小さく出す。
 * 同期が終わっていなくても待たない（オフラインや回線が遅くても、ホームに入れるように）。
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion()
  const label = useSyncStore((state) =>
    syncStatusLabel({ status: state.status, key: state.key, lastSyncedAt: state.lastSyncedAt }),
  )

  useEffect(() => {
    const timer = setTimeout(onDone, SPLASH_DURATION_MS)
    return () => clearTimeout(timer)
  }, [onDone])

  const rise = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, ease: EASE_OUT, delay },
        }

  return (
    <motion.div
      data-testid="splash"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-12 overflow-hidden bg-background px-6"
      exit={
        reduceMotion
          ? { opacity: 0, transition: { duration: 0.2 } }
          : { opacity: 0, scale: 1.06, transition: { duration: 0.7, ease: EASE_OUT } }
      }
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-sky-wash" />
        <AmbientLines seed={3} className="absolute inset-0 size-full" />
      </div>

      <div className="relative flex flex-col items-center gap-6">
        <motion.img
          src="/brand/icon.svg"
          alt=""
          className="size-28 rounded-[22%] shadow-[0_18px_40px_-18px_rgba(18,18,19,0.45)]"
          {...rise(0.05)}
        />
        <motion.div className="flex flex-col items-center gap-2" {...rise(0.15)}>
          <img src="/brand/logo-wordmark.svg" alt="Rondo" className="h-10 w-auto" />
          {/* 財務・会計（Finance & Accounting）。ロゴの高さの 3 分の 1 くらい */}
          <span className="text-[13px] leading-none font-bold tracking-[0.3em] text-ink">
            F&amp;A
          </span>
        </motion.div>
      </div>

      <motion.p
        role="status"
        aria-live="polite"
        className="relative h-5 text-caption text-ink-muted"
        {...rise(0.3)}
      >
        {label}
      </motion.p>
    </motion.div>
  )
}
