// 色テーマ。<html data-theme> を切り替え、色は app.css の変数で差し替える。
// 起動直後のちらつきを防ぐため、最後に選んだテーマは localStorage にも控えておく。

export type Theme = 'black' | 'white' | 'ivory' | 'pink'

export interface ThemeOption {
  key: Theme
  label: string
  desc: string
  /** 選択肢のプレビュー: 背景 / カード / アクセント / 文字 */
  swatch: { bg: string; card: string; accent: string; text: string }
}

export const THEMES: ThemeOption[] = [
  {
    key: 'black',
    label: 'ブラック',
    desc: 'ジムでも見やすい、引き締まった黒',
    swatch: { bg: '#0a0b0e', card: '#12141a', accent: '#c6ff3e', text: '#eef0f4' },
  },
  {
    key: 'white',
    label: 'ホワイト',
    desc: '明るくすっきり',
    swatch: { bg: '#f4f5f7', card: '#ffffff', accent: '#3f7d0a', text: '#16181d' },
  },
  {
    key: 'ivory',
    label: 'アイボリー',
    desc: 'あたたかくやさしい色合い',
    swatch: { bg: '#f5efe4', card: '#fffaf2', accent: '#9a693c', text: '#3b3128' },
  },
  {
    key: 'pink',
    label: 'ピンク',
    desc: 'やわらかく華やかに',
    swatch: { bg: '#fff3f6', card: '#ffffff', accent: '#c9456b', text: '#40293a' },
  },
]

const KEY = 'fitmemo:theme'

export function isTheme(v: unknown): v is Theme {
  return THEMES.some(t => t.key === v)
}

/** 前回のテーマ (なければ黒) */
export function savedTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    if (isTheme(v)) return v
  } catch {
    // 保存できない環境では既定の黒
  }
  return 'black'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  const bg = THEMES.find(t => t.key === theme)!.swatch.bg
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // 保存できなくても表示は切り替わる
  }
}
