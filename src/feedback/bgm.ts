import { midiToFrequency as hz, playBell, playTone } from './audio'

/**
 * BGM。音源ファイルを使わず、ゆっくりした和音とまばらな鈴の音をその場で作り続ける
 * （毎回少しずつ違う、勉強のじゃまにならないアンビエント）。
 */

const BPM = 72
const BEAT = 60 / BPM
/** 1 つの和音を鳴らす長さ（拍） */
const CHORD_BEATS = 8
/** 先に予約しておく時間（秒）。タブの処理が少し遅れても途切れないように */
const LOOKAHEAD = 0.4
const TICK_MS = 100

/** Cmaj9 → Am9 → Fmaj9 → G6sus4 （MIDI の番号） */
const CHORDS = [
  { root: 48, tones: [60, 64, 67, 71, 74] },
  { root: 45, tones: [57, 60, 64, 67, 71] },
  { root: 41, tones: [57, 60, 64, 65, 69] },
  { root: 43, tones: [55, 60, 62, 64, 67] },
]
/** 鈴の音に使う音（C のペンタトニック） */
const MELODY = [72, 74, 76, 79, 81, 84, 86, 88]

export type BgmPlayer = { stop(): void }

export function startBgm(
  context: BaseAudioContext,
  out: AudioNode,
  random: () => number = Math.random,
): BgmPlayer {
  let nextBeatAt = context.currentTime + 0.1
  let beat = 0
  let lastNote = 76

  const scheduleBeat = (at: number, index: number) => {
    const chord = CHORDS[Math.floor(index / CHORD_BEATS) % CHORDS.length]!
    if (index % CHORD_BEATS === 0) {
      const length = CHORD_BEATS * BEAT
      // やわらかい和音（立ち上がりと消え際を長く）
      for (const note of chord.tones) {
        playTone(context, out, {
          frequency: hz(note),
          at,
          duration: length + 1.5,
          type: 'triangle',
          gain: 0.028,
          attack: 1.6,
          lowpass: 1100,
        })
      }
      playTone(context, out, {
        frequency: hz(chord.root),
        at,
        duration: length,
        gain: 0.07,
        attack: 0.8,
      })
    }
    // 8 分音符ごとに、ときどき鈴を鳴らす（近い音へ動きやすくする）
    for (const half of [0, 0.5]) {
      if (random() > 0.22) continue
      const near = MELODY.filter((note) => Math.abs(note - lastNote) <= 5)
      const note = near[Math.floor(random() * near.length)] ?? 76
      lastNote = note
      playBell(context, out, hz(note), at + half * BEAT, 0.035 + random() * 0.02, 1.6)
    }
  }

  const tick = () => {
    while (nextBeatAt < context.currentTime + LOOKAHEAD) {
      scheduleBeat(nextBeatAt, beat)
      nextBeatAt += BEAT
      beat += 1
    }
  }
  tick()
  const timer = setInterval(tick, TICK_MS)
  return { stop: () => clearInterval(timer) }
}
