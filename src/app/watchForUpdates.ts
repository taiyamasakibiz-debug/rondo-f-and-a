/** 新しい版が出ていないか確かめる間隔 */
const UPDATE_CHECK_MS = 30 * 60 * 1000

/**
 * 新しい版が出ていないかを、ページを開き直さなくても確かめる。
 * Service Worker はふつうページを読み込んだときにしか確かめないので、
 * スマホでアプリを開きっぱなしにしていると、いつまでも更新に気づけない。
 * 画面に戻ってきたときと、30 分ごとに確かめる。
 */
export function watchForUpdates(registration: ServiceWorkerRegistration): () => void {
  const check = () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return
    registration.update().catch(() => {
      // 通信できないときは、次の機会に確かめる
    })
  }
  const timer = setInterval(check, UPDATE_CHECK_MS)
  document.addEventListener('visibilitychange', check)
  window.addEventListener('online', check)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', check)
    window.removeEventListener('online', check)
  }
}
