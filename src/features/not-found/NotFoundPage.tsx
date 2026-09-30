import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Not Found" subtitle="ページが見つかりません" />
      <Link to="/" className="group inline-flex items-center gap-4 text-link-caps">
        Back to Home
        <span className="flex size-11 items-center justify-center rounded-pill border border-ink transition-transform group-hover:translate-x-1">
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </Link>
    </>
  )
}
