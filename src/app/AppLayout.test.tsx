import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { routes } from './router'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

describe('ルーティング', () => {
  it('ホームにラボの一覧が出る', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: /Labs/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /CVP ラボ/ })).toBeInTheDocument()
  })

  it('ラボのカードから各ラボに移動できる', async () => {
    renderAt('/')
    await userEvent.click(screen.getByRole('link', { name: /投資ラボ/ }))
    expect(await screen.findByRole('heading', { name: /投資ラボ/ })).toBeInTheDocument()
  })

  it('存在しないラボは「見つかりません」になる', () => {
    renderAt('/labs/unknown')
    expect(screen.getByRole('heading', { name: /ページが見つかりません/ })).toBeInTheDocument()
  })
})

describe('問題を解く', () => {
  it('CVP ラボで問題を解いて採点できる', async () => {
    renderAt('/labs/cvp/practice')
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(3)
    await userEvent.type(inputs[0]!, '1')
    await userEvent.click(screen.getByRole('button', { name: /採点する/ }))

    expect(await screen.findByRole('status')).toHaveTextContent(/INCORRECT|CORRECT/)
    // 未回答のステップには正解が表示される
    expect(screen.getAllByText(/正解は/).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /解説/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /次の問題/ })).toBeInTheDocument()
  })

  it('問題がまだないラボは準備中と表示する', () => {
    renderAt('/labs/journal/practice')
    expect(screen.getByText('このラボの問題は準備中です。')).toBeInTheDocument()
  })
})

describe('記録', () => {
  it('問題を解くと記録ページとホームに反映される', async () => {
    const { useProgressStore } = await import('@/progress/store')
    await useProgressStore.getState().resetAll()

    renderAt('/labs/cvp/practice')
    await userEvent.click(screen.getByRole('button', { name: /採点する/ }))
    expect(await screen.findByText(/\+\d+ XP/)).toBeInTheDocument()
    await vi.waitFor(() => expect(useProgressStore.getState().attempts).toHaveLength(1))

    cleanup()
    renderAt('/records')
    expect(screen.getByRole('link', { name: /損益分岐点売上高と安全余裕率/ })).toBeInTheDocument()
    expect(screen.getByText(/1 問/)).toBeInTheDocument()

    cleanup()
    renderAt('/')
    expect(screen.getByText('TODAY').nextElementSibling).toHaveTextContent('1 / 3')
  })
})
