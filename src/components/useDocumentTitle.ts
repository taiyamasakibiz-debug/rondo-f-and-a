import { useEffect } from 'react'

export const APP_NAME = 'Luminous Insight'

/**
 * ブラウザのタブのタイトル。複数のウィンドウを並べて使うので（docs/DESIGN.md §2）、
 * どのウィンドウが何の画面かをタイトルで見分けられるようにする。
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} | ${APP_NAME}` : APP_NAME
    return () => {
      document.title = APP_NAME
    }
  }, [title])
}
