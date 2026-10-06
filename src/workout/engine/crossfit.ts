// CrossFit ボックス向けの種目データ (WOD の種目とストレングスのリフト)。

import type { Injury, Muscle } from './types'

/** W = ウェイトリフティング / G = 体操 (自重) / M = 有酸素 (モノストラクチャル) */
export type Modality = 'W' | 'G' | 'M'

/** 同じグループの種目は1つのWODに重ねない */
export type MoveGroup = 'squat' | 'hinge' | 'press' | 'pull' | 'core' | 'mono' | 'jump' | 'full' | 'lunge'

/** [男性基準, 女性基準] または共通の文字列 */
export type ByScale = string | [string, string]

export interface BoxMovement {
  id: string
  name: string
  en: string
  mod: Modality
  group: MoveGroup
  muscles: Muscle[]
  avoid: Injury[]
  /** Rx で行う難しさ。初心者は1〜2、上級者は3まで */
  level: 1 | 2 | 3
  unit: 'reps' | 'cal' | 'm'
  /** 中級者が1回 (1cal / 1m) にかかる秒数の目安 */
  sec: number
  /** 小・中・大 の代表的な回数 */
  reps: [number, number, number]
  rx: ByScale
  scaled: ByScale
  beginner: ByScale
  cues: string[]
}

