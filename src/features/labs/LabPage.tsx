import { useParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { findLab } from './labs'

// 各ラボの中身はフェーズ 4 で作る
export function LabPage() {
  const { labId } = useParams()
  const lab = findLab(labId)
  if (!lab) return <NotFoundPage />

  return (
    <>
      <PageHeader title={lab.nameEn} subtitle={lab.name} description={lab.description} />
      <p className="rounded-xl border border-dashed border-line p-12 text-center text-body-sm text-ink-muted">
        準備中
      </p>
    </>
  )
}
