import { annuityFactor, presentValueFactor } from '@/domain/investment/investment'
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

/** 試験と同じく、小数第 3 位までの年金現価係数（years 年分） */
export function annuityFactorOf(rate: number, years: number): number {
  return annuityFactor(rate, years, 3)
}

/** 年金現価係数の表（その割引率・年数の 1 つだけ。複利現価係数と並べると、どちらを使うかで答えがずれるため） */
export function annuityFactorBlock(rate: number, years: number): Block {
  return {
    type: 'table',
    caption: `年金現価係数（割引率 ${formatNumber(rate * 100)}%）`,
    headers: ['年数', `${years} 年`],
    rows: [['係数', formatNumber(annuityFactorOf(rate, years), 3)]],
  }
}
