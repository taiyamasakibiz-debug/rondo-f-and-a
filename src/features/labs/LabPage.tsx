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
      <PageHeader title={lab.name} description={lab.description} />
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        準備中
      </p>
    </>
  )
}
