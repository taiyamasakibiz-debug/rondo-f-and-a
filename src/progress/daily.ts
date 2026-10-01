import { UNITS } from '@/course/units'
import { createRandom } from '@/engine/random'
import type { ProblemTemplate, Topic } from '@/engine/types'
import { type DayKey, dayKey } from './day'
import { topicProgress } from './level'
import { type Phase, phaseOf } from './phase'
import { buildReviewCards, dueCards } from './review'
import { type Attempt, type Settings, liveAttempts } from './types'
import { computeCourse } from './units'

/** なぜ今日この問題が選ばれたか */
export type DailyReason =
  /** 復習の期日が来た */
  | 'review'
  /** 前回全問正解できなかった問題の復習 */
  | 'retry'
  /** まだ解いたことがない */
  | 'new'
  /** しばらく解いていない */
  | 'practice'
  /** 直前期の本番形式（総合問題・難しい問題） */
  | 'exam'

export type DailyItem = {
  templateId: string
  topic: Topic
  seed: number
  reason: DailyReason
  /** 今日この問題（テンプレートとシード）を解いた記録。まだなら undefined */
  attempt?: Attempt
}

export type DailyPlan = {
  day: DayKey
  phase: Phase
  items: DailyItem[]
  doneCount: number
  complete: boolean
}

/** 直前期のデイリーのうち、本番形式にする割合 */
const FINAL_EXAM_RATIO = 0.7

/** 本番形式の問題：Stage 3（総合）の単元の問題と、難易度 3 の問題 */
const STAGE3_TEMPLATE_IDS = new Set(
  UNITS.filter((unit) => unit.stage === 3).flatMap((unit) => unit.templateIds),
)
function isExamFormat(template: ProblemTemplate): boolean {
  return STAGE3_TEMPLATE_IDS.has(template.id) || template.difficulty === 3
}

/**
 * 今日のデイリー（docs/DESIGN.md §4、docs/COURSE.md §9）。局面で出し方が変わる。
 * - マスター期間：期日が来た復習 → 新しい問題（最低 1 問は残す。次の単元から）→ しばらく解いていない問題
 * - 維持期間：期日が来た復習 → しばらく解いていない問題（新しい問題は出さない）
 * - 直前期：弱点の復習（期日・前回の間違い）と、本番形式を 3：7 くらいで
 *
 * 1 日の間は同じ問題が並ぶように、今日より前の記録だけで問題を選ぶ。
 * 今日の記録は「済み」の判定にだけ使う。
 */
