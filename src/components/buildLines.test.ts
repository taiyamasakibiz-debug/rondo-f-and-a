import { describe, expect, it } from 'vitest'
import { buildLines } from './buildLines'

/** パスの始点と終点の y 座標 */
function ends(d: string) {
  const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
  return { startY: numbers[1]!, endY: numbers.at(-1)! }
}

describe('buildLines', () => {
  it('画面が高いほど束が増え、同じ seed なら同じ線になる', () => {
    const clusters = (height: number) =>
      new Set(buildLines(400, height, 1).map((line) => line.id.split('-')[0])).size
    expect(clusters(800)).toBe(3)
    expect(clusters(3000)).toBe(10)
    expect(buildLines(400, 800, 1)).toEqual(buildLines(400, 800, 1))
  })

  it('束の縦の位置はばらばらで、傾きはおおむね交互になる', () => {
    const lines = buildLines(1200, 6000, 3)
    const byCluster = new Map<string, { startY: number; endY: number }[]>()
    for (const line of lines) {
      const cluster = line.id.split('-')[0]!
      byCluster.set(cluster, [...(byCluster.get(cluster) ?? []), ends(line.from)])
    }
    const centers: number[] = []
    const tilts: number[] = []
    for (const group of byCluster.values()) {
      const start = group.reduce((sum, e) => sum + e.startY, 0) / group.length
      const end = group.reduce((sum, e) => sum + e.endY, 0) / group.length
      centers.push((start + end) / 2)
      tilts.push(Math.sign(start - end))
    }
    // 間隔がそろっていない
    const gaps = centers.slice(1).map((y, i) => y - centers[i]!)
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(50)
    // 隣の束と傾きの向きが変わることが多い
    const flips = tilts.slice(1).filter((tilt, i) => tilt !== tilts[i]).length
    expect(flips / (tilts.length - 1)).toBeGreaterThan(0.5)
  })
})
