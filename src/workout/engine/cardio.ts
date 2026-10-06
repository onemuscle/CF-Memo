// フィニッシャー・有酸素のブロック。場所 (施設型ジム / CrossFit / 自宅 / 野外) に合わせて手段を変える。

import type { Answers, Block } from './types'

type Where = Pick<Answers, 'env' | 'gear' | 'quiet' | 'injuries'>

interface Mode {
  name: string
  en: string
  /** ON / OFF の説明 */
  how: string
}

/** 高強度インターバルの手段 */
function intervalMode(w: Where): Mode {
  const knee = w.injuries.includes('knee')
  if (w.env === 'home') {
    if (w.quiet || knee) {
      return { name: 'シャドーボクシング (足踏みしながら)', en: 'Shadow Boxing', how: 'ON は全力でパンチを打ち続け、OFF はその場で足踏み。ジャンプなしで静かに心拍を上げる' }
    }
    return { name: 'バーピー', en: 'Burpee', how: 'ON はできるだけ多く、OFF は立って呼吸を整える。きつければプッシュアップなしでOK' }
  }
  if (w.env === 'outdoor') {
    if (knee) return { name: '早歩き ⇄ ゆっくり歩き', en: 'Power Walk Intervals', how: 'ON は腕を大きく振って全力の早歩き、OFF はゆっくり歩く' }
    if (w.gear.includes('stairs')) return { name: '坂道・階段ダッシュ', en: 'Hill Sprints', how: 'ON で坂・階段を駆け上がり、OFF で歩いて下りる (ひざに優しく、走るより強度が高い)' }
    return { name: 'ダッシュ', en: 'Sprints', how: 'ON は8〜9割の力で走り、OFF は歩いて戻る。最初の2本は7割で' }
  }
  return { name: 'エアロバイク', en: 'Bike Intervals', how: 'エアロバイク (またはローイングマシン) で。ON は負荷を上げてハードに、OFF は止まらずゆっくり漕ぐ' }
}

/** 低〜中強度で続ける有酸素の手段 */
function steadyMode(w: Where): Mode {
  const knee = w.injuries.includes('knee')
  if (w.env === 'home') {
    if (w.gear.includes('bench') && !knee) return { name: '踏み台昇降', en: 'Step-ups', how: '安定した低い段差 (階段の1段目など) を一定のリズムで上り下り' }
    return { name: 'その場足踏み (腿上げ)', en: 'Marching in Place', how: '腕を大きく振り、腿を腰の高さ近くまで上げて足踏み。テレビを見ながらでもOK' }
  }
  if (w.env === 'outdoor') {
    if (knee) return { name: '早歩き', en: 'Brisk Walk', how: '腕を振って少し息が弾むペースで歩く' }
    return { name: 'ジョグ', en: 'Jog', how: '会話できるペースで。きつければ早歩きに切り替えてOK' }
  }
  if (w.env === 'box') return { name: 'ロー / エアバイク', en: 'Row / Bike', how: 'ロー or エアバイクを一定のペースで' }
  if (knee) return { name: 'エアロバイク', en: 'Bike', how: 'エアロバイクを一定のペースで' }
  return { name: 'トレッドミル傾斜ウォーク', en: 'Incline Walk', how: 'トレッドミルで傾斜10〜12%・時速4.5〜5.5km。手すりにつかまらず、腕を振って歩く' }
}

export function intervals(min: number, [on, off]: [number, number], title: string, w: Where): Block {
  const rounds = Math.floor((min * 60) / (on + off))
  const mode = intervalMode(w)
  return {
    key: 'finisher',
    kind: 'finisher',
    label: 'FINISHER',
    title: `${title} ${min}分`,
    minutes: min,
    format: `${mode.name}: ${on}秒 ${on <= 20 ? '全力' : 'ハード'} / ${off}秒 ゆっくり × ${rounds}本`,
    items: [
      {
        id: 'fin-interval',
        name: `${mode.name} インターバル`,
        en: mode.en,
        prescription: `${on}秒 / ${off}秒 × ${rounds}本`,
        sets: rounds,
        detail: mode.how,
      },
    ],
    timer: { type: 'interval', rounds, workSec: on, restSec: off, label: mode.name },
    tips: [
      on <= 20 && off >= 40
        ? '短い全力で心肺とパワーに強い刺激を。最後の1本まで出し切る'
        : on >= 60
          ? 'ハードは「会話できない」強度。最後の2本でペースを上げられれば合格'
          : '筋トレのあとに行うと、脂肪が使われやすい状態で有酸素ができる',
    ],
  }
}

/** 少し息が弾む程度で続ける有酸素 (脂肪燃焼・健康目的) */
export function steady(min: number, title: string, w: Where): Block {
  const mode = steadyMode(w)
  return {
    key: 'finisher',
    kind: 'finisher',
    label: 'FINISHER',
    title: `${mode.name} ${min}分`,
    minutes: min,
    format: `${title}: ${mode.how}。少し息が弾む程度で続ける`,
    items: [
      {
        id: 'fin-steady',
        name: mode.name,
        en: mode.en,
        prescription: `${min}分`,
        detail: '関節にやさしく、筋トレのあとの脂肪燃焼に効率的',
      },
    ],
    timer: { type: 'guided', steps: [{ label: mode.name, seconds: min * 60 }] },
  }
}

/** 余った時間に入れる、会話できる強度の有酸素 (Zone 2) */
export function easyCardio(min: number, w: Where): Block {
  const mode = steadyMode(w)
  return {
    key: 'zone2',
    kind: 'finisher',
    label: 'ZONE 2',
    title: `ゆったり有酸素 ${min}分`,
    minutes: min,
    format: `${mode.how}。鼻呼吸か会話ができる強度を保つ`,
    items: [
      {
        id: 'zone2',
        name: `${mode.name} (低強度)`,
        en: 'Zone 2 Cardio',
        prescription: `${min}分`,
        detail: '心拍の目安は「180 − 年齢」前後。疲労回復を早め、心肺の土台を作る',
      },
    ],
    timer: { type: 'guided', steps: [{ label: 'ゆったり有酸素', seconds: min * 60 }] },
    tips: ['筋トレの疲労を抜きながら脂肪も使える。余裕がなければ省略してOK'],
  }
}
