import Anthropic from '@anthropic-ai/sdk'
import type { AccessoryAdvice, ScannedWod, WodMovement } from './types'

/**
 * ホワイトボードのWODをAIの画像入力で読み取る。Anthropic (Claude) と OpenAI (ChatGPT) のどちらか。
 *
 * 画像をそのままモデルに渡して「WODとして」解釈させるので、
 * 手書き・かすれ・斜め・記号 (21-15-9, 43/30kg, ↑↓) にも耐える。
 */

export type Provider = 'anthropic' | 'openai'

export const PROVIDER_SETTING = 'ai-provider'
export const API_KEY_SETTING = 'anthropic-api-key'
export const OPENAI_KEY_SETTING = 'openai-api-key'
/** OpenAI はモデル名の入れ替わりが早いので、キーの確認時に使えるモデルを選んで控えておく */
export const OPENAI_MODELS_SETTING = 'openai-models'
export const QUALITY_SETTING = 'read-quality'

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'ChatGPT (OpenAI)',
}

export const KEY_SETTING: Record<Provider, string> = {
  anthropic: API_KEY_SETTING,
  openai: OPENAI_KEY_SETTING,
}

export function providerOf(v: string | undefined): Provider {
  return v === 'openai' ? 'openai' : 'anthropic'
}

/** 読み取り・判定に使うAIの設定 */
export interface AiConfig {
  provider: Provider
  apiKey: string
  /** OpenAI の品質ごとのモデル (checkApiKey で選んだもの) */
  openaiModels?: OpenAiModels
}

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

export type OpenAiModels = Record<Quality, string>

/**
 * OpenAI の品質ごとの候補 (先頭ほど優先)。キーで使えるモデルの一覧から、いちばん前にあるものを使う。
 * 画像入力と json_schema の構造化出力に対応したモデルだけを並べている。
 */
const OPENAI_CANDIDATES: Record<Quality, string[]> = {
  eco: ['gpt-5.6-luna', 'gpt-5.4-nano', 'gpt-5-nano', 'gpt-4.1-mini', 'gpt-4o-mini'],
  standard: ['gpt-5.6-terra', 'gpt-5.4-mini', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o'],
  best: ['gpt-5.6-sol', 'gpt-5.4', 'gpt-5', 'gpt-4.1', 'gpt-4o'],
}

export const OPENAI_COST: Record<Quality, string> = {
  eco: '1回1円未満',
  standard: '1回1〜2円',
  best: '1回3〜5円',
}

/** 保存しておいたモデルの選択を読む (壊れていれば既定の候補の先頭) */
export function openAiModelsOf(v: string | undefined): OpenAiModels {
  try {
    const m = JSON.parse(v ?? '') as Partial<OpenAiModels>
    if (m.eco && m.standard && m.best) return m as OpenAiModels
  } catch {
    // 未保存
  }
  return { eco: OPENAI_CANDIDATES.eco[0], standard: OPENAI_CANDIDATES.standard[0], best: OPENAI_CANDIDATES.best[0] }
}

/** 品質ごとの表示 (設定画面用) */
export function tierInfo(ai: Pick<AiConfig, 'provider' | 'openaiModels'>, q: Quality): { label: string; model: string; cost: string } {
  if (ai.provider === 'openai') {
    return { label: QUALITY_TIERS[q].label, model: (ai.openaiModels ?? openAiModelsOf(undefined))[q], cost: OPENAI_COST[q] }
  }
  return QUALITY_TIERS[q]
}

// ---------------------------------------------------------------- AIの呼び出し (共通)

interface StructuredRequest {
  system: string
  text: string
  image?: { data: string; mediaType: 'image/jpeg' }
  schema: Record<string, unknown>
  schemaName: string
}

class AiStop extends Error {}

/** 構造化出力 (JSON) を1回もらう。返り値は JSON の文字列 */
async function structured(ai: AiConfig, quality: Quality, req: StructuredRequest): Promise<string> {
  return ai.provider === 'openai' ? callOpenAi(ai, quality, req) : callAnthropic(ai.apiKey, quality, req)
}

async function callAnthropic(apiKey: string, quality: Quality, req: StructuredRequest): Promise<string> {
  const tier = QUALITY_TIERS[quality]
  const client = new Anthropic({
    apiKey,
    // ブラウザから直接叩くための明示。SDKが anthropic-dangerous-direct-browser-access を付ける
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
  })
  const res = await client.messages.create({
    model: tier.model,
    max_tokens: 16000,
    system: req.system,
    output_config: {
      format: { type: 'json_schema', schema: req.schema },
      // Haiku 4.5 は effort 非対応。送るとエラーになるので段に持たせている
      ...(tier.effort ? { effort: tier.effort } : {}),
    },
    messages: [
      {
        role: 'user',
        content: [
          ...(req.image
            ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: req.image.mediaType, data: req.image.data } }]
            : []),
          { type: 'text' as const, text: req.text },
        ],
      },
    ],
  })
  if (res.stop_reason === 'refusal') throw new AiStop('refusal')
  if (res.stop_reason === 'max_tokens') throw new AiStop('max_tokens')
  const block = res.content.find(b => b.type === 'text')
  if (!block || block.type !== 'text') throw new AiStop('empty')
  return block.text
}

