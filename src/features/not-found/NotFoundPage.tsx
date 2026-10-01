import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { ARROW_HOVER } from '@/components/ArrowDot'
import { PageHeader } from '@/components/PageHeader'
import { cn } from '@/lib/utils'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Not Found" subtitle="ページが見つかりません" />
      <Link to="/" className="group inline-flex items-center gap-4 text-link-caps">
        Back to Home
        <span
          className={cn(
            'flex size-11 items-center justify-center rounded-pill border border-ink',
            ARROW_HOVER,
          )}
        >
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </Link>
    </>
  )
}
