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

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

let iosSwitch: HTMLLabelElement | null = null

function tickIos() {
  if (!iosSwitch) {
    const label = document.createElement('label')
    label.setAttribute('aria-hidden', 'true')
    label.style.cssText =
      'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    label.append(input)
    document.body.append(label)
    iosSwitch = label
  }
  // スイッチにフォーカスが移ってキーボードが閉じたりしないよう、元に戻す
  const active = document.activeElement
  iosSwitch.click()
  if (active instanceof HTMLElement && document.activeElement !== active) active.focus()
}

export function vibrate(name: SoundName): void {
  const pattern = PATTERNS[name]
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern)
    return
  }
  if (!isIos()) return
  // 振動する部分（偶数番目）の数だけ、間をあけて鳴らす
  let delay = 0
  pattern.forEach((ms, i) => {
    if (i % 2 === 0) setTimeout(tickIos, delay)
    delay += ms + (i % 2 === 0 ? 40 : 0)
  })
}
