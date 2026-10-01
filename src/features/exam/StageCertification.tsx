import { useMemo } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  TIERS,
  TIER_RULES,
  type Tier,
  buildExam,
  certificationOf,
  examEligibility,
  examResults,
} from '@/progress/certification'
import { PROBLEM_TEMPLATES } from '@/problems'
import { useNow } from '@/progress/hooks'
import { expectedMinutesFor } from '@/progress/timing'
import { useProgressStore } from '@/progress/store'
import { CertBadge } from './CertBadge'

/** Stage の修了テスト（認定）。認定済み・受けられる・まだ受けられない、のどれかを出す */
export function StageCertification({ tier }: { tier: Tier }) {
  const attempts = useProgressStore((state) => state.attempts)
  const settings = useProgressStore((state) => state.settings)
  const status = useProgressStore((state) => state.status)
  const now = useNow()
  const rule = TIER_RULES[tier]
  const current = certificationOf(attempts)
  const certified = current !== null && TIERS.indexOf(current) >= TIERS.indexOf(tier)
  const eligibility = examEligibility(attempts, tier, settings, now)
  const best = Math.max(
    0,
    ...examResults(attempts)
      .filter((result) => result.tier === tier)
      .map((result) => Math.round(result.ratio * 100)),
  )
  // 一覧に出す制限時間の目安。実際の時間は、出題が決まったとき（テストの画面）に決まる
  const minutes = useMemo(
    () => buildExam(tier, 0, PROBLEM_TEMPLATES, expectedMinutesFor(attempts)).timeLimitMs / 60_000,
    [tier, attempts],
  )

  if (status === 'loading') return null
  return (
    <div
      className={cn(
        'mt-4 flex flex-col gap-3 rounded-lg border p-5 md:flex-row md:items-center md:justify-between md:gap-6',
        certified ? 'border-ink' : 'border-line',
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <CertBadge tier={tier} />
          <span className="text-caption text-ink-muted">
            {certified ? '認定済み' : eligibility.eligible ? '受験できます' : '未解放'}
          </span>
        </div>
        <p className="text-caption text-ink-muted">
          合格ライン {Math.round(rule.passRatio * 100)}%
          {minutes > 0 && ` ・ 制限時間 約 ${minutes} 分`}
          {best > 0 && ` ・ 最高 ${best}%`}
        </p>
      </div>
      {eligibility.eligible ? (
        <Button
          asChild
          size="sm"
          variant={certified ? 'outline' : 'default'}
          className="self-start md:self-auto"
        >
          <Link to={`/exam/${tier}`}>{certified ? 'もう一度受ける' : '受験する'}</Link>
        </Button>
      ) : (
        <p className="text-body-sm text-ink-body md:max-w-xs md:text-right">{eligibility.reason}</p>
      )}
    </div>
  )
}