export const BOX_MOVEMENTS: BoxMovement[] = [
  // ---- W ----
  {
    id: 'thruster', name: 'スラスター', en: 'Thruster', mod: 'W', group: 'squat', muscles: ['legs', 'shoulders', 'glutes'],
    avoid: ['knee', 'shoulder'], level: 2, unit: 'reps', sec: 2.6, reps: [6, 10, 15],
    rx: ['43kg', '30kg'], scaled: ['30kg', '20kg'], beginner: ['ダンベル 2×10kg', 'ダンベル 2×5kg'],
    cues: ['フロントスクワットから立ち上がる勢いでそのまま頭上へ', '肘を高く保ち、かかとで床を押す', '頭上でロック → 下ろしながら次のスクワットへ'],
  },
  {
    id: 'power-clean', name: 'パワークリーン', en: 'Power Clean', mod: 'W', group: 'hinge', muscles: ['back', 'legs', 'glutes'],
    avoid: ['lowback', 'wrist'], level: 2, unit: 'reps', sec: 3.5, reps: [5, 8, 12],
    rx: ['61kg', '43kg'], scaled: ['43kg', '30kg'], beginner: ['ダンベルハングクリーン 2×10kg', 'ダンベルハングクリーン 2×5kg'],
    cues: ['バーを体の近くに保ち、脚で床を押して加速', '腕は最後まで曲げない', '肘を素早く前に回してキャッチ'],
  },
  {
    id: 'hang-power-clean', name: 'ハングパワークリーン', en: 'Hang Power Clean', mod: 'W', group: 'hinge', muscles: ['back', 'legs', 'glutes'],
    avoid: ['lowback', 'wrist'], level: 2, unit: 'reps', sec: 3, reps: [5, 9, 12],
    rx: ['52kg', '35kg'], scaled: ['40kg', '25kg'], beginner: ['ダンベルハングクリーン 2×10kg', 'ダンベルハングクリーン 2×5kg'],
    cues: ['太もも中間まで下ろして跳ぶように伸び上がる', '肩をすくめてバーを引き上げる', '肘を前へ回してフロントラックで受ける'],
  },
  {
    id: 'power-snatch', name: 'パワースナッチ', en: 'Power Snatch', mod: 'W', group: 'hinge', muscles: ['back', 'shoulders', 'legs'],
    avoid: ['lowback', 'shoulder', 'wrist'], level: 3, unit: 'reps', sec: 3.5, reps: [5, 8, 10],
    rx: ['43kg', '30kg'], scaled: ['30kg', '20kg'], beginner: ['ダンベルスナッチ 15kg', 'ダンベルスナッチ 10kg'],
    cues: ['手幅を広く、バーを体に沿わせて引く', '脚の爆発でバーを浮かせ、下に潜り込む', '頭上でロックして立ち上がる'],
  },
  {
    id: 'deadlift', name: 'デッドリフト', en: 'Deadlift', mod: 'W', group: 'hinge', muscles: ['back', 'glutes', 'legs'],
    avoid: ['lowback'], level: 1, unit: 'reps', sec: 2.3, reps: [5, 10, 15],
    rx: ['102kg', '70kg'], scaled: ['70kg', '48kg'], beginner: ['ケトルベル 24kg', 'ケトルベル 16kg'],
    cues: ['背中をまっすぐ固めたまま床を押す', 'バーはすねに沿わせる', '疲れても背中が丸まったら重量を下げる'],
  },
  {
    id: 'push-press', name: 'プッシュプレス', en: 'Push Press', mod: 'W', group: 'press', muscles: ['shoulders', 'arms', 'legs'],
    avoid: ['shoulder'], level: 1, unit: 'reps', sec: 2.2, reps: [6, 10, 15],
    rx: ['52kg', '35kg'], scaled: ['35kg', '25kg'], beginner: ['ダンベル 2×10kg', 'ダンベル 2×5kg'],
    cues: ['軽く膝を曲げ、脚の力でバーを押し上げる', '頭を前に入れて頭上でロック', '下ろすときは膝で衝撃を吸収'],
  },
  {
    id: 's2oh', name: 'ショルダー・トゥ・オーバーヘッド', en: 'Shoulder to Overhead', mod: 'W', group: 'press', muscles: ['shoulders', 'arms', 'legs'],
    avoid: ['shoulder', 'wrist'], level: 2, unit: 'reps', sec: 2.4, reps: [6, 10, 15],
    rx: ['52kg', '35kg'], scaled: ['40kg', '25kg'], beginner: ['ダンベル 2×10kg', 'ダンベル 2×5kg'],
    cues: ['プレス・プッシュプレス・ジャークどれでもOK', '疲れてきたら脚を使うジャークに切り替える', '頭上で肘をロック'],
  },
  {
    id: 'front-squat', name: 'フロントスクワット', en: 'Front Squat', mod: 'W', group: 'squat', muscles: ['legs', 'core', 'glutes'],
    avoid: ['knee', 'wrist'], level: 2, unit: 'reps', sec: 2.4, reps: [6, 10, 15],
    rx: ['61kg', '43kg'], scaled: ['43kg', '30kg'], beginner: ['ゴブレットスクワット 16kg', 'ゴブレットスクワット 8kg'],
    cues: ['肘を高く、胸を張ったまましゃがむ', '膝はつま先の方向へ', 'かかとで床を押して立つ'],
  },
  {
    id: 'ohs', name: 'オーバーヘッドスクワット', en: 'Overhead Squat', mod: 'W', group: 'squat', muscles: ['legs', 'shoulders', 'core'],
    avoid: ['knee', 'shoulder', 'wrist'], level: 3, unit: 'reps', sec: 2.8, reps: [5, 10, 15],
    rx: ['43kg', '30kg'], scaled: ['30kg', '20kg'], beginner: ['エアスクワット (腕を上げて)', 'エアスクワット (腕を上げて)'],
    cues: ['バーを頭の真上〜少し後ろで支え続ける', '脇の下を前に向けて肘をロック', '体幹を固め、胸を張ったまましゃがむ'],
  },
  {
    id: 'db-snatch', name: 'ダンベルスナッチ (左右交互)', en: 'DB Snatch', mod: 'W', group: 'hinge', muscles: ['shoulders', 'glutes', 'legs'],
    avoid: ['shoulder', 'lowback'], level: 1, unit: 'reps', sec: 2.5, reps: [10, 20, 30],
    rx: ['22.5kg', '15kg'], scaled: ['15kg', '10kg'], beginner: ['10kg', '5kg'],
    cues: ['床から頭上まで一気に', '脚と股関節で上げ、腕は最後', '頭上でロックしてから下ろす'],
  },
  {
    id: 'db-cj', name: 'ダンベルハングクリーン&ジャーク', en: 'DB Hang Clean & Jerk', mod: 'W', group: 'press', muscles: ['shoulders', 'legs', 'back'],
    avoid: ['shoulder'], level: 1, unit: 'reps', sec: 3, reps: [6, 10, 16],
    rx: ['2×22.5kg', '2×15kg'], scaled: ['2×15kg', '2×10kg'], beginner: ['2×10kg', '2×5kg'],
    cues: ['ダンベルを肩に跳ね上げてから頭上へ', '脚の反動で押し上げる', '片手ずつでも可 (左右交互)'],
  },
  {
    id: 'devils-press', name: 'デビルプレス', en: "Devil's Press", mod: 'W', group: 'full', muscles: ['shoulders', 'glutes', 'chest'],
    avoid: ['shoulder', 'lowback', 'wrist'], level: 2, unit: 'reps', sec: 5, reps: [5, 8, 12],
    rx: ['2×22.5kg', '2×15kg'], scaled: ['2×15kg', '2×10kg'], beginner: ['2×7.5kg', '2×5kg'],
    cues: ['ダンベルを持ってバーピー', '立ち上がりながら2つ同時に床から頭上へ振り上げる', '背中を丸めず股関節で振る'],
  },
  {
    id: 'kb-swing', name: 'ケトルベルスイング', en: 'Kettlebell Swing', mod: 'W', group: 'hinge', muscles: ['glutes', 'back', 'legs'],
    avoid: ['lowback'], level: 1, unit: 'reps', sec: 1.8, reps: [12, 15, 21],
    rx: ['アメリカン 24kg', 'アメリカン 16kg'], scaled: ['ロシアン 20kg', 'ロシアン 12kg'], beginner: ['ロシアン 16kg', 'ロシアン 8kg'],
    cues: ['しゃがまずに股関節を折る', 'お尻の爆発で振り上げる (腕で上げない)', 'アメリカンは頭上、ロシアンは目の高さまで'],
  },
  {
    id: 'goblet-squat', name: 'ケトルベル・ゴブレットスクワット', en: 'KB Goblet Squat', mod: 'W', group: 'squat', muscles: ['legs', 'glutes', 'core'],
    avoid: ['knee'], level: 1, unit: 'reps', sec: 2, reps: [10, 15, 20],
    rx: ['32kg', '24kg'], scaled: ['24kg', '16kg'], beginner: ['16kg', '8kg'],
    cues: ['ケトルベルを胸の前で持つ', '肘を膝の内側に通すように深く', '胸を張って立つ'],
  },
  {
    id: 'wall-ball', name: 'ウォールボール', en: 'Wall Ball Shot', mod: 'W', group: 'squat', muscles: ['legs', 'shoulders', 'glutes'],
    avoid: ['knee'], level: 1, unit: 'reps', sec: 2.6, reps: [12, 20, 30],
    rx: ['9kg・3m', '6kg・2.7m'], scaled: ['6kg・3m', '4kg・2.7m'], beginner: ['4kg・低めの的', '3kg・低めの的'],
    cues: ['しゃがんだ反動のまま、脚の力でボールを投げる', 'キャッチしながら次のスクワットへ', '小分けにするなら早めに (例: 10-5-5)'],
  },
  {
    id: 'db-lunge', name: 'ダンベル・フロントラックランジ', en: 'DB Front Rack Lunge', mod: 'W', group: 'lunge', muscles: ['legs', 'glutes', 'core'],
    avoid: ['knee'], level: 1, unit: 'reps', sec: 2.2, reps: [10, 16, 24],
    rx: ['2×22.5kg', '2×15kg'], scaled: ['2×15kg', '2×10kg'], beginner: ['自重', '自重'],
    cues: ['ダンベルを肩に担いで歩くランジ (回数は左右合計)', '後ろ膝を床すれすれまで', '上体はまっすぐ'],
  },
  {
    id: 'db-stepover', name: 'ダンベル・ボックスステップオーバー', en: 'DB Box Step-over', mod: 'W', group: 'lunge', muscles: ['legs', 'glutes'],
    avoid: ['knee'], level: 1, unit: 'reps', sec: 4, reps: [6, 10, 15],
    rx: ['2×22.5kg・60cm', '2×15kg・50cm'], scaled: ['2×15kg・50cm', '2×10kg・40cm'], beginner: ['自重・40cm', '自重・30cm'],
    cues: ['ダンベルを下げ持ちで台に上がり、反対側へ降りる', '上の足で立ち上がる', 'ジャンプはしない'],
  },
  {
    id: 'sdhp', name: 'スモウデッドリフトハイプル (KB)', en: 'KB Sumo Deadlift High Pull', mod: 'W', group: 'hinge', muscles: ['back', 'shoulders', 'legs'],
    avoid: ['shoulder', 'lowback'], level: 1, unit: 'reps', sec: 2.2, reps: [10, 15, 20],
    rx: ['32kg', '24kg'], scaled: ['24kg', '16kg'], beginner: ['16kg', '8kg'],
    cues: ['足幅を広く、脚と股関節で立ち上がる', '勢いのまま肘を高く上げてあごの下まで', '背中を丸めない'],
  },

  // ---- G ----
  {
    id: 'pull-up', name: 'プルアップ', en: 'Pull-up', mod: 'G', group: 'pull', muscles: ['back', 'arms'],
    avoid: ['shoulder'], level: 1, unit: 'reps', sec: 2, reps: [5, 10, 15],
    rx: 'キッピング可', scaled: 'ジャンピングプルアップ or バンド', beginner: 'リングロウ',
    cues: ['あごがバーを越えたら1回', '回数が落ちる前に小分け (例: 5-3-2)', 'リングロウは体を斜めにするほどきつい'],
  },
  {
    id: 'c2b', name: 'チェスト・トゥ・バー', en: 'Chest-to-Bar Pull-up', mod: 'G', group: 'pull', muscles: ['back', 'arms'],
    avoid: ['shoulder'], level: 3, unit: 'reps', sec: 2.2, reps: [5, 10, 15],
    rx: 'C2B', scaled: 'プルアップ', beginner: 'ジャンピングプルアップ',
    cues: ['胸 (鎖骨より下) がバーに触れたら1回', 'キップで腰をバーに近づける', '早めに小分けにする'],
  },
  {
    id: 't2b', name: 'トゥ・トゥ・バー', en: 'Toes-to-Bar', mod: 'G', group: 'core', muscles: ['core', 'back'],
    avoid: ['shoulder'], level: 2, unit: 'reps', sec: 2.3, reps: [6, 10, 15],
    rx: 'T2B', scaled: 'ニー・トゥ・エルボー', beginner: 'ハンギングニーレイズ (または シットアップ)',
    cues: ['バーにぶら下がり、両足のつま先をバーへ', '肩でバーを押し下げて振りを作る', '握力が持たなければ早めに降りる'],
  },
  {
    id: 'push-up', name: 'プッシュアップ', en: 'Push-up', mod: 'G', group: 'press', muscles: ['chest', 'arms', 'core'],
    avoid: ['wrist'], level: 1, unit: 'reps', sec: 1.8, reps: [10, 15, 20],
    rx: 'ハンドリリース', scaled: '台に手をつく', beginner: '膝つき',
    cues: ['頭からかかとまで一直線', '胸を床につける (ハンドリリースは手を一瞬浮かせる)', 'お尻が落ちたら台に手をつく'],
  },
  {
    id: 'hspu', name: 'ハンドスタンド・プッシュアップ', en: 'Handstand Push-up', mod: 'G', group: 'press', muscles: ['shoulders', 'arms'],
    avoid: ['shoulder', 'wrist'], level: 3, unit: 'reps', sec: 3, reps: [5, 8, 12],
    rx: 'キッピング可', scaled: 'パイクプッシュアップ (足を台に)', beginner: 'ダンベルショルダープレス',
    cues: ['頭と両手で三角形を作る位置に手をつく', '体幹を固め、頭頂部を床につけてから押す', '壁から足が離れないように'],
  },
  {
    id: 'burpee', name: 'バーピー', en: 'Burpee', mod: 'G', group: 'full', muscles: ['chest', 'legs', 'core'],
    avoid: ['wrist'], level: 1, unit: 'reps', sec: 3.3, reps: [8, 12, 15],
    rx: 'チェスト・トゥ・フロア', scaled: 'ステップバック', beginner: 'ステップバック (床に胸をつけない)',
    cues: ['胸と太ももを床につけ、立ち上がって頭上で手を叩く', '一定のリズムで (速すぎない)', '息は「降りて吐く・立って吸う」'],
  },
  {
    id: 'bbjo', name: 'バーピー・ボックスジャンプオーバー', en: 'Burpee Box Jump-over', mod: 'G', group: 'jump', muscles: ['legs', 'chest', 'core'],
    avoid: ['knee', 'wrist'], level: 2, unit: 'reps', sec: 6, reps: [5, 8, 12],
    rx: '60/50cm', scaled: '50/40cm・ステップオーバー可', beginner: 'バーピー + 低い台をまたぐ',
    cues: ['台に向かってバーピー → 台を越える', '台の上に乗ってから降りてもOK', '着地は柔らかく'],
  },
  {
    id: 'box-jump', name: 'ボックスジャンプ', en: 'Box Jump', mod: 'G', group: 'jump', muscles: ['legs', 'glutes'],
    avoid: ['knee'], level: 1, unit: 'reps', sec: 2.4, reps: [10, 15, 20],
    rx: ['60cm', '50cm'], scaled: ['50cm', '40cm'], beginner: 'ステップアップ',
    cues: ['腕を振って跳び、台の上で立ち切る', '降りるのはステップダウン (アキレス腱を守る)', '疲れたらステップアップに切り替え'],
  },
  {
    id: 'air-squat', name: 'エアスクワット', en: 'Air Squat', mod: 'G', group: 'squat', muscles: ['legs', 'glutes'],
    avoid: ['knee'], level: 1, unit: 'reps', sec: 1.5, reps: [15, 20, 30],
    rx: '自重', scaled: '自重', beginner: 'ボックスに座るスクワット',
    cues: ['股関節が膝より下まで', 'かかとを浮かせない', '立ち切って股関節を伸ばす'],
  },
  {
    id: 'sit-up', name: 'アブマット・シットアップ', en: 'AbMat Sit-up', mod: 'G', group: 'core', muscles: ['core'],
    avoid: [], level: 1, unit: 'reps', sec: 1.8, reps: [15, 20, 25],
    rx: 'アブマット', scaled: 'アブマット', beginner: 'クランチ',
    cues: ['足裏を合わせて膝を開く', '手で床にタッチ → 起き上がってつま先にタッチ', '反動を使ってリズムよく'],
  },
  {
    id: 'v-up', name: 'Vアップ', en: 'V-up', mod: 'G', group: 'core', muscles: ['core'],
    avoid: ['lowback'], level: 1, unit: 'reps', sec: 2, reps: [10, 15, 20],
    rx: 'Vアップ', scaled: 'タックアップ', beginner: 'デッドバグ',
    cues: ['手と足を同時に上げてV字に', 'きつければ膝を曲げる', '腰が反らないように'],
  },
  {
    id: 'ring-dip', name: 'リングディップ', en: 'Ring Dip', mod: 'G', group: 'press', muscles: ['chest', 'arms', 'shoulders'],
    avoid: ['shoulder', 'wrist'], level: 3, unit: 'reps', sec: 2.5, reps: [5, 10, 15],
    rx: 'リング', scaled: 'バーディップ / バンド', beginner: 'プッシュアップ',
    cues: ['リングを体の近くで安定させる', '肩が肘より下まで', 'トップでリングを外に回してロック'],
  },
  {
    id: 'bar-mu', name: 'バー・マッスルアップ', en: 'Bar Muscle-up', mod: 'G', group: 'pull', muscles: ['back', 'arms', 'chest'],
    avoid: ['shoulder', 'wrist'], level: 3, unit: 'reps', sec: 4, reps: [3, 5, 8],
    rx: 'バーMU', scaled: 'C2B ×2回', beginner: 'ジャンピングプルアップ ×2回',
    cues: ['大きなキップで腰をバーへ', 'バーを下に押し込んで上に乗る', '回数より1回ずつ確実に'],
  },
  {
    id: 'pistol', name: 'ピストル (左右交互)', en: 'Pistol', mod: 'G', group: 'lunge', muscles: ['legs', 'glutes', 'core'],
    avoid: ['knee'], level: 3, unit: 'reps', sec: 2.5, reps: [6, 10, 16],
    rx: 'ピストル', scaled: 'ボックスへのピストル', beginner: 'リバースランジ',
    cues: ['片脚でしゃがみ、反対の脚を前に伸ばす', 'かかとを浮かせない', 'バランスが難しければ柱を持つ'],
  },
  {
    id: 'double-under', name: 'ダブルアンダー', en: 'Double-under', mod: 'G', group: 'jump', muscles: ['legs'],
    avoid: ['knee'], level: 2, unit: 'reps', sec: 0.55, reps: [30, 50, 75],
    rx: 'ダブルアンダー', scaled: 'ダブルアンダー練習 (同じ時間)', beginner: 'シングルアンダー (回数×2)',
    cues: ['手首で回し、腕は体の横で固定', 'ジャンプは高くなくていい (少し高めに一定)', '引っかかってもすぐ再開'],
  },

  // ---- M ----
  {
    id: 'row', name: 'ロー (ローイング)', en: 'Row', mod: 'M', group: 'mono', muscles: ['back', 'legs'],
    avoid: [], level: 1, unit: 'cal', sec: 3.4, reps: [10, 15, 21],
    rx: '記載どおり', scaled: '記載の8割', beginner: '記載の6割',
    cues: ['脚で蹴る → 体を倒す → 腕で引く の順', '戻りは逆順でゆっくり', 'ダンパーは4〜6'],
  },
  {
    id: 'bike', name: 'エアバイク', en: 'Assault Bike', mod: 'M', group: 'mono', muscles: ['legs', 'arms'],
    avoid: [], level: 1, unit: 'cal', sec: 3, reps: [10, 15, 20],
    rx: '記載どおり', scaled: '記載の8割', beginner: '記載の6割',
    cues: ['腕と脚の両方で漕ぐ', '最初の10秒で飛ばしすぎない', 'ひざ・腰に優しい有酸素'],
  },
  {
    id: 'ski', name: 'スキーエルゴ', en: 'Ski Erg', mod: 'M', group: 'mono', muscles: ['back', 'arms', 'core'],
    avoid: ['shoulder'], level: 1, unit: 'cal', sec: 3.6, reps: [10, 15, 20],
    rx: '記載どおり', scaled: '記載の8割', beginner: '記載の6割 (なければロー)',
    cues: ['腕ではなく体を折りたたむ力で引く', 'お尻を少し後ろへ', 'なければローで代用'],
  },
  {
    id: 'run', name: 'ラン', en: 'Run', mod: 'M', group: 'mono', muscles: ['legs'],
    avoid: ['knee'], level: 1, unit: 'm', sec: 0.3, reps: [200, 400, 800],
    rx: '記載どおり', scaled: '記載どおり (ウォーク混じりOK)', beginner: '距離を半分 or ローで代用',
    cues: ['会話がギリギリできないペースを保つ', '戻ってきたら息を整えずに次の種目へ', '走れない環境ならローで代用 (100m ≒ 7cal)'],
  },
]

