import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { type FormEvent, useState } from 'react'
import { useParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { type Problem, generateProblem } from '@/engine/generate'
import { type ProblemResult, type StepInput, gradeProblem } from '@/engine/grade'
import { createRandom, randomSeed } from '@/engine/random'
import { findLab } from '@/features/labs/labs'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { templatesForTopic } from '@/problems'
import { AnswerFeedback } from './AnswerFeedback'
import { ProblemBlocks } from './ProblemBlocks'
import { StepCard } from './StepCard'

export function PracticePage() {
  const { labId } = useParams()
  const lab = findLab(labId)
  if (!lab) return <NotFoundPage />
  // ラボが変わったら状態を作り直す
  return <Practice key={lab.id} topic={lab.id} />
}

function newProblem(topic: Parameters<typeof templatesForTopic>[0]): Problem | null {
  const templates = templatesForTopic(topic)
  if (templates.length === 0) return null
  const seed = randomSeed()
  return generateProblem(createRandom(seed).pick(templates), seed)
}

function Practice({ topic }: { topic: Parameters<typeof templatesForTopic>[0] }) {
  const lab = findLab(topic)!
  const reduceMotion = useReducedMotion()
  const [problem, setProblem] = useState(() => newProblem(topic))
  const [inputs, setInputs] = useState<Record<string, StepInput>>({})
  const [result, setResult] = useState<ProblemResult | null>(null)

  if (!problem) {
    return (
      <>
        <PageHeader title={lab.nameEn} subtitle={lab.name} />
        <p className="rounded-xl border border-dashed border-line p-12 text-center text-body-sm text-ink-muted">
          このラボの問題は準備中です。
        </p>
      </>
    )
  }

  const { template, params } = problem
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setResult(gradeProblem(problem, inputs))
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }
  const handleNext = () => {
    setProblem(newProblem(topic))
    setInputs({})
    setResult(null)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  return (
    <>
      <PageHeader title={lab.nameEn} subtitle={template.title} />

      <div className="flex flex-col gap-12">
        {result && (
          <AnswerFeedback
            correct={result.allCorrect}
            title={result.allCorrect ? '全問正解' : `${result.earned} / ${result.total} 点`}
          >
            {result.allCorrect
              ? 'すべてのステップが正解です。'
              : '間違えたステップの正解と解説を確認します。'}
          </AnswerFeedback>
        )}

        <ProblemBlocks blocks={template.body(params)} />

        <form onSubmit={handleSubmit} className="flex flex-col gap-10">
          {template.steps.map((step, index) => (
            <StepCard
              key={step.id}
              index={index}
              step={step}
              params={params}
              input={inputs[step.id]}
              onChange={(input) => setInputs((prev) => ({ ...prev, [step.id]: input }))}
              result={result?.steps.find((r) => r.stepId === step.id)}
            />
          ))}

          {!result && (
            <Button type="submit" size="lg" className="self-start pr-2">
              採点する
              <ArrowDot />
            </Button>
          )}
        </form>

        {result && (
          <motion.section
            aria-labelledby="explanation-heading"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6 rounded-xl bg-fog p-6 md:p-10"
          >
            <h2 id="explanation-heading" className="flex flex-col gap-1">
              <span className="text-[28px] leading-[1.1] font-bold tracking-[-0.04em]">
                Explanation
              </span>
              <span className="text-sub-ja text-ink-muted">解説</span>
            </h2>
            <ProblemBlocks blocks={template.explanation(params)} />
            <Button type="button" size="lg" className="self-start pr-2" onClick={handleNext}>
              次の問題
              <ArrowDot />
            </Button>
          </motion.section>
        )}
      </div>
    </>
  )
}

/** Tessera の主ボタンの右端にある丸い矢印 */
function ArrowDot() {
  return (
    <span
      data-icon="inline-end"
      className="flex size-10 items-center justify-center rounded-pill bg-on-ink text-ink"
    >
      <ArrowRight className="size-4" aria-hidden />
    </span>
  )
}
