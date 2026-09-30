import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { LABS } from './labs'

export function LabsPage() {
  return (
    <>
      <PageHeader title="ラボ" description="論点ごとに問題を解いて、理解を確かめます。" />
      <ul className="flex flex-col gap-2">
        {LABS.map((lab) => (
          <li key={lab.id}>
            <Link
              to={`/labs/${lab.id}`}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted"
            >
              <lab.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium">{lab.name}</p>
                <p className="text-sm text-muted-foreground">{lab.description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
