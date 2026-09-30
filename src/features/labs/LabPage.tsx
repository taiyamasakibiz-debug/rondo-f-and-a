import { ArrowRight } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { templatesForTopic } from '@/problems'
import { findLab } from './labs'

export function LabPage() {
  const { labId } = useParams()
  const lab = findLab(labId)
  if (!lab) return <NotFoundPage />
  const templates = templatesForTopic(lab.id)

  return (
    <>
      <PageHeader title={lab.nameEn} subtitle={lab.name} description={lab.description} />
      {templates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-12 text-center text-body-sm text-ink-muted">
          準備中
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          <ul className="flex flex-col">
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex items-center justify-between gap-4 border-t border-line py-5 last:border-b"
              >
                <span className="font-ja text-[15px] font-medium tracking-text">
                  {template.title}
                </span>
                <span className="shrink-0 rounded-pill border border-line px-3 py-1 text-[11px] font-bold tracking-[0.1em]">
                  LEVEL {template.difficulty}
                </span>
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="self-start pr-2">
            <Link to={`/labs/${lab.id}/practice`}>
              問題を解く
              <span
                data-icon="inline-end"
                className="flex size-10 items-center justify-center rounded-pill bg-on-ink text-ink"
              >
                <ArrowRight className="size-4" aria-hidden />
              </span>
            </Link>
          </Button>
        </div>
      )}
    </>
  )
}
