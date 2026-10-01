import type { SoundName } from './sounds'

/**
 * 振動（触覚フィードバック）。
 * - Android など：Vibration API の振動パターン（ミリ秒。振動・休み・振動…）
 * - iPhone：Vibration API がないため、iOS 18 以降の Safari がスイッチの切り替えで出す
 *   短い振動を使う（強さや長さは選べず、パターンは回数で表す）
 */
export const PATTERNS: Record<SoundName, number[]> = {
  tap: [8],
  correct: [12, 50, 18],
  partial: [14],
  incorrect: [28],
  levelUp: [14, 60, 14, 60, 30],
  streak: [12, 50, 12],
  certified: [18, 70, 18, 70, 40],
  failed: [24],
}

/** iPhone で続けて振動させるときの間隔 */
const SWITCH_INTERVAL_MS = 100

/** Vibration API がなく、指で操作する端末（iPhone・iPad） */
function canUseSwitchHaptics(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
}

/**
 * iOS の Safari は、スイッチ（<input type="checkbox" switch>）が切り替わると短く振動する。
 * 見えないスイッチを作ってラベルを押し、すぐ取り除く。
 * タップの処理の中から「同期的に」呼ばないと振動しないので、setTimeout などを挟まない。
 */
function tickSwitch() {
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.display = 'none'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  label.append(input)
  // body に置くとフォーカスが動いてキーボードが閉じることがあるので、head に置く
  document.head.append(label)
  try {
    label.click()
  } finally {
    label.remove()
  }
}

export function vibrate(name: SoundName): void {
  const pattern = PATTERNS[name]
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern)
    return
  }
  if (!canUseSwitchHaptics()) return
  // 振動する部分（偶数番目）の数だけ鳴らす。1 回目はタップの処理の中ですぐに鳴らし、
  // 2 回目からは間をあける（近すぎると 1 回にまとまってしまう）
  const pulses = Math.ceil(pattern.length / 2)
  tickSwitch()
  for (let i = 1; i < pulses; i += 1) setTimeout(tickSwitch, i * SWITCH_INTERVAL_MS)
}
