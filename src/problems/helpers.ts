import { presentValueFactor } from '@/domain/investment/investment'
import { formatNumber } from '@/engine/numbers'
import type { Block } from '@/engine/types'

/** 金額の表示（桁区切り、マイナスは △） */
export const yen = (value: number) => formatNumber(value)

/** 比率を % で表示（小数 digits 桁） */
export const pct = (ratio: number, digits = 1) => `${formatNumber(ratio * 100, digits)}%`

export function text(value: string): Block {
  return { type: 'text', text: value }
}

/** 「項目・金額」の 2 列の表。金額以外（数量など）も並ぶときは valueHeader を変える */
export function amountTable(
  caption: string,
  rows: readonly [string, number][],
  valueHeader = '金額',
): Block {
  return {
    type: 'table',
    caption,
    headers: ['項目', valueHeader],
    rows: rows.map(([label, value]) => [label, yen(value)]),
  }
}

/** 「項目・前期末・当期末」のように、列が複数ある金額の表 */
export function multiColumnTable(
  caption: string,
  columns: readonly string[],
  rows: readonly [string, ...number[]][],
): Block {
  return {
    type: 'table',
    caption,
    headers: ['項目', ...columns],
    rows: rows.map(([label, ...values]) => [label, ...values.map(yen)]),
  }
}

/** 試験と同じく、小数第 3 位までの複利現価係数（1 年目から） */
export function discountFactorsTable(rate: number, years: number): number[] {
  return Array.from({ length: years }, (_, i) => presentValueFactor(rate, i + 1, 3))
}

export function factorBlock(rate: number, years: number): Block {
  const factors = discountFactorsTable(rate, years)
  return {
    type: 'table',
    caption: `複利現価係数（割引率 ${formatNumber(rate * 100)}%）`,
    headers: ['年', ...factors.map((_, i) => `${i + 1} 年`)],
    rows: [['係数', ...factors.map((factor) => formatNumber(factor, 3))]],
  }
}
