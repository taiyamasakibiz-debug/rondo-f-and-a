import { useEffect, useMemo, useState } from 'react'
import type { Topic } from '@/engine/types'
import { certificationOf } from './certification'
import { topicProgress } from './level'
import { useProgressStore } from './store'
import { computeStreak } from './streak'
import { computeCourse } from './units'

/**
 * 今の時刻。1 分ごとに更新するので、アプリを開いたまま日付が変わっても
 * ストリークや「今日」の数え方が追いつく。
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

export function useStreak() {
  const attempts = useProgressStore((state) => state.attempts)
  const settings = useProgressStore((state) => state.settings)
  const now = useNow()
  return useMemo(() => computeStreak(attempts, settings, now), [attempts, settings, now])
}

export function useTopicProgress(topic: Topic) {
  const attempts = useProgressStore((state) => state.attempts)
  return useMemo(() => topicProgress(attempts, topic), [attempts, topic])
}

/** 論点ごとに、合格したいちばん上の認定 */
export function useCertification(topic: Topic) {
  const attempts = useProgressStore((state) => state.attempts)
  return useMemo(() => certificationOf(attempts, topic), [attempts, topic])
}

/** コースの現在地（Stage の進み具合と単元の状態） */
export function useCourse() {
  const attempts = useProgressStore((state) => state.attempts)
  const dayStartHour = useProgressStore((state) => state.settings.dayStartHour)
  const now = useNow()
  return useMemo(
    () => computeCourse(attempts, { dayStartHour }, now),
    [attempts, dayStartHour, now],
  )
}
