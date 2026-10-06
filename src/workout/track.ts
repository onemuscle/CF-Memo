// 計測用のフック。Google アナリティクス等のタグを workout/index.html に入れれば
// そのまま送られる (入れていなければ何もしない)。

type Params = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

export function track(event: string, params: Params = {}) {
  try {
    if (window.gtag) window.gtag('event', event, params)
    else window.dataLayer?.push({ event, ...params })
  } catch {
    // 計測の失敗で画面を止めない
  }
}
