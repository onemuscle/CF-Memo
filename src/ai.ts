import Anthropic from '@anthropic-ai/sdk'
import type { AccessoryAdvice, ScannedWod, WodMovement } from './types'

/**
 * ホワイトボードのWODをClaudeの画像入力で読み取る。
 *
 * Tesseractは活字向けのOCRエンジンで、手書きのホワイトボードはほぼ読めない。
 * こちらは画像をそのままモデルに渡して「WODとして」解釈させるので、
 * かすれ・斜め・記号 (21-15-9, 43/30kg, ↑↓) にも耐える。
 */

export const API_KEY_SETTING = 'anthropic-api-key'
export const QUALITY_SETTING = 'read-quality'

export type Quality = 'eco' | 'standard' | 'best'

/**
 * 読み取りの品質と費用の段。
 *
 * maxEdge は送信前に縮小する長辺。2576px はClaudeの高解像度入力の上限で、
 * それ以上送っても精度は上がらず画像トークンだけ増える。Haikuは高解像度の
 * 対象外なので1568pxに落として無駄な転送をやめる。
 *
 * effort は思考の深さ。文字起こしは推論より知覚の仕事なので、低くしても
 * 精度はあまり落ちない。Haiku 4.5 は effort に非対応なので送らない。
 */
export const QUALITY_TIERS: Record<
  Quality,
  { label: string; model: string; maxEdge: number; effort?: 'low' | 'medium' | 'high'; cost: string }
> = {
  eco: {
    label: '節約',
    model: 'claude-haiku-4-5',
    maxEdge: 1568,
    cost: '1回1円未満',
  },
  standard: {
    label: '標準',
    model: 'claude-sonnet-5',
    maxEdge: 2576,
    effort: 'low',
    cost: '1回2〜3円',
  },
  best: {
    label: '高精度',
    model: 'claude-opus-5',
    maxEdge: 2576,
    cost: '1回8〜9円',
  },
}

export const DEFAULT_QUALITY: Quality = 'standard'

export function qualityOf(v: string | undefined): Quality {
  return v === 'eco' || v === 'standard' || v === 'best' ? v : DEFAULT_QUALITY
}

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
  maxEdge = 2576,
): Promise<{ data: string; mediaType: 'image/jpeg'; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
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

export async function transcribeWod(
  file: File,
  apiKey: string,
  quality: Quality = DEFAULT_QUALITY,
): Promise<WodDraft> {
  const tier = QUALITY_TIERS[quality]
  const client = new Anthropic({
    apiKey,
    // ブラウザから直接叩くための明示。SDKが anthropic-dangerous-direct-browser-access を付ける
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
  })

  const image = await prepareImage(file, tier.maxEdge)

  const res = await client.messages.create({
    model: tier.model,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: {
      format: { type: 'json_schema', schema: WOD_SCHEMA },
      // Haiku 4.5 は effort 非対応。送るとエラーになるので段に持たせている
      ...(tier.effort ? { effort: tier.effort } : {}),
    },
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

/** APIキーが生きているかの軽い確認。いちばん安いモデルで1往復するだけ */
export async function checkApiKey(apiKey: string): Promise<void> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0 })
  await client.messages.create({
    model: QUALITY_TIERS.eco.model,
    max_tokens: 16,
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

// ================================================================ 補助トレの判定
//
// 朝のWODが重ければ夜の補助は削る、というのはプラン側にもとから書いてある判断
// (TOP_RULES / SKIP_RULE)。ただし「重いかどうか」はその日のボードを見ないと決め
// られないので、読み取ったWODとその日の予定を突き合わせて判定させる。

const ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: {
      type: 'string',
      enum: ['keep', 'reduce', 'swap', 'skip'],
      description:
        'keep=予定どおり / reduce=セット数を減らす / swap=種目を入れ替える / skip=この日はやらない',
    },
    amLoad: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: '朝のWODの負荷。ボードに書かれた量だけで判断する',
    },
    headline: {
      type: 'string',
      description: '結論を1文で。例「予定どおりでOK」「肩を2セット減らす」「今日は中止」',
    },
    reason: {
      type: 'string',
      description:
        'WODのどの種目・どの量を見てそう判断したかを具体的に。2〜3文。一般論ではなく今日のボードの中身を挙げる',
    },
    exercises: {
      type: 'array',
      description:
        '実施する内容。keep なら予定の種目をそのまま、reduce/swap なら変更後、skip なら空配列',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '種目名（英語表記のまま）' },
          nameJa: { type: 'string', description: '日本語の言い方' },
          volume: { type: 'string', description: 'セット×回数。例 3×12-20' },
          change: {
            type: 'string',
            description: '予定からの変更点。変更なしなら空文字。例「4→2セット」「肘に優しい種目へ」',
          },
        },
        required: ['name', 'nameJa', 'volume', 'change'],
        additionalProperties: false,
      },
    },
    caution: { type: 'string', description: 'やる場合の注意。無ければ空文字' },
  },
  required: ['verdict', 'amLoad', 'headline', 'reason', 'exercises', 'caution'],
  additionalProperties: false,
} as const

