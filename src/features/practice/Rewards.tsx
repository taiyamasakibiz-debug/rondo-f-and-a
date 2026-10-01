import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { Burst } from '@/components/celebrate/Burst'
import { DigitalLines } from '@/components/DigitalLines'
import { feedbackLater } from '@/feedback'
import { DURATION, EASE_OUT, SPRING_POP, SPRING_SOFT, STAGE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { LevelState } from '@/progress/level'

export type Reward = {
  xp: number
  before: LevelState
  after: LevelState
  /** この 1 問で今日のノルマを達成したときの、ストリークの変化 */
  streak?: { from: number; to: number }
}

/** バーが満タンになって次のレベルに切り替わるまでの割合（DURATION.fill のうち） */
const LEVEL_SWITCH_AT = 0.45

/**
 * 1 問解いたあとのごほうび：得た XP、経験値のバー、レベルアップ、ストリーク。
 * 結果 → XP → （バーが満タンになって）レベルアップ → ストリーク の順に流れる。
 * 演出の途中でも、下の解説や次の問題へのボタンはすぐ使える。
 */
export function RewardPanel({ reward }: { reward: Reward }) {
  const reduceMotion = useReducedMotion()
  const leveledUp = reward.after.level > reward.before.level
  // レベルアップの表示は、バーが満タンになった瞬間に切り替える
  const [switched, setSwitched] = useState(Boolean(reduceMotion) || !leveledUp)
  useEffect(() => {
    if (switched) return
    const timer = setTimeout(
      () => setSwitched(true),
      (STAGE.reward + DURATION.fill * LEVEL_SWITCH_AT) * 1000,
    )
    return () => clearTimeout(timer)
  }, [switched])
  const shown = switched ? reward.after : reward.before

  return (
    <div className="-mt-6 flex flex-col gap-4">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.enter, delay: STAGE.reward, ease: EASE_OUT }}
        className="flex flex-wrap items-center gap-x-5 gap-y-3"
      >
        <span className="rounded-pill border border-line px-4 py-2 text-tag">+{reward.xp} XP</span>
        <div className="flex min-w-48 flex-1 items-center gap-3">
          <motion.span
            key={shown.level}
            initial={reduceMotion || !leveledUp ? false : { scale: 1.35 }}
            animate={{ scale: 1 }}
            transition={SPRING_POP}
            className="relative text-[15px] font-bold tabular-nums"
          >
            Lv.{shown.level}
          </motion.span>
          <XpBar before={reward.before} after={reward.after} leveledUp={leveledUp} />
        </div>
        <span className="text-caption text-ink-muted">
          {reward.after.nextLevelXp === null
            ? '最高レベル'
            : `次のレベルまで ${reward.after.nextLevelXp - reward.after.xp} XP`}
        </span>
      </motion.div>

      {leveledUp && switched && <LevelUp from={reward.before.level} to={reward.after.level} />}
      {reward.streak && <StreakUp from={reward.streak.from} to={reward.streak.to} />}
    </div>
  )
}

/** 経験値のバー。レベルアップのときは満タンまで伸びて、新しいレベルの 0 から伸び直す */
function XpBar({
  before,
  after,
  leveledUp,
}: {
  before: LevelState
  after: LevelState
  leveledUp: boolean
}) {
  const reduceMotion = useReducedMotion()
  const scaleX = leveledUp
    ? [before.progress, 1, 0, after.progress]
    : [before.progress, after.progress]
  return (
    <div
      role="progressbar"
      aria-label="次のレベルまでの経験値"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(after.progress * 100)}
      className="relative h-1.5 flex-1 overflow-hidden rounded-pill bg-line"
    >
      <motion.div
        className="absolute inset-0 origin-left rounded-pill bg-ink"
        initial={reduceMotion ? false : { scaleX: before.progress }}
        animate={{ scaleX: reduceMotion ? after.progress : scaleX }}
        transition={{
          duration: DURATION.fill,
          delay: STAGE.reward,
          ease: leveledUp ? 'easeInOut' : EASE_OUT,
          times: leveledUp ? [0, LEVEL_SWITCH_AT, LEVEL_SWITCH_AT + 0.001, 1] : undefined,
        }}
      />
    </div>
  )
}

/** レベルアップのカード。黒いピルが弾んで出て、波紋が広がる */
function LevelUp({ from, to }: { from: number; to: number }) {
  const reduceMotion = useReducedMotion()
  useEffect(() => feedbackLater('levelUp', 0), [])
  return (
    <motion.div
      role="status"
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING_SOFT}
      className="relative flex items-center gap-6 overflow-hidden rounded-lg bg-ink px-6 py-5 text-on-ink"
    >
      <div className="relative flex flex-col gap-1">
        <span className="text-[13px] font-bold tracking-caps opacity-70">LEVEL UP</span>
        <span className="font-ja text-[15px] font-bold tracking-ja">レベルが上がりました</span>
      </div>
      <span className="relative ml-auto flex items-baseline gap-3 tabular-nums">
        <span className="text-[17px] opacity-60">Lv.{from}</span>
        <span aria-hidden className="opacity-60">
          →
        </span>
        <span className="relative text-[44px] leading-none font-bold tracking-tight">
          <span className="sr-only">Lv.</span>
          <AnimatedNumber value={to} from={from} />
          <Burst delay={0.05} sparks={12} className="text-on-ink" />
        </span>
      </span>
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
