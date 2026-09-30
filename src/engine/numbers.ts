import type { Unit } from './types'

/**
 * ユーザーが入力した数値を読み取る。読めなければ null。
 * - 全角数字・全角記号（NFKC で半角に）
 * - 桁区切りのカンマ、空白
 * - 末尾の単位（千円・円・%・回・倍・年・日・個）
 * - マイナス：「-」のほか、試験で使う「△」「▲」
 */
export function parseNumber(input: string): number | null {
  let text = input.normalize('NFKC').replace(/[\s,]/g, '')
  text = text.replace(/(千円|円|%|回|倍|年|日|個)$/, '')
  let sign = 1
  if (/^[△▲−-]/.test(text)) {
    sign = -1
    text = text.slice(1)
  }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null
  const value = sign * Number(text)
  return value === 0 ? 0 : value
}

const NEGATIVE_PREFIX = /^\s*[△▲\-−－]/

/** 入力がマイナスを表しているか（先頭が △ ▲ - のどれか） */
export function isNegative(input: string): boolean {
  return NEGATIVE_PREFIX.test(input)
}

/**
 * 入力の先頭の「△」を付けたり外したりする。
 * スマホの数字キーボードにはマイナスがないことが多いため、± ボタンから使う。
 * 試験の答案と同じ表記に合わせて、付けるときは △ を使う。
 */
export function toggleSign(input: string): string {
  return isNegative(input) ? input.replace(NEGATIVE_PREFIX, '') : `△${input.trimStart()}`
}

/**
 * 表示用の数値。桁区切りを付け、マイナスは試験と同じ「△」で表す。
 * digits を指定しなければ、小数は必要な桁だけ表示する（最大 6 桁）。
 */
export function formatNumber(value: number, digits?: number): string {
  // 「千円未満」など負の桁の丸めでは小数を表示しない
  if (digits !== undefined) digits = Math.max(0, digits)
  const formatted = Math.abs(value).toLocaleString('ja-JP', {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? 6,
  })
  return value < 0 ? `△${formatted}` : formatted
}

export function formatWithUnit(value: number, unit: Unit | undefined, digits?: number): string {
  return `${formatNumber(value, digits)}${unit ?? ''}`
}
