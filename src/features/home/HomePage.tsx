import { DigitalLines } from '@/components/DigitalLines'
import { LabCard } from '@/features/labs/LabCard'
import { LABS } from '@/features/labs/labs'

// 今日のデイリー、ストリーク、レベル一覧はフェーズ 5 で作る
export function HomePage() {
  return (
    <>
      <section className="relative -mx-4 mb-16 overflow-hidden bg-sky-wash px-5 py-16 md:mx-0 md:rounded-xl md:px-16 md:py-24">
        <DigitalLines className="pointer-events-none absolute inset-0 size-full" />
        <div className="relative flex flex-col gap-6">
          <p className="font-ja text-lg font-bold tracking-ja text-ink-muted md:text-2xl">
            今日のデイリー
          </p>
          <h1 className="text-[52px] leading-[0.95] font-bold tracking-tight md:text-[96px]">
            Daily
            <br />
            Training.
          </h1>
          <p className="max-w-md font-ja text-[15px] leading-loose font-medium tracking-ja text-ink-body md:text-lg">
            問題の仕組みができたら、ここに今日の3問が並びます。
          </p>
        </div>
      </section>

      <section aria-labelledby="labs-heading">
        <div className="mb-8 flex flex-col gap-2">
          <h2 id="labs-heading" className="flex items-baseline gap-4">
            <span className="text-[13px] font-bold tracking-caps text-ink-muted">01</span>
            <span className="text-[32px] leading-[1.1] font-bold tracking-[-0.04em] md:text-[44px]">
              Labs
            </span>
          </h2>
          <p className="text-sub-ja text-ink-muted">ラボ</p>
        </div>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LABS.map((lab, index) => (
            <li key={lab.id}>
              <LabCard lab={lab} index={index} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
