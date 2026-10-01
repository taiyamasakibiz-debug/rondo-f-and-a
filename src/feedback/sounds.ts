import { midiToFrequency as hz, playBell, playTone } from './audio'

/**
 * 効果音。明るいラボの世界観に合わせて、ガラスの鈴のような澄んだ音で作る。
 * 間違えたときも、責めるような音にはしない（低く短く、やわらかく）。
 */
export type SoundName =
  'tap' | 'correct' | 'partial' | 'incorrect' | 'levelUp' | 'streak' | 'certified' | 'failed'

type Play = (context: BaseAudioContext, out: AudioNode, at: number) => void

// MIDI の番号：72 = C5、84 = C6
export const SOUNDS: Record<SoundName, Play> = {
  tap(context, out, at) {
    playTone(context, out, { frequency: 1800, at, duration: 0.03, gain: 0.05 })
  },
  correct(context, out, at) {
    playBell(context, out, hz(88), at, 0.14, 0.7) // E6
    playBell(context, out, hz(93), at + 0.09, 0.16, 1.1) // A6
  },
  partial(context, out, at) {
    playBell(context, out, hz(84), at, 0.12, 0.8) // C6
  },
  incorrect(context, out, at) {
    const options = { type: 'triangle' as const, gain: 0.12, lowpass: 900, duration: 0.28 }
    playTone(context, out, { ...options, frequency: hz(57), at }) // A3
    playTone(context, out, { ...options, frequency: hz(53), at: at + 0.13 }) // F3
  },
  levelUp(context, out, at) {
    ;[84, 88, 91, 96].forEach((note, i) =>
      playBell(context, out, hz(note), at + i * 0.075, 0.12, 1),
    )
    // 下で和音をふわっと鳴らす
    for (const note of [60, 64, 67, 71]) {
      playTone(context, out, {
        frequency: hz(note),
        at,
        duration: 1.6,
        type: 'triangle',
        gain: 0.035,
        attack: 0.25,
        lowpass: 1600,
      })
    }
  },
  streak(context, out, at) {
    playBell(context, out, hz(91), at, 0.13, 0.9) // G6
    playBell(context, out, hz(98), at + 0.11, 0.12, 1.3) // D7
  },
  certified(context, out, at) {
    for (const note of [60, 64, 67, 71, 74]) {
      playTone(context, out, {
        frequency: hz(note),
        at,
        duration: 2.4,
        type: 'triangle',
        gain: 0.04,
        attack: 0.4,
        lowpass: 2000,
      })
    }
    // 押した瞬間のきらめき（ペンタトニックで上がっていく）
    ;[84, 86, 88, 91, 93, 96].forEach((note, i) =>
      playBell(context, out, hz(note), at + 0.05 + i * 0.06, 0.09, 1.2),
    )
  },
  failed(context, out, at) {
    playBell(context, out, hz(79), at, 0.08, 0.9) // G5
    playBell(context, out, hz(76), at + 0.16, 0.08, 1.2) // E5
  },
}
