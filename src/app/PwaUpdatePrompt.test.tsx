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

describe('watchForUpdates', () => {
  it('画面に戻ってきたときと、30 分ごとに新しい版を確かめる', async () => {
    vi.useFakeTimers()
    const { watchForUpdates } = await import('./watchForUpdates')
    const update = vi.fn().mockResolvedValue(undefined)
    const stop = watchForUpdates({ update } as unknown as ServiceWorkerRegistration)
    try {
      document.dispatchEvent(new Event('visibilitychange'))
      expect(update).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(30 * 60 * 1000)
      expect(update).toHaveBeenCalledTimes(2)
    } finally {
      stop()
      vi.useRealTimers()
    }
    document.dispatchEvent(new Event('visibilitychange'))
    expect(update).toHaveBeenCalledTimes(2)
  })
})
