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

/**
 * 文字を入力する欄にフォーカスがあるか。
 * スマホでキーボードが出ている間は、画面下に固定した要素がスクロールでずれて浮いてしまう
 * （iOS Safari は固定要素をキーボードの上ではなくページ全体の下端に合わせる）ので、その間は隠すのに使う。
 */
export function useTextInputFocused(): boolean {
  const [focused, setFocused] = useState(() => isTextEntry(document.activeElement))
  useEffect(() => {
    // 入力欄から入力欄へ移るときは focusout → focusin の順に来るので、落ち着いてから確かめる
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setFocused(isTextEntry(document.activeElement)), 0)
    }
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [])
  return focused
}
