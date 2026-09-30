import { describe, expect, it } from 'vitest'
import { applyRounding, nearlyEqual } from './rounding'

describe('applyRounding', () => {
  it('小数点第3位を四捨五入する', () => {
    expect(applyRounding(12.345, { mode: 'halfUp', digits: 2 })).toBe(12.35)
    expect(applyRounding(12.344, { mode: 'halfUp', digits: 2 })).toBe(12.34)
  })

  it('浮動小数の誤差があっても正しく四捨五入する', () => {
    // 1.005 は内部では 1.00499999… だが、見た目どおり 1.01 にする
    expect(applyRounding(1.005, { mode: 'halfUp', digits: 2 })).toBe(1.01)
    expect(applyRounding(0.1 + 0.2, { mode: 'halfUp', digits: 1 })).toBe(0.3)
    // 比率の計算結果（例：営業利益 / 売上高 × 100）
    expect(applyRounding((1234 / 5678) * 100, { mode: 'halfUp', digits: 2 })).toBe(21.73)
  })

  it('千円未満を切り捨てる', () => {
    expect(applyRounding(123_456, { mode: 'down', digits: -3 })).toBe(123_000)
    expect(applyRounding(123_999, { mode: 'down', digits: -3 })).toBe(123_000)
  })

  it('整数に切り上げる', () => {
    expect(applyRounding(2.01, { mode: 'up', digits: 0 })).toBe(3)
    expect(applyRounding(2, { mode: 'up', digits: 0 })).toBe(2)
  })

  it('負の数は絶対値で丸めてから符号を戻す', () => {
    expect(applyRounding(-2.5, { mode: 'halfUp', digits: 0 })).toBe(-3)
    expect(applyRounding(-2.7, { mode: 'down', digits: 0 })).toBe(-2)
    expect(applyRounding(-2.1, { mode: 'up', digits: 0 })).toBe(-3)
  })

  it('-0 は 0 にする', () => {
    expect(Object.is(applyRounding(-0.001, { mode: 'halfUp', digits: 2 }), 0)).toBe(true)
  })
})

describe('nearlyEqual', () => {
  it('浮動小数の誤差は一致とみなす', () => {
    expect(nearlyEqual(0.1 + 0.2, 0.3)).toBe(true)
    expect(nearlyEqual(1_000_000.0000001, 1_000_000)).toBe(true)
  })

  it('意味のある差は一致とみなさない', () => {
    expect(nearlyEqual(0.3, 0.31)).toBe(false)
  })
})
