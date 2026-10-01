import { motion, useReducedMotion } from 'motion/react'
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowDot } from '@/components/ArrowDot'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { generateProblem } from '@/engine/generate'
import { type StepInput, gradeProblem } from '@/engine/grade'
import { randomSeed } from '@/engine/random'
import { feedbackLater } from '@/feedback'
import { findLab } from '@/features/labs/labs'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { AnswerFeedback } from '@/features/practice/AnswerFeedback'
import { Mark } from '@/features/practice/Mark'
import { ProblemBlocks } from '@/features/practice/ProblemBlocks'
import { StepCard } from '@/features/practice/StepCard'
import { findTemplate, templatesForTopic } from '@/problems'
import {
  EXAM_SIZE,
  type ExamItem,
  TIERS,
  TIER_RULES,
  type Tier,
  buildExam,
  examEligibility,
  examResults,
} from '@/progress/certification'
import { useProgressStore } from '@/progress/store'
import { CertifiedCard } from './CertifiedCard'

type Topic = Parameters<typeof templatesForTopic>[0]

export function ExamPage() {
  const { labId, tier } = useParams()
  const lab = findLab(labId)
  if (!lab || !TIERS.includes(tier as Tier)) return <NotFoundPage />
  return <Exam key={`${lab.id}:${tier}`} topic={lab.id} tier={tier as Tier} />
}

type Session = { id: string; startedAt: string; items: ExamItem[] }

