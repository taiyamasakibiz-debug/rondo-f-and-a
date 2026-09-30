import { render, screen } from '@testing-library/react'
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
    expect(screen.getByRole('heading', { name: '今日のデイリー' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /CVP ラボ/ })).toBeInTheDocument()
  })

  it('ラボのカードから各ラボに移動できる', async () => {
    renderAt('/')
    await userEvent.click(screen.getByRole('link', { name: /投資ラボ/ }))
    expect(await screen.findByRole('heading', { name: '投資ラボ' })).toBeInTheDocument()
  })

  it('存在しないラボは「見つかりません」になる', () => {
    renderAt('/labs/unknown')
    expect(screen.getByRole('heading', { name: 'ページが見つかりません' })).toBeInTheDocument()
  })
})
