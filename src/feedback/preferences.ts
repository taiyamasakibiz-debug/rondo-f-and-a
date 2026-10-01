import { create } from 'zustand'

/**
 * 音と振動の設定。端末ごとの好みなので、ほかの端末とは同期せず、このブラウザにだけ保存する。
 */
export type FeedbackPreferences = {
  /** 効果音 */
  se: boolean
  /** BGM（はじめはオフ。開いた瞬間に音が鳴らないように） */
  bgm: boolean
  /** 振動（触覚フィードバック） */
  haptics: boolean
  /** 効果音の音量（0〜1） */
  seVolume: number
  /** BGM の音量（0〜1） */
  bgmVolume: number
}

export const DEFAULT_PREFERENCES: FeedbackPreferences = {
  se: true,
  bgm: false,
  haptics: true,
  seVolume: 0.7,
  bgmVolume: 0.5,
}

const STORAGE_KEY = 'luminous-insight-feedback'

function clamp01(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback
}

export function parsePreferences(raw: string | null): FeedbackPreferences {
  if (!raw) return DEFAULT_PREFERENCES
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof FeedbackPreferences, unknown>>
    const flag = (key: 'se' | 'bgm' | 'haptics') =>
      typeof value[key] === 'boolean' ? value[key] : DEFAULT_PREFERENCES[key]
    return {
      se: flag('se'),
      bgm: flag('bgm'),
      haptics: flag('haptics'),
      seVolume: clamp01(value.seVolume, DEFAULT_PREFERENCES.seVolume),
      bgmVolume: clamp01(value.bgmVolume, DEFAULT_PREFERENCES.bgmVolume),
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function load(): FeedbackPreferences {
  try {
    return parsePreferences(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_PREFERENCES
  }
}

type PreferencesState = FeedbackPreferences & {
  update(patch: Partial<FeedbackPreferences>): void
}

export const useFeedbackPreferences = create<PreferencesState>()((set, get) => ({
  ...load(),
  update(patch) {
    set(patch)
    const { update: _, ...values } = { ...get() }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
    } catch {
      // 保存できなくても、開いている間は設定どおりに動く
    }
  },
}))
