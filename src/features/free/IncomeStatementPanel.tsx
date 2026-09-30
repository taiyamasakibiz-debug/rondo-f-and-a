import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { Panel } from './Panel'
import { useFreeStatements } from './useFreeStatements'

type Row = { label: string; value: number; profit?: boolean; sign?: '+' | '−' }

/** P/L の段階利益。売上高を 100% として、各行の大きさをバーで見せる */
export function IncomeStatementPanel() {
  const { incomeStatement: pl, profits } = useFreeStatements()
  const reduceMotion = useReducedMotion()
  const rows: Row[] = [
    { label: '売上高', value: pl.sales, profit: true },
    { label: '売上原価', value: pl.costOfSales, sign: '−' },
    { label: '売上総利益', value: profits.grossProfit, profit: true },
    { label: '販売費及び一般管理費', value: pl.sellingGeneralAndAdministrativeExpenses, sign: '−' },
    { label: '営業利益', value: profits.operatingProfit, profit: true },
    { label: '営業外収益', value: pl.nonOperatingIncome, sign: '+' },
    { label: '営業外費用', value: pl.nonOperatingExpenses, sign: '−' },
    { label: '経常利益', value: profits.ordinaryProfit, profit: true },
    { label: '特別利益', value: pl.extraordinaryIncome, sign: '+' },
    { label: '特別損失', value: pl.extraordinaryLosses, sign: '−' },
    { label: '税引前当期純利益', value: profits.profitBeforeTax, profit: true },
    { label: '法人税等', value: pl.incomeTaxes, sign: '−' },
    { label: '当期純利益', value: profits.netIncome, profit: true },
  ]
  const scale = Math.max(...rows.map((row) => Math.abs(row.value)), 1)
  const empty = rows.every((row) => row.value === 0)

  return (
    <Panel id="pl">
      {empty ? (
        <p className="text-body-sm text-ink-muted">
          収益・費用の仕訳を記帳すると、段階利益がここに並びます。決算振替のあとは 0 に戻ります。
        </p>
      ) : (
        <ul className="flex flex-col">
          {rows
            .filter((row) => row.profit || row.value !== 0)
            .map((row) => (
              <li
                key={row.label}
                className={cn(
                  'grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 py-2.5',
                  row.profit ? 'border-t border-line' : 'pl-4',
                )}
              >
                <span
                  className={cn(
                    'font-ja text-[14px] tracking-text',
                    row.profit ? 'font-bold' : 'text-ink-body',
                  )}
                >
                  {row.sign && <span className="mr-2 text-ink-muted">{row.sign}</span>}
                  {row.label}
                </span>
                <span className={cn('text-right tabular-nums', row.profit ? 'font-bold' : '')}>
                  {row.value < 0 && '△'}
                  <AnimatedNumber value={Math.abs(row.value)} />
                </span>
                <div className="col-span-2 h-1.5 overflow-hidden rounded-pill bg-line-soft">
                  <motion.div
                    initial={false}
                    animate={{ width: `${(Math.abs(row.value) / scale) * 100}%` }}
                    transition={
                      reduceMotion ? { duration: 0 } : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
                    }
                    className={cn(
                      'h-full rounded-pill',
                      row.value < 0 ? 'bg-stone' : row.profit ? 'bg-ink' : 'bg-line',
                    )}
                  />
                </div>
              </li>
            ))}
        </ul>
      )}
    </Panel>
  )
}
