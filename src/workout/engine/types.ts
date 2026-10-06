// ワークアウト生成サイト (きょうトレ) の型定義。
// 診断の回答 (Answers) から、その日のメニュー (Workout) を組み立てる。

import type { GenContext } from './common'

/** gym = 24時間ジムなどの施設型ジム / box = CrossFit ボックス */
export type Env = 'gym' | 'box'

/** なりたい姿 */
export type Goal = 'lean' | 'muscle' | 'strength' | 'stamina' | 'athletic' | 'health'

export type Muscle = 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'glutes' | 'legs'

export type Level = 'beginner' | 'intermediate' | 'advanced'

export type Condition = 'great' | 'normal' | 'tired'

/** 痛み・不安があって負担をかけたくない部位 */
export type Injury = 'lowback' | 'knee' | 'shoulder' | 'wrist'

/** CrossFit の重量表記 (Rx の男女基準) */
export type Scale = 'men' | 'women'

export interface Answers {
  env: Env
  goal: Goal
  /** 空配列 = おまかせ (履歴と目的から決める) */
  focus: Muscle[]
  minutes: number
  level: Level
  condition: Condition
  injuries: Injury[]
  scale: Scale
}

/** 前回の「きつさ」評価。次回のボリューム調整に使う */
export type Rating = 'easy' | 'good' | 'hard'

/** 完了したワークアウトの記録 (端末内に保存) */
export interface HistoryEntry {
  id: string
  /** YYYY-MM-DD (ローカル) */
  date: string
  doneAt: number
  title: string
  env: Env
  goal: Goal
  muscles: Muscle[]
  exerciseIds: string[]
  minutes: number
  rating?: Rating
  /** WODのスコア (ラウンド数・タイム) */
  score?: string
}

export type TimerSpec =
  | { type: 'amrap'; minutes: number }
  | { type: 'fortime'; capMinutes: number }
  | { type: 'emom'; minutes: number; stations: string[] }
  | { type: 'interval'; rounds: number; workSec: number; restSec: number; label: string }
  | { type: 'guided'; steps: { label: string; seconds: number }[] }

export interface Variant {
  label: 'Rx' | 'Scaled' | '初心者'
  text: string
}

export interface Item {
  /** 種目ID (入れ替え・履歴に使う) */
  id: string
  name: string
  en?: string
  /** 「4セット × 8回」「12回」「60秒」など */
  prescription: string
  /** チェックボックスで消化を記録するセット数 */
  sets?: number
  /** 休憩・強度などの補足 */
  detail?: string
  /** スーパーセットのペア表記 (A1 / A2) */
  tag?: string
  /** 休憩タイマーの秒数 */
  restSec?: number
  cues?: string[]
  /** CrossFit の Rx / Scaled / 初心者 の重量・動作 */
  variants?: Variant[]
  /** この人に勧める variant の label */
  recommended?: Variant['label']
  /** 1RMを入れると重量を計算する (バーベル種目) */
  percent?: { lift: string; lo: number; hi: number }
  /** 入れ替え可能な施設型ジムの種目 */
  swappable?: boolean
  /** ウォームアップ等のガイド秒数 */
  seconds?: number
}

export type BlockKind = 'warmup' | 'strength' | 'main' | 'wod' | 'accessory' | 'finisher' | 'cooldown'

export interface Block {
  key: string
  kind: BlockKind
  /** 「A」「WOD」など短いラベル */
  label: string
  title: string
  minutes: number
  /** 形式の説明 (AMRAP とは? など) */
  format?: string
  items: Item[]
  timer?: TimerSpec
  /** ペース配分・狙い */
  tips?: string[]
}

export interface Workout {
  id: string
  seed: number
  createdAt: number
  answers: Answers
  /** 生成に使った履歴の要約 (共有URLで同じメニューを再現するため) */
  context?: GenContext
  /** 実際に組んだ部位 (おまかせの場合は解決後) */
  focus: Muscle[]
  /** 「背中・腕」「全身」など表示用 */
  focusLabel: string
  title: string
  subtitle: string
  /** CrossFit の WOD 名 */
  wodName?: string
  blocks: Block[]
  totalMinutes: number
  /** なぜこのメニューなのか (トレーナーの解説) */
  why: string[]
  cautions: string[]
  /** 次回への進め方 */
  next: string[]
}