export const BOX_BY_ID = new Map(BOX_MOVEMENTS.map(m => [m.id, m]))

export function byScale(v: ByScale, scale: 'men' | 'women'): string {
  return typeof v === 'string' ? v : v[scale === 'men' ? 0 : 1]
}

/** ストレングスパートのリフト */
export interface Lift {
  id: string
  name: string
  en: string
  kind: 'squat' | 'hinge' | 'press' | 'bench' | 'oly' | 'pull' | 'glute'
  muscles: Muscle[]
  avoid: Injury[]
  level: 1 | 2 | 3
  /** 1RM から重量を計算できるか (自重種目は false) */
  percent: boolean
  cues: string[]
}

export const LIFTS: Lift[] = [
  {
    id: 'back-squat', name: 'バックスクワット', en: 'Back Squat', kind: 'squat', muscles: ['legs', 'glutes', 'core'],
    avoid: ['knee', 'lowback'], level: 1, percent: true,
    cues: ['大きく吸って腹圧をかけてからしゃがむ', '膝はつま先の方向へ', 'ボトムで緩めずに切り返す'],
  },
  {
    id: 'front-squat-s', name: 'フロントスクワット', en: 'Front Squat', kind: 'squat', muscles: ['legs', 'core', 'glutes'],
    avoid: ['knee', 'wrist'], level: 2, percent: true,
    cues: ['肘を高く、胸を張る', '上体を立てたまま深く', '肘が落ちたらバーも落ちる'],
  },
  {
    id: 'deadlift-s', name: 'デッドリフト', en: 'Deadlift', kind: 'hinge', muscles: ['back', 'glutes', 'legs'],
    avoid: ['lowback'], level: 1, percent: true,
    cues: ['バーを足の中央の上にセット', '脇を締めて背中を固めてから引く', '1回ずつ床でリセット'],
  },
  {
    id: 'strict-press', name: 'ストリクトプレス', en: 'Strict Press', kind: 'press', muscles: ['shoulders', 'arms', 'core'],
    avoid: ['shoulder'], level: 1, percent: true,
    cues: ['脚を使わずに押す', 'お尻とお腹を締めて腰を反らない', 'バーが顔を過ぎたら頭を前へ'],
  },
  {
    id: 'push-press-s', name: 'プッシュプレス', en: 'Push Press', kind: 'press', muscles: ['shoulders', 'arms', 'legs'],
    avoid: ['shoulder'], level: 1, percent: true,
    cues: ['膝を軽く曲げて真下へ沈む (前に倒れない)', '脚の力をバーへ伝える', '頭上でロックしてから下ろす'],
  },
  {
    id: 'push-jerk', name: 'プッシュジャーク', en: 'Push Jerk', kind: 'press', muscles: ['shoulders', 'legs', 'arms'],
    avoid: ['shoulder', 'wrist'], level: 2, percent: true,
    cues: ['ディップ&ドライブでバーを浮かせる', 'バーの下に潜り、肘をロックしてキャッチ', '立ち上がってフィニッシュ'],
  },
  {
    id: 'bench-press-s', name: 'ベンチプレス', en: 'Bench Press', kind: 'bench', muscles: ['chest', 'arms', 'shoulders'],
    avoid: ['shoulder', 'wrist'], level: 1, percent: true,
    cues: ['肩甲骨を寄せて下げる', 'バーはみぞおち〜乳首の高さへ', 'ボックスにベンチがなければダンベルフロアプレス'],
  },
  {
    id: 'power-clean-s', name: 'パワークリーン', en: 'Power Clean', kind: 'oly', muscles: ['back', 'legs', 'glutes'],
    avoid: ['lowback', 'wrist'], level: 2, percent: true,
    cues: ['床からひざまではゆっくり、ひざを過ぎたら爆発', 'バーを体の近くに', '肘を速く回してキャッチ'],
  },
  {
    id: 'hang-power-snatch', name: 'ハングパワースナッチ', en: 'Hang Power Snatch', kind: 'oly', muscles: ['back', 'shoulders', 'legs'],
    avoid: ['lowback', 'shoulder', 'wrist'], level: 3, percent: true,
    cues: ['太もも中間から跳ぶように伸び上がる', 'バーを体に沿わせて引き上げる', '頭上で肘を素早くロック'],
  },
  {
    id: 'strict-pull-up', name: 'ストリクトプルアップ', en: 'Strict Pull-up', kind: 'pull', muscles: ['back', 'arms'],
    avoid: ['shoulder'], level: 1, percent: false,
    cues: ['反動を使わない', '余裕があればダンベルを足に挟んで加重', 'できなければバンドアシスト or ネガティブ (5秒で下ろす)'],
  },
  {
    id: 'pendlay-row', name: 'ペンドレイロウ', en: 'Pendlay Row', kind: 'pull', muscles: ['back', 'arms'],
    avoid: ['lowback'], level: 1, percent: false,
    cues: ['上体を床と平行近くまで倒す', '毎回床から爆発的にみぞおちへ引く', '背中を丸めない'],
  },
  {
    id: 'hip-thrust-s', name: 'バーベルヒップスラスト', en: 'Barbell Hip Thrust', kind: 'glute', muscles: ['glutes', 'legs'],
    avoid: [], level: 1, percent: false,
    cues: ['肩甲骨の下をボックスに乗せる', 'あごを引き、お尻で押し上げる', 'トップで1秒止める'],
  },
]

export const LIFT_BY_ID = new Map(LIFTS.map(l => [l.id, l]))

/** WODの名前 (シードで決まる) */
export const WOD_NAMES = [
  'IKAZUCHI', 'HAYATE', 'TSUBAME', 'HOMURA', 'SHIRANUI', 'KOGARASHI', 'RAIDEN', 'FUJIN',
  'ARASHI', 'SHIGURE', 'HIBANA', 'KAGEROU', 'MUSASHI', 'TATSUMAKI', 'OBORO', 'SAKURA',
  'NAMI', 'KIRIN', 'YAMABIKO', 'TENKA', 'SUSANOO', 'HAKKOU', 'KOGANE', 'GOUKA',
]
