import { FlaskConical, House, NotebookPen, Settings } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { cn } from '@/lib/utils'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'

const NAV_ITEMS = [
  { to: '/', label: 'ホーム', icon: House, end: true },
  { to: '/labs', label: 'ラボ', icon: FlaskConical, end: false },
  { to: '/records', label: '記録', icon: NotebookPen, end: false },
  { to: '/settings', label: '設定', icon: Settings, end: false },
] as const

export function AppLayout() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <NavLink to="/" className="font-heading text-base font-semibold tracking-tight">
            Luminous Insight
          </NavLink>
          <nav aria-label="メインナビゲーション" className="hidden gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
                    isActive && 'bg-muted font-medium text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 md:pb-10">
        <motion.div
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* スマホは画面下のタブで移動する */}
      <nav
        aria-label="メインナビゲーション（モバイル）"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-4">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground',
                    isActive && 'font-medium text-foreground',
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
