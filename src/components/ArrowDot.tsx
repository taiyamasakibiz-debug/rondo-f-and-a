import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 丸い矢印のマウスオーバー：オレンジになって、少し右へ動く（すべての丸い矢印でそろえる）。
 * 親の要素に group（ボタンの中なら group/button）が要る
 */
export const ARROW_HOVER =
  'transition-[background-color,border-color,color,translate] duration-300 ease-out group-hover:translate-x-1 group-hover:border-ember group-hover:bg-ember group-hover:text-[#121213] motion-reduce:group-hover:translate-x-0'

const ARROW_HOVER_IN_BUTTON =
  'transition-[background-color,color,translate] duration-300 ease-out group-hover/button:translate-x-1 group-hover/button:bg-ember group-hover/button:text-[#121213] motion-reduce:group-hover/button:translate-x-0'

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
        ARROW_HOVER_IN_BUTTON,
      )}
    >
      <ArrowRight className="size-4" aria-hidden />
    </span>
  )
}
