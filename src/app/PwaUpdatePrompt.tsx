import { AnimatePresence, motion } from 'motion/react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

// v1 は Service Worker のキャッシュが古いまま残りやすかったため、
// 新しい版が届いたら知らせて、ユーザーの操作で切り替える
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          // スマホでは下のタブ（高さ約 56px + 余白 12px）に重ならないよう、その上に出す。
          // 幅が狭いので文字とボタンを 2 段に分ける。Tessera は影を使わないので枠線だけにする
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-50 mx-auto flex max-w-md flex-col gap-3 rounded-lg border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between md:bottom-6"
        >
          <p className="text-sm whitespace-nowrap">新しいバージョンがあります</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
              あとで
            </Button>
            <Button size="sm" onClick={() => updateServiceWorker(true)}>
              更新する
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
