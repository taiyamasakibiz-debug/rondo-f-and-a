import { createRandom } from './random'
import type { Params, ParamSpec, ProblemTemplate } from './types'

/** 出題された 1 問。テンプレートとシードがあれば同じ問題を作り直せる */
export type Problem = {
  template: ProblemTemplate
  seed: number
  params: Params
}

const MAX_ATTEMPTS = 1000

/**
 * シードからパラメータを引き、制約を満たす組み合わせで問題を作る。
 * 同じシードなら必ず同じパラメータになる。
 */
export function generateProblem(template: ProblemTemplate, seed: number): Problem {
  const random = createRandom(seed)
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const params = drawParams(template.params, random)
    if (!template.constraint || template.constraint(params)) {
      return { template, seed, params }
    }
  }
  throw new Error(`「${template.id}」の制約を満たすパラメータが見つかりません`)
}

function drawParams(spec: ParamSpec, random: ReturnType<typeof createRandom>): Params {
  const params: Record<string, number> = {}
  for (const [name, param] of Object.entries(spec)) {
    params[name] =
      param.kind === 'int'
        ? random.int(param.min, param.max, param.step)
        : random.pick(param.values)
  }
  return params
}
