import { useDocumentTitle } from './useDocumentTitle'

type PageHeaderProps = {
  /** 英字の見出し */
  title: string
  /** 英字見出しの下に添える和文のサブ見出し */
  subtitle?: string
  description?: string
}

// Tessera の見出しパターン：英字の大見出し + 和文のサブ見出し
export function PageHeader({ title, subtitle, description }: PageHeaderProps) {
  useDocumentTitle(subtitle ?? title)
  return (
    <div className="mb-10 flex flex-col gap-2">
      <h1 className="flex flex-col gap-2">
        <span className="text-[36px] leading-[1.1] font-bold tracking-[-0.04em] md:text-section-en">
          {title}
        </span>
        {subtitle && <span className="text-sub-ja text-ink-muted">{subtitle}</span>}
      </h1>
      {description && <p className="mt-2 text-body-sm text-ink-body">{description}</p>}
    </div>
  )
}
