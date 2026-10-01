import { useId, useState } from 'react'
import { formatNumber, parseNumber } from '@/engine/numbers'
import type { JournalAnswer, JournalLine } from '@/engine/types'
import { cn } from '@/lib/utils'

type Row = { key: number; accountId: string; amount: string }
type Side = 'debits' | 'credits'

const SIDE_LABELS: Record<Side, string> = { debits: '借方', credits: '貸方' }

let nextKey = 0
const emptyRow = (): Row => ({ key: (nextKey += 1), accountId: '', amount: '' })

/** 行の入力から、採点に渡す仕訳を作る（科目か金額が空の行は無視する） */
function toLines(rows: readonly Row[]): JournalLine[] {
  return rows.flatMap((row) => {
    const amount = parseNumber(row.amount)
    return row.accountId && amount !== null ? [{ accountId: row.accountId, amount }] : []
  })
}

function total(rows: readonly Row[]): number {
  return toLines(rows).reduce((sum, line) => sum + line.amount, 0)
}

type Accounts = readonly { id: string; name: string }[]

/** 仕訳の入力（問題の解答と、フリーモードの記帳で使う） */
export function JournalField({
  id,
  prompt,
  accounts,
  onChange,
  disabled = false,
}: {
  id: string
  prompt: string
  accounts: Accounts
  onChange: (answer: JournalAnswer) => void
  disabled?: boolean
}) {
  const graded = disabled
  const [rows, setRows] = useState<Record<Side, Row[]>>({
    debits: [emptyRow()],
    credits: [emptyRow()],
  })

  const update = (next: Record<Side, Row[]>) => {
    setRows(next)
    onChange({ debits: toLines(next.debits), credits: toLines(next.credits) })
  }
  const updateRow = (side: Side, key: number, patch: Partial<Row>) =>
    update({
      ...rows,
      [side]: rows[side].map((row) => (row.key === key ? { ...row, ...patch } : row)),
    })
  const addRow = (side: Side) => update({ ...rows, [side]: [...rows[side], emptyRow()] })
  const removeRow = (side: Side, key: number) =>
    update({ ...rows, [side]: rows[side].filter((row) => row.key !== key) })

  const debitTotal = total(rows.debits)
  const creditTotal = total(rows.credits)
  const touched = debitTotal > 0 || creditTotal > 0

  return (
    <fieldset className="flex flex-col gap-5">
      <legend id={`${id}-label`} className="mb-3 font-ja text-base font-bold tracking-[0.08em]">
        {prompt}
      </legend>
      {/* 借方と貸方を横に並べるかは、置かれた場所の幅で決める（フリーモードの狭いパネルでは縦に並べる） */}
      <div className="@container">
        <div className="grid gap-8 @2xl:grid-cols-2">
          {(['debits', 'credits'] as const).map((side) => (
            <SideRows
              key={side}
              side={side}
              rows={rows[side]}
              accounts={accounts}
              disabled={graded}
              onChangeRow={(key, patch) => updateRow(side, key, patch)}
              onAdd={() => addRow(side)}
              onRemove={(key) => removeRow(side, key)}
            />
          ))}
        </div>
      </div>
      <p
        className={cn(
          'text-caption tabular-nums',
          touched && debitTotal !== creditTotal ? 'text-ink-body' : 'text-ink-muted',
        )}
      >
        借方合計 {formatNumber(debitTotal)} ／ 貸方合計 {formatNumber(creditTotal)}
        {touched && debitTotal !== creditTotal && '（貸借が一致していません）'}
      </p>
    </fieldset>
  )
}

function SideRows({
  side,
  rows,
  accounts,
  disabled,
  onChangeRow,
  onAdd,
  onRemove,
}: {
  side: Side
  rows: readonly Row[]
  accounts: Accounts
  disabled: boolean
  onChangeRow: (key: number, patch: Partial<Row>) => void
  onAdd: () => void
  onRemove: (key: number) => void
}) {
  const baseId = useId()
  const label = SIDE_LABELS[side]
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-bold tracking-[0.1em]">{label}</span>
      {rows.map((row, index) => (
        <div key={row.key} className="flex items-end gap-3">
          <label className="sr-only" htmlFor={`${baseId}-account-${row.key}`}>
            {label} {index + 1} 行目の科目
          </label>
          <select
            id={`${baseId}-account-${row.key}`}
            value={row.accountId}
            disabled={disabled}
            onChange={(event) => onChangeRow(row.key, { accountId: event.target.value })}
            className="h-12 min-w-0 flex-1 border-0 border-b border-ink bg-transparent px-1 text-[15px] tracking-text focus:border-b-2 focus:border-ember focus:outline-none disabled:text-ink"
          >
            <option value="">科目を選ぶ</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${baseId}-amount-${row.key}`}>
            {label} {index + 1} 行目の金額
          </label>
          <input
            id={`${baseId}-amount-${row.key}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={row.amount}
            disabled={disabled}
            onChange={(event) => onChangeRow(row.key, { amount: event.target.value })}
            className="h-12 w-32 min-w-0 border-0 border-b border-ink bg-transparent px-1 text-right text-[17px] font-bold tracking-text tabular-nums focus:border-b-2 focus:border-ember focus:outline-none disabled:text-ink"
          />
          {rows.length > 1 && !disabled && (
            <button
              type="button"
              onClick={() => onRemove(row.key)}
              className="h-12 shrink-0 px-2 text-caption text-ink-muted hover:text-ink"
            >
              削除
              <span className="sr-only">
                （{label} {index + 1} 行目）
              </span>
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={onAdd}
          className="self-start rounded-pill border border-line px-4 py-2 text-tag hover:border-ink"
        >
          {label}に行を追加
        </button>
      )}
    </div>
  )
}
