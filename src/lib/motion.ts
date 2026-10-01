/**
 * 動きのトークン（docs/DESIGN.md §3.4：長さやイージングを全画面で揃える）。
 * 派手さより、なめらかで気持ちいい動きにする。
 */

/** 速く出て、ゆっくり止まる（Tessera の基本のイージング） */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const

/** 記号やバッジが「ポン」と出るときのばね */
export const SPRING_POP = { type: 'spring', stiffness: 420, damping: 18 } as const
/** カードが少し弾んで落ち着くときのばね */
export const SPRING_SOFT = { type: 'spring', stiffness: 260, damping: 20 } as const

/** 演出の長さ（秒） */
export const DURATION = {
  /** 結果の表示、カードの出現 */
  enter: 0.5,
  /** 正解の波紋・火花 */
  burst: 0.9,
  /** 経験値のバーが伸びる */
  fill: 1.1,
} as const

/** 演出を出す順番（秒）。結果 → 経験値 → レベルアップ → ストリーク の順に流れるように */
export const STAGE = {
  feedback: 0,
  reward: 0.25,
  levelUp: 0.25 + 0.55,
  streak: 1.4,
} as const
