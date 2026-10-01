import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSyncStore } from '@/sync/client'
import { routes } from './router'
import { resetSplash } from './splashState'

// 実際は 1.5 秒（splashState.test.ts で確かめる）。テストでは待たされないよう短くする
vi.mock('./splashState', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./splashState')>()),
  SPLASH_DURATION_MS: 300,
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

async function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  await vi.waitFor(() => expect(router.state.initialized).toBe(true))
  render(<RouterProvider router={router} />)
}

beforeEach(() => {
  // 同期を使っていない端末として開く
  useSyncStore.setState({ status: 'off', key: null, lastSyncedAt: null, error: null })
  resetSplash()
})

describe('起動画面', () => {
  it('開き直したトップで少し出て、ボタンを押さなくてもホームに切り替わる', async () => {
    await renderAt('/')
    expect(screen.getByTestId('splash')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    // 起動画面の間、奥のホームは操作できない
    expect(document.querySelector('[inert]')).not.toBeNull()

    await waitFor(() => expect(screen.queryByTestId('splash')).not.toBeInTheDocument(), {
      timeout: 3000,
    })
    expect(document.querySelector('[inert]')).toBeNull()
    expect(screen.getByRole('link', { name: /CVP ラボ/ })).toBeInTheDocument()
  })

  it('同期を使っていない端末では、同期の状態を出さない', async () => {
    await renderAt('/')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('同期を使っている端末では、同期中の表示から「最新です」に変わる', async () => {
    useSyncStore.setState({ status: 'syncing', key: 'k', lastSyncedAt: null })
    await renderAt('/')
    expect(screen.getByRole('status')).toHaveTextContent('同期中…')

    useSyncStore.setState({ status: 'idle', lastSyncedAt: new Date().toISOString() })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('最新です'))
  })

  it('同期が終わっていなくても、時間が来たらホームに切り替わる', async () => {
    useSyncStore.setState({ status: 'syncing', key: 'k', lastSyncedAt: null })
    await renderAt('/')
    expect(screen.getByRole('status')).toHaveTextContent('同期中…')
    await waitFor(() => expect(screen.queryByTestId('splash')).not.toBeInTheDocument(), {
      timeout: 3000,
    })
  })

  it('同期に失敗したら、あとでやり直すと伝える', async () => {
    useSyncStore.setState({ status: 'error', key: 'k', lastSyncedAt: null })
    await renderAt('/')
    expect(screen.getByRole('status')).toHaveTextContent(
      '同期できませんでした。あとで自動でやり直します',
    )
  })

  it('トップ以外から開いたときは出さず、あとでトップに戻っても出さない', async () => {
    const user = userEvent.setup()
    await renderAt('/labs')
    expect(screen.queryByTestId('splash')).not.toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: 'Home' })[0]!)
    expect(screen.queryByTestId('splash')).not.toBeInTheDocument()
  })

  it('別ウィンドウ用のパネルでは出さない', async () => {
    await renderAt('/free/bs?window=1')
    expect(screen.queryByTestId('splash')).not.toBeInTheDocument()
  })
})
