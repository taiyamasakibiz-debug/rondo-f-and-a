import { ACTIVITY_LABELS, type Activity } from '@/domain/cashflow/byActivity'
import { AnimatedNumber } from './AnimatedNumber'
import { Panel } from './Panel'
import { useFreeStatements } from './useFreeStatements'

const ACTIVITIES: Activity[] = ['operating', 'investing', 'financing']

function Signed({ value, bold = false }: { value: number; bold?: boolean }) {
  const rounded = Math.round(value)
  return (
    <span className={bold ? 'font-bold tabular-nums' : 'tabular-nums'}>
      {rounded < 0 && '△'}
      <AnimatedNumber value={Math.abs(rounded)} />
    </span>
  )
}

/** 現金の動きを、相手の科目で営業・投資・財務に振り分けた CF */
export function CashFlowPanel() {
  const { cashFlow } = useFreeStatements()
  const empty = ACTIVITIES.every((activity) => cashFlow.activities[activity].items.length === 0)

  return (
    <Panel id="cf">
      {empty ? (
        <p className="text-body-sm text-ink-muted">
          「現金預金」の区分の科目が動く仕訳を記帳すると、ここに振り分けられます。
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-6">
            {ACTIVITIES.map((activity) => {
              const { items, total } = cashFlow.activities[activity]
              return (
                <div key={activity} className="flex flex-col">
                  <div className="flex items-baseline justify-between border-b border-line py-2">
                    <span className="font-ja text-[14px] font-bold tracking-text">
                      {ACTIVITY_LABELS[activity]}によるキャッシュフロー
                    </span>
                    <Signed value={total} bold />
                  </div>
                  {items.map((item) => (
                    <div
                      key={item.accountId}
                      className="flex items-baseline justify-between border-b border-line-soft py-2 pl-4 text-[14px]"
                    >
                      <span className="text-ink-body">{item.accountName}</span>
                      <Signed value={item.amount} />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
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
            現金預金が動いた仕訳ごとに、相手の科目の区分で営業・投資・財務に振り分けています（期首残高は
            0）。
          </p>
        </>
      )}
    </Panel>
  )
}
