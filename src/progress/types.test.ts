import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, settingsSchema } from './types'

describe('settingsSchema', () => {
  it('目標月と試験日がない古い設定を読むと、既定の値で補う', () => {
    const old = { dailyGoal: 5, dayStartHour: 3, updatedAt: '2026-10-01T00:00:00.000Z' }
    expect(settingsSchema.parse(old)).toEqual({
      ...old,
      masteryMonth: DEFAULT_SETTINGS.masteryMonth,
      firstExamDate: DEFAULT_SETTINGS.firstExamDate,
      secondExamDate: DEFAULT_SETTINGS.secondExamDate,
    })
  })

  it('月や日付の形がおかしい設定は受け付けない', () => {
    const base = { ...DEFAULT_SETTINGS, updatedAt: '2026-10-01T00:00:00.000Z' }
    expect(settingsSchema.safeParse({ ...base, masteryMonth: '2027-13' }).success).toBe(false)
    expect(settingsSchema.safeParse({ ...base, masteryMonth: '2027-3' }).success).toBe(false)
    expect(settingsSchema.safeParse({ ...base, firstExamDate: '2027/08/01' }).success).toBe(false)
    expect(settingsSchema.safeParse({ ...base, secondExamDate: '2027-02-30' }).success).toBe(false)
  })
})
