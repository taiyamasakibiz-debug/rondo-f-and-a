import { motion, useReducedMotion } from 'motion/react'
import type { Block } from '@/engine/types'

type RadarBlock = Extract<Block, { type: 'radar' }>

const SIZE = 320
const CENTER = SIZE / 2
const RADIUS = 110
const RINGS = [0.25, 0.5, 0.75, 1]

/** 系列ごとの線。1 本目は ink の実線、2 本目以降は sky-300 の破線（色だけに頼らず線種でも区別する） */
const SERIES_STYLES = [
  { stroke: 'var(--ink)', fill: 'var(--ink)', fillOpacity: 0.08, dash: undefined },
  { stroke: 'var(--sky-300)', fill: 'var(--sky-300)', fillOpacity: 0.12, dash: '4 3' },
]

function point(axis: number, count: number, ratio: number): [number, number] {
  const angle = -Math.PI / 2 + (axis / count) * Math.PI * 2
  return [CENTER + Math.cos(angle) * RADIUS * ratio, CENTER + Math.sin(angle) * RADIUS * ratio]
}

/**
 * 分析レーダー。外側ほど良い（値は軸ごとに 0〜1 に正規化して渡す）。
 * 図だけでは読み上げで伝わらないので、問題側で同じ内容の表も添えること。
 */
export function RadarChart({ block }: { block: RadarBlock }) {
  const reduceMotion = useReducedMotion()
  const count = block.axes.length
  const polygon = (values: readonly number[]) =>
    values.map((value, i) => point(i, count, Math.max(0, Math.min(1, value))).join(',')).join(' ')

  return (
    <figure className="flex flex-col gap-3">
      {block.caption && (
        <figcaption className="text-caption text-ink-muted">{block.caption}</figcaption>
      )}
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto w-full max-w-sm overflow-visible"
        role="img"
        aria-label={`${block.caption ?? 'レーダーチャート'}（外側ほど良い）`}
      >
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={polygon(block.axes.map(() => ring))}
            fill="none"
            stroke="var(--line-soft)"
            strokeWidth={1}
          />
        ))}
        {block.axes.map((axis, i) => {
          const [x, y] = point(i, count, 1)
          const [lx, ly] = point(i, count, 1.2)
          return (
            <g key={axis}>
              <line x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="var(--line-soft)" />
              <text
                x={lx}
                y={ly}
                textAnchor={Math.abs(lx - CENTER) < 4 ? 'middle' : lx > CENTER ? 'start' : 'end'}
                dominantBaseline="middle"
                className="fill-ink-body font-ja text-[11px] font-bold"
              >
                {axis}
              </text>
            </g>
          )
        })}
        {block.series.map((series, s) => {
          const style = SERIES_STYLES[s % SERIES_STYLES.length]!
          return (
            <motion.polygon
              key={series.label}
              points={polygon(series.values)}
              fill={style.fill}
              fillOpacity={style.fillOpacity}
              stroke={style.stroke}
              strokeWidth={1.6}
              strokeDasharray={style.dash}
              initial={reduceMotion ? false : { scale: 0.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: s * 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
            />
          )
        })}
      </svg>
      <div className="flex justify-center gap-6 text-caption text-ink-body">
        {block.series.map((series, s) => (
          <span key={series.label} className="flex items-center gap-2">
            <svg width="24" height="8" aria-hidden>
              <line
                x1="0"
                y1="4"
                x2="24"
                y2="4"
                stroke={SERIES_STYLES[s % SERIES_STYLES.length]!.stroke}
                strokeWidth="2"
                strokeDasharray={SERIES_STYLES[s % SERIES_STYLES.length]!.dash}
              />
            </svg>
            {series.label}
          </span>
        ))}
      </div>
    </figure>
  )
}
