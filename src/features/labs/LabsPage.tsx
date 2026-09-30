import { PageHeader } from '@/components/PageHeader'
import { LabCard } from './LabCard'
import { LABS } from './labs'

export function LabsPage() {
  return (
    <>
      <PageHeader
        title="Labs"
        subtitle="ラボ"
        description="論点ごとに問題を解いて、理解を確かめます。"
      />
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {LABS.map((lab, index) => (
          <li key={lab.id}>
            <LabCard lab={lab} index={index} />
          </li>
        ))}
      </ul>
    </>
  )
}
