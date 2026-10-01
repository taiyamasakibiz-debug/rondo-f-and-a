import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useMemo } from 'react'
import { Link } from 'react-router'
import { ARROW_HOVER } from '@/components/ArrowDot'
import { PageHeader } from '@/components/PageHeader'
import { unitPracticePath } from '@/course/units'
import { LABS, type Lab, findLab } from '@/features/labs/labs'
import { cn } from '@/lib/utils'
import { findTemplate } from '@/problems'
import { StageCertification } from '@/features/exam/StageCertification'
import {
  useCourse,
  usePhase,
  useStreak,
  useStudyForecast,
  useTopicProgress,
} from '@/progress/hooks'
import { PHASE_LABELS } from '@/progress/phase'
import type { StageProgress, UnitProgress, UnitState } from '@/progress/units'
import { MAX_FREEZES } from '@/progress/streak'
import { useProgressStore } from '@/progress/store'
import type { Attempt } from '@/progress/types'

export function RecordsPage() {
  const status = useProgressStore((state) => state.status)

  return (
    <>
      <PageHeader title="Records" subtitle="記録" />
      {status === 'error' ? (
        <p role="alert" className="text-body-sm text-ink-body">
          記録を読み込めませんでした。ブラウザの設定で、このサイトのデータ保存が許可されているか確認してください。
        </p>
      ) : (
        <div className="flex flex-col gap-16">
          <StreakSection />
          <CourseSection />
          <LevelsSection />
          <MistakesSection />
        </div>
      )}
    </>
  )
}

function SectionHeading({ number, en, ja }: { number: string; en: string; ja: string }) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <h2 className="flex items-baseline gap-4">
        <span className="text-[13px] font-bold tracking-caps text-ink-muted">{number}</span>
        <span className="text-[28px] leading-[1.1] font-bold tracking-[-0.04em]">{en}</span>
      </h2>
      <p className="text-sub-ja text-ink-muted">{ja}</p>
    </div>
  )
}

function StreakSection() {
  const streak = useStreak()
  const settings = useProgressStore((state) => state.settings)
  const todayProgress = Math.min(1, streak.todayCount / settings.dailyGoal)

  return (
    <section>
      <SectionHeading number="01" en="Streak" ja="ストリーク" />
      <div className="grid gap-6 md:grid-cols-3">
        <KeyNumber label="CURRENT" value={streak.current} unit="日" note="連続でデイリーを達成" />
        <KeyNumber label="BEST" value={streak.best} unit="日" note="これまでの最長" />
        <KeyNumber
          label="FREEZE"
          value={streak.freezes}
          unit={`/ ${MAX_FREEZES}`}
          note="7 日続けると 1 つ。休んだ日に自動で使われる"
        />
      </div>
      <div className="mt-6 flex flex-col gap-3 rounded-md bg-fog p-6">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-ja text-[15px] font-bold tracking-ja">今日のデイリー</span>
          <span className="text-label tabular-nums">
            {streak.todayCount} / {settings.dailyGoal} 問
          </span>
        </div>
        <ProgressBar value={todayProgress} label="今日のデイリーの進み具合" />
        <span className="text-caption text-ink-muted">
          {streak.todayGoalMet
            ? '今日のデイリーは達成済みです。'
            : 'ノルマを達成するとストリークが伸びます。'}
        </span>
      </div>
    </section>
  )
}

const PRIORITY_LABEL = { must: null, recommended: '推奨', later: '後回し' } as const

const STATE_LABEL: Record<UnitState, string> = {
  preparing: '準備中',
  untouched: '未着手',
  learning: '学習中',
  consolidated: '定着',
  review: '要復習',
}

/** 状態のピル。色だけに頼らず、文字で示す（オレンジは「要復習」の点だけ） */
function StateTag({ state }: { state: UnitState }) {
  return (
    <span
      className={
        state === 'consolidated'
          ? 'inline-flex items-center gap-2 rounded-pill border border-ink bg-ink px-3 py-1 text-[11px] font-bold tracking-[0.1em] text-on-ink'
          : state === 'learning' || state === 'review'
            ? 'inline-flex items-center gap-2 rounded-pill border border-ink px-3 py-1 text-[11px] font-bold tracking-[0.1em]'
            : 'inline-flex items-center gap-2 rounded-pill border border-line px-3 py-1 text-[11px] font-bold tracking-[0.1em] text-ink-muted'
      }
    >
      {state === 'review' && <span className="size-2 rounded-pill bg-ember" aria-hidden />}
      {STATE_LABEL[state]}
    </span>
  )
}

