import { motion, useReducedMotion } from 'motion/react'
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router'
import { useTextInputFocused } from '@/components/useTextInputFocused'
import { cn } from '@/lib/utils'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'

const NAV_ITEMS = [
  { to: '/', label: 'ホーム', labelEn: 'Home', end: true },
  { to: '/labs', label: 'ラボ', labelEn: 'Labs', end: false },
  { to: '/records', label: '記録', labelEn: 'Records', end: false },
  { to: '/settings', label: '設定', labelEn: 'Settings', end: false },
] as const

export function AppLayout() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const [searchParams] = useSearchParams()
  // 別ウィンドウで開いたパネル（?window=1）は、ナビを省いて中身だけを見せる
  const windowMode = searchParams.get('window') === '1'
  const typing = useTextInputFocused()

  if (windowMode) {
    return (
      <div className="min-h-dvh bg-background p-3 text-foreground md:p-4">
        <Outlet />
        <PwaUpdatePrompt />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Tessera のナビ：半透明の白いピル */}
      <header className="sticky top-0 z-40 px-4 pt-4 md:px-6 md:pt-6">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-pill border border-line bg-white/60 px-6 backdrop-blur-md md:h-16 md:pr-2 md:pl-8">
          <NavLink to="/" className="text-[15px] font-extrabold tracking-[0.3em] uppercase">
            Luminous
          </NavLink>
          <nav aria-label="メインナビゲーション" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-pill px-5 py-3 text-label text-ink-muted transition-colors hover:text-ink',
                    isActive && 'bg-ink text-on-ink hover:text-on-ink',
                  )
                }
              >
                {item.labelEn}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-28 md:px-6 md:pt-14 md:pb-24">
        <motion.div
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* スマホは画面下のピル型タブで移動する。Tessera はアイコンを矢印だけにするため文字だけで示す。
          キーボードが出ている間は、スクロールでずれて入力の邪魔になるので隠す */}
      <nav
        aria-label="メインナビゲーション（モバイル）"
        className={cn(
          'fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 md:hidden',
          typing && 'hidden',
        )}
      >
        <ul className="grid grid-cols-4 rounded-pill border border-line bg-white/70 p-1.5 backdrop-blur-md">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-center rounded-pill py-3 font-ja text-[13px] font-bold tracking-[0.1em] text-ink-muted transition-colors',
                    isActive && 'bg-ink text-on-ink',
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <PwaUpdatePrompt />
    </div>
  )
}