const ADVICE_SYSTEM = `あなたはCrossFitと筋肥大を並行させている人のコーチです。その日の朝のWODを踏まえて、夜に予定している補助トレをそのままやるか、減らすか、入れ替えるか、やめるかを決めます。

判断の柱:
- 刺激を重複させない。朝に大量に使った部位を、夜にもう一度追い込まない。予定を守ることより重複を避けるほうが優先。
- 次のいずれかに当たる朝は「高負荷」とみなす: 2km以上のラン / 40〜50rep以上のバーピー / Wall Ball・Thruster・Lunge などスクワット系の大量 / Squat Snatch・Cleanなど高ボリュームのOlympic lifting。
- 高負荷ならラン・バーピーは削除する。筋肥大の補助は、疲れている部位と被らなければ少量なら残してよい。
- 夜は45〜50分以内。予定より増やす提案はしない。

守ること:
- 判断はボードに書かれている量だけを根拠にする。本人のRPEや体調は分からないので推測しない。必要なら caution で「RPEが9〜10だった場合は中止」のように条件で書く。
- 予定を変える理由がなければ迷わず keep を選ぶ。無理に変更を作らない。
- reduce では予定にある種目のセット数を落とす。新しい種目を足さない。
- swap は、朝と部位が重複する種目を、重複しない別の種目に置き換えるときだけ。
- reason には「バーピー50repとThruster 43kgが入っているため」のように、今日のボードの中身を必ず挙げる。`

/** 今日の補助トレをどうするかを判定する。予定種目が無い日 (完全休養など) は呼ばない */
export async function judgeAccessory(
  wod: { title: string; format: string; movements: WodMovement[]; notes: string; raw: string },
  plan: {
    date: string
    pm: string
    note: string
    exercises: { name: string; sets: string; reps: string; intensity: string; aim: string; caution: string }[]
    topRules: string[]
  },
  apiKey: string,
  quality: Quality = DEFAULT_QUALITY,
): Promise<Omit<AccessoryAdvice, 'forDate'>> {
  const tier = QUALITY_TIERS[quality]
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 })

  const wodText = [
    wod.title && `WOD名: ${wod.title}`,
    wod.format && `形式: ${wod.format}`,
    ...wod.movements.map(m => `- ${m.name} ${[m.reps, m.load].filter(Boolean).join(' ')}`),
    wod.notes && `備考: ${wod.notes}`,
    wod.raw && `ボード原文:\n${wod.raw}`,
  ]
    .filter(Boolean)
    .join('\n')

  const planText = [
    `夜の予定: ${plan.pm}`,
    plan.note && `この日のメモ: ${plan.note}`,
    '予定している種目:',
    ...plan.exercises.map(
      e =>
        `- ${e.name} ${e.sets}×${e.reps} ${e.intensity}（狙い: ${e.aim}${e.caution ? ` / 注意: ${e.caution}` : ''}）`,
    ),
    '',
    'プラン全体のルール:',
    ...plan.topRules.map(r => `- ${r}`),
  ]
    .filter(Boolean)
    .join('\n')

  const res = await client.messages.create({
    model: tier.model,
    max_tokens: 16000,
    system: ADVICE_SYSTEM,
    output_config: {
      format: { type: 'json_schema', schema: ADVICE_SCHEMA },
      ...(tier.effort ? { effort: tier.effort } : {}),
    },
    messages: [
      {
        role: 'user',
        content: `【今朝のWOD】\n${wodText}\n\n【今夜の予定】\n${planText}\n\n今夜の補助トレをどうするか判定してください。`,
      },
    ],
  })

  if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') {
    throw new Error('補助トレの判定に失敗しました。')
  }
  const block = res.content.find(b => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('補助トレの判定が空でした。')

  const parsed = JSON.parse(block.text) as Omit<AccessoryAdvice, 'forDate'>
  return {
    verdict: parsed.verdict ?? 'keep',
    amLoad: parsed.amLoad ?? 'medium',
    headline: parsed.headline ?? '',
    reason: parsed.reason ?? '',
    exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
    caution: parsed.caution ?? '',
  }
}
