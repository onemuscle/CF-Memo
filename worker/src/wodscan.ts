import Anthropic from '@anthropic-ai/sdk'

/**
 * ホワイトボードの写真から WOD を読み取る (Claude の画像入力)。
 * API キーは Worker の Secret (ANTHROPIC_API_KEY) にだけ置き、ブラウザには渡さない。
 * 1回あたり数円 (画像1枚 + 短い出力)。
 */

export interface ScannedMovement {
  name: string
  nameJa: string
  reps: string
  load: string
}

export interface ScannedWod {
  title: string
  format: string
  time_cap_min: number | null
  strength: string
  movements: ScannedMovement[]
  notes: string
  raw: string
  confidence: 'high' | 'medium' | 'low'
}

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'WOD名 (Fran / Murph など)。無ければ空文字' },
    format: { type: 'string', description: '形式。例: AMRAP 12min / 5 Rounds For Time / EMOM 10min / 21-15-9。無ければ空文字' },
    time_cap_min: { type: ['number', 'null'], description: 'Time Cap や AMRAP の分数。無ければ null' },
    strength: { type: 'string', description: 'WOD とは別の筋力・スキルのパート (例: Back Squat 5x5 @75%)。無ければ空文字' },
    movements: {
      type: 'array',
      description: 'WOD の種目を書かれている順に。読み取れなければ空配列',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'ボードに書かれていたままの種目名' },
          nameJa: { type: 'string', description: '日本語・カタカナの言い方' },
          reps: { type: 'string', description: '回数や距離 (21-15-9 / 400m)。無ければ空文字' },
          load: { type: 'string', description: '重量や高さ (43/30kg / 24in)。無ければ空文字' },
        },
        required: ['name', 'nameJa', 'reps', 'load'],
        additionalProperties: false,
      },
    },
    notes: { type: 'string', description: 'スケール・備考。無ければ空文字' },
    raw: { type: 'string', description: 'ボードの文字を見えたまま行ごとに書き起こしたもの' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: '1文字でも推測が入ったら high にしない' },
  },
  required: ['title', 'format', 'time_cap_min', 'strength', 'movements', 'notes', 'raw', 'confidence'],
  additionalProperties: false,
} as const

const SYSTEM = `あなたはCrossFitボックスのホワイトボードを読み取る係です。撮影された画像から、その日のメニューを書き起こします。

守ること:
- 書かれていないものを補わない。よくあるWODの型に当てはめて推測しない。
- 読めない文字は ? に置き換える。単語ごと消さない。
- 略記はボードのまま残す (T2B, HSPU, C&J, DU など)。nameJa の側で日本語にする。
- 男女別重量は 43/30kg のようにスラッシュのまま残す。
- ウォームアップは movements に入れない。筋力・スキルのパートは strength に、メインの WOD は movements に入れる。
- raw は整形せず、ボードの行の並びのまま書き起こす。
- 1文字でも推測が入った、または画像がぶれて確信が持てない場合は confidence を high にしない。`

export class ScanError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function scanWod(apiKey: string, image: Uint8Array, mime: string): Promise<ScannedWod> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) throw new ScanError(415, 'この形式の画像は読み取れません (JPEG/PNG/WebP)')
  const client = new Anthropic({ apiKey, maxRetries: 2 })
  let data = ''
  for (let i = 0; i < image.length; i += 0x8000) data += String.fromCharCode(...image.subarray(i, i + 0x8000))
  try {
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // 書き起こしは推論より知覚の仕事なので、思考は浅くてよい
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg', data: btoa(data) } },
            { type: 'text', text: 'この写真のホワイトボードに書かれている今日のメニューを読み取ってください。写っている範囲だけを書き起こしてください。' },
          ],
        },
      ],
    })
    if (res.stop_reason === 'refusal') throw new ScanError(422, '読み取りを断られました。別の写真で試してください')
    if (res.stop_reason === 'max_tokens') throw new ScanError(502, '読み取り結果が長すぎて途中で切れました')
    const text = res.content.find(b => b.type === 'text')
    if (!text || text.type !== 'text') throw new ScanError(502, '読み取り結果が空でした')
    return JSON.parse(text.text) as ScannedWod
  } catch (e) {
    if (e instanceof ScanError) throw e
    if (e instanceof Anthropic.AuthenticationError) throw new ScanError(503, 'Anthropic API キーが正しくありません (Worker の ANTHROPIC_API_KEY)')
    if (e instanceof Anthropic.RateLimitError) throw new ScanError(429, '読み取りが混み合っています。少し待ってから再試行してください')
    if (e instanceof Anthropic.BadRequestError) throw new ScanError(400, `読み取りに失敗しました: ${e.message}`)
    if (e instanceof Anthropic.APIError) throw new ScanError(502, `読み取りサービスのエラー (${e.status})`)
    throw e
  }
}

/** 読み取り結果を「トレーニング」記録の項目に変換 */
export function toWorkoutFields(w: ScannedWod): Record<string, unknown> {
  const lines = w.movements.map(m => [m.reps, m.name, m.load, m.nameJa ? `(${m.nameJa})` : ''].filter(Boolean).join(' '))
  const cap = w.time_cap_min ? `Time Cap ${w.time_cap_min}分` : ''
  const desc = [w.strength ? `【Strength】${w.strength}` : '', [w.format, cap].filter(Boolean).join(' / '), ...lines, w.notes].filter(Boolean).join('\n')
  return {
    type: 'crossfit',
    title: w.title || (w.format ? w.format.split(/\s/)[0] + ' WOD' : 'WOD'),
    format: w.format || null,
    description: desc || w.raw || null,
  }
}
