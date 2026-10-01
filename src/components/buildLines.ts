import { seededRandom } from '@/lib/seededRandom'

export type Line = {
  id: string
  /** 動きの両端の形。この 2 つの間をゆっくり行き来する */
  from: string
  to: string
  opacity: number
  width: number
  duration: number
  delay: number
}

/** 線の束 1 つあたりの縦の間隔の目安（px）。画面が高いほど束が増える */
const CLUSTER_SPACING = 300
/** 束がまったく同じ向きに並び続けないよう、ときどき傾きの向きをそろえる確率 */
const SAME_TILT_CHANCE = 0.2

/**
 * 線の束を作る。
 * - 束の縦の位置は等間隔にせず、まばらにずらす
 * - 傾き（左から右へ上がるか下がるか）はおおむね交互にし、ときどき同じ向きを続ける。傾きの大きさもまばらにする
 * - 束の中の線は、端に向かって少しずつ広がる
 */
export function buildLines(width: number, height: number, seed: number): Line[] {
  const random = seededRandom(seed)
  const clusters = Math.max(3, Math.round(height / CLUSTER_SPACING))
  const lines: Line[] = []
  let tilt = random() < 0.5 ? 1 : -1

  for (let c = 0; c < clusters; c += 1) {
    // 区間の中で位置をずらし、束どうしの間隔をばらばらにする
    const centerY = ((c + 0.15 + random() * 0.7) / clusters) * height
    const rise = tilt * (0.06 + random() * 0.22) * Math.min(width, 1400)
    if (random() > SAME_TILT_CHANCE) tilt = -tilt

    const count = 5 + Math.floor(random() * 5)
    const spreadStart = 12 + random() * 30
    const spreadEnd = 30 + random() * 70
    const bend = (random() - 0.5) * 120
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5
      const startY = centerY + rise / 2 + t * spreadStart * 2
      const endY = centerY - rise / 2 + t * spreadEnd * 2
      const c1x = width * (0.25 + random() * 0.15)
      const c2x = width * (0.6 + random() * 0.15)
      const c1y = startY + (endY - startY) * 0.3 + bend + t * 10
      const c2y = startY + (endY - startY) * 0.7 - bend * 0.6 - t * 10
      const path = (dy1: number, dy2: number, dyEnd: number) =>
        `M-40 ${startY.toFixed(1)} C${c1x.toFixed(1)} ${(c1y + dy1).toFixed(1)} ${c2x.toFixed(1)} ${(c2y + dy2).toFixed(1)} ${width + 40} ${(endY + dyEnd).toFixed(1)}`
      const swing = 25 + random() * 35
      lines.push({
        id: `${c}-${i}`,
        from: path(0, 0, 0),
        to: path(swing, -swing * 0.8, (random() - 0.5) * 24),
        opacity: 0.45 + random() * 0.5,
        width: 0.7 + random() * 0.5,
        duration: 6 + random() * 5,
        delay: -random() * 8,
      })
    }
  }
  return lines
}
