import { describe, expect, it } from 'vitest'
import { FINAL_DAYS_BEFORE_FIRST_EXAM, masteryDeadline, phaseOf, phaseSummary } from './phase'
import { DEFAULT_SETTINGS } from './types'

const settings = {
  masteryMonth: '2027-03',
  firstExamDate: '2027-08-01',
  secondExamDate: '2027-10-01',
}

describe('masteryDeadline', () => {
  it('目標の月の末日', () => {
    expect(masteryDeadline('2027-03')).toBe('2027-03-31')
    expect(masteryDeadline('2027-02')).toBe('2027-02-28')
    expect(masteryDeadline('2028-02')).toBe('2028-02-29')
    expect(masteryDeadline('2026-12')).toBe('2026-12-31')
  })
})

describe('phaseOf', () => {
  it('目標の月の末日まではマスター期間', () => {
    expect(phaseOf('2026-10-01', settings)).toBe('mastery')
    expect(phaseOf('2027-03-31', settings)).toBe('mastery')
  })

  it('マスター期間のあとは維持期間', () => {
    expect(phaseOf('2027-04-01', settings)).toBe('maintenance')
    expect(phaseOf('2027-06-30', settings)).toBe('maintenance')
  })

  it('1 次試験の 30 日前から 2 次試験の日までは直前期', () => {
    // 8/1 の 30 日前は 7/2
    expect(phaseOf('2027-07-02', settings)).toBe('final')
    expect(phaseOf('2027-07-01', settings)).toBe('maintenance')
    expect(FINAL_DAYS_BEFORE_FIRST_EXAM).toBe(30)
    expect(phaseOf('2027-08-15', settings)).toBe('final')
    expect(phaseOf('2027-10-01', settings)).toBe('final')
  })

  it('2 次試験が終わったあとは維持期間', () => {
    expect(phaseOf('2027-10-02', settings)).toBe('maintenance')
  })

  it('目標の月が直前期と重なるなら、直前期を優先する', () => {
    expect(phaseOf('2027-07-15', { ...settings, masteryMonth: '2027-07' })).toBe('final')
  })

  it('既定の設定', () => {
    expect(phaseOf('2026-10-01', DEFAULT_SETTINGS)).toBe('mastery')
  })
})

describe('phaseSummary', () => {
  it('局面が終わるまでの日数を出す', () => {
    expect(phaseSummary('2027-03-01', settings)).toMatchObject({
      phase: 'mastery',
      endsOn: '2027-03-31',
      daysLeft: 30,
    })
    expect(phaseSummary('2027-04-01', settings)).toMatchObject({
      phase: 'maintenance',
      endsOn: '2027-07-01',
    })
    expect(phaseSummary('2027-09-01', settings)).toMatchObject({
      phase: 'final',
      endsOn: '2027-10-01',
      daysLeft: 30,
    })
  })

  it('最後の局面（2 次試験のあとの維持期間）には終わりがない', () => {
    expect(phaseSummary('2027-11-01', settings)).toEqual({
      phase: 'maintenance',
      endsOn: null,
      daysLeft: null,
    })
  })

  it('マスターの期限が直前期より先なら、直前期の前日までで切る', () => {
    expect(phaseSummary('2027-06-01', { ...settings, masteryMonth: '2027-12' })).toMatchObject({
      phase: 'mastery',
      endsOn: '2027-07-01',
    })
  })
})
