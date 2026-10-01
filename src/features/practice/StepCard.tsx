import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type StepInput, type StepResult, matchKeywords, writtenLength } from '@/engine/grade'
import type { ChoiceStep, NumericStep, Params, StepTemplate, WrittenStep } from '@/engine/types'
import { isNegative, toggleSign } from '@/engine/numbers'
import { cn } from '@/lib/utils'
import { JournalField } from './JournalField'
import { Mark } from './Mark'

type StepCardProps = {
  index: number
  step: StepTemplate
  params: Params
  input: StepInput | undefined
  onChange: (input: StepInput) => void
  result?: StepResult
}

export function StepCard({ index, step, params, input, onChange, result }: StepCardProps) {
  const number = `Q${index + 1}`
  const inputId = `step-${step.id}`
  const points = step.points ?? 1

  return (
    <section
      aria-labelledby={`${inputId}-label`}
      className="flex flex-col gap-5 border-t border-line pt-6"
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[13px] font-bold tracking-caps text-ink-muted">{number}</span>
        <span className="text-caption text-ink-muted">{points} 点</span>
      </div>

      {step.kind === 'numeric' && (
        <NumericField
          id={inputId}
          step={step}
          value={input?.kind === 'numeric' ? input.raw : ''}
          onChange={(raw) => onChange({ kind: 'numeric', raw })}
          result={result}
        />
      )}
      {step.kind === 'choice' && (
        <ChoiceField
          id={inputId}
          step={step}
          params={params}
          selected={input?.kind === 'choice' ? input.key : null}
          onSelect={(key) => onChange({ kind: 'choice', key })}
          result={result}
        />
      )}
      {step.kind === 'journal' && (
        <JournalField
          id={inputId}
          prompt={step.prompt}
          accounts={step.accounts}
          onChange={(answer) => onChange({ kind: 'journal', answer })}
          disabled={result !== undefined}
        />
      )}
      {step.kind === 'written' && (
        <WrittenField
          id={inputId}
          step={step}
          value={input?.kind === 'written' ? input.text : ''}
          onChange={(text) => onChange({ kind: 'written', text })}
          disabled={result !== undefined}
        />
      )}

      <AnimatePresence>
        {result &&
          (step.kind === 'written' ? (
            <WrittenResultRow
              step={step}
              params={params}
              text={input?.kind === 'written' ? input.text : ''}
              result={result}
            />
          ) : (
            <StepResultRow result={result} index={index} />
          ))}
      </AnimatePresence>
    </section>
  )
}

