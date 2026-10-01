import { useEffect, useState } from 'react'

const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

/** キーボード（スマホではソフトウェアキーボード）で入力する要素か */
export function isTextEntry(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false
  if (element instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(element.type)
  return (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element.isContentEditable === true
  )
}

/** 見えている高さがこれだけ減っていたら、キーボードが出ているとみなす */
const KEYBOARD_MIN_PX = 120

function viewportShrunk(): boolean {
  const viewport = window.visualViewport
  if (!viewport) return false
  return window.innerHeight - viewport.height * viewport.scale > KEYBOARD_MIN_PX
}

/**
 * スマホでキーボードが出ているか（文字を入力する欄にフォーカスがある間）。
 * キーボードが出ている間は、画面下に固定した要素がスクロールでずれて浮いてしまう
 * （iOS Safari は固定要素をキーボードの上ではなくページ全体の下端に合わせる）ので、その間は隠すのに使う。
 *
 * フォーカスが残ったままキーボードだけ閉じた場合（キーボードの「完了」や Android の戻る）も、
 * 見えている高さが元に戻った時点ですぐに false にする。
 */
export function useTextInputFocused(): boolean {
  const [focused, setFocused] = useState(() => isTextEntry(document.activeElement))
  // フォーカスしたあとにキーボードが出て、そのあと閉じた
  const [closedWhileFocused, setClosedWhileFocused] = useState(false)

  useEffect(() => {
    let opened = viewportShrunk()
    // 入力欄から入力欄へ移るときは focusout → focusin の順に来るので、落ち着いてから確かめる
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const next = isTextEntry(document.activeElement)
        setFocused(next)
        if (next) {
          opened = viewportShrunk()
          setClosedWhileFocused(false)
        }
      }, 0)
    }
    const onFocusOut = (event: FocusEvent) => {
      // 入力欄の外へフォーカスが外れたとき（キーボードを閉じたときなど）は、待たずにすぐ戻す
      const next = event.relatedTarget instanceof Element ? event.relatedTarget : null
      if (!isTextEntry(next)) setFocused(false)
      update()
    }
    const onResize = () => {
      const shrunk = viewportShrunk()
      if (shrunk) {
        opened = true
        setClosedWhileFocused(false)
      } else if (opened) {
        opened = false
        setClosedWhileFocused(true)
      }
    }
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', onFocusOut)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', onFocusOut)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])
  return focused && !closedWhileFocused
}
