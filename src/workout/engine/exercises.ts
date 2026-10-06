// 施設型ジム (24時間ジム等)・自宅・野外の種目データ。
// box: true の種目は CrossFit ボックスの補強 (アクセサリー) にも使う。
// 自宅・野外では、バーベル・マシン・ケーブルを使わず、必要な道具 (needs) がそろう種目だけを選ぶ。

import type { Answers, Gear, Injury, Muscle } from './types'

/**
 * 種目が埋める「枠」。部位ごとに枠の優先順を決めておき、
 * 枠に合う種目の中から条件 (レベル・痛み・前回との重複) で選ぶ。
 */
export type Slot =
  | 'chest.press'
  | 'chest.incline'
  | 'chest.fly'
  | 'chest.bw'
  | 'back.vpull'
  | 'back.hpull'
  | 'back.iso'
  | 'hinge'
  | 'shoulders.press'
  | 'shoulders.lateral'
  | 'shoulders.rear'
  | 'arms.biceps'
  | 'arms.triceps'
  | 'core.antiext'
  | 'core.flex'
  | 'core.antirot'
  | 'glutes.thrust'
  | 'glutes.iso'
  | 'unilateral'
  | 'legs.squat'
  | 'legs.ham'
  | 'legs.quad'
  | 'legs.calf'
  | 'power'

export type Kind = 'compound' | 'iso' | 'core' | 'power'
export type Equip = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell'

export interface GymExercise {
  id: string
  name: string
  en: string
  slot: Slot
  muscle: Muscle
  also?: Muscle[]
  kind: Kind
  equip: Equip
  /** 1 = 初心者から / 2 = 中級から / 3 = 上級向け */
  level: 1 | 2 | 3
  avoid: Injury[]
  cues: string[]
  unit?: 'reps' | 'sec'
  /** 左右それぞれ行う */
  each?: boolean
  box?: boolean
  /** 自宅・野外で必要な道具 (ダンベル・ケトルベル種目は equip から自動で判定) */
  needs?: Gear[]
  /** 施設型ジム専用 (自宅・野外では出さない) */
  gymOnly?: boolean
  /** 自宅・野外向けの代替種目 (施設型ジムでは出さない) */
  awayOnly?: boolean
  /** ジャンプ・着地がある (静かにしたい日は外す) */
  impact?: boolean
  /** 1RM 計算に対応するバーベル種目 */
  lift?: string
}

