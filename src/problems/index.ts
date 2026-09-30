import type { ProblemTemplate, Topic } from '@/engine/types'
import { breakEvenBasic } from './cvp/break-even-basic'

/** すべての問題テンプレート。追加したらここに登録する */
export const PROBLEM_TEMPLATES: readonly ProblemTemplate[] = [breakEvenBasic]

export function templatesForTopic(topic: Topic): ProblemTemplate[] {
  return PROBLEM_TEMPLATES.filter((template) => template.topic === topic)
}

export function findTemplate(id: string): ProblemTemplate | undefined {
  return PROBLEM_TEMPLATES.find((template) => template.id === id)
}
