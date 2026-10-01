import { useEffect, useMemo, useState } from 'react'
import type { Topic } from '@/engine/types'
import { certificationOf } from './certification'
import { topicProgress } from './level'
import { useProgressStore } from './store'
import { computeStreak } from './streak'
import { dayKey } from './day'
import { phaseSummary } from './phase'
import { studyForecast } from './timing'
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

/** 合格したいちばん上の認定 */
export function useCertification() {
  const attempts = useProgressStore((state) => state.attempts)
  return useMemo(() => certificationOf(attempts), [attempts])
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

/** 今日の局面（マスター期間・維持期間・直前期）と、その局面が終わるまでの日数 */
export function usePhase() {
  const settings = useProgressStore((state) => state.settings)
  const now = useNow()
  return useMemo(() => phaseSummary(dayKey(now, settings.dayStartHour), settings), [now, settings])
}

/** 学習時間の見込み（定着していない単元を、目安の回数まで解くのにかかる時間と、1 週間あたりの時間） */
export function useStudyForecast() {
  const attempts = useProgressStore((state) => state.attempts)
  const settings = useProgressStore((state) => state.settings)
  const course = useCourse()
  const now = useNow()
  return useMemo(
    () => studyForecast(course, attempts, settings, now),
    [course, attempts, settings, now],
  )
}
