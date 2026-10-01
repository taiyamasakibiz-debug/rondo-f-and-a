/**
 * Web Audio の土台。音源ファイルは使わず、効果音も BGM もその場で合成する。
 * ブラウザは操作の前に音を出せないので、最初のタップで音の準備をする（unlockAudio）。
 */

type AudioGraph = {
  context: AudioContext
  /** すべての音の出口。画面を離れるときに音量を絞る */
  master: GainNode
  /** 効果音の出口（音量つき） */
  se: GainNode
  /** BGM の出口（音量つき） */
  bgm: GainNode
  /** 残響（効果音と BGM の両方から少しずつ送る） */
  reverb: GainNode
}

let graph: AudioGraph | null = null

function createReverb(context: AudioContext, seconds = 2.2): ConvolverNode {
  // 減衰するノイズで、明るい部屋のような短い残響を作る
  const length = Math.floor(context.sampleRate * seconds)
  const impulse = context.createBuffer(2, length, context.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3
    }
  }
  const convolver = context.createConvolver()
  convolver.buffer = impulse
  return convolver
}

/** 音の準備ができていれば返す。対応していない環境では null */
export function getAudio(): AudioGraph | null {
  if (graph) return graph
  const AudioContextClass =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  if (!AudioContextClass) return null

  // iPhone ではマナーモードのときに鳴らさず、ほかのアプリの音楽とも重ねられるようにする
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession
  if (session) session.type = 'ambient'

  const context = new AudioContextClass()
  const master = context.createGain()
  const compressor = context.createDynamicsCompressor()
  master.connect(compressor).connect(context.destination)

  const reverbIn = context.createGain()
  reverbIn.gain.value = 0.35
  reverbIn.connect(createReverb(context)).connect(master)

  const se = context.createGain()
  se.connect(master)
  se.connect(reverbIn)
  const bgm = context.createGain()
  bgm.connect(master)
  bgm.connect(reverbIn)

  graph = { context, master, se, bgm, reverb: reverbIn }
  return graph
}

/** 作ってあれば返す（まだ作っていなければ作らない） */
export function peekAudio(): AudioGraph | null {
  return graph
}

/** 絞りきるまでの時間（秒） */
const FADE_SECONDS = 0.08

/**
 * 音の処理を止める。いきなり止めると、鳴っている途中の波が切れたり、
 * 最後の音が繰り返されたりして「ピー」と鳴ることがあるので、先に音量を絞ってから止める。
 */
export async function fadeOutAndSuspend(): Promise<void> {
  const audio = graph
  if (!audio || audio.context.state !== 'running') return
  const { context, master } = audio
  master.gain.cancelScheduledValues(context.currentTime)
  master.gain.setValueAtTime(master.gain.value, context.currentTime)
  master.gain.linearRampToValueAtTime(0, context.currentTime + FADE_SECONDS)
  await new Promise((resolve) => setTimeout(resolve, FADE_SECONDS * 1000 + 40))
  if (context.state === 'running') await context.suspend()
}

/** 止めていた音の処理を再開し、音量を戻す */
export async function resumeAndFadeIn(): Promise<void> {
  const audio = graph
  if (!audio) return
  const { context, master } = audio
  if (context.state !== 'running') await context.resume()
  master.gain.cancelScheduledValues(context.currentTime)
  master.gain.setValueAtTime(0, context.currentTime)
  master.gain.linearRampToValueAtTime(1, context.currentTime + 0.3)
}

/** 最初のタップのときに呼ぶ（ブラウザは操作の中でしか音を出し始められない） */
export function unlockAudio(): void {
  const audio = getAudio()
  if (audio && audio.context.state === 'suspended') void audio.context.resume()
}

export function setBusVolume(bus: 'se' | 'bgm', volume: number): void {
  const audio = graph
  if (!audio) return
  // 耳の感じ方に合わせて、つまみの値を 2 乗して使う
  audio[bus].gain.setTargetAtTime(volume * volume, audio.context.currentTime, 0.05)
}

export type ToneOptions = {
  /** 周波数（Hz） */
  frequency: number
  /** 鳴らし始め（AudioContext の時刻） */
  at: number
  /** 長さ（秒）。この間に消えていく */
  duration: number
  type?: OscillatorType
  gain?: number
  attack?: number
  /** 周波数をこの値まで動かす（音程のすべり） */
  glideTo?: number
  /** 高い音を丸める（Hz） */
  lowpass?: number
}

/** 1 つの音を鳴らす。音の出口は destination */
export function playTone(context: BaseAudioContext, destination: AudioNode, options: ToneOptions) {
  const { frequency, at, duration, type = 'sine', gain = 0.2, attack = 0.005 } = options
  const oscillator = context.createOscillator()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, at)
  if (options.glideTo)
    oscillator.frequency.exponentialRampToValueAtTime(options.glideTo, at + duration)

  const envelope = context.createGain()
  envelope.gain.setValueAtTime(0.0001, at)
  envelope.gain.exponentialRampToValueAtTime(gain, at + attack)
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)

  let output: AudioNode = envelope
  if (options.lowpass) {
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = options.lowpass
    envelope.connect(filter)
    output = filter
  }
  oscillator.connect(envelope)
  output.connect(destination)
  oscillator.start(at)
  oscillator.stop(at + duration + 0.05)
}

/** ガラスの実験器具を軽くはじいたような音（基音と、少しずらした倍音） */
export function playBell(
  context: BaseAudioContext,
  destination: AudioNode,
  frequency: number,
  at: number,
  gain = 0.16,
  duration = 0.9,
) {
  playTone(context, destination, { frequency, at, duration, gain })
  playTone(context, destination, {
    frequency: frequency * 2.76,
    at,
    duration: duration * 0.35,
    gain: gain * 0.25,
  })
  playTone(context, destination, {
    frequency: frequency * 5.4,
    at,
    duration: duration * 0.12,
    gain: gain * 0.08,
  })
}

/** 音名の周波数（A4 = 440Hz。MIDI の番号で指定） */
export function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}
