import { getAudio, setBusVolume, unlockAudio } from './audio'
import { type BgmPlayer, startBgm } from './bgm'
import { useFeedbackPreferences } from './preferences'
import { SOUNDS, type SoundName } from './sounds'

export type { SoundName } from './sounds'

/**
 * 手応えの出口：効果音を、設定に合わせて鳴らす。
 * 画面の演出（src/lib/motion.ts の STAGE）と同じタイミングで呼ぶ。
 */
export function feedback(name: SoundName): void {
  const preferences = useFeedbackPreferences.getState()
  if (!preferences.se) return
  const audio = getAudio()
  if (!audio || audio.context.state !== 'running') return
  SOUNDS[name](audio.context, audio.se, audio.context.currentTime + 0.01)
}

/** delay 秒後に鳴らす。戻り値で取り消す（画面を離れたときなど） */
export function feedbackLater(name: SoundName, delay: number): () => void {
  const timer = setTimeout(() => feedback(name), delay * 1000)
  return () => clearTimeout(timer)
}

let bgm: BgmPlayer | null = null

function syncBgm() {
  const { bgm: enabled } = useFeedbackPreferences.getState()
  const audio = getAudio()
  const shouldPlay =
    enabled && document.visibilityState === 'visible' && audio?.context.state === 'running'
  if (shouldPlay && !bgm && audio) {
    bgm = startBgm(audio.context, audio.bgm)
  } else if (!shouldPlay && bgm) {
    bgm.stop()
    bgm = null
  }
}

/**
 * 起動時に 1 回呼ぶ。最初のタップで音の準備をし、設定の変更・画面の表示に合わせて BGM を流す・止める。
 */
export function startFeedback(): () => void {
  const applyVolumes = () => {
    const { seVolume, bgmVolume } = useFeedbackPreferences.getState()
    setBusVolume('se', seVolume)
    setBusVolume('bgm', bgmVolume)
  }
  const onGesture = () => {
    const audio = getAudio()
    if (!audio) return
    applyVolumes()
    unlockAudio()
    // resume は非同期なので、動き始めてから BGM を確かめる
    void audio.context.resume().then(syncBgm, () => {})
  }
  const onVisibility = () => {
    const audio = getAudio()
    if (!audio) return
    // 見ていない間は音の処理を止める（電池の節約。BGM も止まる）
    if (document.visibilityState === 'hidden') void audio.context.suspend().then(syncBgm, () => {})
    else void audio.context.resume().then(syncBgm, () => {})
  }
  const unsubscribe = useFeedbackPreferences.subscribe(() => {
    applyVolumes()
    syncBgm()
  })
  // iPhone はタッチを離したとき（pointerup・click）でないと音を出し始められない
  const events = ['pointerup', 'click', 'keydown'] as const
  for (const type of events) window.addEventListener(type, onGesture, { capture: true })
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    unsubscribe()
    for (const type of events) window.removeEventListener(type, onGesture, { capture: true })
    document.removeEventListener('visibilitychange', onVisibility)
    bgm?.stop()
    bgm = null
  }
}
