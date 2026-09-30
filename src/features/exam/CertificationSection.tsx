import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import type { Topic } from '@/engine/types'
import {
  TIERS,
  TIER_RULES,
  certificationOf,
  examEligibility,
  examResults,
} from '@/progress/certification'
import { useProgressStore } from '@/progress/store'
import { cn } from '@/lib/utils'
import { CertBadge } from './CertBadge'

/** ラボのページに出す、認定テストの一覧（認定済み・受けられる・まだ受けられない） */
export function CertificationSection({ topic }: { topic: Topic }) {
  const attempts = useProgressStore((state) => state.attempts)
  const status = useProgressStore((state) => state.status)
  const current = certificationOf(attempts, topic)
  const results = examResults(attempts).filter((result) => result.topic === topic)

  return (
    <section
      aria-labelledby="certification-heading"
      className="flex flex-col gap-6 border-t border-line pt-10"
    >
      <div className="flex flex-col gap-2">
        <h2
          id="certification-heading"
          className="text-[28px] leading-[1.1] font-bold tracking-[-0.04em]"
        >
          Certification
        </h2>
        <p className="text-sub-ja text-ink-muted">認定テスト</p>
      </div>
      {status !== 'loading' && (
        <ul className="grid gap-4 md:grid-cols-3">
          {TIERS.map((tier) => {
            const rule = TIER_RULES[tier]
            const certified = current !== null && TIERS.indexOf(current) >= TIERS.indexOf(tier)
            const eligibility = examEligibility(attempts, topic, tier)
            const best = Math.max(
              0,
              ...results.filter((r) => r.tier === tier).map((r) => Math.round(r.ratio * 100)),
            )
            return (
              <li
                key={tier}
                className={cn(
                  'flex flex-col gap-4 rounded-lg border p-6',
                  certified ? 'border-ink' : 'border-line',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <CertBadge tier={tier} />
                  <span className="text-caption text-ink-muted">
                    {certified ? '認定済み' : eligibility.eligible ? '受験できます' : '未解放'}
                  </span>
                </div>
                <p className="text-caption text-ink-muted">
                  Lv.{rule.minLevel} 以上 ・ {rule.timeLimitMs / 60_000} 分 ・ 合格ライン{' '}
                  {Math.round(rule.passRatio * 100)}%{best > 0 && ` ・ 最高 ${best}%`}
                </p>
                {eligibility.eligible ? (
                  <Button
                    asChild
                    size="sm"
                    variant={certified ? 'outline' : 'default'}
                    className="self-start"
                  >
                    <Link to={`/labs/${topic}/exam/${tier}`}>
                      {certified ? 'もう一度受ける' : '受験する'}
                    </Link>
                  </Button>
                ) : (
                  <p className="text-body-sm text-ink-body">{eligibility.reason}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
