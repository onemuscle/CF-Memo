import Anthropic from '@anthropic-ai/sdk'
import type { ScannedWod, WodMovement } from './types'

/**
 * ホワイトボードのWODをClaudeの画像入力で読み取る。
 *
 * Tesseractは活字向けのOCRエンジンで、手書きのホワイトボードはほぼ読めない。
 * こちらは画像をそのままモデルに渡して「WODとして」解釈させるので、
 * かすれ・斜め・記号 (21-15-9, 43/30kg, ↑↓) にも耐える。
 */

const MODEL = 'claude-opus-5'
/** Claudeの高解像度入力の上限。これ以上送っても精度は上がらず画像トークンだけ増える */
const MAX_EDGE = 2576

export const API_KEY_SETTING = 'anthropic-api-key'

/** 構造化出力のスキーマ。すべて必須にして、無ければ空文字を返させる */
const WOD_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'WOD名。Fran や Murph などの名前、無ければ空文字',
    },
    format: {
      type: 'string',
      description:
        '形式。例: AMRAP 12min / 5 Rounds For Time / EMOM 10min / 21-15-9。読み取れなければ空文字',
    },
    movements: {
      type: 'array',
      description: '種目を書かれている順に。1つも読み取れなければ空配列',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'ボードに書かれていたままの種目名' },
          nameJa: { type: 'string', description: 'カタカナ・日本語での言い方' },
          reps: { type: 'string', description: '回数や距離。例: 21-15-9 / 400m / 空文字' },
          load: { type: 'string', description: '重量や高さ。例: 43/30kg / 24in / 空文字' },
        },
        required: ['name', 'nameJa', 'reps', 'load'],
        additionalProperties: false,
      },
    },
    notes: {
      type: 'string',
      description: 'Time Cap、スケール、備考など。無ければ空文字',
    },
    raw: {
      type: 'string',
      description: 'ボードの文字を見えたまま行ごとに書き起こしたもの',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: '読み取りの確からしさ。1文字でも推測が入ったら high にしない',
    },
  },
  required: ['title', 'format', 'movements', 'notes', 'raw', 'confidence'],
  additionalProperties: false,
} as const

const SYSTEM = `あなたはCrossFitボックスのホワイトボードを読み取る係です。撮影された画像から、その日のWODを書き起こします。

守ること:
- 書かれていないものを補わない。よくあるWODの型に当てはめて推測しない。
- 読めない文字は ? に置き換える。単語ごと消さない。
- 略記はボードのまま残す (T2B, HSPU, C&J, DU など)。nameJa の側で日本語にする。
- 男女別重量は 43/30kg のようにスラッシュのまま残す。
- raw は整形せず、ボードの行の並びのまま書き起こす。
- 1文字でも推測が入った、または画像がぶれて確信が持てない場合は confidence を high にしない。

英語の種目名はそのまま name に、日本語の言い方を nameJa に入れます (例: Thruster / スラスター、Toes to Bar / トゥ・トゥ・バー)。`

const PROMPT =
  'この画像のホワイトボードに書かれているWODを読み取ってください。ボードの一部しか写っていない場合は、写っている範囲だけを書き起こしてください。'

/**
 * 画像を長辺 MAX_EDGE まで縮小してJPEGのbase64にする。
 * スマホの写真は4000px以上あることが多く、そのまま送っても上限で切られるだけ。
 */
export async function prepareImage(
  file: File,
): Promise<{ data: string; mediaType: 'image/jpeg'; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像の変換に失敗しました。')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
  return { data: dataUrl.split(',')[1], mediaType: 'image/jpeg', width, height }
}

interface Parsed {
  title: string
  format: string
  movements: WodMovement[]
  notes: string
  raw: string
  confidence: 'high' | 'medium' | 'low'
}

export type WodDraft = Omit<ScannedWod, 'date' | 'result' | 'updatedAt'>

export async function transcribeWod(file: File, apiKey: string): Promise<WodDraft> {
  const client = new Anthropic({
    apiKey,
    // ブラウザから直接叩くための明示。SDKが anthropic-dangerous-direct-browser-access を付ける
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
  })

  const image = await prepareImage(file)

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: WOD_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: image.mediaType, data: image.data },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  })

  if (res.stop_reason === 'refusal') {
    throw new Error('この画像は読み取りを断られました。別の写真でお試しください。')
  }
  if (res.stop_reason === 'max_tokens') {
    throw new Error('読み取り結果が長すぎて途中で切れました。ボードを分けて撮ってください。')
  }

  const block = res.content.find(b => b.type === 'text')
  if (!block || block.type !== 'text') {
    throw new Error('読み取り結果が空でした。もう一度お試しください。')
  }

  let parsed: Parsed
  try {
    parsed = JSON.parse(block.text) as Parsed
  } catch {
    throw new Error('読み取り結果を解釈できませんでした。もう一度お試しください。')
  }

  return {
    title: parsed.title ?? '',
    format: parsed.format ?? '',
    movements: Array.isArray(parsed.movements) ? parsed.movements : [],
    notes: parsed.notes ?? '',
    raw: (parsed.raw ?? '').trim(),
    confidence: parsed.confidence ?? 'low',
    source: 'claude',
  }
}

/** APIキーが生きているかの軽い確認。設定画面の「確認」ボタン用 */
export async function checkApiKey(apiKey: string): Promise<void> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0 })
  await client.messages.create({
    model: MODEL,
    max_tokens: 16,
    thinking: { type: 'disabled' },
    messages: [{ role: 'user', content: 'ok とだけ返してください。' }],
  })
}

/** 読み取り結果をメモ本文用のテキストに整形する */
export function wodToText(w: {
  title: string
  format: string
  movements: WodMovement[]
  notes: string
  raw: string
}): string {
  const lines: string[] = []
  if (w.title) lines.push(w.title)
  if (w.format) lines.push(w.format)
  if (w.movements.length) {
    lines.push('')
    for (const m of w.movements) {
      const right = [m.reps, m.load].filter(Boolean).join(' ')
      lines.push(`- ${m.name}${m.nameJa ? ` (${m.nameJa})` : ''}${right ? ` — ${right}` : ''}`)
    }
  }
  if (w.notes) {
    lines.push('')
    lines.push(w.notes)
  }
  if (!lines.length) return w.raw
  return lines.join('\n')
}