/** Tessera の TextField：下線だけの入力欄 */
function NumericField({
  id,
  step,
  value,
  onChange,
  result,
}: {
  id: string
  step: NumericStep
  value: string
  onChange: (raw: string) => void
  result?: StepResult
}) {
  const graded = result !== undefined
  return (
    <div className="flex flex-col gap-3">
      <label
        id={`${id}-label`}
        htmlFor={id}
        className="font-ja text-base font-bold tracking-[0.08em]"
      >
        {step.prompt}
      </label>
      <div
        className={cn(
          'flex max-w-sm items-baseline gap-3 border-b transition-colors focus-within:border-b-2',
          graded
            ? result.correct
              ? 'border-correct-300'
              : 'border-incorrect-300'
            : 'border-ink focus-within:border-ember',
        )}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          disabled={graded}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-help`}
          className="h-14 w-full min-w-0 bg-transparent px-1 text-[22px] font-bold tracking-text tabular-nums outline-none disabled:text-ink"
        />
        {step.unit && <span className="shrink-0 pb-1 text-label text-ink-muted">{step.unit}</span>}
        {/* スマホの数字キーボードにはマイナスがないことが多いので、符号を切り替えるボタンを置く */}
        <button
          type="button"
          disabled={graded}
          onClick={() => {
            const next = toggleSign(value)
            onChange(next)
            // 続けて数字を打てるよう、入力欄にカーソルを戻す（末尾に置く）
            setTimeout(() => {
              const input = document.getElementById(id) as HTMLInputElement | null
              input?.focus()
              input?.setSelectionRange(next.length, next.length)
            })
          }}
          aria-pressed={isNegative(value)}
          aria-label="プラスとマイナスを切り替える"
          className="mb-2 flex size-9 shrink-0 items-center justify-center self-end rounded-pill border border-line text-label hover:border-ink disabled:opacity-40 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
        >
          ±
        </button>
      </div>
      <span id={`${id}-help`} className="text-caption text-ink-muted">
        マイナスは「△」「-」を入力するか、± ボタンで切り替えられます
      </span>
    </div>
  )
}

/** Tessera の QuizChoice */
function ChoiceField({
  id,
  step,
  params,
  selected,
  onSelect,
  result,
}: {
  id: string
  step: ChoiceStep
  params: Params
  selected: string | null
  onSelect: (key: string) => void
  result?: StepResult
}) {
  const graded = result !== undefined
  const answer = step.answer(params)
  return (
    <fieldset className="flex flex-col gap-3">
      <legend id={`${id}-label`} className="mb-3 font-ja text-base font-bold tracking-[0.08em]">
        {step.prompt}
      </legend>
      {step.options(params).map((option) => {
        const isAnswer = graded && option.key === answer
        const isWrongPick = graded && option.key === selected && option.key !== answer
        const isSelected = !graded && option.key === selected
        return (
          <button
            key={option.key}
            type="button"
            disabled={graded}
            aria-pressed={option.key === selected}
            onClick={() => onSelect(option.key)}
            className={cn(
              'flex min-h-16 w-full items-center gap-4 rounded-md border border-line bg-paper px-5 py-4 text-left text-base font-medium tracking-text transition-colors',
              !graded && 'hover:border-ink',
              isSelected && 'border-2 border-ink bg-haze',
              isAnswer && 'border-2 border-correct-300 bg-correct-50',
              isWrongPick && 'border-2 border-incorrect-300 bg-incorrect-50',
              graded && !isAnswer && !isWrongPick && 'opacity-50',
            )}
          >
            {isAnswer || isWrongPick ? (
              <Mark correct={isAnswer} />
            ) : (
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-pill border border-line text-[13px] font-bold text-ink-muted">
                {option.key}
              </span>
            )}
            <span className="flex-1">{option.label}</span>
            {isAnswer && (
              <span className="text-[13px] font-bold tracking-[0.1em] text-correct-text">正解</span>
            )}
            {isWrongPick && (
              <span className="text-[13px] font-bold tracking-[0.1em] text-incorrect-text">
                不正解
              </span>
            )}
          </button>
        )
      })}
    </fieldset>
  )
}

/** 採点結果の行。上のステップから順に、少しずつずらして出す */
function StepResultRow({ result, index }: { result: StepResult; index: number }) {
  const reduceMotion = useReducedMotion()
  const delay = 0.2 + index * 0.08
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex items-start gap-4 rounded-md p-4',
        result.correct ? 'bg-correct-50' : 'bg-incorrect-50',
      )}
    >
      <Mark correct={result.correct} delay={delay + 0.1} />
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            'text-[13px] font-bold tracking-[0.1em]',
            result.correct ? 'text-correct-text' : 'text-incorrect-text',
          )}
        >
          {result.correct ? '正解' : result.invalidInput ? '未回答' : '不正解'}
        </span>
        {!result.correct && (
          <span className="text-body-sm text-ink-body">
            正解は <strong className="font-bold text-ink">{result.expected}</strong>
          </span>
        )}
        {result.hint && <span className="text-body-sm text-ink-body">{result.hint}</span>}
      </div>
    </motion.div>
  )
}

/** 記述の入力欄。字数（空白を除く）を数えて見せる */
function WrittenField({
  id,
  step,
  value,
  onChange,
  disabled,
}: {
  id: string
  step: WrittenStep
  value: string
  onChange: (text: string) => void
  disabled: boolean
}) {
  const length = writtenLength(value)
  const over = length > step.maxLength
  return (
    <div className="flex flex-col gap-3">
      <label
        id={`${id}-label`}
        htmlFor={id}
        className="font-ja text-base font-bold tracking-[0.08em]"
      >
        {step.prompt}
      </label>
      <textarea
        id={id}
        value={value}
        disabled={disabled}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-count`}
        className="min-h-28 w-full resize-y rounded-md border border-line bg-paper p-4 font-ja text-[16px] leading-[1.9] tracking-text focus:border-ember focus:outline-none disabled:text-ink"
      />
      <span
        id={`${id}-count`}
        aria-live="polite"
        className={cn('self-end text-caption tabular-nums', over ? 'text-ink' : 'text-ink-muted')}
      >
        {length} / {step.maxLength} 字{over && '（字数を超えています）'}
      </span>
    </div>
  )
}

/** 記述の採点結果：満たした観点と足りない観点、模範解答 */
function WrittenResultRow({
  step,
  params,
  text,
  result,
}: {
  step: WrittenStep
  params: Params
  text: string
  result: StepResult
}) {
  const reduceMotion = useReducedMotion()
  const matches = matchKeywords(step, params, text)
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex items-start gap-4 rounded-md p-4',
        result.correct ? 'bg-correct-50' : 'bg-incorrect-50',
      )}
    >
      <Mark correct={result.correct} />
      <div className="flex flex-col gap-3">
        <span
          className={cn(
            'text-[13px] font-bold tracking-[0.1em]',
            result.correct ? 'text-correct-text' : 'text-incorrect-text',
          )}
        >
          {result.invalidInput
            ? '未回答'
            : `${Math.round(result.earned * 10) / 10} / ${result.points} 点（キーワードによる目安）`}
        </span>
        {result.hint && <span className="text-body-sm text-ink-body">{result.hint}</span>}
        <ul className="flex flex-wrap gap-2" aria-label="採点の観点">
          {matches.map((match) => (
            <li
              key={match.label}
              className={cn(
                'rounded-pill border px-3 py-1 text-[12px] font-bold tracking-[0.05em]',
                match.matched
                  ? 'border-correct-300 text-correct-text'
                  : 'border-incorrect-300 text-incorrect-text',
              )}
            >
              {match.matched ? '○' : '×'} {match.label}
              <span className="sr-only">{match.matched ? '（満たしている）' : '（足りない）'}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-bold tracking-[0.1em]">模範解答</span>
          <p className="text-body-sm text-ink-body">{result.expected}</p>
        </div>
        <span className="text-caption text-ink-muted">
          表現の違いは自動では判定しきれないので、模範解答と見比べて確かめてください。
        </span>
      </div>
    </motion.div>
  )
}
