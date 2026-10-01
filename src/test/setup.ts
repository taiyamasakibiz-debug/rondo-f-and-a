import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { markSplashHandled } from '@/app/splashState'

// 起動画面は専用のテストでだけ出す（ほかのテストはホームを直接開く）
beforeEach(() => markSplashHandled())

afterEach(() => {
  cleanup()
})
