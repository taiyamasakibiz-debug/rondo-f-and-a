import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { isTextEntry, useTextInputFocused } from './useTextInputFocused'

function Probe() {
  const typing = useTextInputFocused()
  return (
    <>
      <input aria-label="金額" inputMode="decimal" />
      <input aria-label="チェック" type="checkbox" />
      <select aria-label="ノルマ">
        <option>1</option>
      </select>
      <p>{typing ? '入力中' : '入力していない'}</p>
    </>
  )
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
}

describe('useTextInputFocused', () => {
  it('文字の入力欄にフォーカスがある間だけ true', async () => {
    render(<Probe />)
    expect(screen.getByText('入力していない')).toBeInTheDocument()

    act(() => screen.getByLabelText('金額').focus())
    await settle()
    expect(screen.getByText('入力中')).toBeInTheDocument()

    // 入力欄から入力欄へ移っても、途中で false にならない
    act(() => screen.getByLabelText('ノルマ').focus())
    await settle()
    expect(screen.getByText('入力中')).toBeInTheDocument()

    act(() => screen.getByLabelText('チェック').focus())
    await settle()
    expect(screen.getByText('入力していない')).toBeInTheDocument()
  })

  it('ボタンやチェックボックスは入力欄に数えない', () => {
    expect(isTextEntry(document.createElement('button'))).toBe(false)
    const radio = document.createElement('input')
    radio.type = 'radio'
    expect(isTextEntry(radio)).toBe(false)
    expect(isTextEntry(document.createElement('textarea'))).toBe(true)
    expect(isTextEntry(null)).toBe(false)
  })
})
