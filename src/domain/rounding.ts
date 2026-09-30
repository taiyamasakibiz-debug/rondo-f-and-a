/**
 * 端数処理。事例Ⅳの設問にある指定をそのまま表現する。
 *
 * - 「小数点第3位を四捨五入」→ { mode: 'halfUp', digits: 2 }
 * - 「千円未満を切り捨て」    → { mode: 'down', digits: -3 }
 * - 「整数で答える（切り上げ）」→ { mode: 'up', digits: 0 }
 *
 * digits は「残す桁」。正なら小数点以下の桁数、負なら 10 の位・100 の位…で丸める。
 * 負の数は絶対値で丸めてから符号を戻す（-2.5 の四捨五入は -3、切り捨ては -2）。
 */
export type RoundingMode = 'halfUp' | 'down' | 'up'

export type RoundingRule = {
  mode: RoundingMode
  digits: number
}

export function applyRounding(value: number, rule: RoundingRule): number {
  if (!Number.isFinite(value)) return value
  const sign = value < 0 ? -1 : 1
  const shifted = shift(Math.abs(value), rule.digits)
  // 浮動小数の誤差（1.005 が 1.00499… になる など）で丸めがずれないように、
  // 12 桁に揃えてから整数部を取り出す
  const cleaned = Number(shifted.toPrecision(12))
  let integer: number
  switch (rule.mode) {
    case 'halfUp':
      integer = Math.floor(cleaned + 0.5)
      break
    case 'down':
      integer = Math.floor(cleaned)
      break
    case 'up':
      integer = Math.ceil(cleaned)
      break
  }
  const result = sign * shift(integer, -rule.digits)
  // -0 を 0 にそろえる
  return result === 0 ? 0 : result
}

// 10 のべき乗の掛け算を指数表記で行い、0.1 * 3 のような誤差を避ける
function shift(value: number, digits: number): number {
  const [mantissa, exponent = '0'] = String(value).split('e')
  return Number(`${mantissa}e${Number(exponent) + digits}`)
}

/**
 * 比較のための許容誤差つき一致判定。丸めを当ててから比べるのが基本で、
 * これは丸めの指定がない値（中間計算など）に使う。
 */
export function nearlyEqual(a: number, b: number, tolerance = 1e-9): boolean {
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b))
}
