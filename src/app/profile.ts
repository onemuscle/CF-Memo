// みんな向け版 (Fitto) のプロフィール。オンボーディングで聞いた内容をそのまま持つ。
// プランはこのプロフィールから毎回同じ結果になるよう計算するので、プラン自体は保存しない。

import { getSetting, putSetting } from '../db'
import type { Env, Gear, Goal, Injury, Level } from '../workout/engine'
import type { Theme } from './theme'

export type Sex = 'male' | 'female' | 'other'

/** トレーニング以外の普段の活動量 */
export type Activity = 'low' | 'mid' | 'high'

/** 筋トレとは別に、有酸素だけの日をどれくらい入れるか */
export type CardioPref = 'none' | 'some' | 'more'

/** トレーニングすることが多い時間帯 (食事のタイミングに使う) */
export type TrainTime = 'morning' | 'noon' | 'evening' | 'night'

export interface Profile {
  version: 1
  /** 呼び名 (空でもよい) */
  name: string
  goal: Goal
  sex: Sex
  age: number
  /** cm */
  height: number
  /** kg */
  weight: number
  /** 目標体重 (減量・増量のときだけ。なければ現状維持) */
  targetWeight?: number
  level: Level
  /** 使える場所 (1つ以上) */
  places: Env[]
  /** 自宅・野外で使える道具 */
  gear: Gear[]
  /** 自宅でジャンプ・足音を控えたい */
  quiet: boolean
  /** トレーニングする曜日 (0 = 日曜 〜 6 = 土曜) */
  days: number[]
  /** 1回あたりの時間 (分) */
  minutes: number
  trainTime: TrainTime
  cardio: CardioPref
  injuries: Injury[]
  activity: Activity
  /** 1日の食事回数 (間食込み) */
  meals: 3 | 4 | 5
  /** プランの長さ (週) */
  weeks: 4 | 8 | 12
  /** YYYY-MM-DD */
  startDate: string
  createdAt: number
  /** アプリの色 (なければ黒) */
  theme?: Theme
}

export const PROFILE_SETTING = 'profile'

export async function loadProfile(): Promise<Profile | null> {
  const raw = await getSetting(PROFILE_SETTING)
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Profile
    return p.version === 1 ? p : null
  } catch {
    return null
  }
}

export async function saveProfile(p: Profile): Promise<void> {
  await putSetting(PROFILE_SETTING, JSON.stringify(p))
}

// ---------------------------------------------------------------- 表示用ラベル

export const SEX_LABEL: Record<Sex, string> = {
  male: '男性',
  female: '女性',
  other: '回答しない',
}

export const ACTIVITY_LABEL: Record<Activity, string> = {
  low: 'デスクワーク中心',
  mid: '立ち仕事・よく歩く',
  high: '体を使う仕事',
}

export const CARDIO_LABEL: Record<CardioPref, string> = {
  none: '筋トレだけ',
  some: '週1日くらい',
  more: 'しっかり入れたい',
}

export const TRAIN_TIME_LABEL: Record<TrainTime, string> = {
  morning: '朝',
  noon: '昼',
  evening: '夕方',
  night: '夜',
}

export const DOW_LABEL = ['日', '月', '火', '水', '木', '金', '土']

/** 月曜始まりで並べた曜日 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/** 曜日を「月・水・金」のように */
export function daysText(days: number[]): string {
  return WEEK_ORDER.filter(d => days.includes(d))
    .map(d => DOW_LABEL[d])
    .join('・')
}

/** 週◯日を選んだときの曜日の初期値 (なるべく間を空ける) */
export const DEFAULT_DAYS: Record<number, number[]> = {
  1: [3],
  2: [2, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
}

/** 目的ごとに、減量・増量どちらの目標体重を聞くか */
export function weightDirection(goal: Goal): 'down' | 'up' | null {
  if (goal === 'lean') return 'down'
  if (goal === 'muscle') return 'up'
  return null
}

export function bmi(p: Pick<Profile, 'height' | 'weight'>): number {
  const m = p.height / 100
  return p.weight / (m * m)
}