export const GYM_EXERCISES: GymExercise[] = [
  // ---- 胸 ----
  {
    id: 'bench-press', name: 'バーベルベンチプレス', en: 'Bench Press', slot: 'chest.press', muscle: 'chest', also: ['arms', 'shoulders'],
    kind: 'compound', equip: 'barbell', level: 2, avoid: ['shoulder', 'wrist'], box: true, lift: 'ベンチプレス',
    cues: ['肩甲骨を寄せて下げ、胸を張ったまま固定', 'バーはみぞおち〜乳首の高さに下ろす', '足で床を押して全身を固めてから挙げる'],
  },
  {
    id: 'db-bench', name: 'ダンベルベンチプレス', en: 'Dumbbell Bench Press', slot: 'chest.press', muscle: 'chest', also: ['arms', 'shoulders'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: ['shoulder'], box: true, needs: ['bench'],
    cues: ['ダンベルは胸の横まで深く下ろす', '肘は体から45度くらいに開く', '挙げるときはダンベル同士を近づけるイメージ'],
  },
  {
    id: 'chest-press', name: 'チェストプレス (マシン)', en: 'Machine Chest Press', slot: 'chest.press', muscle: 'chest', also: ['arms'],
    kind: 'compound', equip: 'machine', level: 1, avoid: [],
    cues: ['グリップが胸の真ん中の高さに来るようシートを調整', '肩をすくめず、胸で押す', '戻すときは2秒かけてゆっくり'],
  },
  {
    id: 'incline-db', name: 'インクラインダンベルプレス', en: 'Incline Dumbbell Press', slot: 'chest.incline', muscle: 'chest', also: ['shoulders'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: ['shoulder'], box: true, needs: ['bench'],
    cues: ['ベンチの角度は30度前後 (上げすぎると肩の種目になる)', '鎖骨の下あたりに下ろす', '胸の上部が伸びるのを感じる'],
  },
  {
    id: 'smith-incline', name: 'スミスマシン・インクラインプレス', en: 'Smith Incline Press', slot: 'chest.incline', muscle: 'chest', also: ['shoulders'],
    kind: 'compound', equip: 'machine', level: 1, avoid: ['shoulder'],
    cues: ['バーが鎖骨の下に下りる位置にベンチを置く', '肩甲骨を寄せたまま押す', '安全ストッパーを必ずセット'],
  },
  {
    id: 'cable-fly', name: 'ケーブルフライ', en: 'Cable Fly', slot: 'chest.fly', muscle: 'chest',
    kind: 'iso', equip: 'cable', level: 1, avoid: [],
    cues: ['肘を軽く曲げた角度を最後まで変えない', '大きな木を抱えるように弧を描く', '閉じたところで1秒胸を絞る'],
  },
  {
    id: 'pec-deck', name: 'ペックフライ (マシン)', en: 'Pec Deck', slot: 'chest.fly', muscle: 'chest',
    kind: 'iso', equip: 'machine', level: 1, avoid: [],
    cues: ['背中をパッドから離さない', '開くときは胸が伸びる手前まで (肩に痛みが出ない範囲)', '閉じたところで1秒止める'],
  },
  {
    id: 'push-up', name: 'プッシュアップ', en: 'Push-up', slot: 'chest.bw', muscle: 'chest', also: ['arms', 'core'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: ['wrist'], box: true,
    cues: ['頭からかかとまで一直線 (お尻を落とさない)', '胸が床に付く手前まで下ろす', 'きつければ膝をつく / 台に手をつく'],
  },
  {
    id: 'dips', name: 'ディップス', en: 'Dips', slot: 'chest.bw', muscle: 'chest', also: ['arms'],
    kind: 'compound', equip: 'bodyweight', level: 2, avoid: ['shoulder', 'wrist'], box: true, gymOnly: true,
    cues: ['少し前傾すると胸に、直立すると腕に効く', '肩が前に出すぎない深さまで', 'アシストマシンがあれば使ってOK'],
  },

  // ---- 背中 ----
  {
    id: 'lat-pulldown', name: 'ラットプルダウン', en: 'Lat Pulldown', slot: 'back.vpull', muscle: 'back', also: ['arms'],
    kind: 'compound', equip: 'cable', level: 1, avoid: [],
    cues: ['胸を張り、バーを鎖骨に向かって引く', '腕ではなく肘を下に下ろす意識', '上で肩甲骨を一度上げ、引きながら下げる'],
  },
  {
    id: 'assisted-pullup', name: 'アシスト懸垂 (マシン)', en: 'Assisted Pull-up', slot: 'back.vpull', muscle: 'back', also: ['arms'],
    kind: 'compound', equip: 'machine', level: 1, avoid: ['shoulder'],
    cues: ['アシストは最後の2回がきつい重さに', '下ろすときは肘が伸び切るまで', 'あごがバーを越えるまで引く'],
  },
  {
    id: 'pull-up', name: '懸垂 (チンニング)', en: 'Pull-up', slot: 'back.vpull', muscle: 'back', also: ['arms'],
    kind: 'compound', equip: 'bodyweight', level: 2, avoid: ['shoulder'], box: true, needs: ['bar'],
    cues: ['反動を使わずストリクトで', '胸をバーに近づけるように引く', '回数が落ちたらネガティブ (3秒下ろす) で追い込む'],
  },
  {
    id: 'barbell-row', name: 'ベントオーバーロウ', en: 'Barbell Row', slot: 'back.hpull', muscle: 'back', also: ['arms'],
    kind: 'compound', equip: 'barbell', level: 2, avoid: ['lowback'], box: true, lift: 'ベントオーバーロウ',
    cues: ['股関節から45度前傾、背中は丸めない', 'バーをへその方向へ引く', '上体を起こして反動を使わない'],
  },
  {
    id: 'db-row', name: 'ワンハンドダンベルロウ', en: 'One-arm Dumbbell Row', slot: 'back.hpull', muscle: 'back', also: ['arms'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: [], box: true, each: true,
    cues: ['ベンチに手と膝をつき背中をフラットに', 'ダンベルを腰ポケットへ引く', '下ろしたら背中が伸びるのを感じる'],
  },
  {
    id: 'seated-row', name: 'シーテッドロウ (ケーブル)', en: 'Seated Cable Row', slot: 'back.hpull', muscle: 'back', also: ['arms'],
    kind: 'compound', equip: 'cable', level: 1, avoid: [],
    cues: ['胸を張って上体はほぼ垂直', 'ハンドルをみぞおちに引き、肩甲骨を寄せる', '戻すときは肩甲骨を前に開く'],
  },
  {
    id: 'chest-supported-row', name: 'チェストサポートロウ', en: 'Chest-supported Row', slot: 'back.hpull', muscle: 'back', also: ['arms'],
    kind: 'compound', equip: 'machine', level: 1, avoid: [],
    cues: ['胸をパッドに付けたまま (腰に負担がない)', '肘を後ろへ引き肩甲骨を寄せる', 'トップで1秒止める'],
  },
  {
    id: 'straight-arm-pd', name: 'ストレートアームプルダウン', en: 'Straight-arm Pulldown', slot: 'back.iso', muscle: 'back',
    kind: 'iso', equip: 'cable', level: 1, avoid: [],
    cues: ['肘をほぼ伸ばしたまま太ももまで弧を描く', '脇の下 (広背筋) で引く', '上体は少し前傾で固定'],
  },
  {
    id: 'back-extension', name: 'バックエクステンション', en: 'Back Extension', slot: 'back.iso', muscle: 'back', also: ['glutes'],
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: ['lowback'], box: true, gymOnly: true,
    cues: ['股関節から曲げ伸ばしする', '上で体が一直線になったら止める (反りすぎない)', 'お尻を締めて上がる'],
  },

  // ---- ヒンジ (背中・お尻・脚の共通枠) ----
  {
    id: 'deadlift', name: 'デッドリフト', en: 'Deadlift', slot: 'hinge', muscle: 'back', also: ['glutes', 'legs'],
    kind: 'compound', equip: 'barbell', level: 2, avoid: ['lowback'], box: true, lift: 'デッドリフト',
    cues: ['バーはすねに沿わせ、体から離さない', '背中をまっすぐ固めてから床を押す', '立ち上がったら腰を反らさず、お尻を締めて終わる'],
  },
  {
    id: 'rdl', name: 'ルーマニアンデッドリフト', en: 'Romanian Deadlift', slot: 'hinge', muscle: 'glutes', also: ['legs', 'back'],
    kind: 'compound', equip: 'barbell', level: 2, avoid: ['lowback'], box: true, lift: 'ルーマニアンデッドリフト',
    cues: ['膝は軽く曲げたまま、お尻を後ろへ引く', 'もも裏が伸びきったところで切り返す (膝下まで)', '背中は最後まで丸めない'],
  },
  {
    id: 'db-rdl', name: 'ダンベルRDL', en: 'Dumbbell RDL', slot: 'hinge', muscle: 'glutes', also: ['legs'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: ['lowback'], box: true,
    cues: ['ダンベルを太ももに沿わせて下ろす', 'お尻を後ろの壁に近づけるイメージ', 'もも裏の伸びを感じたら戻る'],
  },
  {
    id: 'kb-swing-gym', name: 'ケトルベルスイング', en: 'Kettlebell Swing', slot: 'power', muscle: 'glutes', also: ['legs', 'core'],
    kind: 'power', equip: 'kettlebell', level: 1, avoid: ['lowback'], box: true,
    cues: ['しゃがむのではなく股関節を折る', 'お尻の爆発で振り上げ、腕は添えるだけ', '胸の高さで止める (ロシアンスイング)'],
  },

  // ---- 肩 ----
  {
    id: 'ohp', name: 'スタンディングショルダープレス', en: 'Overhead Press', slot: 'shoulders.press', muscle: 'shoulders', also: ['arms', 'core'],
    kind: 'compound', equip: 'barbell', level: 2, avoid: ['shoulder', 'lowback'], box: true, lift: 'ショルダープレス',
    cues: ['お尻とお腹を締めて腰を反らさない', 'バーが顔の前を通ったら頭を前に入れる', '頭の真上でロックアウト'],
  },
  {
    id: 'db-shoulder-press', name: 'ダンベルショルダープレス (座位)', en: 'Seated DB Shoulder Press', slot: 'shoulders.press', muscle: 'shoulders', also: ['arms'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: ['shoulder'], box: true,
    cues: ['背もたれは垂直より少し倒す', '耳の横まで下ろし、頭上で近づける', '腰を反らせて押さない'],
  },
  {
    id: 'machine-shoulder-press', name: 'ショルダープレス (マシン)', en: 'Machine Shoulder Press', slot: 'shoulders.press', muscle: 'shoulders', also: ['arms'],
    kind: 'compound', equip: 'machine', level: 1, avoid: ['shoulder'],
    cues: ['グリップが肩の高さに来るよう調整', '肩をすくめずに押す', '下ろすときは2秒'],
  },
  {
    id: 'lateral-raise', name: 'サイドレイズ', en: 'Lateral Raise', slot: 'shoulders.lateral', muscle: 'shoulders',
    kind: 'iso', equip: 'dumbbell', level: 1, avoid: [], box: true,
    cues: ['軽い重さで、肘から上げる', '肩の高さまで (それ以上は不要)', '小指側を少し上げ、すくめない'],
  },
  {
    id: 'cable-lateral', name: 'ケーブルサイドレイズ', en: 'Cable Lateral Raise', slot: 'shoulders.lateral', muscle: 'shoulders',
    kind: 'iso', equip: 'cable', level: 1, avoid: [], each: true,
    cues: ['ケーブルを体の前でクロスさせて引く', '下でも負荷が抜けないのがケーブルの強み', '2秒かけて下ろす'],
  },
  {
    id: 'rear-delt-fly', name: 'リアデルトフライ', en: 'Rear Delt Fly', slot: 'shoulders.rear', muscle: 'shoulders', also: ['back'],
    kind: 'iso', equip: 'machine', level: 1, avoid: [],
    cues: ['ペックフライのマシンを逆向きに座って使う (ダンベルでもOK)', '肩甲骨を寄せすぎず、肩の後ろで開く', '軽めで高回数'],
  },
  {
    id: 'face-pull', name: 'フェイスプル', en: 'Face Pull', slot: 'shoulders.rear', muscle: 'shoulders', also: ['back'],
    kind: 'iso', equip: 'cable', level: 1, avoid: [],
    cues: ['ロープを目の高さへ引き、両手を耳の横へ開く', '肘を高く保つ', '姿勢改善・肩の健康にも効く種目'],
  },
  {
    id: 'band-pull-apart', name: 'バンドプルアパート', en: 'Band Pull-apart', slot: 'shoulders.rear', muscle: 'shoulders', also: ['back'],
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], box: true, needs: ['band'],
    cues: ['腕を伸ばしたまま胸の高さでバンドを左右に開く', '肩甲骨を寄せて1秒止める', 'ゆっくり戻す'],
  },

  // ---- 腕 ----
  {
    id: 'db-curl', name: 'ダンベルカール', en: 'Dumbbell Curl', slot: 'arms.biceps', muscle: 'arms',
    kind: 'iso', equip: 'dumbbell', level: 1, avoid: [], box: true,
    cues: ['肘の位置を体の横で固定', '上げながら小指側を外にひねる', '反動を使わず2秒で下ろす'],
  },
  {
    id: 'hammer-curl', name: 'ハンマーカール', en: 'Hammer Curl', slot: 'arms.biceps', muscle: 'arms',
    kind: 'iso', equip: 'dumbbell', level: 1, avoid: [], box: true,
    cues: ['手のひらを向かい合わせたまま上げる', '前腕と腕の太さに効く', '肘を前に出さない'],
  },
  {
    id: 'cable-curl', name: 'ケーブルカール', en: 'Cable Curl', slot: 'arms.biceps', muscle: 'arms',
    kind: 'iso', equip: 'cable', level: 1, avoid: [],
    cues: ['最後まで負荷が抜けない', 'トップで1秒絞る', '体を後ろに倒さない'],
  },
  {
    id: 'incline-curl', name: 'インクラインダンベルカール', en: 'Incline Curl', slot: 'arms.biceps', muscle: 'arms',
    kind: 'iso', equip: 'dumbbell', level: 2, avoid: ['shoulder'], needs: ['bench'],
    cues: ['ベンチを45〜60度に倒し腕を垂らす', '力こぶが伸びた状態から巻き上げる', '軽めで丁寧に'],
  },
  {
    id: 'pushdown', name: 'トライセプスプッシュダウン', en: 'Triceps Pushdown', slot: 'arms.triceps', muscle: 'arms',
    kind: 'iso', equip: 'cable', level: 1, avoid: [],
    cues: ['肘を脇に付けたまま固定', '下で肘を伸ばし切って1秒', '肩が上がらないように'],
  },
  {
    id: 'overhead-ext', name: 'オーバーヘッドエクステンション', en: 'Overhead Triceps Extension', slot: 'arms.triceps', muscle: 'arms',
    kind: 'iso', equip: 'dumbbell', level: 1, avoid: ['shoulder'], box: true,
    cues: ['ダンベル1つを両手で頭の後ろへ下ろす', '肘は前を向けたまま開かない', '二の腕の伸びを感じる'],
  },
  {
    id: 'close-grip-bench', name: 'ナローベンチプレス', en: 'Close-grip Bench Press', slot: 'arms.triceps', muscle: 'arms', also: ['chest'],
    kind: 'compound', equip: 'barbell', level: 2, avoid: ['shoulder', 'wrist'], box: true,
    cues: ['手幅は肩幅程度 (狭すぎると手首を痛める)', '肘を体に沿わせて下ろす', 'みぞおちの少し下に下ろす'],
  },
  {
    id: 'bench-dip', name: 'ベンチディップ', en: 'Bench Dip', slot: 'arms.triceps', muscle: 'arms',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: ['shoulder', 'wrist'], box: true, needs: ['bench'],
    cues: ['ベンチに手をつき、お尻を体の近くで下ろす', '肘が90度になるまで', '膝を曲げると楽になる'],
  },

  // ---- 腹筋・体幹 ----
  {
    id: 'plank', name: 'プランク', en: 'Plank', slot: 'core.antiext', muscle: 'core',
    kind: 'core', equip: 'bodyweight', level: 1, avoid: [], box: true, unit: 'sec',
    cues: ['肘を肩の真下、頭からかかとまで一直線', 'お腹をへこませ、お尻を締める', '腰が落ちたら終了'],
  },
  {
    id: 'dead-bug', name: 'デッドバグ', en: 'Dead Bug', slot: 'core.antiext', muscle: 'core',
    kind: 'core', equip: 'bodyweight', level: 1, avoid: [], box: true,
    cues: ['腰を床に押し付けたまま対角の手足を伸ばす', '息を吐きながら伸ばす', '腰が浮かない範囲で'],
  },
  {
    id: 'ab-wheel', name: 'アブローラー (膝つき)', en: 'Ab Wheel Rollout', slot: 'core.antiext', muscle: 'core',
    kind: 'core', equip: 'bodyweight', level: 2, avoid: ['lowback'], box: true, gymOnly: true,
    cues: ['背中を少し丸めたまま転がす', '腰が反る手前で止める', '戻りはお腹で引き寄せる'],
  },
  {
    id: 'hollow-hold', name: 'ホロウホールド', en: 'Hollow Hold', slot: 'core.antiext', muscle: 'core',
    kind: 'core', equip: 'bodyweight', level: 1, avoid: [], box: true, unit: 'sec',
    cues: ['腰を床に押し付けたまま手足を浮かせる', 'きつければ膝を曲げる', 'CrossFitの体操系の土台になる姿勢'],
  },
  {
    id: 'cable-crunch', name: 'ケーブルクランチ', en: 'Cable Crunch', slot: 'core.flex', muscle: 'core',
    kind: 'core', equip: 'cable', level: 1, avoid: ['lowback'],
    cues: ['膝立ちでロープを頭の横に持つ', 'みぞおちをへそに近づけるように丸める', '腕で引かない'],
  },
  {
    id: 'hanging-knee-raise', name: 'ハンギングニーレイズ', en: 'Hanging Knee Raise', slot: 'core.flex', muscle: 'core',
    kind: 'core', equip: 'bodyweight', level: 1, avoid: ['shoulder'], box: true, needs: ['bar'],
    cues: ['反動を使わず膝を胸へ', '骨盤を丸めるところまで上げる', 'ゆっくり下ろす'],
  },
  {
    id: 'hanging-leg-raise', name: 'ハンギングレッグレイズ', en: 'Hanging Leg Raise', slot: 'core.flex', muscle: 'core',
    kind: 'core', equip: 'bodyweight', level: 2, avoid: ['shoulder', 'lowback'], box: true, needs: ['bar'],
    cues: ['脚を伸ばしたまま腰の高さ以上へ', '体を振らない', '下ろすときに腰を反らない'],
  },
  {
    id: 'v-up-gym', name: 'Vアップ', en: 'V-up', slot: 'core.flex', muscle: 'core',
    kind: 'core', equip: 'bodyweight', level: 1, avoid: ['lowback'], box: true,
    cues: ['手と足を同時に上げてV字に', 'きつければ膝を曲げたタックアップ', '下ろすときもお腹の力を抜かない'],
  },
  {
    id: 'pallof', name: 'パロフプレス', en: 'Pallof Press', slot: 'core.antirot', muscle: 'core',
    kind: 'core', equip: 'cable', level: 1, avoid: [], each: true,
    cues: ['ケーブルの横に立ち胸の前で握る', 'ねじられないように耐えながら腕を伸ばす', '2秒止めて戻す'],
  },
  {
    id: 'side-plank', name: 'サイドプランク', en: 'Side Plank', slot: 'core.antirot', muscle: 'core',
    kind: 'core', equip: 'bodyweight', level: 1, avoid: [], box: true, unit: 'sec', each: true,
    cues: ['肘を肩の真下に', '頭から足まで一直線、お尻を落とさない', 'きつければ膝をつく'],
  },
  {
    id: 'farmers-carry', name: 'ファーマーズウォーク', en: "Farmer's Carry", slot: 'core.antirot', muscle: 'core', also: ['arms'],
    kind: 'core', equip: 'dumbbell', level: 1, avoid: [], box: true, unit: 'sec',
    cues: ['重いダンベルを両手に持って歩く', '胸を張り、体を左右に揺らさない', '握力と体幹が同時に鍛えられる'],
  },

  // ---- お尻 ----
  {
    id: 'hip-thrust', name: 'ヒップスラスト', en: 'Hip Thrust', slot: 'glutes.thrust', muscle: 'glutes', also: ['legs'],
    kind: 'compound', equip: 'barbell', level: 1, avoid: [], box: true, lift: 'ヒップスラスト',
    cues: ['肩甲骨の下をベンチに乗せ、すねが垂直になる足の位置', 'あごを引き、お尻で腰を押し上げる', 'トップで1秒お尻を締める (腰は反らない)'],
  },
  {
    id: 'smith-hip-thrust', name: 'スミスマシン・ヒップスラスト', en: 'Smith Hip Thrust', slot: 'glutes.thrust', muscle: 'glutes', also: ['legs'],
    kind: 'compound', equip: 'machine', level: 1, avoid: [],
    cues: ['バーにパッドを巻いて腰骨の上に', 'お尻の力で押し上げる', 'トップで1秒止める'],
  },
  {
    id: 'glute-bridge', name: 'シングルレッグヒップリフト', en: 'Single-leg Glute Bridge', slot: 'glutes.thrust', muscle: 'glutes',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], box: true, each: true,
    cues: ['仰向けで片脚を浮かせ、かかとで押す', 'お尻を締めて骨盤を水平に', 'トップで2秒止める'],
  },
  {
    id: 'hip-abduction', name: 'ヒップアブダクション (マシン)', en: 'Hip Abduction', slot: 'glutes.iso', muscle: 'glutes',
    kind: 'iso', equip: 'machine', level: 1, avoid: [],
    cues: ['上体を少し前傾するとお尻の上部に効く', '開いたところで1秒止める', '戻すときもゆっくり'],
  },
  {
    id: 'cable-kickback', name: 'ケーブルキックバック', en: 'Cable Kickback', slot: 'glutes.iso', muscle: 'glutes',
    kind: 'iso', equip: 'cable', level: 1, avoid: ['lowback'], each: true,
    cues: ['足首にアタッチメントを付け、後ろへ蹴る', '腰を反らずにお尻で蹴る', 'トップで1秒'],
  },
  {
    id: 'banded-walk', name: 'バンドサイドウォーク', en: 'Banded Lateral Walk', slot: 'glutes.iso', muscle: 'glutes',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], box: true, needs: ['band'],
    cues: ['膝上にミニバンドを付け、軽くしゃがむ', 'つま先は正面のまま横へ歩く', '膝が内に入らないように'],
  },

  // ---- 片脚種目 (お尻・脚の共通枠) ----
  {
    id: 'bulgarian', name: 'ブルガリアンスクワット', en: 'Bulgarian Split Squat', slot: 'unilateral', muscle: 'glutes', also: ['legs'],
    kind: 'compound', equip: 'dumbbell', level: 2, avoid: ['knee'], box: true, each: true, needs: ['bench'],
    cues: ['後ろ足の甲をベンチに乗せる', '少し前傾するとお尻、直立すると前ももに効く', '前足のかかとで床を押して立つ'],
  },
  {
    id: 'walking-lunge', name: 'ダンベルウォーキングランジ', en: 'DB Walking Lunge', slot: 'unilateral', muscle: 'legs', also: ['glutes'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: ['knee'], box: true, each: true,
    cues: ['大きく一歩踏み出し、後ろ膝を床すれすれまで', '上体はまっすぐ', '前足のかかとで押して次の一歩'],
  },
  {
    id: 'step-up', name: 'ダンベルステップアップ', en: 'DB Step-up', slot: 'unilateral', muscle: 'legs', also: ['glutes'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: ['knee'], box: true, each: true, needs: ['bench'],
    cues: ['膝が90度になる高さの台を使う', '上の足だけで立ち上がる (後ろ足で蹴らない)', 'ゆっくり下りる'],
  },

  // ---- 脚 ----
  {
    id: 'back-squat', name: 'バーベルスクワット', en: 'Back Squat', slot: 'legs.squat', muscle: 'legs', also: ['glutes', 'core'],
    kind: 'compound', equip: 'barbell', level: 2, avoid: ['knee', 'lowback'], box: true, lift: 'バックスクワット',
    cues: ['大きく息を吸って腹圧をかけてからしゃがむ', '膝はつま先と同じ向き', '太ももが床と平行かそれより深く'],
  },
  {
    id: 'goblet-squat', name: 'ゴブレットスクワット', en: 'Goblet Squat', slot: 'legs.squat', muscle: 'legs', also: ['glutes', 'core'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: ['knee'], box: true,
    cues: ['ダンベルを胸の前で縦に持つ', '肘を膝の内側に通すように深くしゃがむ', '胸を張ったまま立つ'],
  },
  {
    id: 'leg-press', name: 'レッグプレス', en: 'Leg Press', slot: 'legs.squat', muscle: 'legs', also: ['glutes'],
    kind: 'compound', equip: 'machine', level: 1, avoid: ['knee'],
    cues: ['足は肩幅、プレートの真ん中に', 'お尻がシートから浮かない深さまで', '膝を伸ばし切ってロックしない'],
  },
  {
    id: 'smith-squat', name: 'スミスマシンスクワット', en: 'Smith Machine Squat', slot: 'legs.squat', muscle: 'legs', also: ['glutes'],
    kind: 'compound', equip: 'machine', level: 1, avoid: ['knee', 'lowback'],
    cues: ['足を少し前に出して立つ', 'お尻を後ろに引きながらしゃがむ', 'ストッパーを必ずセット'],
  },
  {
    id: 'box-squat', name: 'ボックススクワット (ダンベル)', en: 'DB Box Squat', slot: 'legs.squat', muscle: 'legs', also: ['glutes'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: [], box: true, needs: ['bench'],
    cues: ['痛みの出ない高さの台・ベンチにお尻を軽く触れる', 'すねはなるべく垂直に (ひざに優しい)', 'かかとで押して立つ'],
  },
  {
    id: 'leg-curl', name: 'レッグカール', en: 'Leg Curl', slot: 'legs.ham', muscle: 'legs',
    kind: 'iso', equip: 'machine', level: 1, avoid: [],
    cues: ['膝の位置をマシンの軸に合わせる', 'お尻を浮かせずに曲げる', '戻すときは3秒'],
  },
  {
    id: 'leg-extension', name: 'レッグエクステンション', en: 'Leg Extension', slot: 'legs.quad', muscle: 'legs',
    kind: 'iso', equip: 'machine', level: 1, avoid: ['knee'],
    cues: ['膝の位置をマシンの軸に合わせる', '上で1秒、前ももを絞る', '反動を使わない'],
  },
  {
    id: 'calf-raise', name: 'カーフレイズ', en: 'Calf Raise', slot: 'legs.calf', muscle: 'legs',
    kind: 'iso', equip: 'machine', level: 1, avoid: [], box: true,
    cues: ['段差につま先を乗せ、かかとを深く下ろす', 'つま先立ちで1秒止める', 'マシンがなければダンベルを持って'],
  },

  // ---- パワー (動ける体) ----
  {
    id: 'box-jump-gym', name: 'ボックスジャンプ', en: 'Box Jump', slot: 'power', muscle: 'legs', also: ['glutes'],
    kind: 'power', equip: 'bodyweight', level: 1, avoid: ['knee'], box: true, needs: ['bench'], impact: true,
    cues: ['腕を振って高く跳び、静かに着地', '着地は膝を軽く曲げて', '降りるときはステップダウン'],
  },
  {
    id: 'jump-squat', name: 'ジャンプスクワット', en: 'Jump Squat', slot: 'power', muscle: 'legs', also: ['glutes'],
    kind: 'power', equip: 'bodyweight', level: 1, avoid: ['knee'], box: true, impact: true,
    cues: ['浅めにしゃがんで最大の高さへ', '1回ずつリセットして全力で', '着地は柔らかく'],
  },
  {
    id: 'db-snatch-gym', name: 'ダンベルスナッチ', en: 'Dumbbell Snatch', slot: 'power', muscle: 'shoulders', also: ['glutes', 'legs'],
    kind: 'power', equip: 'dumbbell', level: 2, avoid: ['shoulder', 'lowback'], box: true, each: true,
    cues: ['床から頭上まで一気に', '脚と股関節で上げ、腕は最後に', '頭上で肘をロック'],
  },
  {
    id: 'med-ball-throw', name: 'メディシンボール・チェストパス', en: 'Med Ball Chest Pass', slot: 'power', muscle: 'chest', also: ['shoulders', 'core'],
    kind: 'power', equip: 'bodyweight', level: 1, avoid: ['wrist'], box: true, gymOnly: true,
    cues: ['壁に向かって胸から全力で投げる', '足から力を伝える', 'ボールがなければクラップなしの爆発的プッシュアップで'],
  },

  // ---- 自宅・野外の代替種目 (道具なし / ダンベル / チューブ / 椅子 / 鉄棒) ----
  {
    id: 'knee-push-up', name: '膝つきプッシュアップ', en: 'Knee Push-up', slot: 'chest.press', muscle: 'chest', also: ['arms'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: ['wrist'], awayOnly: true,
    cues: ['膝から頭まで一直線', '胸が床に付く手前まで下ろす', '余裕が出たら通常のプッシュアップへ'],
  },
  {
    id: 'incline-push-up', name: 'インクラインプッシュアップ (台に手をつく)', en: 'Incline Push-up', slot: 'chest.press', muscle: 'chest', also: ['arms'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: ['wrist'], awayOnly: true, needs: ['bench'],
    cues: ['椅子・ベンチの縁に手をつく (動かないものを使う)', '胸を台に近づけるように下ろす', '台が高いほど楽になる'],
  },
  {
    id: 'wide-push-up', name: 'ワイドプッシュアップ', en: 'Wide Push-up', slot: 'chest.press', muscle: 'chest', also: ['shoulders'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: ['wrist', 'shoulder'], awayOnly: true,
    cues: ['手幅を肩幅の1.5倍に', '胸の外側が伸びるまで下ろす', 'お尻を落とさない'],
  },
  {
    id: 'archer-push-up', name: 'アーチャープッシュアップ', en: 'Archer Push-up', slot: 'chest.press', muscle: 'chest', also: ['arms'],
    kind: 'compound', equip: 'bodyweight', level: 3, avoid: ['wrist', 'shoulder'], awayOnly: true, each: true,
    cues: ['手幅を広くとり、片側の腕に体重を寄せて下ろす', '反対の腕は伸ばしたまま補助', '片手プッシュアップへの準備になる'],
  },
  {
    id: 'decline-push-up', name: 'デクラインプッシュアップ (足を台に)', en: 'Decline Push-up', slot: 'chest.incline', muscle: 'chest', also: ['shoulders'],
    kind: 'compound', equip: 'bodyweight', level: 2, avoid: ['wrist', 'shoulder'], awayOnly: true, needs: ['bench'],
    cues: ['足を椅子・ベンチに乗せる', '胸の上部に効く', '腰が反らないようお腹を締める'],
  },
  {
    id: 'db-floor-press', name: 'ダンベルフロアプレス', en: 'DB Floor Press', slot: 'chest.press', muscle: 'chest', also: ['arms'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: [], awayOnly: true,
    cues: ['床に仰向けで膝を立てる', '二の腕が床に軽く触れるまで下ろす', 'ベンチがなくても胸を鍛えられ、肩にも優しい'],
  },
  {
    id: 'db-floor-fly', name: 'ダンベルフロアフライ', en: 'DB Floor Fly', slot: 'chest.fly', muscle: 'chest',
    kind: 'iso', equip: 'dumbbell', level: 1, avoid: [], awayOnly: true,
    cues: ['床に仰向けで肘を軽く曲げて開く', '二の腕が床に触れたら閉じる', '軽めの重さで胸を絞る'],
  },
  {
    id: 'band-chest-press', name: 'チューブチェストプレス', en: 'Band Chest Press', slot: 'chest.press', muscle: 'chest', also: ['arms'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true, needs: ['band'],
    cues: ['チューブを背中に回して両手で持つ', '胸の前へ押し出す', '戻すときもゆっくり'],
  },
  {
    id: 'band-fly', name: 'チューブフライ', en: 'Band Fly', slot: 'chest.fly', muscle: 'chest',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true, needs: ['band'],
    cues: ['チューブを背中に回し、腕を開いた姿勢から', '大きな木を抱えるように閉じる', '閉じたところで1秒'],
  },
  {
    id: 'towel-pulldown', name: 'タオルラットプルダウン (うつ伏せ)', en: 'Prone Towel Pulldown', slot: 'back.vpull', muscle: 'back',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true,
    cues: ['うつ伏せでタオルの両端を引っ張りながら頭上に伸ばす', 'タオルを張ったまま胸の横へ肘を引く', '肩甲骨を寄せて2秒止める'],
  },
  {
    id: 'band-pulldown', name: 'チューブラットプルダウン', en: 'Band Pulldown', slot: 'back.vpull', muscle: 'back', also: ['arms'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true, needs: ['band'],
    cues: ['チューブを頭上で肩幅より広く持つ', '左右に引き伸ばしながら胸の前へ下ろす', '背中の外側で引く'],
  },
  {
    id: 'db-pullover', name: 'ダンベルプルオーバー', en: 'DB Pullover', slot: 'back.vpull', muscle: 'back', also: ['chest'],
    kind: 'iso', equip: 'dumbbell', level: 1, avoid: ['shoulder'], awayOnly: true,
    cues: ['床に仰向けでダンベル1つを両手で胸の上に', '肘を軽く曲げたまま頭の後ろへ下ろす', '脇の下が伸びたら胸の上へ戻す'],
  },
  {
    id: 'australian-row', name: '斜め懸垂 (低い鉄棒)', en: 'Australian Pull-up', slot: 'back.hpull', muscle: 'back', also: ['arms'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true, needs: ['bar'],
    cues: ['腰の高さの鉄棒にぶら下がり、体を斜めに', '胸をバーに近づけるように引く', '足を前に出すほどきつくなる'],
  },
  {
    id: 'band-row', name: 'チューブロウ', en: 'Band Row', slot: 'back.hpull', muscle: 'back', also: ['arms'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true, needs: ['band'],
    cues: ['座って足裏にチューブを掛ける (柱やドアに固定しても可)', 'みぞおちへ引き肩甲骨を寄せる', '背中を丸めない'],
  },
  {
    id: 'superman', name: 'スーパーマン', en: 'Superman', slot: 'back.iso', muscle: 'back', also: ['glutes'],
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: ['lowback'], awayOnly: true,
    cues: ['うつ伏せで手足を同時に少し浮かせる', '上で2秒止める', '首は反らさず目線は床'],
  },
  {
    id: 'reverse-snow-angel', name: 'リバーススノーエンジェル', en: 'Reverse Snow Angel', slot: 'back.iso', muscle: 'back', also: ['shoulders'],
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true,
    cues: ['うつ伏せで胸と腕を少し浮かせる', '腕を腰の横から頭上まで大きく弧を描く', '肩甲骨を寄せたまま動かす'],
  },
  {
    id: 'single-leg-rdl', name: '片脚ルーマニアンデッドリフト', en: 'Single-leg RDL', slot: 'hinge', muscle: 'glutes', also: ['legs', 'back'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true, each: true,
    cues: ['片脚で立ち、反対の脚を後ろへ伸ばしながら上体を倒す', '骨盤を水平に保つ', 'ダンベルがあれば持つと負荷アップ'],
  },
  {
    id: 'pike-push-up', name: 'パイクプッシュアップ', en: 'Pike Push-up', slot: 'shoulders.press', muscle: 'shoulders', also: ['arms'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: ['wrist', 'shoulder'], awayOnly: true,
    cues: ['お尻を高く上げた「く」の字の姿勢', '頭頂部を手の間へ下ろす', '足を台に乗せるとさらにきつい'],
  },
  {
    id: 'band-shoulder-press', name: 'チューブショルダープレス', en: 'Band Shoulder Press', slot: 'shoulders.press', muscle: 'shoulders', also: ['arms'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: ['shoulder'], awayOnly: true, needs: ['band'],
    cues: ['チューブを足で踏み、肩の高さから頭上へ', '腰を反らさない', '戻すときもゆっくり'],
  },
  {
    id: 'band-lateral', name: 'チューブサイドレイズ', en: 'Band Lateral Raise', slot: 'shoulders.lateral', muscle: 'shoulders',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true, needs: ['band'],
    cues: ['チューブを足で踏み、肘から横へ上げる', '肩の高さまで', 'すくめない'],
  },
  {
    id: 'prone-ytw', name: 'YTWレイズ (うつ伏せ)', en: 'Prone Y-T-W', slot: 'shoulders.rear', muscle: 'shoulders', also: ['back'],
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true,
    cues: ['うつ伏せで腕をY・T・Wの形に順に浮かせる (1セット=各形)', '親指を天井に向ける', '肩の後ろと背中の上部に効く'],
  },
  {
    id: 'band-curl', name: 'チューブカール', en: 'Band Curl', slot: 'arms.biceps', muscle: 'arms',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true, needs: ['band'],
    cues: ['チューブを足で踏み、肘を体の横で固定', '上でしっかり絞る', 'ゆっくり戻す'],
  },
  {
    id: 'towel-curl', name: 'タオルカール', en: 'Towel Curl', slot: 'arms.biceps', muscle: 'arms',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true, each: true,
    cues: ['片足の裏にタオルを掛け、両手で持つ', '足で抵抗をかけながら肘を曲げる', '下ろすときも足で押し返して負荷をかける'],
  },
  {
    id: 'diamond-push-up', name: 'ダイヤモンドプッシュアップ', en: 'Diamond Push-up', slot: 'arms.triceps', muscle: 'arms', also: ['chest'],
    kind: 'compound', equip: 'bodyweight', level: 2, avoid: ['wrist'], awayOnly: true,
    cues: ['両手の親指と人差し指でひし形を作る', '肘を体に沿わせて下ろす', 'きつければ膝をつく'],
  },
  {
    id: 'band-pushdown', name: 'チューブトライセプスエクステンション', en: 'Band Triceps Extension', slot: 'arms.triceps', muscle: 'arms',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true, needs: ['band'],
    cues: ['チューブを背中側で踏み、頭の後ろから上へ伸ばす', '肘の位置を固定', '二の腕の伸びを感じる'],
  },
  {
    id: 'mountain-climber', name: 'マウンテンクライマー', en: 'Mountain Climber', slot: 'core.antiext', muscle: 'core', also: ['legs'],
    kind: 'core', equip: 'bodyweight', level: 1, avoid: ['wrist'], awayOnly: true, unit: 'sec',
    cues: ['プランク姿勢で膝を交互に胸へ', 'お尻を上げすぎない', '静かにしたい日はゆっくり'],
  },
  {
    id: 'leg-raise', name: 'レッグレイズ', en: 'Lying Leg Raise', slot: 'core.flex', muscle: 'core',
    kind: 'core', equip: 'bodyweight', level: 1, avoid: ['lowback'], awayOnly: true,
    cues: ['仰向けで手をお尻の下に', '脚をそろえて天井へ上げ、床すれすれまで下ろす', '腰が浮くなら膝を曲げる'],
  },
  {
    id: 'bicycle-crunch', name: 'バイシクルクランチ', en: 'Bicycle Crunch', slot: 'core.flex', muscle: 'core',
    kind: 'core', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true,
    cues: ['肘と反対の膝を近づけるようにひねる (左右で1回)', '反動ではなくお腹で', '首を手で引っ張らない'],
  },
  {
    id: 'shoulder-tap', name: 'プランクショルダータップ', en: 'Plank Shoulder Tap', slot: 'core.antirot', muscle: 'core', also: ['shoulders'],
    kind: 'core', equip: 'bodyweight', level: 1, avoid: ['wrist'], awayOnly: true,
    cues: ['高いプランクで片手ずつ反対の肩にタッチ', '腰を左右に揺らさない', '足幅を広げると楽になる'],
  },
  {
    id: 'band-pallof', name: 'チューブパロフプレス', en: 'Band Pallof Press', slot: 'core.antirot', muscle: 'core',
    kind: 'core', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true, needs: ['band'], each: true,
    cues: ['チューブを柱やドアに横から固定', 'ねじられないように耐えながら腕を伸ばす', '2秒止めて戻す'],
  },
  {
    id: 'bw-glute-bridge', name: 'ヒップリフト', en: 'Glute Bridge', slot: 'glutes.thrust', muscle: 'glutes', also: ['legs'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true,
    cues: ['仰向けで膝を立て、かかとで床を押す', 'お尻を締めて肩から膝まで一直線に', 'トップで2秒止める'],
  },
  {
    id: 'db-glute-bridge', name: 'ダンベルヒップリフト', en: 'DB Glute Bridge', slot: 'glutes.thrust', muscle: 'glutes', also: ['legs'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: [], awayOnly: true,
    cues: ['ダンベルを腰骨の上に乗せる (タオルを挟む)', 'お尻で押し上げてトップで1秒', '腰は反らさない'],
  },
  {
    id: 'donkey-kick', name: 'ドンキーキック', en: 'Donkey Kick', slot: 'glutes.iso', muscle: 'glutes',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: ['wrist'], awayOnly: true, each: true,
    cues: ['四つ這いで膝を90度に曲げたまま、足裏を天井へ', '腰を反らさずお尻で上げる', 'トップで1秒'],
  },
  {
    id: 'fire-hydrant', name: 'ファイヤーハイドラント', en: 'Fire Hydrant', slot: 'glutes.iso', muscle: 'glutes',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: ['wrist'], awayOnly: true, each: true,
    cues: ['四つ這いで膝を曲げたまま横へ開く', '骨盤を傾けない', 'お尻の横 (中臀筋) に効く'],
  },
  {
    id: 'clamshell', name: 'クラムシェル', en: 'Clamshell', slot: 'glutes.iso', muscle: 'glutes',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true, each: true,
    cues: ['横向きで膝を曲げ、かかとをつけたまま膝を開く', '骨盤を後ろに倒さない', 'チューブを膝上に巻くと負荷アップ'],
  },
  {
    id: 'bw-bulgarian', name: '自重ブルガリアンスクワット', en: 'Bodyweight Bulgarian Split Squat', slot: 'unilateral', muscle: 'glutes', also: ['legs'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: ['knee'], awayOnly: true, needs: ['bench'], each: true,
    cues: ['後ろ足の甲を椅子・ベンチに乗せる', '前足のかかとで床を押して立つ', '自重でも3秒かけて下ろすと十分きつい'],
  },
  {
    id: 'reverse-lunge', name: 'リバースランジ', en: 'Reverse Lunge', slot: 'unilateral', muscle: 'legs', also: ['glutes'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: ['knee'], awayOnly: true, each: true,
    cues: ['片足を大きく後ろへ引いて沈む', '前の膝はつま先より前に出しすぎない', '前足のかかとで押して戻る'],
  },
  {
    id: 'bw-step-up', name: 'ステップアップ (自重)', en: 'Step-up', slot: 'unilateral', muscle: 'legs', also: ['glutes'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: ['knee'], awayOnly: true, needs: ['bench'], each: true,
    cues: ['安定したベンチ・段差に片足を乗せる', '上の足だけで立ち上がる', '降りるときもゆっくり'],
  },
  {
    id: 'bw-squat', name: '自重スクワット', en: 'Bodyweight Squat', slot: 'legs.squat', muscle: 'legs', also: ['glutes'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: ['knee'], awayOnly: true,
    cues: ['お尻を後ろに引きながら太ももが床と平行まで', '膝はつま先と同じ向き', '3秒で下ろすと自重でも効く'],
  },
  {
    id: 'chair-squat', name: '椅子スクワット', en: 'Chair Squat', slot: 'legs.squat', muscle: 'legs', also: ['glutes'],
    kind: 'compound', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true, needs: ['bench'],
    cues: ['椅子・ベンチにお尻が軽く触れるまで下ろす', 'すねをなるべく垂直に (ひざに優しい)', '座り込まずにすぐ立つ'],
  },
  {
    id: 'pistol-box', name: 'ボックスピストル (片脚スクワット)', en: 'Box Pistol', slot: 'legs.squat', muscle: 'legs', also: ['glutes', 'core'],
    kind: 'compound', equip: 'bodyweight', level: 2, avoid: ['knee'], awayOnly: true, needs: ['bench'], each: true,
    cues: ['片脚で立ち、椅子・ベンチにお尻が触れるまで下ろす', '反対の脚は前に伸ばす', '自重で脚を強くする最強の種目'],
  },
  {
    id: 'wall-sit', name: '空気椅子 (ウォールシット)', en: 'Wall Sit', slot: 'legs.quad', muscle: 'legs',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: ['knee'], awayOnly: true, unit: 'sec',
    cues: ['壁に背中をつけ、太ももが床と平行になる位置で止まる', '膝は90度', '足音ゼロで脚を追い込める'],
  },
  {
    id: 'slider-leg-curl', name: 'タオルレッグカール', en: 'Slider Leg Curl', slot: 'legs.ham', muscle: 'legs', also: ['glutes'],
    kind: 'iso', equip: 'bodyweight', level: 2, avoid: [], awayOnly: true,
    cues: ['仰向けでかかとをタオルに乗せ (フローリング)、お尻を浮かせる', 'お尻を浮かせたまま脚を伸ばして戻す', 'もも裏がつりそうなら片脚ずつ休む'],
  },
  {
    id: 'bw-calf-raise', name: 'カーフレイズ (段差)', en: 'Calf Raise', slot: 'legs.calf', muscle: 'legs',
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], awayOnly: true,
    cues: ['階段や段差につま先を乗せ、かかとを深く下ろす', 'つま先立ちで1秒止める', '片脚ずつにすると負荷アップ'],
  },
  {
    id: 'skater-jump', name: 'スケータージャンプ', en: 'Skater Jump', slot: 'power', muscle: 'legs', also: ['glutes'],
    kind: 'power', equip: 'bodyweight', level: 1, avoid: ['knee'], awayOnly: true, impact: true,
    cues: ['片脚で横へ跳び、反対の脚で着地', '着地で1秒止めてバランス', '左右で1回'],
  },
  {
    id: 'broad-jump', name: '立ち幅跳び', en: 'Broad Jump', slot: 'power', muscle: 'legs', also: ['glutes'],
    kind: 'power', equip: 'bodyweight', level: 1, avoid: ['knee', 'lowback'], awayOnly: true, impact: true,
    cues: ['腕を大きく振って前へ全力で跳ぶ', '膝を曲げて静かに着地', '1回ずつ歩いて戻ってリセット'],
  },
  {
    id: 'plyo-push-up', name: 'プライオプッシュアップ', en: 'Plyo Push-up', slot: 'power', muscle: 'chest', also: ['arms', 'shoulders'],
    kind: 'power', equip: 'bodyweight', level: 2, avoid: ['wrist', 'shoulder'], awayOnly: true,
    cues: ['床を強く押して手が浮くほど速く', '着地は肘を曲げて柔らかく', 'まずは膝つきでもOK'],
  },
]

/** 部位ごとの枠の優先順。先頭ほど大きな種目 */
export const SLOT_ORDER: Record<Muscle | 'full', Slot[]> = {
  chest: ['chest.press', 'chest.incline', 'chest.fly', 'chest.bw'],
  back: ['back.vpull', 'back.hpull', 'hinge', 'back.iso', 'shoulders.rear'],
  shoulders: ['shoulders.press', 'shoulders.lateral', 'shoulders.rear', 'shoulders.lateral'],
  arms: ['arms.biceps', 'arms.triceps', 'arms.biceps', 'arms.triceps'],
  core: ['core.antiext', 'core.flex', 'core.antirot'],
  glutes: ['glutes.thrust', 'hinge', 'unilateral', 'glutes.iso'],
  legs: ['legs.squat', 'hinge', 'unilateral', 'legs.ham', 'legs.quad', 'legs.calf'],
  full: [
    'legs.squat', 'chest.press', 'back.vpull', 'hinge', 'shoulders.press',
    'back.hpull', 'core.antiext', 'unilateral', 'shoulders.lateral', 'core.antirot',
  ],
}

export const GYM_BY_ID = new Map(GYM_EXERCISES.map(e => [e.id, e]))

const NO_AWAY_EQUIP = new Set<Equip>(['barbell', 'machine', 'cable'])

/** この回答の場所・道具で実施できる種目か */
export function availableFor(e: GymExercise, a: Pick<Answers, 'env' | 'gear' | 'quiet'>): boolean {
  if (a.env === 'gym') return !e.awayOnly
  if (a.env === 'box') return !!e.box
  if (e.gymOnly || NO_AWAY_EQUIP.has(e.equip)) return false
  if (a.quiet && e.impact) return false
  const needs: Gear[] = [...(e.needs ?? [])]
  if (e.equip === 'dumbbell') needs.push('dumbbell')
  if (e.equip === 'kettlebell') needs.push('kettlebell')
  return needs.every(g => a.gear.includes(g))
}