function Exam({ topic, tier }: { topic: Topic; tier: Tier }) {
  const lab = findLab(topic)!
  const rule = TIER_RULES[tier]
  const attempts = useProgressStore((state) => state.attempts)
  const status = useProgressStore((state) => state.status)
  const [session, setSession] = useState<Session | null>(null)
  const [finished, setFinished] = useState(false)

  const start = () => {
    setSession({
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      items: buildExam(templatesForTopic(topic), randomSeed()),
    })
  }

  const header = (
    <PageHeader
      title={`${rule.labelEn[0]}${rule.labelEn.slice(1).toLowerCase()} Exam`}
      subtitle={`${lab.name}・${rule.label}認定テスト`}
    />
  )

  if (session && finished) {
    return (
      <>
        {header}
        <ExamResultView topic={topic} tier={tier} session={session} />
      </>
    )
  }
  if (session) {
    return (
      <>
        {header}
        <ExamRunner
          topic={topic}
          tier={tier}
          session={session}
          onFinish={() => setFinished(true)}
        />
      </>
    )
  }

  const eligibility = examEligibility(attempts, topic, tier)
  return (
    <>
      {header}
      <div className="flex flex-col gap-8">
        <dl className="grid gap-4 sm:grid-cols-3">
          {[
            ['問題数', `${EXAM_SIZE} 問`],
            ['制限時間', `${rule.timeLimitMs / 60_000} 分`],
            ['合格ライン', `${Math.round(rule.passRatio * 100)}%`],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 rounded-md bg-fog p-5">
              <dt className="text-caption text-ink-muted">{label}</dt>
              <dd className="text-[28px] font-bold tracking-snug tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink-body">
          <li>
            本番と同じく、解いている間は正解を表示しません。最後にまとめて採点結果を出します。
          </li>
          <li>
            時間切れになると、入力中の問題はその時点の答えで採点し、残りの問題は 0 点になります。
          </li>
          <li>途中でページを離れると、そこで終了します（残りは 0 点）。</li>
        </ul>
        {status === 'loading' ? null : eligibility.eligible ? (
          <Button size="lg" className="self-start pr-2" onClick={start}>
            テストを始める
            <ArrowDot />
          </Button>
        ) : (
          <p className="text-body-sm text-ink-body">{eligibility.reason}</p>
        )}
      </div>
    </>
  )
}

function ExamRunner({
  topic,
  tier,
  session,
  onFinish,
}: {
  topic: Topic
  tier: Tier
  session: Session
  onFinish: () => void
}) {
  const reduceMotion = useReducedMotion()
  const recordAttempt = useProgressStore((state) => state.recordAttempt)
  const rule = TIER_RULES[tier]
  const [index, setIndex] = useState(0)
  const [inputs, setInputs] = useState<Record<string, StepInput>>({})
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [remainingMs, setRemainingMs] = useState(rule.timeLimitMs)
  const submitting = useRef(false)
  // 時間切れになったか。採点の途中で時間切れになっても、終わったらテストを終える
  const timedOut = useRef(false)

  const item = session.items[index]!
  const problem = useMemo(
    () => generateProblem(findTemplate(item.templateId)!, item.seed),
    [item.templateId, item.seed],
  )

  /** 今の問題を採点して記録し、次へ進む（最後なら終了） */
  const submit = useCallback(
    async (final: boolean) => {
      if (submitting.current) return
      submitting.current = true
      const graded = gradeProblem(problem, inputs)
      await recordAttempt({
        templateId: problem.template.id,
        topic,
        seed: problem.seed,
        earned: graded.earned,
        total: graded.total,
        allCorrect: graded.allCorrect,
        steps: graded.steps.map((step) => ({ stepId: step.stepId, correct: step.correct })),
        durationMs: Date.now() - startedAt,
        exam: { id: session.id, tier, index, startedAt: session.startedAt },
      }).catch((error: unknown) => console.error('解答記録の保存に失敗しました', error))
      submitting.current = false
      if (final || timedOut.current || index + 1 >= session.items.length) {
        onFinish()
        return
      }
      setIndex(index + 1)
      setInputs({})
      setStartedAt(Date.now())
      window.scrollTo({ top: 0, behavior: 'auto' })
    },
    [problem, inputs, recordAttempt, topic, startedAt, session, tier, index, onFinish],
  )

  // 残り時間。時間切れになったら、入力中の問題を採点して終了する
  const deadline = Date.parse(session.startedAt) + rule.timeLimitMs
  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  }, [submit])
  useEffect(() => {
    const timer = setInterval(() => {
      const left = deadline - Date.now()
      setRemainingMs(Math.max(0, left))
      if (left <= 0) {
        clearInterval(timer)
        timedOut.current = true
        void submitRef.current(true)
      }
    }, 250)
    return () => clearInterval(timer)
  }, [deadline])

  // テスト中にページを離れようとしたら確認する
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit(false)
  }

  const minutes = Math.floor(remainingMs / 60_000)
  const seconds = Math.floor((remainingMs % 60_000) / 1000)
  const lastMinute = remainingMs < 60_000

  return (
    <div className="flex flex-col gap-10">
      <div className="sticky top-20 z-30 -mx-4 flex items-center justify-between gap-4 border-b border-line bg-background/90 px-4 py-3 backdrop-blur md:top-24 md:mx-0 md:rounded-pill md:border md:px-6">
        <span className="text-[13px] font-bold tracking-caps text-ink-muted">
          Q{index + 1} / {session.items.length}
        </span>
        <span
          className={
            lastMinute ? 'text-label text-ember-text tabular-nums' : 'text-label tabular-nums'
          }
          aria-label={`残り ${minutes} 分 ${seconds} 秒`}
          role="timer"
        >
          残り {minutes}:{String(seconds).padStart(2, '0')}
        </span>
      </div>

      <motion.div
        key={index}
        initial={reduceMotion ? false : { opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-10"
      >
        <h2 className="font-ja text-lg font-bold tracking-ja">{problem.template.title}</h2>
        <ProblemBlocks blocks={problem.template.body(problem.params)} />
        <form onSubmit={handleSubmit} className="flex flex-col gap-10">
          {problem.template.steps.map((step, i) => (
            <StepCard
              key={step.id}
              index={i}
              step={step}
              params={problem.params}
              input={inputs[step.id]}
              onChange={(input) => setInputs((prev) => ({ ...prev, [step.id]: input }))}
            />
          ))}
          <Button type="submit" size="lg" className="self-start pr-2">
            {index + 1 >= session.items.length ? '解答して採点する' : '解答して次へ'}
            <ArrowDot />
          </Button>
        </form>
      </motion.div>
    </div>
  )
}

function ExamResultView({ topic, tier, session }: { topic: Topic; tier: Tier; session: Session }) {
  const attempts = useProgressStore((state) => state.attempts)
  const rule = TIER_RULES[tier]
  const result = examResults(attempts).find((r) => r.examId === session.id)
  // 合格の音は認定証（CertifiedCard）で、バッジが押される瞬間に鳴らす
  const failed = result !== undefined && !result.passed
  useEffect(() => (failed ? feedbackLater('failed', 0.1) : undefined), [failed])
  const byIndex = new Map(
    attempts.filter((a) => a.exam?.id === session.id).map((a) => [a.exam!.index, a]),
  )

  return (
    <div className="flex flex-col gap-10">
      <AnswerFeedback
        correct={result?.passed ?? false}
        title={result?.passed ? `${rule.label}認定` : '不合格'}
      >
        得点率 {Math.round((result?.ratio ?? 0) * 100)}%（合格ライン{' '}
        {Math.round(rule.passRatio * 100)}%）
      </AnswerFeedback>

      {result?.passed && <CertifiedCard tier={tier} labName={findLab(topic)!.name} />}

      <ol className="flex flex-col">
        {session.items.map((item, index) => {
          const attempt = byIndex.get(index)
          const title = findTemplate(item.templateId)?.title ?? item.templateId
          return (
            <li key={index} className="border-t border-line last:border-b">
              <Link
                to={`/labs/${topic}/practice?template=${encodeURIComponent(item.templateId)}&seed=${item.seed}`}
                className="group flex items-center gap-4 py-4"
              >
                <span className="w-10 shrink-0 text-[13px] font-bold tracking-caps text-ink-muted">
                  Q{index + 1}
                </span>
                <span className="min-w-0 flex-1 text-[15px] font-medium tracking-text break-words group-hover:text-ember-text">
                  {title}
                </span>
                {attempt ? (
                  <>
                    <span className="shrink-0 text-caption text-ink-muted tabular-nums">
                      {attempt.earned} / {attempt.total} 点
                    </span>
                    <Mark correct={attempt.allCorrect} />
                  </>
                ) : (
                  <span className="text-caption text-ink-muted">未解答</span>
                )}
              </Link>
            </li>
          )
        })}
      </ol>
      <p className="text-caption text-ink-muted">
        各問題を開くと、同じ問題を解き直して解説を確認できます。
      </p>
      <Button asChild variant="outline" className="self-start">
        <Link to={`/labs/${topic}`}>ラボに戻る</Link>
      </Button>
    </div>
  )
}
