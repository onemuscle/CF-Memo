// フィニッシャー・有酸素のブロック (施設型ジム / CrossFit 共通)

import type { Block, Env, Injury } from './types'

export function bikeIntervals(min: number, [on, off]: [number, number], title: string): Block {
  const rounds = Math.floor((min * 60) / (on + off))
  return {
    key: 'finisher',
    kind: 'finisher',
    label: 'FINISHER',
    title: `${title} ${min}分`,
    minutes: min,
    format: `エアロバイク (またはローイングマシン) で ${on}秒 ${on <= 20 ? '全力' : 'ハード'} / ${off}秒 ゆっくり × ${rounds}本`,
    items: [
      {
        id: 'fin-bike',
        name: 'エアロバイク インターバル',
        en: 'Bike Intervals',
        prescription: `${on}秒 / ${off}秒 × ${rounds}本`,
        sets: rounds,
        detail: on <= 20 ? 'ON は負荷を上げて「これ以上は無理」の全力。OFF は止まらずゆっくり漕ぐ' : 'ON は会話できない強度、OFF は会話できる強度',
      },
    ],
    timer: { type: 'interval', rounds, workSec: on, restSec: off, label: 'エアロバイク' },
    tips: [
      on <= 20 && off >= 40
        ? '短い全力で心肺とパワーに強い刺激を。最後の1本まで出し切る'
        : on >= 60
          ? 'ハードは「会話できない」強度。最後の2本でペースを上げられれば合格'
          : '筋トレのあとに行うと、脂肪が使われやすい状態で有酸素ができる',
    ],
  }
}

export function incline(min: number, title: string): Block {
  return {
    key: 'finisher',
    kind: 'finisher',
    label: 'FINISHER',
    title: `傾斜ウォーク ${min}分`,
    minutes: min,
    format: `${title}: トレッドミルで傾斜10〜12%・時速4.5〜5.5km。少し息が弾む程度で歩き続ける`,
    items: [
      {
        id: 'fin-incline',
        name: 'トレッドミル傾斜ウォーク',
        en: 'Incline Walk',
        prescription: `${min}分`,
        detail: '手すりにつかまらず、腕を振って歩く。関節にやさしく脂肪燃焼に効率的',
      },
    ],
    timer: { type: 'guided', steps: [{ label: '傾斜ウォーク', seconds: min * 60 }] },
  }
}


/** 余った時間に入れる、会話できる強度の有酸素 (Zone 2) */
export function easyCardio(min: number, env: Env, injuries: Injury[]): Block {
  const machine =
    env === 'box' ? 'ロー or エアバイク' : injuries.includes('knee') ? 'エアロバイク' : 'エアロバイク・トレッドミル・クロストレーナー'
  return {
    key: 'zone2',
    kind: 'finisher',
    label: 'ZONE 2',
    title: `ゆったり有酸素 ${min}分`,
    minutes: min,
    format: `${machine}のどれかで、鼻呼吸か会話ができる強度を保つ`,
    items: [
      {
        id: 'zone2',
        name: env === 'box' ? 'ロー / エアバイク (低強度)' : '有酸素マシン (低強度)',
        en: 'Zone 2 Cardio',
        prescription: `${min}分`,
        detail: '心拍の目安は「180 − 年齢」前後。疲労回復を早め、心肺の土台を作る',
      },
    ],
    timer: { type: 'guided', steps: [{ label: 'ゆったり有酸素', seconds: min * 60 }] },
    tips: ['筋トレの疲労を抜きながら脂肪も使える。余裕がなければ省略してOK'],
  }
}