function CourseSection() {
  const course = useCourse()
  const phase = usePhase()
  const forecast = useStudyForecast()
  const current = course.stages.find((entry) => entry.stage.id === course.currentStage)
  const { level, points, nextPoints } = course.level
  const nextUnit = course.nextUnit
  const nextPath = nextUnit && unitPracticePath(nextUnit.unit, topicOfTemplate)

  return (
    <section>
      <SectionHeading number="02" en="Course" ja="学習コース" />
      <div className="mb-10 grid gap-4 md:grid-cols-3 md:gap-6">
        <CourseCard
          label="COURSE LEVEL"
          value={level}
          unit="/ 10"
          caption="単元を定着させるたびに上がる"
          progress={nextPoints === null ? 1 : points / nextPoints}
          progressLabel="次のコースレベルまで"
          foot={
            nextPoints === null ? '最高レベル' : `次のレベルまで あと ${nextPoints - points} 点`
          }
        />
        <CourseCard
          label="STAGE"
          value={current?.stage.id ?? 3}
          unit="/ 3"
          caption={current?.stage.name ?? 'すべての Stage を修了'}
          progress={
            current && current.gateUnits.length > 0
              ? current.consolidatedCount / current.gateUnits.length
              : 1
          }
          progressLabel="この Stage の定着した単元"
          foot={
            current ? (
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span>
                  定着 {current.consolidatedCount} / {current.gateUnits.length} 単元
                </span>
                {nextUnit && nextPath && (
                  <Link
                    to={nextPath}
                    className="font-bold text-ink underline-offset-4 hover:underline"
                  >
                    次は {nextUnit.unit.name} →
                  </Link>
                )}
              </span>
            ) : (
              '修了'
            )
          }
        />
        <CourseCard
          label="PHASE"
          title={PHASE_LABELS[phase.phase].name}
          caption={
            phase.daysLeft !== null && phase.endsOn
              ? `${phase.endsOn.replaceAll('-', '.')} まで あと ${phase.daysLeft} 日`
              : PHASE_LABELS[phase.phase].description
          }
          foot={
            forecast.minutesPerWeek !== null && forecast.remainingMinutes > 0
              ? `目安のペース：週に約 ${formatHours(forecast.minutesPerWeek)}`
              : PHASE_LABELS[phase.phase].description
          }
        />
      </div>
      <div className="flex flex-col gap-10">
        {course.stages.map((entry) => (
          <StageBlock key={entry.stage.id} entry={entry} />
        ))}
      </div>
    </section>
  )
}

const topicOfTemplate = (id: string) => findTemplate(id)?.topic

/** 学習コースのカード：英字のラベル、大きな値（または名前）、一言、下の段（バーと補足） */
function CourseCard({
  label,
  value,
  unit,
  title,
  caption,
  progress,
  progressLabel,
  foot,
}: {
  label: string
  value?: number
  unit?: string
  title?: string
  caption: string
  progress?: number
  progressLabel?: string
  foot: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-6 md:p-8">
      <span className="text-[13px] font-bold tracking-caps text-ink-muted">{label}</span>
      {value !== undefined ? (
        <div className="flex items-baseline gap-2">
          <span className="text-[56px] leading-none font-bold tracking-tight tabular-nums">
            {value}
          </span>
          {unit && <span className="text-label text-ink-muted">{unit}</span>}
        </div>
      ) : (
        <span className="font-ja text-[28px] leading-tight font-bold tracking-ja">{title}</span>
      )}
      <span className="font-ja text-[15px] font-bold tracking-ja">{caption}</span>
      <div className="mt-auto flex flex-col gap-2 pt-2">
        {progress !== undefined && progressLabel && (
          <ProgressBar value={progress} label={progressLabel} />
        )}
        <span className="text-caption text-ink-muted tabular-nums">{foot}</span>
      </div>
    </div>
  )
}

