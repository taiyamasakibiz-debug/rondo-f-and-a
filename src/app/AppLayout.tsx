import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, ScrollRestoration, useLocation, useSearchParams } from 'react-router'
import { AmbientLines } from '@/components/AmbientLines'
import { useTextInputFocused } from '@/components/useTextInputFocused'
import { feedback } from '@/feedback'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'
import { Splash } from './Splash'
import { markSplashHandled, shouldShowSplash } from './splashState'

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/labs', label: 'Labs', end: false },
  { to: '/records', label: 'Records', end: false },
  { to: '/settings', label: 'Settings', end: false },
] as const

/** ナビの 1 項目。PC の上のナビとスマホの下のタブで同じ見た目にする */
function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center justify-center rounded-pill py-3 text-label text-ink-muted transition-colors hover:text-ink',
    isActive && 'bg-ink text-on-ink hover:text-on-ink',
  )
}

export function AppLayout() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const [searchParams] = useSearchParams()
  // 別ウィンドウで開いたパネル（?window=1）は、ナビを省いて中身だけを見せる
  const windowMode = searchParams.get('window') === '1'
  const typing = useTextInputFocused()
  // 開き直したときの 1 回だけ、トップで起動画面を出す。ほかの画面から入ったときは出さない
  const [splashOpen, setSplashOpen] = useState(() =>
    shouldShowSplash(location.pathname, windowMode),
  )
  const [revealFromSplash] = useState(splashOpen)
  useEffect(() => markSplashHandled(), [])
  // 時間が来たらホームに切り替える（Splash の時計が巻き直されないよう、関数は作り直さない）
  const closeSplash = useCallback(() => setSplashOpen(false), [])

  if (windowMode) {
    return (
      <div className="min-h-dvh bg-background p-3 text-foreground md:p-4">
        <Outlet />
        <PwaUpdatePrompt />
        <ScrollRestoration />
      </div>
    )
  }

  const isHome = location.pathname === '/'

  // 起動画面から入ったときは、奥からホームがゆっくり浮かんでくる
  const mainState =
    revealFromSplash && !reduceMotion
      ? splashOpen
        ? { opacity: 0, scale: 0.95 }
        : { opacity: 1, scale: 1 }
      : undefined
  const chromeFade = cn(
    'transition-opacity duration-700',
    revealFromSplash && splashOpen && 'opacity-0',
  )

  return (
    <>
      <div
        inert={splashOpen}
        className="relative flex min-h-dvh flex-col bg-background text-foreground"
      >
        <Backdrop key={isHome ? 'home' : 'page'} full={isHome} />
        {/* Tessera のナビ：半透明の白いピル */}
        <header className={cn('sticky top-0 z-40 px-4 pt-4 md:px-6 md:pt-6', chromeFade)}>
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-pill border border-line bg-white/60 px-6 backdrop-blur-md md:h-16 md:pr-2 md:pl-8">
            <NavLink to="/" aria-label="Rondo F&A ホーム" className="flex items-end gap-2.5">
              <img src="/brand/logo-horizontal.svg" alt="" className="h-10 w-auto" />
              {/*
                財務・会計（Finance & Accounting）。ロゴの高さの 3 分の 1 くらい。
                文字の下端を、ロゴの「Rondo」の文字の下端（SVG の高さ 115 のうち 100、表示で下から約 5px）にそろえる
              */}
              <span
                aria-hidden
                className="mb-[4px] text-[13px] leading-none font-bold tracking-[0.2em] text-ink"
              >
                F&amp;A
              </span>
            </NavLink>
            <nav aria-label="メインナビゲーション" className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => feedback('tap')}
                  className={(state) => cn(navLinkClass(state), 'px-5')}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <motion.main
          initial={mainState}
          animate={mainState}
          transition={{ duration: 0.8, ease: EASE_OUT }}
          className="relative mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-28 md:px-6 md:pt-14 md:pb-24"
        >
          <motion.div
            key={location.pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Outlet />
          </motion.div>
        </motion.main>

        {/* スマホは画面下のピル型タブで移動する（PC の上のナビと同じ表示）。Tessera はアイコンを矢印だけにするため文字だけで示す。
          キーボードが出ている間は、スクロールでずれて入力の邪魔になるので隠す */}
        <nav
          aria-label="メインナビゲーション（モバイル）"
          className={cn(
            'fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 md:hidden',
            chromeFade,
            typing && 'hidden',
          )}
        >
          <ul className="grid grid-cols-4 rounded-pill border border-line bg-white/60 p-1.5 backdrop-blur-md">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={() => feedback('tap')}
                  className={navLinkClass}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <PwaUpdatePrompt />
        {/* 画面を移ったら先頭から表示する（戻るときは元の位置に戻す） */}
        <ScrollRestoration />
      </div>
      <AnimatePresence>{splashOpen && <Splash onDone={closeSplash} />}</AnimatePresence>
    </>
  )
}

/**
 * 背景の水色とデジタルライン。
 * - ホーム：画面全体に敷き、スクロールしても動かない
 * - ほかの画面：ページの最上部だけに敷き、下に行くほど自然に薄くする
 */
function Backdrop({ full }: { full: boolean }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      aria-hidden
      data-testid={full ? 'backdrop-full' : 'backdrop-top'}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'pointer-events-none overflow-hidden',
        full
          ? 'fixed inset-0'
          : 'absolute inset-x-0 top-0 h-[420px] [mask-image:linear-gradient(to_bottom,black_35%,transparent)] md:h-[520px]',
      )}
    >
      {/* sky-wash はいちばん濃い水色が下にあるので、上だけに敷くときは上下を反転して、濃い方を上にする */}
      <div className={cn('absolute inset-0 bg-sky-wash', !full && '-scale-y-100')} />
      <AmbientLines seed={full ? 7 : 13} className="absolute inset-0 size-full" />
    </motion.div>
  )
}
