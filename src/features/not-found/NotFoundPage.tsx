import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="ページが見つかりません" />
      <Link to="/" className="text-sm underline underline-offset-4">
        ホームへ戻る
      </Link>
    </>
  )
}
