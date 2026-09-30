import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'

const updateServiceWorker = vi.fn()
const setNeedRefresh = vi.fn()

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}))

describe('PwaUpdatePrompt', () => {
  it('新しい版があると知らせ、「更新する」で切り替える', async () => {
    render(<PwaUpdatePrompt />)
    expect(screen.getByRole('status')).toHaveTextContent('新しいバージョンがあります')
    await userEvent.click(screen.getByRole('button', { name: '更新する' }))
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('「あとで」で閉じる', async () => {
    render(<PwaUpdatePrompt />)
    await userEvent.click(screen.getAllByRole('button', { name: 'あとで' })[0]!)
    expect(setNeedRefresh).toHaveBeenCalledWith(false)
  })
})
