// 診断の質問。1画面1問・タップで次へ進む (複数選択の問だけ「次へ」ボタン)。

import type { Answers } from './engine'

export interface Option {
  value: string
  label: string
  desc?: string
  emoji?: string
  /** 選ぶと他の選択を外す (おまかせ / なし) */
  exclusive?: boolean
}

export interface Step {
  key: keyof Answers
  title: string
  sub?: string
  multi?: boolean
  options: Option[]
  /** この条件のときだけ聞く */
  when?: (a: Partial<Answers>) => boolean
  layout?: 'list' | 'grid'
}

export const STEPS: Step[] = [
  {
    key: 'env',
    title: 'どこでトレーニングしますか?',
    options: [
      { value: 'gym', label: '施設型ジム', desc: '24時間ジム・フィットネスクラブ。マシン・ダンベル・ケーブルが使える', emoji: '🏋️' },
      { value: 'box', label: 'CrossFit', desc: 'ボックスで WOD。バーベル・ケトルベル・ロー・プルアップバー', emoji: '🔥' },
      { value: 'home', label: '自宅', desc: '道具なしでもOK。ダンベルやチューブがあれば活用', emoji: '🏠' },
      { value: 'outdoor', label: '野外', desc: '公園・河川敷など。鉄棒・ベンチ・坂道も活用', emoji: '🌳' },
    ],
  },
  {
    key: 'gear',
    title: '家にある道具は?',
    sub: '複数選択OK。あるものに合わせて種目を選びます',
    multi: true,
    when: a => a.env === 'home',
    options: [
      { value: 'none', label: 'なにもない', desc: '自重だけで組みます', emoji: '🙌', exclusive: true },
      { value: 'dumbbell', label: 'ダンベル', desc: '可変式もOK' },
      { value: 'band', label: 'チューブ', desc: 'トレーニング用ゴムバンド' },
      { value: 'kettlebell', label: 'ケトルベル' },
      { value: 'bench', label: '椅子・ベンチ', desc: '動かない丈夫なもの' },
      { value: 'bar', label: '懸垂バー', desc: 'ドア枠・ぶら下がり健康器' },
    ],
    layout: 'grid',
  },
  {
    key: 'quiet',
    title: 'ジャンプや足音は大丈夫?',
    sub: '集合住宅なら静かなメニューにできます',
    when: a => a.env === 'home',
    options: [
      { value: 'no', label: '大丈夫', desc: 'ジャンプ系もOK', emoji: '👟' },
      { value: 'yes', label: '静かにしたい', desc: 'ジャンプ・ダッシュなしで組む', emoji: '🤫' },
    ],
  },
  {
    key: 'gear',
    title: '使える設備・道具は?',
    sub: '複数選択OK。公園の遊具や地形も活用します',
    multi: true,
    when: a => a.env === 'outdoor',
    options: [
      { value: 'none', label: 'なにもない', desc: '平らな場所だけで組みます', emoji: '🙌', exclusive: true },
      { value: 'bar', label: '鉄棒', desc: '懸垂・斜め懸垂・ぶら下がり' },
      { value: 'bench', label: 'ベンチ・段差', desc: '足を乗せる・踏み台' },
      { value: 'stairs', label: '階段・坂道', desc: 'ダッシュ・ウォークに' },
      { value: 'band', label: 'チューブ', desc: '持っていく場合' },
    ],
    layout: 'grid',
  },
  {
    key: 'goal',
    title: 'なりたい姿は?',
    sub: 'いちばん近いものを1つ',
    options: [
      { value: 'lean', label: '引き締まった体', desc: '脂肪を落としてシャープに', emoji: '✨' },
      { value: 'muscle', label: '筋肉を大きく', desc: '厚みのある体・ボディメイク', emoji: '💪' },
      { value: 'strength', label: '強くなる', desc: '扱える重量を伸ばしたい', emoji: '🏆' },
      { value: 'stamina', label: 'バテない体力', desc: '心肺機能・持久力アップ', emoji: '🫀' },
      { value: 'athletic', label: '動ける体', desc: 'スポーツに活きる瞬発力', emoji: '⚡' },
      { value: 'health', label: '健康・姿勢改善', desc: '肩こり・腰痛予防、長く続けたい', emoji: '🌿' },
    ],
    layout: 'grid',
  },
  {
    key: 'focus',
    title: '今日鍛えたい部位は?',
    sub: '複数選択OK。迷ったら「おまかせ」で前回の記録から自動で決めます',
    multi: true,
    options: [
      { value: 'auto', label: 'おまかせ', desc: '回復している部位を優先', emoji: '🎯', exclusive: true },
      { value: 'chest', label: '胸' },
      { value: 'back', label: '背中' },
      { value: 'shoulders', label: '肩' },
      { value: 'arms', label: '腕' },
      { value: 'core', label: '腹筋・体幹' },
      { value: 'glutes', label: 'お尻' },
      { value: 'legs', label: '脚' },
    ],
    layout: 'grid',
  },
  {
    key: 'minutes',
    title: '今日使える時間は?',
    sub: 'ウォームアップとストレッチ (計6分) 込みの時間です',
    options: [
      { value: '20', label: '20分', desc: 'サクッと' },
      { value: '30', label: '30分' },
      { value: '45', label: '45分' },
      { value: '60', label: '60分', desc: 'しっかり' },
      { value: '75', label: '75分' },
      { value: '90', label: '90分', desc: 'がっつり' },
    ],
    layout: 'grid',
  },
  {
    key: 'level',
    title: 'トレーニング歴は?',
    options: [
      { value: 'beginner', label: '初心者', desc: '半年未満・久しぶりに再開', emoji: '🌱' },
      { value: 'intermediate', label: '中級者', desc: '半年〜2年。基本種目のフォームはOK', emoji: '🔰' },
      { value: 'advanced', label: '上級者', desc: '2年以上。高重量・高難度の種目もこなせる', emoji: '🥇' },
    ],
  },
  {
    key: 'condition',
    title: '今日のコンディションは?',
    sub: '体調に合わせて量と強度を調整します',
    options: [
      { value: 'great', label: '絶好調', desc: '記録を狙いたい', emoji: '😤' },
      { value: 'normal', label: 'ふつう', desc: 'いつも通り', emoji: '🙂' },
      { value: 'tired', label: '疲れ気味', desc: '寝不足・筋肉痛・仕事終わり', emoji: '😮‍💨' },
    ],
  },
  {
    key: 'injuries',
    title: '痛み・不安がある部位は?',
    sub: '負担が大きい種目をメニューから外します',
    multi: true,
    options: [
      { value: 'none', label: 'なし', exclusive: true, emoji: '👍' },
      { value: 'lowback', label: '腰' },
      { value: 'knee', label: 'ひざ' },
      { value: 'shoulder', label: '肩' },
      { value: 'wrist', label: '手首' },
    ],
    layout: 'grid',
  },
  {
    key: 'scale',
    title: '重量の目安 (Rx) は?',
    sub: 'WODの重量・ボックスの高さの表記に使います',
    when: a => a.env === 'box',
    options: [
      { value: 'men', label: '男性基準', desc: '例: スラスター 43kg / KB 24kg' },
      { value: 'women', label: '女性基準', desc: '例: スラスター 30kg / KB 16kg' },
    ],
  },
]

export function activeSteps(a: Partial<Answers>): Step[] {
  return STEPS.filter(s => !s.when || s.when(a))
}

/** 診断の途中の値 (複数選択は配列、おまかせ/なしは空配列) を Answers にする */
export function completeAnswers(a: Partial<Answers>): Answers | undefined {
  if (!a.env || !a.goal || !a.minutes || !a.level || !a.condition) return undefined
  return {
    env: a.env,
    goal: a.goal,
    focus: a.focus ?? [],
    minutes: a.minutes,
    level: a.level,
    condition: a.condition,
    injuries: a.injuries ?? [],
    scale: a.scale ?? 'men',
    gear: a.env === 'home' || a.env === 'outdoor' ? a.gear ?? [] : [],
    quiet: a.env === 'home' ? !!a.quiet : false,
  }
}
