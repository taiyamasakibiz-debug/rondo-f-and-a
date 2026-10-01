import { describe, expect, it } from 'vitest'
import { PROBLEM_TEMPLATES } from '@/problems'
import { STAGES, UNITS, findUnit } from '@/course/units'
import { type Attempt, DEFAULT_SETTINGS } from './types'
import { COURSE_LEVEL_THRESHOLDS, computeCourse, courseLevel } from './units'

let nextId = 0
function attempt(
  templateId: string,
  day: string,
  earned = 5,
  total = 5,
  durationMs = 60_000,
): Attempt {
  nextId += 1
  const [y, m, d] = day.split('-').map(Number)
  const at = new Date(y!, m! - 1, d!, 12).toISOString()
  return {
    id: `a${nextId}`,
    templateId,
    topic: 'cvp',
    seed: nextId,
    earned,
    total,
    allCorrect: earned === total,
    steps: [],
    durationMs,
    answeredAt: at,
    createdAt: at,
    updatedAt: at,
  }
}

const cvpIds = findUnit('mgt-cvp')!.templateIds
/** CVP の全型を day の日に 1 回ずつ解いた記録 */
function allTemplates(day: string, earned = 5): Attempt[] {
  return cvpIds.map((id) => attempt(id, day, earned))
}
function stateOf(attempts: Attempt[], now: Date, unitId = 'mgt-cvp') {
  const course = computeCourse(attempts, DEFAULT_SETTINGS, now)
  return course.stages.flatMap((s) => s.units).find((p) => p.unit.id === unitId)!.state
}
const at = (m: number, d: number) => new Date(2026, m - 1, d, 12)

describe('コースのデータ', () => {
  it('すべての問題テンプレートが、ちょうど 1 つの単元に入っている', () => {
    for (const template of PROBLEM_TEMPLATES) {
      const owners = UNITS.filter((unit) => unit.templateIds.includes(template.id))
      expect(
        owners.map((unit) => unit.id),
        template.id,
      ).toHaveLength(1)
    }
  })

  it('単元のテンプレート ID と前提が実在する', () => {
    const ids = new Set(PROBLEM_TEMPLATES.map((template) => template.id))
    const unitIds = new Set(UNITS.map((unit) => unit.id))
    for (const unit of UNITS) {
      for (const id of unit.templateIds) expect(ids.has(id), id).toBe(true)
      for (const id of unit.prerequisites) expect(unitIds.has(id), id).toBe(true)
      expect(STAGES.some((stage) => stage.id === unit.stage)).toBe(true)
    }
  })

  it('前提は手前の単元だけを指す（循環しない）', () => {
    UNITS.forEach((unit, index) => {
      for (const id of unit.prerequisites) {
        expect(UNITS.findIndex((u) => u.id === id)).toBeLessThan(index)
      }
    })
  })
})

describe('単元の状態', () => {
  it('型がない単元は準備中', () => {
    expect(stateOf([], at(10, 1), 'mgt-seg')).toBe('preparing')
  })

  it('解いていなければ未着手、解いたら学習中', () => {
    expect(stateOf([], at(10, 1))).toBe('untouched')
    expect(stateOf(allTemplates('2026-10-01'), at(10, 2))).toBe('learning')
  })

  it('全型を解いて正確さが高くても、間を空けて解くまでは定着しない', () => {
    const attempts = [...allTemplates('2026-10-01'), ...allTemplates('2026-10-02')]
    expect(stateOf(attempts, at(10, 3))).toBe('learning')
  })

  it('7 日以上空けて解いて高い得点なら定着', () => {
    const attempts = [...allTemplates('2026-10-01'), ...allTemplates('2026-10-09')]
    expect(stateOf(attempts, at(10, 10))).toBe('consolidated')
  })

  it('間を空けて解いても、得点率が低ければ定着しない', () => {
    const attempts = [...allTemplates('2026-10-01'), ...allTemplates('2026-10-09', 3)]
    expect(stateOf(attempts, at(10, 10))).toBe('learning')
  })

  it('全型を解いていなければ定着しない', () => {
    const [first] = cvpIds
    const attempts = [attempt(first!, '2026-10-01'), attempt(first!, '2026-10-09')]
    expect(stateOf(attempts, at(10, 10))).toBe('learning')
  })

  it('定着したあと 30 日解かないと要復習', () => {
    const attempts = [...allTemplates('2026-10-01'), ...allTemplates('2026-10-09')]
    expect(stateOf(attempts, at(11, 7))).toBe('consolidated') // 29 日後
    expect(stateOf(attempts, at(11, 8))).toBe('review') // 30 日後
  })

  it('定着したあと 14 日以上空けて解いて 6 割未満なら要復習', () => {
    const attempts = [
      ...allTemplates('2026-10-01'),
      ...allTemplates('2026-10-09'),
      attempt(cvpIds[0]!, '2026-10-25', 2),
    ]
    expect(stateOf(attempts, at(10, 26))).toBe('review')
  })

  it('要復習から、間を空けて解き直して高い得点を取れば定着に戻る', () => {
    const attempts = [
      ...allTemplates('2026-10-01'),
      ...allTemplates('2026-10-09'),
      attempt(cvpIds[0]!, '2026-10-25', 2),
      ...allTemplates('2026-11-02'),
      ...allTemplates('2026-11-10'),
    ]
    expect(stateOf(attempts, at(11, 11))).toBe('consolidated')
  })

  it('削除した記録は数えない', () => {
    const deleted = { ...allTemplates('2026-10-01')[0]!, deletedAt: new Date().toISOString() }
    expect(stateOf([deleted], at(10, 2))).toBe('untouched')
  })
})

