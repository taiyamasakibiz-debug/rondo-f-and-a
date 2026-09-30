import { useMemo } from 'react'
import { PROBLEM_TEMPLATES } from '@/problems'
import { buildDaily } from '@/progress/daily'
import { useNow } from '@/progress/hooks'
import { useProgressStore } from '@/progress/store'

/** 今日のデイリー。記録・設定・日付が変わったときに計算し直す */
export function useDaily() {
  const attempts = useProgressStore((state) => state.attempts)
  const settings = useProgressStore((state) => state.settings)
  const now = useNow()
  return useMemo(
    () => buildDaily(attempts, settings, PROBLEM_TEMPLATES, now),
    [attempts, settings, now],
  )
}
