import { PageHeader } from '@/components/PageHeader'

// レベル、認定、ストリーク、間違いノートはフェーズ 3・5 で作る
export function RecordsPage() {
  return (
    <PageHeader
      title="記録"
      description="レベル・認定・ストリーク・間違いノートがここに並びます。"
    />
  )
}