export function buildDaily(
  attempts: readonly Attempt[],
  settings: Settings,
  templates: readonly ProblemTemplate[],
  now: Date,
): DailyPlan {
  const today = dayKey(now, settings.dayStartHour)
  const phase = phaseOf(today, settings)
  const live = liveAttempts(attempts)
  const history = live.filter(
    (attempt) => dayKey(new Date(attempt.answeredAt), settings.dayStartHour) < today,
  )
  const todays = live.filter(
    (attempt) => dayKey(new Date(attempt.answeredAt), settings.dayStartHour) === today,
  )

  const count = Math.min(settings.dailyGoal, templates.length)
  const random = createRandom(hashDay(today))
  // 同点のときの並びを日ごとに変えるための値。比較のたびに乱数を引くと並びが一貫しないので先に決める
  const tieBreak = new Map<string, number>()
  for (const template of templates) {
    tieBreak.set(template.id, random.next())
    if (!tieBreak.has(template.topic)) tieBreak.set(template.topic, random.next())
  }
  const byId = new Map(templates.map((template) => [template.id, template]))
  const chosen: { template: ProblemTemplate; reason: DailyReason }[] = []
  const isChosen = (id: string) => chosen.some((item) => item.template.id === id)
  const push = (template: ProblemTemplate, reason: DailyReason, limit = count) => {
    if (chosen.length < limit && !isChosen(template.id)) chosen.push({ template, reason })
  }

  const lastByTemplate = latestByTemplate(history)
  const attempted = new Set(history.map((attempt) => attempt.templateId))
  const fresh = templates.filter((template) => !attempted.has(template.id))
  const lastAnswered = (template: ProblemTemplate) =>
    lastByTemplate.get(template.id)?.answeredAt ?? ''

  /** 復習の期日が来た問題（期日を過ぎた日数が多い順）。前回全問正解できなかったものは retry */
  const pushReviews = (limit: number) => {
    for (const card of dueCards(buildReviewCards(history, settings), today)) {
      const template = byId.get(card.templateId)
      if (template) {
        push(template, lastByTemplate.get(template.id)?.allCorrect ? 'review' : 'retry', limit)
      }
    }
  }

  /** まだ解いたことがない問題。次の単元の問題を先に、そのあとはレベルが低いラボから 1 問ずつ順番に */
  const pushNew = () => {
    const nextUnit = computeCourse(history, settings, now).nextUnit?.unit
    const preferred = new Set(nextUnit?.templateIds ?? [])
    for (const template of shuffle(
      fresh.filter((t) => preferred.has(t.id)),
      random,
    )) {
      push(template, 'new')
    }

    const xpByTopic = new Map(
      [...new Set(templates.map((t) => t.topic))].map((topic) => [
        topic,
        topicProgress(history, topic).xp,
      ]),
    )
    const topics = [...new Set(fresh.map((template) => template.topic))].sort(
      (a, b) => xpByTopic.get(a)! - xpByTopic.get(b)! || tieBreak.get(a)! - tieBreak.get(b)!,
    )
    const queues = new Map(
      topics.map((topic) => [
        topic,
        shuffle(
          fresh.filter((t) => t.topic === topic && !isChosen(t.id)),
          random,
        ),
      ]),
    )
    while (chosen.length < count && [...queues.values()].some((queue) => queue.length > 0)) {
      for (const topic of topics) {
        const template = queues.get(topic)!.shift()
        if (template) push(template, 'new')
      }
    }
  }

  /** しばらく解いていない問題（最後に解いた日が古い順）。attemptedFirst なら、解いたことのある問題を先に */
  const pushRest = (attemptedFirst: boolean) => {
    const rest = templates
      .filter((template) => !isChosen(template.id))
      .sort(
        (a, b) =>
          (attemptedFirst ? Number(!attempted.has(a.id)) - Number(!attempted.has(b.id)) : 0) ||
          lastAnswered(a).localeCompare(lastAnswered(b)) ||
          tieBreak.get(a.id)! - tieBreak.get(b.id)!,
      )
    for (const template of rest) push(template, 'practice')
  }

  if (phase === 'mastery') {
    // 復習が溜まっていても、新しい問題を 1 問は残す（新しい単元が止まらないように）
    const reviewLimit = fresh.length > 0 && count > 1 ? count - 1 : count
    pushReviews(reviewLimit)
    pushNew()
    pushRest(false)
  } else if (phase === 'maintenance') {
    pushReviews(count)
    // 新しい問題は出さない。ただし、まだ何も解いていないときは出す
    if (attempted.size === 0) pushNew()
    pushRest(true)
    pushNew()
  } else {
    const pool = templates.filter(isExamFormat)
    const examCount = pool.length === 0 ? 0 : Math.max(1, Math.round(count * FINAL_EXAM_RATIO))
    const weakLimit = count - examCount
    // 弱点：期日が来た復習、前回間違えた問題（得点率が低い順）
    pushReviews(weakLimit)
    const mistakes = [...lastByTemplate.values()]
      .filter((attempt) => !attempt.allCorrect && byId.has(attempt.templateId))
      .sort((a, b) => a.earned / a.total - b.earned / b.total)
    for (const attempt of mistakes) push(byId.get(attempt.templateId)!, 'retry', weakLimit)
    // 本番形式：前回の得点率が低い・長く解いていない順（まだ解いていなければいちばん先）
    const ratioOf = (template: ProblemTemplate) => {
      const last = lastByTemplate.get(template.id)
      return last ? last.earned / last.total : -1
    }
    const examPool = pool
      .filter((template) => !isChosen(template.id))
      .sort(
        (a, b) =>
          ratioOf(a) - ratioOf(b) ||
          lastAnswered(a).localeCompare(lastAnswered(b)) ||
          tieBreak.get(a.id)! - tieBreak.get(b.id)!,
      )
    for (const template of examPool) push(template, 'exam', weakLimit + examCount)
    pushReviews(count)
    pushRest(true)
    pushNew()
  }

  const items = chosen.map(({ template, reason }): DailyItem => {
    const seed = Math.floor(random.next() * 4294967296)
    const attempt = todays.findLast((a) => a.templateId === template.id && a.seed === seed)
    return { templateId: template.id, topic: template.topic, seed, reason, attempt }
  })
  const doneCount = items.filter((item) => item.attempt).length
  return {
    day: today,
    phase,
    items,
    doneCount,
    complete: items.length > 0 && doneCount === items.length,
  }
}

/** 次に解くデイリーの問題（なければ undefined） */
export function nextDailyItem(plan: DailyPlan): DailyItem | undefined {
  return plan.items.find((item) => !item.attempt)
}

export function dailyPracticePath(item: DailyItem): string {
  return `/labs/${item.topic}/practice?template=${encodeURIComponent(item.templateId)}&seed=${item.seed}&from=daily`
}

function latestByTemplate(attempts: readonly Attempt[]): Map<string, Attempt> {
  const latest = new Map<string, Attempt>()
  for (const attempt of [...attempts].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))) {
    latest.set(attempt.templateId, attempt)
  }
  return latest
}

function shuffle<T>(values: readonly T[], random: ReturnType<typeof createRandom>): T[] {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

/** 日付の文字列から、その日のシードを作る（FNV-1a） */
function hashDay(day: DayKey): number {
  let hash = 2166136261
  for (const char of day) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
