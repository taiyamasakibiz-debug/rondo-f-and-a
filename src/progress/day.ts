/**
 * 学習の「日付」。日付の切り替わり時刻（例：午前 4 時）より前の解答は前日として数える。
 * 日付は "2026-10-01" の形の文字列（端末のタイムゾーン）で扱う。
 */
export type DayKey = string

export function dayKey(date: Date, dayStartHour: number): DayKey {
  const shifted = new Date(date.getTime() - dayStartHour * 60 * 60 * 1000)
  const y = shifted.getFullYear()
  const m = String(shifted.getMonth() + 1).padStart(2, '0')
  const d = String(shifted.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(day: DayKey, days: number): DayKey {
  // 夏時間などの影響を受けないよう、UTC の正午で計算する
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** b − a の日数 */
export function daysBetween(a: DayKey, b: DayKey): number {
  const ms = Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)
  return Math.round(ms / (24 * 60 * 60 * 1000))
}
