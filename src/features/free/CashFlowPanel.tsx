import { useState } from 'react'
import { ACTIVITY_LABELS, type Activity } from '@/domain/cashflow/byActivity'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { cn } from '@/lib/utils'
import { Panel } from './Panel'
import { useFreeStatements } from './useFreeStatements'

const ACTIVITIES: Activity[] = ['operating', 'investing', 'financing']

type Method = 'direct' | 'indirect'
const METHOD_LABELS: Record<Method, string> = { direct: '直接法', indirect: '間接法' }
/** 最後に選んだ表示方法（このブラウザだけ。ウィンドウを開き直しても同じ表示にする） */
const METHOD_KEY = 'luminous-insight-cf-method'

function loadMethod(): Method {
  try {
    return localStorage.getItem(METHOD_KEY) === 'indirect' ? 'indirect' : 'direct'
  } catch {
    return 'direct'
  }
}

function Signed({ value, bold = false }: { value: number; bold?: boolean }) {
  const rounded = Math.round(value)
  return (
    <span className={bold ? 'font-bold tabular-nums' : 'tabular-nums'}>
      {rounded < 0 && '△'}
      <AnimatedNumber value={Math.abs(rounded)} />
    </span>
  )
}

function Heading({ label, total }: { label: string; total: number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line py-2">
      <span className="font-ja text-[14px] font-bold tracking-text">{label}</span>
      <Signed value={total} bold />
    </div>
  )
}

function Row({
  label,
  value,
  strong = false,
  indent = true,
}: {
  label: string
  value: number
  strong?: boolean
  indent?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-line-soft py-2 text-[14px]',
        indent && 'pl-4',
        strong && 'bg-fog/60 font-bold',
      )}
    >
      <span className={strong ? 'text-ink' : 'text-ink-body'}>{label}</span>
      <Signed value={value} bold={strong} />
    </div>
  )
}

/** 直接法と間接法を切り替えるタブ */
function MethodSwitch({
  method,
  onChange,
}: {
  method: Method
  onChange: (method: Method) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="キャッシュフロー計算書の表示方法"
      className="inline-flex self-start rounded-pill border border-line p-1"
    >
      {(['direct', 'indirect'] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={method === value}
          onClick={() => onChange(value)}
          className={cn(
            'rounded-pill px-4 py-1.5 font-ja text-[13px] font-bold tracking-[0.1em] text-ink-muted transition-colors',
            method === value && 'bg-ink text-on-ink',
          )}
        >
          {METHOD_LABELS[value]}
        </button>
      ))}
    </div>
  )
}

/** 直接法：現金の動きを、相手の科目で営業・投資・財務に振り分けた CF */
function DirectView() {
  const { cashFlow } = useFreeStatements()
  return (
    <div className="flex flex-col gap-6">
      {ACTIVITIES.map((activity) => {
        const { items, total } = cashFlow.activities[activity]
        return (
          <div key={activity} className="flex flex-col">
            <Heading label={`${ACTIVITY_LABELS[activity]}によるキャッシュフロー`} total={total} />
            {items.map((item) => (
              <Row key={item.accountId} label={item.accountName} value={item.amount} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** 間接法：営業活動を税引前当期純利益から調整して示す。投資・財務は直接法と同じ */
function IndirectView() {
  const { indirectCashFlow: cf } = useFreeStatements()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col">
        <Heading label="営業活動によるキャッシュフロー" total={cf.operating} />
        {cf.adjustments.map((line) => (
          <Row key={line.id} label={line.label} value={line.amount} />
        ))}
        <Row label="小計" value={cf.subtotal} strong />
        {cf.payments.map((line) => (
          <Row key={line.id} label={line.label} value={line.amount} />
        ))}
      </div>
      {(['investing', 'financing'] as const).map((activity) => {
        const { items, total } = cf[activity]
        return (
          <div key={activity} className="flex flex-col">
            <Heading label={`${ACTIVITY_LABELS[activity]}によるキャッシュフロー`} total={total} />
            {items.map((item) => (
              <Row key={item.accountId} label={item.accountName} value={item.amount} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** キャッシュフロー計算書。直接法と間接法を切り替えられる（どちらも合計は同じ） */
export function CashFlowPanel() {
  const { cashFlow } = useFreeStatements()
  const [method, setMethod] = useState<Method>(loadMethod)
  const changeMethod = (next: Method) => {
    setMethod(next)
    try {
      localStorage.setItem(METHOD_KEY, next)
    } catch {
      // 保存できなくても、開いている間は切り替えられる
    }
  }
  const empty = ACTIVITIES.every((activity) => cashFlow.activities[activity].items.length === 0)

  return (
    <Panel id="cf">
      <MethodSwitch method={method} onChange={changeMethod} />
      {empty ? (
        <p className="text-body-sm text-ink-muted">
          「現金預金」の区分の科目が動く仕訳を記帳すると、ここに振り分けられます。
        </p>
      ) : (
        <>
          {method === 'direct' ? <DirectView /> : <IndirectView />}
          <div className="flex flex-col gap-2 rounded-md bg-fog p-4 text-[14px]">
            <div className="flex items-baseline justify-between">
              <span className="font-ja font-bold">現金の増減額</span>
              <Signed value={cashFlow.netChange} bold />
            </div>
            <div className="flex items-baseline justify-between text-ink-muted">
              <span className="font-ja">B/S の現金預金</span>
              <Signed value={cashFlow.cashBalance} />
            </div>
          </div>
          <p className="text-caption text-ink-muted">
            {method === 'direct'
              ? '現金預金が動いた仕訳ごとに、相手の科目の区分で営業・投資・財務に振り分けています（期首残高は 0）。'
              : '営業活動は、税引前当期純利益から、現金が動かない損益と運転資本の増減で調整しています（期首残高は 0）。利息と法人税等は、小計の下に実際に受け払いした額を並べます。営業活動の合計は直接法と同じになります。'}
          </p>
        </>
      )}
    </Panel>
  )
}
