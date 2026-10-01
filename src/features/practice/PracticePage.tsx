import { motion, useReducedMotion } from 'motion/react'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowDot } from '@/components/ArrowDot'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { type Unit, findUnit } from '@/course/units'
import { type Problem, generateProblem } from '@/engine/generate'
import {
  type ProblemResult,
  type SelfGrade,
  type StepInput,
  gradeProblem,
  withSelfGrades,
} from '@/engine/grade'
import { createRandom, randomSeed } from '@/engine/random'
import { useDaily } from '@/features/daily/useDaily'
import { feedback } from '@/feedback'
import { findLab } from '@/features/labs/labs'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { findTemplate, templatesForTopic } from '@/problems'
import { dailyPracticePath } from '@/progress/daily'
import { topicProgress } from '@/progress/level'
import { nextAttemptXp } from '@/progress/xp'
import { useProgressStore } from '@/progress/store'
import type { Attempt } from '@/progress/types'
import { computeStreak } from '@/progress/streak'
import { computeCourse } from '@/progress/units'
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
  // 学習コースの単元から開いたときは、その単元の問題だけを出す
  const unit = findUnit(searchParams.get('unit') ?? '')
  return (
    <Practice
      key={`${lab.id}:${searchParams}`}
      topic={lab.id}
      unit={unit && unit.templateIds.length > 0 ? unit : undefined}
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

/** ラボ（または単元）の問題から 1 つ選んで作る */
function newProblem(topic: Topic, unit?: Unit): Problem | null {
  const templates = unit
    ? unit.templateIds.map((id) => findTemplate(id)).filter((t) => t !== undefined)
    : templatesForTopic(topic)
  if (templates.length === 0) return null
  const seed = randomSeed()
  return generateProblem(createRandom(seed).pick(templates), seed)
}

function Practice({
  topic,
  unit,
  initial,
  fromDaily,
}: {
  topic: Topic
  unit?: Unit
  initial: Problem | null
  fromDaily: boolean
}) {
  const lab = findLab(topic)!
  const reduceMotion = useReducedMotion()
  const recordAttempt = useProgressStore((state) => state.recordAttempt)
  const [problem, setProblem] = useState(() => initial ?? newProblem(topic, unit))
  const [inputs, setInputs] = useState<Record<string, StepInput>>({})
  // キーワードによる目安の採点（自己採点を当てる前）
  const [result, setResult] = useState<ProblemResult | null>(null)
  // 記述の自己採点（小問の id ごと）
  const [selfGrades, setSelfGrades] = useState<Record<string, SelfGrade>>({})
  // 保存した記録（自己採点で、保存した記録を直すため）
  const [saved, setSaved] = useState<Attempt | null>(null)

  const [reward, setReward] = useState<Reward | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  // 次の問題に進むたびに増やし、入力欄（仕訳の行など、欄の中に状態を持つもの）を作り直す
  const [round, setRound] = useState(0)
  const navigate = useNavigate()
  const daily = useDaily()

  // 自己採点が変わったら、保存した記録の採点を直す（保存の前に付けた自己採点も、保存のあとに反映する）
  useEffect(() => {
    if (!saved || !result || Object.keys(selfGrades).length === 0) return
    const regraded = withSelfGrades(result, selfGrades)
    useProgressStore
      .getState()
      .updateAttemptScore(saved.id, {
        earned: regraded.earned,
        total: regraded.total,
        allCorrect: regraded.allCorrect,
        steps: regraded.steps.map((step) => ({
          stepId: step.stepId,
          correct: step.correct,
          ...(selfGrades[step.stepId] ? { selfGrade: selfGrades[step.stepId] } : {}),
        })),
      })
      .catch((error: unknown) => {
        console.error('自己採点の保存に失敗しました', error)
        setSaveError(true)
      })
  }, [saved, result, selfGrades])

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
  const shown = result && withSelfGrades(result, selfGrades)

  /** 記述の自己採点（記録は上の effect で直す） */
  const handleSelfGrade = (stepId: string, grade: SelfGrade) => {
    setSelfGrades((prev) => ({ ...prev, [stepId]: grade }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    // 採点済みなら、もう一度記録しない（入力欄で Enter を押したときなど）
    if (result) return
    // 採点した時刻。所要時間とストリークの判定は、この時刻でそろえる
    const submittedAt = new Date()
    const graded = gradeProblem(problem, inputs)
    setResult(graded)
    // 採点の瞬間の手応え（効果音）。ボタンを押した操作の中で鳴らす
    feedback(graded.allCorrect ? 'correct' : graded.earned > 0 ? 'partial' : 'incorrect')
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })

    const store = useProgressStore.getState()
    const before = topicProgress(store.attempts, template.topic)
    const streakBefore = computeStreak(store.attempts, store.settings, submittedAt)
    const courseBefore = computeCourse(store.attempts, store.settings, submittedAt)
    const xp = nextAttemptXp(store.attempts, {
      templateId: template.id,
      earned: graded.earned,
      total: graded.total,
      allCorrect: graded.allCorrect,
      answeredAt: submittedAt.toISOString(),
    })
    setReward({ xp, totalBefore: before.xp, totalAfter: before.xp + xp })
    const saving = recordAttempt({
      templateId: template.id,
      // 単元から開いたときは、ほかのラボの問題も出るので、問題そのもののラボで記録する
      topic: template.topic,
      seed: problem.seed,
      earned: graded.earned,
      total: graded.total,
      allCorrect: graded.allCorrect,
      steps: graded.steps.map((step) => ({ stepId: step.stepId, correct: step.correct })),
      durationMs: submittedAt.getTime() - startedAt,
    }).catch((error: unknown) => {
      console.error('解答記録の保存に失敗しました', error)
      setSaveError(true)
      return null
    })
    const attempt = await saving
    if (attempt) {
      setSaved(attempt)
      const after = useProgressStore.getState()
      // この 1 問で、はじめて定着した単元と、上がったコースレベル（実力がついた瞬間のお祝い）
      const courseAfter = computeCourse(after.attempts, after.settings, submittedAt)
      const wasAchieved = new Set(
        courseBefore.stages
          .flatMap((s) => s.units)
          .filter((u) => u.achieved)
          .map((u) => u.unit.id),
      )
      const newlyAchieved = courseAfter.stages
        .flatMap((s) => s.units)
        .find((u) => u.achieved && !wasAchieved.has(u.unit.id))
      const levelFrom = courseBefore.level.level
      const levelTo = courseAfter.level.level
      // この 1 問で今日のノルマを達成したら、ストリークが伸びた演出を出す
      const streakAfter = computeStreak(after.attempts, after.settings, submittedAt)
      const streakUp = !streakBefore.todayGoalMet && streakAfter.todayGoalMet
      setReward((prev) =>
        prev
          ? {
              ...prev,
              ...(newlyAchieved ? { consolidated: { unitName: newlyAchieved.unit.name } } : {}),
              ...(levelTo > levelFrom ? { courseLevel: { from: levelFrom, to: levelTo } } : {}),
              ...(streakUp
                ? { streak: { from: streakBefore.current, to: streakAfter.current } }
                : {}),
            }
          : prev,
      )
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
    setProblem(newProblem(topic, unit))
    setInputs({})
    setResult(null)
    setSelfGrades({})
    setSaved(null)
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
      {unit && !inDaily && (
        <p className="mb-3 flex items-baseline gap-3 text-ink-muted">
          <span className="text-[13px] font-bold tracking-caps">UNIT</span>
          <span className="font-ja text-[13px] font-bold tracking-ja">{unit.name}</span>
        </p>
      )}
      <PageHeader title={lab.nameEn} subtitle={template.title} />

      <div className="flex flex-col gap-12">
        {shown && (
          <AnswerFeedback
            correct={shown.allCorrect}
            title={
              shown.allCorrect ? '全問正解' : `${formatPoints(shown.earned)} / ${shown.total} 点`
            }
          >
            {shown.allCorrect
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
              result={shown?.steps.find((r) => r.stepId === step.id)}
              selfGrade={selfGrades[step.id]}
              onSelfGrade={(grade) => handleSelfGrade(step.id, grade)}
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

/** 点数の表示（記述の部分点などで小数になるときは、小数第 1 位まで） */
function formatPoints(value: number): string {
  return String(Math.round(value * 10) / 10)
}
