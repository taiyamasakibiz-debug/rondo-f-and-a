import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startBgm } from './bgm'
import { DEFAULT_PREFERENCES, parsePreferences, useFeedbackPreferences } from './preferences'
import { SOUNDS, type SoundName } from './sounds'

/** 音を鳴らさずに、作られた音を数えるだけの AudioContext */
function createFakeContext() {
  const started: { frequency: number; at: number }[] = []
  const param = () => {
    let value = 0
    return {
      get value() {
        return value
      },
      set value(next: number) {
        value = next
      },
      setValueAtTime(next: number) {
        value = next
      },
      // 本物の exponentialRampToValueAtTime は 0 以下を受け付けない
      exponentialRampToValueAtTime(next: number) {
        if (!(next > 0)) throw new RangeError('exponential ramp to non-positive value')
        value = next
      },
      setTargetAtTime() {},
    }
  }
  const node = () => ({ connect: (target: unknown) => target })
  const context = {
    currentTime: 0,
    createOscillator() {
      const frequency = param()
      return {
        ...node(),
        type: 'sine',
        frequency,
        start: (at: number) => started.push({ frequency: frequency.value, at }),
        stop() {},
      }
    },
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param() }),
  }
  return { context: context as unknown as BaseAudioContext, started }
}

describe('効果音', () => {
  it.each(Object.keys(SOUNDS) as SoundName[])('%s は聞こえる高さの音を作る', (name) => {
    const { context, started } = createFakeContext()
    SOUNDS[name](context, {} as AudioNode, 1)
    expect(started.length).toBeGreaterThan(0)
    for (const tone of started) {
      expect(tone.frequency).toBeGreaterThan(40)
      expect(tone.frequency).toBeLessThan(16_000)
      expect(tone.at).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('BGM', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('時間が進むと音を作り続け、止めると作らなくなる', () => {
    const { context, started } = createFakeContext()
    const fake = context as unknown as { currentTime: number }
    const player = startBgm(context, {} as AudioNode, () => 0)
    const first = started.length
    expect(first).toBeGreaterThan(0) // 最初の和音

    fake.currentTime = 30
    vi.advanceTimersByTime(100)
    const later = started.length
    expect(later).toBeGreaterThan(first)

    player.stop()
    fake.currentTime = 60
    vi.advanceTimersByTime(1000)
    expect(started.length).toBe(later)
  })
})

describe('効果音と BGM の設定', () => {
  it('壊れた値や範囲外の値は、初期値や範囲内に直す', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences('{')).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences('{"bgm":true,"seVolume":3,"se":"yes"}')).toEqual({
      ...DEFAULT_PREFERENCES,
      bgm: true,
      seVolume: 1,
    })
  })

  it('変更はこのブラウザに保存される', () => {
    useFeedbackPreferences.getState().update({ bgm: true, bgmVolume: 0.3 })
    expect(parsePreferences(localStorage.getItem('luminous-insight-feedback'))).toMatchObject({
      bgm: true,
      bgmVolume: 0.3,
    })
    useFeedbackPreferences.getState().update(DEFAULT_PREFERENCES)
  })
})
