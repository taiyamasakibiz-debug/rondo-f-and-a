import { useEffect, useState } from 'react'

/**
 * キーボードが出ない入力欄。日付や月はピッカー（スマホでは回して選ぶ部品）が出るだけで、
 * 見えている高さが変わらないので、閉じたことに気づけず、下のタブが隠れたままになってしまう
 */
const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'date',
  'datetime-local',
  'file',
  'hidden',
  'image',
  'month',
  'radio',
  'range',
  'reset',
  'submit',
  'time',
  'week',
])

/** キーボード（スマホではソフトウェアキーボード）で入力する要素か */
export function isTextEntry(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false
  if (element instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(element.type)
  // 選択欄（select）もキーボードではなくピッカーが出るので数えない
  return element instanceof HTMLTextAreaElement || element.isContentEditable === true
}

/** 見えている高さがこれだけ減っていたら、キーボードが出ているとみなす */
const KEYBOARD_MIN_PX = 120

/**
 * 見えている高さが元に戻ってから、キーボードが閉じたとみなすまでの時間。
 * キーボードを出したままスクロールすると、iOS では高さが一瞬だけ変わることがあり、そのたびに下のタブが出てしまうため
 */
const CLOSE_SETTLE_MS = 300

/** 見えている高さ */
function visibleHeight(): number {
  const viewport = window.visualViewport
  return viewport ? viewport.height * viewport.scale : window.innerHeight
}

/**
 * スマホでキーボードが出ているか（文字を入力する欄にフォーカスがある間）。
 * キーボードが出ている間は、画面下に固定した要素がスクロールでずれて浮いてしまう
 * （iOS Safari は固定要素をキーボードの上ではなくページ全体の下端に合わせる）ので、その間は隠すのに使う。
 *
 * フォーカスが残ったままキーボードだけ閉じた場合（Android の戻るなど）も、見えている高さが元に戻ったら false にする。
 * キーボードが出ているかは、入力を始める前の見えている高さと比べて決める（ページの高さ innerHeight とは比べない。
 * iOS ではキーボードを出したままスクロールすると、innerHeight も一緒に縮むことがあり、閉じたと勘違いしてしまうため）
 */
export function useTextInputFocused(): boolean {
  const [focused, setFocused] = useState(() => isTextEntry(document.activeElement))
  // フォーカスしたあとにキーボードが出て、そのあと閉じた
  const [closedWhileFocused, setClosedWhileFocused] = useState(false)

  useEffect(() => {
    // キーボードが出ていないときの見えている高さ（入力していない間に測り直す）
    let fullHeight = visibleHeight()
    const keyboardShown = () => fullHeight - visibleHeight() > KEYBOARD_MIN_PX
    let opened = isTextEntry(document.activeElement) && keyboardShown()
    // 入力欄から入力欄へ移るときは focusout → focusin の順に来るので、落ち着いてから確かめる
    let timer: ReturnType<typeof setTimeout> | undefined
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const next = isTextEntry(document.activeElement)
        setFocused(next)
        if (next) {
          opened = keyboardShown()
          setClosedWhileFocused(false)
        } else {
          clearTimeout(closeTimer)
          opened = false
        }
      }, 0)
    }
    const onFocusOut = (event: FocusEvent) => {
      // 入力欄の外へフォーカスが外れたとき（キーボードの ✓ で閉じたときなど）は、待たずにすぐ戻す
      const next = event.relatedTarget instanceof Element ? event.relatedTarget : null
      if (!isTextEntry(next)) setFocused(false)
      update()
    }
    const onResize = () => {
      if (!isTextEntry(document.activeElement)) {
        // 入力していないときの高さを、キーボードがないときの高さとして覚える（画面の回転などにも追いつく）
        fullHeight = visibleHeight()
        return
      }
      if (keyboardShown()) {
        opened = true
        clearTimeout(closeTimer)
        closeTimer = undefined
        setClosedWhileFocused(false)
      } else if (opened && closeTimer === undefined) {
        // 高さが戻った状態がしばらく続いたら、キーボードが閉じたとみなす
        closeTimer = setTimeout(() => {
          closeTimer = undefined
          if (!keyboardShown()) {
            opened = false
            setClosedWhileFocused(true)
          }
        }, CLOSE_SETTLE_MS)
      }
    }
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', onFocusOut)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      clearTimeout(closeTimer)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', onFocusOut)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])
  return focused && !closedWhileFocused
}