function StageBlock({ entry }: { entry: StageProgress }) {
  const { stage, gateUnits, consolidatedCount, cleared } = entry
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="flex items-baseline gap-4">
          <span className="text-[13px] font-bold tracking-caps text-ink-muted">
            STAGE {stage.id}
          </span>
          <span className="font-ja text-[18px] font-bold tracking-ja">{stage.name}</span>
        </h3>
        <span className="text-caption text-ink-muted tabular-nums">
          {cleared ? '修了' : `定着 ${consolidatedCount} / ${gateUnits.length}`}
        </span>
      </div>
      <p className="mb-3 text-caption text-ink-muted">{stage.description}</p>
      <ul className="flex flex-col">
        {entry.units.map((progress) => (
          <UnitRow key={progress.unit.id} progress={progress} />
        ))}
      </ul>
      <StageCertification tier={stage.tier} />
    </div>
  )
}

/** 単元の行。押すと、その単元の問題を解く画面に移る */
function UnitRow({ progress }: { progress: UnitProgress }) {
  const { unit, state } = progress
  const priority = PRIORITY_LABEL[unit.priority]
  const path = unitPracticePath(unit, topicOfTemplate)
  const content = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-8">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-ja text-[15px] font-bold tracking-ja group-hover:text-ember-text">
            {unit.name}
          </span>
          {priority && <span className="text-[11px] tracking-ja text-ink-muted">{priority}</span>}
          {!progress.prerequisitesMet && state !== 'preparing' && (
            <span className="text-[11px] tracking-ja text-ink-muted">前提の単元が先</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-caption text-ink-muted tabular-nums">
          {state !== 'preparing' && state !== 'untouched' && (
            <span>
              型 {progress.attemptedCount} / {progress.templateCount}
              {progress.accuracy !== null && (
                <span className="ml-3">正確さ {Math.round(progress.accuracy * 100)}%</span>
              )}
              {progress.retention !== null && (
                <span className="ml-3">復習 {Math.round(progress.retention * 100)}%</span>
              )}
              {/* 速さは、解き方が身につく前は気にさせない（Stage 3 だけ） */}
              {unit.stage === 3 && progress.speed !== null && (
                <span className="ml-3">速さ {progress.speed.toFixed(1)} 倍</span>
              )}
            </span>
          )}
          <StateTag state={state} />
        </div>
      </div>
      {path && (
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-pill border border-ink',
            ARROW_HOVER,
          )}
          aria-hidden
        >
          <ArrowRight className="size-4" />
        </span>
      )}
    </>
  )
  return (
    <li className="border-t border-line last:border-b">
      {path ? (
        <Link
          to={path}
          aria-label={`${unit.name}の問題を解く（${STATE_LABEL[state]}）`}
          className="group flex items-center gap-4 py-4"
        >
          {content}
        </Link>
      ) : (
        <div className="flex items-center gap-4 py-4">{content}</div>
      )}
    </li>
  )
}

/** 分を「◯ 時間 ◯ 分」に（1 時間未満なら分だけ） */
function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (hours === 0) return `${rest} 分`
  return rest === 0 ? `${hours} 時間` : `${hours} 時間 ${rest} 分`
}