describe('Stage と次の単元', () => {
  it('何も解いていなければ Stage 1 の最初の単元から', () => {
    const course = computeCourse([], DEFAULT_SETTINGS, at(10, 1))
    expect(course.currentStage).toBe(1)
    expect(course.nextUnit?.unit.id).toBe('acc-bs-pl')
  })

  it('前提が済んでいない単元は次の単元に出さない', () => {
    const course = computeCourse([], DEFAULT_SETTINGS, at(10, 1))
    // acc-ca などは acc-bs-pl が定着するまで出ない
    expect(course.nextUnit?.unit.prerequisites).toEqual([])
  })

  it('準備中の単元は、修了にも前提にも数えない', () => {
    const course = computeCourse([], DEFAULT_SETTINGS, at(10, 1))
    const stage2 = course.stages[1]!
    expect(stage2.gateUnits.map((p) => p.unit.id)).not.toContain('mgt-seg')
    // 事例Ⅳ総合は問題があるので、Stage 3 の修了に数える
    expect(course.stages[2]!.gateUnits.map((p) => p.unit.id)).toEqual(['case4-int'])
  })

  it('学習中の単元を、未着手より先に出す', () => {
    const bs = findUnit('acc-bs-pl')!.templateIds
    const defined = bs.map((id) => attempt(id, '2026-10-01', 5))
    const bsDone = [...defined, ...bs.map((id) => attempt(id, '2026-10-09', 5))]
    const started = attempt(findUnit('mgt-cvp')!.templateIds[0]!, '2026-10-10')
    const course = computeCourse([...bsDone, started], DEFAULT_SETTINGS, at(10, 11))
    expect(course.nextUnit?.unit.id).toBe('mgt-cvp')
  })
})

describe('速さ', () => {
  it('直近 5 回の所要時間の中央値を、想定時間（CVP は 5 分）で割る', () => {
    const [first] = cvpIds
    const minutes = [2, 4, 6, 8, 10, 30]
    const attempts = minutes.map((m, i) => attempt(first!, `2026-10-0${i + 1}`, 5, 5, m * 60_000))
    // 直近 5 回は 4・6・8・10・30 分。中央値は 8 分
    const course = computeCourse(attempts, DEFAULT_SETTINGS, at(10, 7))
    const unit = course.stages.flatMap((s) => s.units).find((p) => p.unit.id === 'mgt-cvp')!
    expect(unit.speed).toBeCloseTo(8 / 5)
  })

  it('解いていなければ null', () => {
    const course = computeCourse([], DEFAULT_SETTINGS, at(10, 1))
    expect(course.stages[0]!.units[0]!.speed).toBeNull()
  })
})

describe('コースレベル', () => {
  it('単元の点の合計（Stage の番号）が、レベルの最大の点と一致する', () => {
    const total = UNITS.reduce((sum, unit) => sum + unit.stage, 0)
    expect(total).toBe(COURSE_LEVEL_THRESHOLDS[COURSE_LEVEL_THRESHOLDS.length - 1])
  })

  it('点からレベルを出す', () => {
    expect(courseLevel(0)).toMatchObject({ level: 1, nextPoints: 1 })
    expect(courseLevel(5)).toMatchObject({ level: 6, nextPoints: 7 })
    expect(courseLevel(16)).toMatchObject({ level: 10, nextPoints: null })
    expect(courseLevel(99).level).toBe(10)
  })

  it('何も解いていなければ Lv.1', () => {
    expect(computeCourse([], DEFAULT_SETTINGS, at(10, 1)).level).toMatchObject({
      level: 1,
      points: 0,
    })
  })

  it('単元が定着すると上がり、要復習になっても下がらない', () => {
    const attempts = [...allTemplates('2026-10-01'), ...allTemplates('2026-10-09')]
    const settled = computeCourse(attempts, DEFAULT_SETTINGS, at(10, 10))
    expect(stateOf(attempts, at(10, 10))).toBe('consolidated')
    expect(settled.level).toMatchObject({ level: 2, points: 1 })

    const later = computeCourse(attempts, DEFAULT_SETTINGS, at(12, 31))
    expect(stateOf(attempts, at(12, 31))).toBe('review')
    expect(later.level).toMatchObject({ level: 2, points: 1 })
  })

  it('定着していない単元は点にならない', () => {
    const learning = computeCourse(allTemplates('2026-10-01'), DEFAULT_SETTINGS, at(10, 2))
    expect(learning.level.points).toBe(0)
  })
})
