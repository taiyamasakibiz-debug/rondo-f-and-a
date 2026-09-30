import { FlaskConical, House, NotebookPen, Settings } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { cn } from '@/lib/utils'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'

const NAV_ITEMS = [
  { to: '/', label: 'ホーム', labelEn: 'Home', icon: House, end: true },
  { to: '/labs', label: 'ラボ', labelEn: 'Labs', icon: FlaskConical, end: false },
  { to: '/records', label: '記録', labelEn: 'Records', icon: NotebookPen, end: false },
  { to: '/settings', label: '設定', labelEn: 'Settings', icon: Settings, end: false },
] as const

export function AppLayout() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Tessera のナビ：半透明の白いピル */}
      <header className="sticky top-0 z-40 px-4 pt-4 md:px-6 md:pt-6">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-pill border border-white bg-white/60 px-6 backdrop-blur-md md:h-16 md:pr-2 md:pl-8">
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

      {/* スマホは画面下のピル型タブで移動する */}
      <nav
        aria-label="メインナビゲーション（モバイル）"
        className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 md:hidden"
      >
        <ul className="grid grid-cols-4 rounded-pill border border-white bg-white/70 p-1.5 shadow-[0_8px_32px_rgb(18_18_19/0.08)] backdrop-blur-md">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 rounded-pill py-2 font-ja text-[11px] font-bold text-ink-muted transition-colors',
                    isActive && 'bg-ink text-on-ink',
                  )
                }
              >
                <item.icon className="size-5" aria-hidden />
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
