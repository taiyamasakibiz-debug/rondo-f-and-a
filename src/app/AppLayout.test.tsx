import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/engine/generate'
import { findTemplate } from '@/problems'
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
    renderAt('/labs/cvp/practice?template=cvp.break-even.basic&seed=1')
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

  it('仕訳を入力して採点できる（行の順番は問わない）', async () => {
    const template = findTemplate('journal.credit-sale')!
    const { params } = generateProblem(template, 42)
    const cash = (params.sales! * params.cashPercent!) / 100
    renderAt('/labs/journal/practice?template=journal.credit-sale&seed=42')

    // 借方に 2 行（売掛金を先、現金を後）、貸方に 1 行
    await userEvent.click(screen.getByRole('button', { name: '借方に行を追加' }))
    await userEvent.selectOptions(screen.getByLabelText('借方 1 行目の科目'), '売掛金')
    await userEvent.type(screen.getByLabelText('借方 1 行目の金額'), String(params.sales! - cash))
    await userEvent.selectOptions(screen.getByLabelText('借方 2 行目の科目'), '現金')
    await userEvent.type(screen.getByLabelText('借方 2 行目の金額'), String(cash))
    await userEvent.selectOptions(screen.getByLabelText('貸方 1 行目の科目'), '売上')
    await userEvent.type(screen.getByLabelText('貸方 1 行目の金額'), String(params.sales!))
    await userEvent.click(screen.getByRole('button', { name: /採点する/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('全問正解')
  })
})

describe('記録', () => {
  it('問題を解くと記録ページとホームに反映される', async () => {
    const { useProgressStore } = await import('@/progress/store')
    await useProgressStore.getState().resetAll()

    renderAt('/labs/cvp/practice?template=cvp.break-even.basic&seed=1')
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
