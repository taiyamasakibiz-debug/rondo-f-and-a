import { TIER_RULES, type Tier } from '@/progress/certification'
import { cn } from '@/lib/utils'

const DOT: Record<Tier, string> = {
  bronze: 'bg-stone',
  silver: 'bg-mist',
  // オレンジは点のアクセントとして、いちばん上の認定にだけ使う
  gold: 'bg-ember',
}

/** 認定のバッジ（ピル型のタグ + 色の点） */
export function CertBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-pill border border-line px-3 py-1 text-[11px] font-bold tracking-[0.1em]',
        className,
      )}
    >
      <span className={cn('size-2 rounded-pill', DOT[tier])} aria-hidden />
      {TIER_RULES[tier].labelEn}
      <span className="sr-only">（{TIER_RULES[tier].label}認定）</span>
    </span>
  )
}
