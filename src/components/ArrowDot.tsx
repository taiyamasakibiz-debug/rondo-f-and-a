import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Tessera の主ボタンの右端にある丸い矢印。
 * accent はオレンジの点にする（画面の中でいちばん大事な 1 つのボタンだけ）。
 */
export function ArrowDot({ accent = false }: { accent?: boolean }) {
  return (
    <span
      data-icon="inline-end"
      className={cn(
        'flex size-10 items-center justify-center rounded-pill',
        accent ? 'bg-ember text-[#121213]' : 'bg-on-ink text-ink',
      )}
    >
      <ArrowRight className="size-4" aria-hidden />
    </span>
  )
}