/** Tessera の KEY NUMBER カード（白地に 1px の線） */
function KeyNumber({
  label,
  value,
  unit,
  note,
}: {
  label: string
  value: number
  unit: string
  note: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-8">
      <span className="text-[13px] font-bold tracking-caps text-ink-muted">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-[64px] leading-none font-bold tracking-tight tabular-nums">
          {value}
        </span>
        <span className="text-label text-ink-muted">{unit}</span>
      </div>
      <span className="text-caption text-ink-muted">{note}</span>
    </div>
  )
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const reduceMotion = useReducedMotion()
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className="h-1.5 overflow-hidden rounded-pill bg-line-soft"
    >
      <motion.div
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: `${value * 100}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="h-full rounded-pill bg-ink"
      />
    </div>
  )
}

function LevelsSection() {
  return (
    <section>
      <SectionHeading number="03" en="Labs" ja="ラボごとの努力量と熟練度" />
      <p className="mb-4 text-caption text-ink-muted">XP は解いた量、熟練度は直近の得点率です。</p>
      <ul className="flex flex-col">
        {LABS.map((lab) => (
          <LevelRow key={lab.id} lab={lab} />
        ))}
      </ul>
    </section>
  )
}

function LevelRow({ lab }: { lab: Lab }) {
  const progress = useTopicProgress(lab.id)
  return (
    <li className="grid gap-3 border-t border-line py-6 last:border-b md:grid-cols-[1fr_2fr] md:items-center md:gap-8">
      <div className="flex items-baseline gap-4">
        <span className="text-[22px] font-bold tracking-snug">{lab.nameEn}</span>
        <span className="font-ja text-[13px] font-bold tracking-ja text-ink-muted">{lab.name}</span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4 text-caption text-ink-muted">
          <span className="tabular-nums">
            <strong className="text-label text-ink">{progress.xp} XP</strong>
            <span className="ml-3">{progress.attempts} 問</span>
          </span>
          <span className="tabular-nums">
            熟練度 {progress.mastery === null ? '—' : `${Math.round(progress.mastery * 100)}%`}
          </span>
        </div>
        <ProgressBar value={progress.mastery ?? 0} label={`${lab.name}の熟練度（直近の得点率）`} />
      </div>
    </li>
  )
}

const MISTAKE_LIMIT = 10

/** 全問正解できなかった問題。同じ問題（テンプレートとシード）は最新の 1 回だけ */
function useMistakes(attempts: readonly Attempt[]) {
  return useMemo(() => {
    const latest = new Map<string, Attempt>()
    for (const attempt of attempts) {
      if (attempt.deletedAt) continue
      latest.set(`${attempt.templateId}:${attempt.seed}`, attempt)
    }
    return [...latest.values()]
      .filter((attempt) => !attempt.allCorrect)
      .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))
      .slice(0, MISTAKE_LIMIT)
  }, [attempts])
}

function MistakesSection() {
  const attempts = useProgressStore((state) => state.attempts)
  const mistakes = useMistakes(attempts)

  return (
    <section>
      <SectionHeading number="04" en="Mistakes" ja="間違いノート" />
      {mistakes.length === 0 ? (
        <p className="text-body-sm text-ink-muted">
          全問正解できなかった問題がここに集まります。同じ問題をもう一度解いて全問正解すると、ここから消えます。
        </p>
      ) : (
        <ul className="flex flex-col">
          {mistakes.map((attempt) => {
            const lab = findLab(attempt.topic)
            const template = findTemplate(attempt.templateId)
            return (
              <li key={attempt.id} className="border-t border-line last:border-b">
                <Link
                  to={`/labs/${attempt.topic}/practice?template=${encodeURIComponent(attempt.templateId)}&seed=${attempt.seed}`}
                  className="group flex items-center gap-4 py-5 md:gap-7"
                >
                  <span className="hidden w-24 shrink-0 text-[13px] tracking-text text-ink-muted tabular-nums md:block">
                    {formatDate(attempt.answeredAt)}
                  </span>
                  <span className="shrink-0 rounded-pill border border-line px-3 py-1 text-[11px] font-bold tracking-[0.1em]">
                    {lab?.nameEn.toUpperCase() ?? attempt.topic.toUpperCase()}
                  </span>
                  {/* スマホでは得点を題名の下に置き、横にはみ出さないようにする */}
                  <span className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-7">
                    <span className="min-w-0 flex-1 text-[15px] font-medium tracking-text break-words group-hover:text-ember-text">
                      {template?.title ?? attempt.templateId}
                    </span>
                    <span className="shrink-0 text-caption text-ink-muted tabular-nums">
                      {attempt.earned} / {attempt.total} 点
                    </span>
                  </span>
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-pill border border-ink',
                      ARROW_HOVER,
                    )}
                    aria-hidden
                  >
                    <ArrowRight className="size-4" />
                  </span>
                  <span className="sr-only">もう一度解く</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Tessera の日付表記 2026.10.01 */
function formatDate(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}
