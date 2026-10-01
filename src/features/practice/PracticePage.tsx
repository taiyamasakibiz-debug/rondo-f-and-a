import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { type FormEvent, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { type Problem, generateProblem } from '@/engine/generate'
import { type ProblemResult, type StepInput, gradeProblem } from '@/engine/grade'
import { createRandom, randomSeed } from '@/engine/random'
import { useDaily } from '@/features/daily/useDaily'
import { feedback } from '@/feedback'
import { findLab } from '@/features/labs/labs'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { findTemplate, templatesForTopic } from '@/problems'
import { dailyPracticePath } from '@/progress/daily'
import { levelFromXp, topicProgress, xpForAttempt } from '@/progress/level'
import { useProgressStore } from '@/progress/store'
import { computeStreak } from '@/progress/streak'
import { AnswerFeedback } from './AnswerFeedback'
import { type Reward, RewardPanel } from './Rewards'
import { ProblemBlocks } from './ProblemBlocks'
import { StepCard } from './StepCard'

type Topic = Parameters<typeof templatesForTopic>[0]

export function PracticePage() {
  const { labId } = useParams()
  const [searchParams] = useSearchParams()
  const lab = findLab(labId)
  if (!lab) return <NotFoundPage />
  const retry = retryProblem(lab.id, searchParams)
  // ラボや問題が変わったら状態を作り直す
  const fromDaily = retry !== null && searchParams.get('from') === 'daily'
  return (
    <Practice
      key={`${lab.id}:${searchParams}`}
      topic={lab.id}
      initial={retry}
      fromDaily={fromDaily}
    />
  )
}

/** 間違いノートなどから ?template=…&seed=… で同じ問題を開く */
function retryProblem(topic: Topic, searchParams: URLSearchParams): Problem | null {
  const template = findTemplate(searchParams.get('template') ?? '')
  const seed = Number(searchParams.get('seed'))
  if (!template || template.topic !== topic || !Number.isInteger(seed) || seed < 0) return null
  return generateProblem(template, seed)
}

function newProblem(topic: Topic): Problem | null {
  const templates = templatesForTopic(topic)
  if (templates.length === 0) return null
  const seed = randomSeed()
  return generateProblem(createRandom(seed).pick(templates), seed)
}

function Practice({
  topic,
  initial,
  fromDaily,
}: {
  topic: Topic
  initial: Problem | null
  fromDaily: boolean
}) {
  const lab = findLab(topic)!
  const reduceMotion = useReducedMotion()
  const recordAttempt = useProgressStore((state) => state.recordAttempt)
  const [problem, setProblem] = useState(() => initial ?? newProblem(topic))
  const [inputs, setInputs] = useState<Record<string, StepInput>>({})
  const [result, setResult] = useState<ProblemResult | null>(null)
  const [reward, setReward] = useState<Reward | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  // 次の問題に進むたびに増やし、入力欄（仕訳の行など、欄の中に状態を持つもの）を作り直す
  const [round, setRound] = useState(0)
  const navigate = useNavigate()
  const daily = useDaily()

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
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const graded = gradeProblem(problem, inputs)
    setResult(graded)
    // 採点の瞬間の手応え（効果音）。ボタンを押した操作の中で鳴らす
    feedback(graded.allCorrect ? 'correct' : graded.earned > 0 ? 'partial' : 'incorrect')
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })

    const store = useProgressStore.getState()
    const before = topicProgress(store.attempts, topic)
    const streakBefore = computeStreak(store.attempts, store.settings, new Date())
    const xp = xpForAttempt(graded)
    setReward({ xp, before, after: levelFromXp(before.xp + xp) })
    try {
      await recordAttempt({
        templateId: template.id,
        topic,
        seed: problem.seed,
        earned: graded.earned,
        total: graded.total,
        allCorrect: graded.allCorrect,
        steps: graded.steps.map((step) => ({ stepId: step.stepId, correct: step.correct })),
        durationMs: Date.now() - startedAt,
      })
      // この 1 問で今日のノルマを達成したら、ストリークが伸びた演出を出す
      const after = useProgressStore.getState()
      const streakAfter = computeStreak(after.attempts, after.settings, new Date())
      if (!streakBefore.todayGoalMet && streakAfter.todayGoalMet) {
        setReward((prev) =>
          prev
            ? { ...prev, streak: { from: streakBefore.current, to: streakAfter.current } }
            : prev,
        )
      }
    } catch (error) {
      console.error('解答記録の保存に失敗しました', error)
      setSaveError(true)
    }
  }
  // デイリーから開いたときは、今日のデイリーの何問目か（デイリーにない問題なら -1）
  const dailyIndex = fromDaily
    ? daily.items.findIndex((item) => item.templateId === template.id && item.seed === problem.seed)
    : -1
  const inDaily = dailyIndex >= 0
  // 今解いている問題を除いた、まだ解いていないデイリーの問題
  const nextDaily = inDaily
    ? daily.items.find((item, index) => index !== dailyIndex && !item.attempt)
    : undefined

  const handleNext = () => {
    if (inDaily) {
      // 最後の 1 問のあとは、デイリーの画面で達成の演出を出す
      navigate(nextDaily ? dailyPracticePath(nextDaily) : '/daily', {
        state: nextDaily ? undefined : { justCompleted: true },
      })
      window.scrollTo({ top: 0, behavior: 'auto' })
      return
    }
    setProblem(newProblem(topic))
    setInputs({})
    setResult(null)
    setReward(null)
    setSaveError(false)
    setStartedAt(Date.now())
    setRound((value) => value + 1)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  return (
    <>
      {inDaily && (
        <p className="mb-3 text-[13px] font-bold tracking-caps text-ink-muted">
          DAILY {dailyIndex + 1} / {daily.items.length}
        </p>
      )}
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
        {reward && <RewardPanel reward={reward} />}
        {saveError && (
          <p role="alert" className="text-body-sm text-ink-body">
            この解答を記録に保存できませんでした。ブラウザの保存領域がいっぱいか、プライベートモードの可能性があります。
          </p>
        )}

        <ProblemBlocks blocks={template.body(params)} />

        <form key={round} onSubmit={handleSubmit} className="flex flex-col gap-10">
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
              {inDaily ? (nextDaily ? '次のデイリー' : 'デイリーの結果へ') : '次の問題'}
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
