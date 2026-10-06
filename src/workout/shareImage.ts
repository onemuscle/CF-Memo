// 完了したワークアウトをSNS用の画像 (1080×1350) にする。
// 画像で投稿されると、見た人がサイト名とURLから診断に来る導線になる。

import { ENV_LABEL, GOAL_LABEL } from './engine/labels'
import type { Workout } from './engine'

/** 場所ごとのアクセント色 (workout.css の .env-* と同じ) */
const ACCENT: Record<Workout['answers']['env'], [string, string]> = {
  gym: ['#c6ff3e', 'rgba(198,255,62,0.28)'],
  box: ['#ff7a2f', 'rgba(255,122,47,0.35)'],
  home: ['#5fd4c8', 'rgba(95,212,200,0.3)'],
  outdoor: ['#ffd23f', 'rgba(255,210,63,0.3)'],
}

const W = 1080
const H = 1350

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line)
      line = ch
    } else {
      line += ch
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function renderShareImage(
  w: Workout,
  opts: { streakWeeks: number; total: number; score?: string; url: string },
): Promise<Blob | null> {
  try {
    await document.fonts?.ready
  } catch {
    // フォントが読めなくても描画する
  }
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const [accent, glowColor] = ACCENT[w.answers.env]
  const display = '"Oswald", "Noto Sans JP", sans-serif'
  const body = '"Noto Sans JP", "Inter", sans-serif'

  // 背景
  ctx.fillStyle = '#0a0b0e'
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, W)
  glow.addColorStop(0, glowColor)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const pad = 80
  let y = pad + 20

  // ロゴと日付
  ctx.fillStyle = accent
  ctx.font = `700 44px ${display}`
  ctx.fillText('KYOTORE', pad, y)
  ctx.fillStyle = '#8b90a0'
  ctx.font = `500 30px ${body}`
  const d = new Date()
  const dateText = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
  ctx.fillText(dateText, W - pad - ctx.measureText(dateText).width, y)

  y += 120
  ctx.fillStyle = accent
  ctx.font = `700 92px ${display}`
  ctx.fillText('WORKOUT', pad, y)
  y += 100
  ctx.fillText('COMPLETE', pad, y)

  y += 90
  ctx.fillStyle = '#eef0f4'
  ctx.font = `700 60px ${body}`
  for (const l of wrap(ctx, w.title, W - pad * 2).slice(0, 2)) {
    ctx.fillText(l, pad, y)
    y += 74
  }
  ctx.fillStyle = '#8b90a0'
  ctx.font = `500 32px ${body}`
  ctx.fillText(`${ENV_LABEL[w.answers.env]} / ${GOAL_LABEL[w.answers.goal]} / ${w.focusLabel}`, pad, y)

  // 数字
  y += 70
  const stats = [
    { n: `${w.totalMinutes}`, u: '分' },
    { n: `${opts.total}`, u: '回目' },
    { n: `${opts.streakWeeks}`, u: '週連続' },
  ]
  if (opts.score) stats[1] = { n: opts.score, u: '' }
  const colW = (W - pad * 2) / 3
  stats.forEach((s, i) => {
    const x = pad + colW * i
    ctx.fillStyle = '#12141a'
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(x, y, colW - 20, 150, 24)
    else ctx.rect(x, y, colW - 20, 150)
    ctx.fill()
    ctx.fillStyle = '#eef0f4'
    ctx.font = `700 ${s.n.length > 6 ? 44 : 64}px ${display}`
    ctx.fillText(s.n, x + 28, y + 92)
    ctx.fillStyle = '#8b90a0'
    ctx.font = `500 28px ${body}`
    ctx.fillText(s.u || 'スコア', x + 28, y + 132)
  })

  // メニューの要約
  y += 220
  const main = w.blocks.filter(b => b.kind !== 'warmup' && b.kind !== 'cooldown')
  let lines = 0
  for (const b of main) {
    if (lines >= 8 || y > H - 230) break
    ctx.fillStyle = accent
    ctx.font = `600 30px ${display}`
    ctx.fillText(b.label, pad, y)
    ctx.fillStyle = '#eef0f4'
    ctx.font = `500 32px ${body}`
    const names = b.items.filter(i => i.id !== 'emom-rest').map(i => i.name)
    const text = names.slice(0, 4).join('・') + (names.length > 4 ? ` ほか${names.length - 4}種目` : '')
    for (const l of wrap(ctx, text, W - pad * 2 - 230).slice(0, 2)) {
      ctx.fillText(l, pad + 230, y)
      y += 46
      lines++
    }
    y += 18
  }

  // フッター
  ctx.fillStyle = '#23262f'
  ctx.fillRect(pad, H - 170, W - pad * 2, 2)
  ctx.fillStyle = '#eef0f4'
  ctx.font = `700 34px ${body}`
  ctx.fillText('今日のメニューを30秒で作る →', pad, H - 105)
  ctx.fillStyle = '#8b90a0'
  ctx.font = `500 26px ${body}`
  ctx.fillText(opts.url.replace(/^https?:\/\//, '').replace(/\?.*$/, ''), pad, H - 62)
  ctx.fillStyle = accent
  ctx.font = `700 34px ${body}`
  const tag = '#きょうトレ'
  ctx.fillText(tag, W - pad - ctx.measureText(tag).width, H - 105)

  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'))
}

/** 画像を共有 (対応端末) または保存する */
export async function shareOrDownload(blob: Blob, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], 'kyotore.png', { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'kyotore.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}
