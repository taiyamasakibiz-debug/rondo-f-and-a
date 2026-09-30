/**
 * シード付きの乱数（mulberry32）。同じシードからは同じ問題ができるので、
 * 解答記録からの再出題や、テストでの再現に使える。
 */
export type Random = {
  /** 0 以上 1 未満 */
  next(): number
  /** min 以上 max 以下で、step 刻みの整数 */
  int(min: number, max: number, step?: number): number
  pick<T>(values: readonly T[]): T
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int(min, max, step = 1) {
      const count = Math.floor((max - min) / step) + 1
      return min + Math.floor(next() * count) * step
    },
    pick(values) {
      if (values.length === 0) throw new Error('空の配列からは選べません')
      return values[Math.floor(next() * values.length)]!
    },
  }
}

/** 新しい問題のシード（32bit の整数） */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296)
}
