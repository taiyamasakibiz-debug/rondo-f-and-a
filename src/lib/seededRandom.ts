/**
 * 見た目の飾り（デジタルライン）用の、seed で決まる乱数（0 以上 1 未満）。
 * 同じ seed なら毎回同じ線になり、再描画のたびに形が変わらない。
 * 問題の数値には使わない（問題は src/engine/random.ts）。
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}
