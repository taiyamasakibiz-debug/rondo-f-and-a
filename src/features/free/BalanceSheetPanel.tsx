import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { AnimatedNumber } from './AnimatedNumber'
import { Panel } from './Panel'
import { useFreeStatements } from './useFreeStatements'

type Block = { label: string; value: number; className: string }

/**
 * B/S のブロック図。資産と「負債・純資産」の大きさを面積で見せる（v1 の天秤の代わり）。
 * 仕訳が入るたびに、ブロックの高さがなめらかに変わる。
 */
export function BalanceSheetPanel() {
  const { balanceSheet: bs, totals: t, profits } = useFreeStatements()
  const left: Block[] = [
    { label: '流動資産', value: t.currentAssets, className: 'bg-sky-50' },
    { label: '固定資産', value: t.fixedAssets + bs.deferredAssets, className: 'bg-fog' },
  ]
  const right: Block[] = [
    { label: '流動負債', value: t.currentLiabilities, className: 'bg-haze' },
    { label: '固定負債', value: t.fixedLiabilities, className: 'bg-fog' },
    { label: '純資産', value: t.netAssets, className: 'bg-ink text-on-ink' },
  ]
  const scale = Math.max(t.totalAssets, t.totalLiabilitiesAndNetAssets, 1)
  const empty = t.totalAssets === 0 && t.totalLiabilitiesAndNetAssets === 0

  const rows: [string, number][] = [
    ['現金預金', bs.cashAndDeposits],
    ['売上債権', bs.receivables],
    ['貸倒引当金', bs.allowanceForDoubtfulAccounts],
    ['有価証券', bs.securities],
    ['棚卸資産', bs.inventories],
    ['その他の流動資産', bs.otherCurrentAssets],
    ['有形固定資産', bs.tangibleFixedAssets],
    ['無形固定資産', bs.intangibleFixedAssets],
    ['投資その他の資産', bs.investmentsAndOtherAssets],
    ['繰延資産', bs.deferredAssets],
  ]
  const rightRows: [string, number][] = [
    ['仕入債務', bs.payables],
    ['短期借入金', bs.shortTermBorrowings],
    ['その他の流動負債', bs.otherCurrentLiabilities],
    ['長期借入金', bs.longTermBorrowings],
    ['その他の固定負債', bs.otherFixedLiabilities],
    ['資本金', bs.capitalStock],
    ['資本剰余金', bs.capitalSurplus],
    ['利益剰余金', bs.retainedEarnings],
    ['その他の純資産', bs.otherNetAssets],
  ]

  return (
    <Panel id="bs">
      {empty ? (
        <p className="text-body-sm text-ink-muted">
          仕訳を記帳すると、ここに B/S が組み上がります。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3" aria-hidden>
            <BlockColumn blocks={left} scale={scale} />
            <BlockColumn blocks={right} scale={scale} />
          </div>
          <p className="text-caption text-ink-muted">
            資産合計{' '}
            <AnimatedNumber value={t.totalAssets} className="font-bold text-ink tabular-nums" /> ＝
            負債・純資産合計{' '}
            <AnimatedNumber
              value={t.totalLiabilitiesAndNetAssets}
              className="font-bold text-ink tabular-nums"
            />
            {profits.netIncome !== 0 && (
              <>（利益剰余金に、決算振替前の当期純利益 {formatSigned(profits.netIncome)} を含む）</>
            )}
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <AmountList caption="資産" rows={rows} total={t.totalAssets} />
            <AmountList
              caption="負債・純資産"
              rows={rightRows}
              total={t.totalLiabilitiesAndNetAssets}
            />
          </div>
        </>
      )}
    </Panel>
  )
}

/**
 * 金額をそのまま flex-grow にして、ブロックの高さを金額の比で分ける。
 * 金額が 0 のブロックは描かず（隙間だけが残らないように）、合計が scale に満たない分は空白で埋める。
 */
function BlockColumn({ blocks, scale }: { blocks: Block[]; scale: number }) {
  const reduceMotion = useReducedMotion()
  const visible = blocks.filter((block) => block.value > 0)
  const filler = Math.max(0, scale - visible.reduce((sum, block) => sum + block.value, 0))
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }
  return (
    <div className="flex h-72 flex-col gap-1">
      <AnimatePresence initial={false}>
        {visible.map((block) => {
          const share = block.value / scale
          return (
            <motion.div
              key={block.label}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: block.value }}
              exit={{ flexGrow: 0, opacity: 0 }}
              transition={transition}
              style={{ flexBasis: 0 }}
              className={cn(
                'flex min-h-0 items-start justify-between overflow-hidden rounded-md px-3 text-[12px] font-bold tracking-[0.08em]',
                block.className,
                share > 0.08 ? 'py-2' : 'py-0',
              )}
            >
              {share > 0.08 && (
                <>
                  <span className="font-ja">{block.label}</span>
                  <AnimatedNumber value={block.value} className="tabular-nums" />
                </>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
      {filler > 0 && <div style={{ flexGrow: filler, flexBasis: 0 }} />}
    </div>
  )
}

export function AmountList({
  caption,
  rows,
  total,
}: {
  caption: string
  rows: [string, number][]
  total: number
}) {
  const shown = rows.filter(([, value]) => value !== 0)
  return (
    <table className="w-full border-collapse text-[14px] tracking-text">
      <caption className="mb-2 text-left text-[13px] font-bold tracking-[0.1em]">{caption}</caption>
      <tbody>
        {shown.map(([label, value]) => (
          <tr key={label} className="border-b border-line-soft">
            <th scope="row" className="py-2 text-left font-medium">
              {label}
            </th>
            <td className="py-2 text-right tabular-nums">
              <AnimatedNumber value={value} />
            </td>
          </tr>
        ))}
        <tr className="border-b border-line">
          <th scope="row" className="py-2 text-left font-bold">
            合計
          </th>
          <td className="py-2 text-right font-bold tabular-nums">
            <AnimatedNumber value={total} />
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function formatSigned(value: number): string {
  return value < 0 ? `△${Math.abs(value).toLocaleString('ja-JP')}` : value.toLocaleString('ja-JP')
}