const OPENAI_URL = 'https://api.openai.com/v1'

async function openAiError(res: Response): Promise<Error> {
  let message = `OpenAI API エラー (${res.status})`
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    if (body.error?.message) message += `: ${body.error.message}`
  } catch {
    // 本文が JSON でない
  }
  return new Error(message)
}

async function callOpenAi(ai: AiConfig, quality: Quality, req: StructuredRequest): Promise<string> {
  const model = (ai.openaiModels ?? openAiModelsOf(undefined))[quality]
  const res = await fetch(`${OPENAI_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: 16000,
      messages: [
        { role: 'system', content: req.system },
        {
          role: 'user',
          content: [
            ...(req.image
              ? [{ type: 'image_url', image_url: { url: `data:${req.image.mediaType};base64,${req.image.data}`, detail: 'high' } }]
              : []),
            { type: 'text', text: req.text },
          ],
        },
      ],
      response_format: { type: 'json_schema', json_schema: { name: req.schemaName, strict: true, schema: req.schema } },
    }),
  })
  if (!res.ok) throw await openAiError(res)
  const body = (await res.json()) as {
    choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[]
  }
  const choice = body.choices?.[0]
  if (choice?.message?.refusal) throw new AiStop('refusal')
  if (choice?.finish_reason === 'length') throw new AiStop('max_tokens')
  if (!choice?.message?.content) throw new AiStop('empty')
  return choice.message.content
}

/**
 * APIキーが生きているかの確認。
 * Anthropic はいちばん安いモデルで1往復、OpenAI はモデル一覧 (無料) を取り、品質ごとに使うモデルを決めて返す。
 */
export async function checkApiKey(provider: Provider, apiKey: string): Promise<OpenAiModels | undefined> {
  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0 })
    await client.messages.create({
      model: QUALITY_TIERS.eco.model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'ok とだけ返してください。' }],
    })
    return undefined
  }
  const res = await fetch(`${OPENAI_URL}/models`, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!res.ok) throw await openAiError(res)
  const body = (await res.json()) as { data?: { id: string }[] }
  const ids = new Set((body.data ?? []).map(m => m.id))
  const pick = (q: Quality) => OPENAI_CANDIDATES[q].find(id => ids.has(id))
  const models = { eco: pick('eco'), standard: pick('standard'), best: pick('best') }
  if (!models.eco && !models.standard && !models.best) {
    throw new Error('このキーで画像の読み取りに使えるモデルが見つかりませんでした。')
  }
  // 見つからない段は、見つかった段のモデルで代用する
  const any = (models.standard ?? models.best ?? models.eco)!
  return { eco: models.eco ?? any, standard: models.standard ?? any, best: models.best ?? any }
}

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

export async function transcribeWod(file: File, ai: AiConfig, quality: Quality = DEFAULT_QUALITY): Promise<WodDraft> {
  // OpenAI は detail: high で長辺2048pxまで見る。それ以上送っても縮小されるだけ
  const maxEdge = ai.provider === 'openai' ? 2048 : QUALITY_TIERS[quality].maxEdge
  const image = await prepareImage(file, maxEdge)

  let text: string
  try {
    text = await structured(ai, quality, { system: SYSTEM, text: PROMPT, image, schema: WOD_SCHEMA, schemaName: 'wod' })
  } catch (err) {
    if (err instanceof AiStop) {
      if (err.message === 'refusal') throw new Error('この画像は読み取りを断られました。別の写真でお試しください。')
      if (err.message === 'max_tokens') throw new Error('読み取り結果が長すぎて途中で切れました。ボードを分けて撮ってください。')
      throw new Error('読み取り結果が空でした。もう一度お試しください。')
    }
    throw err
  }

  let parsed: Parsed
  try {
    parsed = JSON.parse(text) as Parsed
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
    source: ai.provider === 'openai' ? 'openai' : 'claude',
  }
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
  ai: AiConfig,
  quality: Quality = DEFAULT_QUALITY,
): Promise<Omit<AccessoryAdvice, 'forDate'>> {

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

  let text: string
  try {
    text = await structured(ai, quality, {
      system: ADVICE_SYSTEM,
      text: `【今朝のWOD】\n${wodText}\n\n【今夜の予定】\n${planText}\n\n今夜の補助トレをどうするか判定してください。`,
      schema: ADVICE_SCHEMA,
      schemaName: 'advice',
    })
  } catch (err) {
    if (err instanceof AiStop) throw new Error('補助トレの判定に失敗しました。')
    throw err
  }

  const parsed = JSON.parse(text) as Omit<AccessoryAdvice, 'forDate'>
  return {
    verdict: parsed.verdict ?? 'keep',
    amLoad: parsed.amLoad ?? 'medium',
    headline: parsed.headline ?? '',
    reason: parsed.reason ?? '',
    exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
    caution: parsed.caution ?? '',
  }
}
