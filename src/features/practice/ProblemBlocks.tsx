import type { Block } from '@/engine/types'

/** 問題文・解説の部品を表示する */
export function ProblemBlocks({ blocks }: { blocks: readonly Block[] }) {
  return (
    <div className="flex flex-col gap-6">
      {blocks.map((block, i) =>
        block.type === 'text' ? (
          <p key={i} className="text-body text-ink-body">
            {block.text}
          </p>
        ) : (
          <div key={i} className="overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse text-[15px] tracking-text">
              {block.caption && (
                <caption className="mb-3 text-left text-caption text-ink-muted">
                  {block.caption}
                </caption>
              )}
              <thead>
                <tr className="border-y border-line">
                  {block.headers.map((header, col) => (
                    <th
                      key={col}
                      scope="col"
                      className={
                        col === 0
                          ? 'px-4 py-3 text-left font-bold'
                          : 'px-4 py-3 text-right font-bold'
                      }
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className="border-b border-line-soft even:bg-haze">
                    {row.map((cell, col) =>
                      col === 0 ? (
                        <th key={col} scope="row" className="px-4 py-3 text-left font-medium">
                          {cell}
                        </th>
                      ) : (
                        <td key={col} className="px-4 py-3 text-right font-medium tabular-nums">
                          {cell}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  )
}
