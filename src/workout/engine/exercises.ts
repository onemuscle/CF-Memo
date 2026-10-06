// 施設型ジム (24時間ジム等) の種目データ。
// box: true の種目は CrossFit ボックスの補強 (アクセサリー) にも使う。

import type { Injury, Muscle } from './types'

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
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: ['shoulder'], box: true,
    cues: ['ダンベルは胸の横まで深く下ろす', '肘は体から45度くらいに開く', '挙げるときはダンベル同士を近づけるイメージ'],
  },
  {
    id: 'chest-press', name: 'チェストプレス (マシン)', en: 'Machine Chest Press', slot: 'chest.press', muscle: 'chest', also: ['arms'],
    kind: 'compound', equip: 'machine', level: 1, avoid: [],
    cues: ['グリップが胸の真ん中の高さに来るようシートを調整', '肩をすくめず、胸で押す', '戻すときは2秒かけてゆっくり'],
  },
  {
    id: 'incline-db', name: 'インクラインダンベルプレス', en: 'Incline Dumbbell Press', slot: 'chest.incline', muscle: 'chest', also: ['shoulders'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: ['shoulder'], box: true,
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
    kind: 'compound', equip: 'bodyweight', level: 2, avoid: ['shoulder', 'wrist'], box: true,
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
    kind: 'compound', equip: 'bodyweight', level: 2, avoid: ['shoulder'], box: true,
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
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: ['lowback'], box: true,
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
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], box: true,
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
    kind: 'iso', equip: 'dumbbell', level: 2, avoid: ['shoulder'],
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
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: ['shoulder', 'wrist'], box: true,
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
    kind: 'core', equip: 'bodyweight', level: 2, avoid: ['lowback'], box: true,
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
    kind: 'core', equip: 'bodyweight', level: 1, avoid: ['shoulder'], box: true,
    cues: ['反動を使わず膝を胸へ', '骨盤を丸めるところまで上げる', 'ゆっくり下ろす'],
  },
  {
    id: 'hanging-leg-raise', name: 'ハンギングレッグレイズ', en: 'Hanging Leg Raise', slot: 'core.flex', muscle: 'core',
    kind: 'core', equip: 'bodyweight', level: 2, avoid: ['shoulder', 'lowback'], box: true,
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
    kind: 'iso', equip: 'bodyweight', level: 1, avoid: [], box: true,
    cues: ['膝上にミニバンドを付け、軽くしゃがむ', 'つま先は正面のまま横へ歩く', '膝が内に入らないように'],
  },

  // ---- 片脚種目 (お尻・脚の共通枠) ----
  {
    id: 'bulgarian', name: 'ブルガリアンスクワット', en: 'Bulgarian Split Squat', slot: 'unilateral', muscle: 'glutes', also: ['legs'],
    kind: 'compound', equip: 'dumbbell', level: 2, avoid: ['knee'], box: true, each: true,
    cues: ['後ろ足の甲をベンチに乗せる', '少し前傾するとお尻、直立すると前ももに効く', '前足のかかとで床を押して立つ'],
  },
  {
    id: 'walking-lunge', name: 'ダンベルウォーキングランジ', en: 'DB Walking Lunge', slot: 'unilateral', muscle: 'legs', also: ['glutes'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: ['knee'], box: true, each: true,
    cues: ['大きく一歩踏み出し、後ろ膝を床すれすれまで', '上体はまっすぐ', '前足のかかとで押して次の一歩'],
  },
  {
    id: 'step-up', name: 'ダンベルステップアップ', en: 'DB Step-up', slot: 'unilateral', muscle: 'legs', also: ['glutes'],
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: ['knee'], box: true, each: true,
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
    kind: 'compound', equip: 'dumbbell', level: 1, avoid: [], box: true,
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
    kind: 'power', equip: 'bodyweight', level: 1, avoid: ['knee'], box: true,
    cues: ['腕を振って高く跳び、静かに着地', '着地は膝を軽く曲げて', '降りるときはステップダウン'],
  },
  {
    id: 'jump-squat', name: 'ジャンプスクワット', en: 'Jump Squat', slot: 'power', muscle: 'legs', also: ['glutes'],
    kind: 'power', equip: 'bodyweight', level: 1, avoid: ['knee'], box: true,
    cues: ['浅めにしゃがんで最大の高さへ', '1回ずつリセットして全力で', '着地は柔らかく'],
  },
  {
    id: 'db-snatch-gym', name: 'ダンベルスナッチ', en: 'Dumbbell Snatch', slot: 'power', muscle: 'shoulders', also: ['glutes', 'legs'],
    kind: 'power', equip: 'dumbbell', level: 2, avoid: ['shoulder', 'lowback'], box: true, each: true,
    cues: ['床から頭上まで一気に', '脚と股関節で上げ、腕は最後に', '頭上で肘をロック'],
  },
  {
    id: 'med-ball-throw', name: 'メディシンボール・チェストパス', en: 'Med Ball Chest Pass', slot: 'power', muscle: 'chest', also: ['shoulders', 'core'],
    kind: 'power', equip: 'bodyweight', level: 1, avoid: ['wrist'], box: true,
    cues: ['壁に向かって胸から全力で投げる', '足から力を伝える', 'ボールがなければクラップなしの爆発的プッシュアップで'],
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
