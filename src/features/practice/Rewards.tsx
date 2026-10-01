import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { Burst } from '@/components/celebrate/Burst'
import { DigitalLines } from '@/components/DigitalLines'
import { feedbackLater } from '@/feedback'
import { DURATION, EASE_OUT, SPRING_POP, SPRING_SOFT, STAGE } from '@/lib/motion'
import { cn } from '@/lib/utils'
export type Reward = {
  xp: number
  /** このラボの累計 XP（この 1 問の前と後） */
  totalBefore: number
  totalAfter: number
  /** この 1 問で、はじめて定着した単元（docs/COURSE.md §4） */
  consolidated?: { unitName: string }
  /** この 1 問で上がったコースレベル */
  courseLevel?: { from: number; to: number }
  /** この 1 問で今日のノルマを達成したときの、ストリークの変化 */
  streak?: { from: number; to: number }
}

/**
 * 1 問解いたあとのごほうび：得た XP（積み上げた努力量）、単元の定着とコースレベル、ストリーク。
 * 結果 → XP → 定着・コースレベル → ストリーク の順に流れる。
 * レベルは「解いた量」ではなく「定着した単元」で上がるので、お祝いは実力がついた瞬間に出す。
 * 演出の途中でも、下の解説や次の問題へのボタンはすぐ使える。
 */
export function RewardPanel({ reward }: { reward: Reward }) {
  const reduceMotion = useReducedMotion()
  return (
    <div className="-mt-6 flex flex-col gap-4">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.enter, delay: STAGE.reward, ease: EASE_OUT }}
        className="flex flex-wrap items-center gap-x-5 gap-y-3"
      >
        <span className="rounded-pill border border-line px-4 py-2 text-tag">+{reward.xp} XP</span>
        <span className="text-caption text-ink-muted tabular-nums">
          このラボの累計{' '}
          <AnimatedNumber
            value={reward.totalAfter}
            from={reward.totalBefore}
            className="text-label text-ink"
          />{' '}
          XP（積み上げた努力量）
        </span>
      </motion.div>

      {(reward.consolidated || reward.courseLevel) && (
        <Consolidated unitName={reward.consolidated?.unitName} courseLevel={reward.courseLevel} />
      )}
      {reward.streak && <StreakUp from={reward.streak.from} to={reward.streak.to} />}
    </div>
  )
}

/**
 * 単元が定着したとき（とコースレベルが上がったとき）のカード。黒いピルが弾んで出て、波紋が広がる
 */
function Consolidated({
  unitName,
  courseLevel,
}: {
  unitName?: string
  courseLevel?: { from: number; to: number }
}) {
  const reduceMotion = useReducedMotion()
  useEffect(() => feedbackLater('levelUp', STAGE.reward), [])
  return (
    <motion.div
      role="status"
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING_SOFT, delay: STAGE.reward }}
      className="relative flex items-center gap-6 overflow-hidden rounded-lg bg-ink px-6 py-5 text-on-ink"
    >
      <div className="relative flex flex-col gap-1">
        <span className="text-[13px] font-bold tracking-caps opacity-70">
          {courseLevel ? 'COURSE LEVEL UP' : 'CONSOLIDATED'}
        </span>
        <span className="font-ja text-[15px] font-bold tracking-ja">
          {unitName ? `「${unitName}」が定着しました` : 'コースレベルが上がりました'}
        </span>
      </div>
      {courseLevel && (
        <span className="relative ml-auto flex items-baseline gap-3 tabular-nums">
          <span className="text-[17px] opacity-60">Lv.{courseLevel.from}</span>
          <span aria-hidden className="opacity-60">
            →
          </span>
          <span className="relative text-[44px] leading-none font-bold tracking-tight">
            <span className="sr-only">Lv.</span>
            <AnimatedNumber value={courseLevel.to} from={courseLevel.from} />
            <Burst delay={STAGE.reward + 0.05} sparks={12} className="text-on-ink" />
          </span>
        </span>
      )}
      {!courseLevel && (
        <span className="relative ml-auto">
          <Burst delay={STAGE.reward + 0.05} sparks={12} className="text-on-ink" />
        </span>
      )}
    </motion.div>
  )
}

/** 1 週間ぶんの点。今日の点が最後に灯る */
const WEEK = 7

/** 今日のノルマを達成して、ストリークが伸びた瞬間の演出 */
export function StreakUp({ from, to }: { from: number; to: number }) {
  const reduceMotion = useReducedMotion()
  const lit = Math.min(to, WEEK)
  // 今日の点が灯るのに合わせて鳴らす
  useEffect(() => feedbackLater('streak', STAGE.streak + 0.35), [])
  return (
    <motion.div
      role="status"
      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING_SOFT, delay: STAGE.streak }}
      className="relative flex w-full flex-wrap items-center gap-x-6 gap-y-4 overflow-hidden rounded-lg bg-sky-wash px-6 py-5"
    >
      <DigitalLines
        count={8}
        seed={21}
        className="pointer-events-none absolute inset-0 size-full"
      />
      <div className="relative flex flex-col gap-1">
        <span className="text-[13px] font-bold tracking-caps text-ink-muted">STREAK</span>
        <span className="font-ja text-[15px] font-bold tracking-ja">今日のノルマ達成</span>
      </div>
      <ol aria-hidden className="relative flex items-center gap-1.5">
        {Array.from({ length: WEEK }, (_, i) => {
          const today = i === lit - 1
          return (
            <motion.li
              key={i}
              className={cn('size-2.5 rounded-pill', i < lit ? 'bg-ink' : 'bg-ink/15')}
              initial={reduceMotion || !today ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...SPRING_POP, delay: STAGE.streak + 0.35 }}
            />
          )
        })}
      </ol>
      <span className="relative ml-auto flex items-baseline gap-2">
        <motion.span
          className="relative"
          initial={reduceMotion ? false : { scale: 1 }}
          animate={reduceMotion ? undefined : { scale: [1, 1, 1.18, 1] }}
          transition={{ duration: 0.6, delay: STAGE.streak + 0.3, times: [0, 0.4, 0.7, 1] }}
        >
          <AnimatedNumber
            value={to}
            from={from}
            className="text-[44px] leading-none font-bold tracking-tight tabular-nums"
          />
          <Burst delay={STAGE.streak + 0.45} sparks={8} className="text-ember" />
        </motion.span>
        <span className="font-ja text-[15px] text-ink-body">日</span>
      </span>
    </motion.div>
  )
}
