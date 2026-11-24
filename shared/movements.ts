/**
 * 種目・スキルの選択肢 (英語表記を保存し、日本語は表示用)。
 * 保存する値は英語表記に揃える (推定1RM の集計や目標の指標 e1rm:back squat がこの名前で一致するため)。
 */

export interface CatalogGroup {
  group: string
  items: [en: string, ja: string][]
}

export const MOVEMENT_CATALOG: CatalogGroup[] = [
  {
    group: 'スクワット',
    items: [
      ['Back Squat', 'バックスクワット'],
      ['Front Squat', 'フロントスクワット'],
      ['Overhead Squat', 'オーバーヘッドスクワット'],
      ['Box Squat', 'ボックススクワット'],
    ],
  },
  {
    group: 'デッドリフト・ヒンジ',
    items: [
      ['Deadlift', 'デッドリフト'],
      ['Sumo Deadlift', 'スモウデッドリフト'],
      ['Romanian Deadlift', 'ルーマニアンデッドリフト'],
      ['Hip Thrust', 'ヒップスラスト'],
    ],
  },
  {
    group: 'プレス・ジャーク',
    items: [
      ['Bench Press', 'ベンチプレス'],
      ['Strict Press', 'ストリクトプレス'],
      ['Push Press', 'プッシュプレス'],
      ['Push Jerk', 'プッシュジャーク'],
      ['Split Jerk', 'スプリットジャーク'],
    ],
  },
  {
    group: 'クリーン',
    items: [
      ['Power Clean', 'パワークリーン'],
      ['Squat Clean', 'スクワットクリーン'],
      ['Hang Power Clean', 'ハングパワークリーン'],
      ['Hang Squat Clean', 'ハングスクワットクリーン'],
      ['Clean & Jerk', 'クリーン&ジャーク'],
    ],
  },
  {
    group: 'スナッチ',
    items: [
      ['Power Snatch', 'パワースナッチ'],
      ['Squat Snatch', 'スクワットスナッチ'],
      ['Hang Power Snatch', 'ハングパワースナッチ'],
      ['Hang Squat Snatch', 'ハングスクワットスナッチ'],
    ],
  },
  {
    group: 'その他',
    items: [
      ['Thruster', 'スラスター'],
      ['Weighted Pull-up', '加重懸垂'],
      ['Weighted Dip', '加重ディップ'],
      ['Front Rack Lunge', 'フロントラックランジ'],
      ['Bulgarian Split Squat', 'ブルガリアンスクワット'],
      ['Barbell Row', 'バーベルロウ'],
    ],
  },
]

export const SKILL_CATALOG: CatalogGroup[] = [
  {
    group: 'マッスルアップ・引く',
    items: [
      ['Ring Muscle-up', 'リングマッスルアップ'],
      ['Bar Muscle-up', 'バーマッスルアップ'],
      ['Strict Pull-up', 'ストリクト懸垂'],
      ['Kipping Pull-up', 'キッピング懸垂'],
      ['Butterfly Pull-up', 'バタフライ懸垂'],
      ['Chest to Bar', 'チェスト・トゥ・バー'],
      ['Toes to Bar', 'トゥ・トゥ・バー'],
      ['Rope Climb', 'ロープクライム'],
      ['Legless Rope Climb', 'レッグレス・ロープクライム'],
    ],
  },
  {
    group: '倒立',
    items: [
      ['Handstand Push-up', 'ハンドスタンドプッシュアップ'],
      ['Strict HSPU', 'ストリクトHSPU'],
      ['Deficit HSPU', 'デフィシットHSPU'],
      ['Handstand Walk', 'ハンドスタンドウォーク'],
      ['Wall Walk', 'ウォールウォーク'],
    ],
  },
  {
    group: 'その他',
    items: [
      ['Double Under', 'ダブルアンダー'],
      ['Pistol', 'ピストルスクワット'],
      ['Ring Dip', 'リングディップ'],
      ['L-sit', 'Lシット'],
    ],
  },
]

/** 英語表記 → 日本語 (カタログにあれば) */
export function jaName(en: string): string | undefined {
  for (const g of [...MOVEMENT_CATALOG, ...SKILL_CATALOG]) {
    const hit = g.items.find(([e]) => e.toLowerCase() === en.trim().toLowerCase())
    if (hit) return hit[1]
  }
  return undefined
}
