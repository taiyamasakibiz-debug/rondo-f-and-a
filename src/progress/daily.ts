import { createRandom } from '@/engine/random'
import type { ProblemTemplate, Topic } from '@/engine/types'
import { type DayKey, dayKey } from './day'
import { topicProgress } from './level'
import { buildReviewCards, dueCards } from './review'
import { type Attempt, type Settings, liveAttempts } from './types'

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
  items: DailyItem[]
  doneCount: number
  complete: boolean
}

/**
 * 今日のデイリー（docs/DESIGN.md §4）。
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

  // 1. 復習の期日が来た問題
  const lastByTemplate = latestByTemplate(history)
  for (const card of dueCards(buildReviewCards(history, settings.dayStartHour), today)) {
    const template = byId.get(card.templateId)
    if (!template || chosen.length >= count) continue
    chosen.push({
      template,
      reason: lastByTemplate.get(template.id)?.allCorrect ? 'review' : 'retry',
    })
  }

  // 2. まだ解いたことがない問題。レベルが低いラボから 1 問ずつ順番に
  const attempted = new Set(history.map((attempt) => attempt.templateId))
  const fresh = templates.filter((template) => !attempted.has(template.id))
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
        fresh.filter((t) => t.topic === topic),
        random,
      ),
    ]),
  )
  while (chosen.length < count && [...queues.values()].some((queue) => queue.length > 0)) {
    for (const topic of topics) {
      const template = queues.get(topic)!.shift()
      if (template && chosen.length < count) chosen.push({ template, reason: 'new' })
    }
  }

  // 3. しばらく解いていない問題（最後に解いた日が古い順）
  const rest = templates
    .filter((template) => !isChosen(template.id))
    .sort(
      (a, b) =>
        (lastByTemplate.get(a.id)?.answeredAt ?? '').localeCompare(
          lastByTemplate.get(b.id)?.answeredAt ?? '',
        ) || tieBreak.get(a.id)! - tieBreak.get(b.id)!,
    )
  for (const template of rest) {
    if (chosen.length >= count) break
    chosen.push({ template, reason: 'practice' })
  }

  const items = chosen.map(({ template, reason }): DailyItem => {
    const seed = Math.floor(random.next() * 4294967296)
    const attempt = todays.findLast((a) => a.templateId === template.id && a.seed === seed)
    return { templateId: template.id, topic: template.topic, seed, reason, attempt }
  })
  const doneCount = items.filter((item) => item.attempt).length
  return { day: today, items, doneCount, complete: items.length > 0 && doneCount === items.length }
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
