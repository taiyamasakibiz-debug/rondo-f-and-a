import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PANELS, type PanelId, openPanelWindow, useIsWindowMode } from './panels'

/** フリーモードの 1 つのパネル。見出しと「別ウィンドウで開く」ボタンを持つ */
export function Panel({
  id,
  children,
  className,
}: {
  id: PanelId
  children: ReactNode
  className?: string
}) {
  const windowMode = useIsWindowMode()
  const { en, ja } = PANELS[id]
  return (
    <section
      aria-labelledby={`panel-${id}`}
      className={cn(
        'flex min-w-0 flex-col gap-6 rounded-xl border border-line bg-paper p-6 md:p-8',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={`panel-${id}`} className="flex flex-col gap-1">
          <span className="text-[24px] leading-[1.1] font-bold tracking-[-0.04em]">{en}</span>
          <span className="text-sub-ja text-[13px] text-ink-muted">{ja}</span>
        </h2>
        {!windowMode && (
          <button
            type="button"
            onClick={() => openPanelWindow(id)}
            className="flex shrink-0 items-center gap-2 rounded-pill border border-line px-4 py-2 text-tag hover:border-ink"
          >
            別ウィンドウ
            <ArrowUpRight className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}
