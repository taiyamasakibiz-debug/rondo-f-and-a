import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router'
import type { Lab } from './labs'

type LabCardProps = {
  lab: Lab
  index: number
}

// Tessera のカード：番号、英字タイトル、和文サブ見出し、説明、右下の丸い矢印
export function LabCard({ lab, index }: LabCardProps) {
  const reduceMotion = useReducedMotion()
  const number = String(index + 1).padStart(2, '0')

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <Link
        to={`/labs/${lab.id}`}
        className="group flex h-full min-h-60 flex-col gap-4 rounded-xl bg-fog p-8 transition-colors hover:bg-sky-50"
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold tracking-caps text-ink-muted">{number}</span>
          <lab.icon className="size-5 text-ink-muted" aria-hidden />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[28px] leading-[1.1] font-bold tracking-[-0.04em]">
            {lab.nameEn}
          </span>
          <span className="font-ja text-[15px] font-bold tracking-ja">{lab.name}</span>
        </div>
        <p className="flex-1 text-body-sm text-ink-body">{lab.description}</p>
        <span className="flex size-12 items-center justify-center self-end rounded-pill bg-ink text-on-ink transition-transform duration-300 group-hover:translate-x-1">
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </Link>
    </motion.div>
  )
}
