import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { LABS } from '@/features/labs/labs'

// 今日のデイリー、ストリーク、レベル一覧はフェーズ 5 で作る
export function HomePage() {
  return (
    <>
      <PageHeader
        title="今日のデイリー"
        description="問題の仕組みができたら、ここに今日の3問が並びます。"
      />
      <section aria-labelledby="labs-heading">
        <h2 id="labs-heading" className="mb-3 text-sm font-medium text-muted-foreground">
          ラボ
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LABS.map((lab) => (
            <li key={lab.id}>
              <Link
                to={`/labs/${lab.id}`}
                className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted"
              >
                <lab.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="font-medium">{lab.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{lab.description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
