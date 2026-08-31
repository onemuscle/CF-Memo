// このファイルは CrossFit_BodyMake_12week_Plan_20260813.xlsx から生成した静的データです。
// プランを変えたときは元のスプレッドシートを更新し、ここを差し替えてください。

/** PM セッションの種別 (色分け・詳細表示の切り替えに使う) */
export type SessionKind =
  | 'shoulder'
  | 'back'
  | 'optional'
  | 'easyrun'
  | 'quality'
  | 'restday'
  | 'weekend'
  | 'review'

export interface PlanDay {
  /** YYYY-MM-DD */
  date: string
  dow: string
  week: number
  phase: string
  am: string
  pm: string
  /** 食A / 食C / 食A/食B のように複数候補が入ることがある */
  meal: string
  /** その日の中止・調整メモ */
  note: string
  kind: SessionKind
}

export interface WeekPlan {
  week: number
  period: string
  phase: string
  easy: string
  burpee: string
  quality: string
  aim: string
  note: string
  targetWeight: number
}

export interface Exercise {
  name: string
  sets: string
  reps: string
  intensity: string
  aim: string
  caution: string
  memo: string
}

export interface MealItem {
  time: string
  food: string
  p: string
  c: string
  f: string
  point: string
  /** 1日合計の行だけ持つ */
  kcal?: string
}

export interface MealPattern {
  /** 対象日 (例: 2部練/ハード日) */
  target: string
  items: MealItem[]
  total: MealItem
}

export const PLAN_PERIOD = '期間: 2026/08/13〜2026/11/04（12週間）｜2026/11/05に12週レビュー。月次シートはA4横1枚で印刷できる設計です。'

export const PLAN_PURPOSE: string[] = ['CrossFitの強さを維持〜向上しながら、ランとBurpeeの効率を上げる', '88.3kgから週0.2〜0.4kg程度の緩やかな減量を狙い、腹回りを絞る', '腹直筋・サイドデルタ・上腕三頭/二頭を直接鍛え、肩・腕・腹筋の見栄えを強化する']

export const START_STATS = '開始値（体組成計）: 88.3kg / BMI 26.4 / 体脂肪率14.7% / 除脂肪体重75.3kg / 筋肉量71.6kg。BIAは水分等で変動するためトレンド用。'

export const START_WEIGHT = 88.3

export const WEEKLY_LOSS = 0.25

export const GOAL_BAND = '85〜86kg前後'

export const REVIEW_HEAD = '目標は体重の数字だけではなく、腹囲・見た目・CrossFit出力・Run/Burpeeの失速を同時に確認すること。'

export const TOP_RULES: string[] = [
  '朝CrossFitが高負荷（大量Run / Burpee / Squat系 / Oly高ボリューム / RPE9-10）なら、その日の夜Run・Burpeeは中止',
  '夜トレは原則45〜50分以内。22:00就寝を削ってまで追加セットをしない',
  '金曜は完全レスト。土日両方CrossFitをする週は土曜のBodymake補助を削除',
  '痛み・睡眠悪化・2〜3セッション連続の出力低下があれば、夜セッションを1回飛ばす',
]

export const WEEKLY_CHECKS: string[] = [
  '体重は毎朝（起床→トイレ→飲食前）に測り、日々の値ではなく7日平均を見る',
  '週1〜2回、朝のへそ周囲を測定。同条件の正面/横写真も残す',
  '2週間平均体重が動かなければ−150〜200kcal/日。週−0.8kg級＋WOD低下なら200〜300kcal戻す',
  '体組成計の体脂肪率は推定値。絶対値より同条件での推移を使う',
]

export const ADJUST_RULES: string[] = [
  '2週間の7日平均体重がほぼ不変 → 1日150〜200kcal削減（主に炭水化物30〜40g or 脂質10〜15g）',
  '1週間で約0.8kg以上落ち、WOD/睡眠/回復が悪化 → 200〜300kcal戻す',
  'Proteinは原則190〜200gを固定。減量時も先にProteinを削らない',
  'トレ終了から夕食まで90分以上空く場合のみ、ホエイ20〜30g＋バナナ等を挟む',
]

export const REVIEW_CHECKS: string[] = [
  '7日平均体重と腹囲は下がったか（目標は体重だけでなくウエストの変化）',
  'CrossFitの主要Lift / Gymnastics / WOD出力は維持〜向上したか',
  '400〜500m反復の最速-最遅の差は小さくなったか',
  'Burpeeの一定本数/EMOMでcycle timeの失速が減ったか',
  '腹筋・肩・腕の見た目が改善したか（同条件写真で比較）',
  '睡眠7h以上を守れたか。痛み・慢性疲労がないか',
]

export const WEEKS: WeekPlan[] = [
  { week: 1, period: '8/13-8/19', phase: '導入', easy: '30-35分 + Stride×4', burpee: 'EMOM 6分 ×4-5/分', quality: 'Threshold 2×8\' / Jog 2\'', aim: '失速を減らす/走効率', note: '', targetWeight: 88.05 },
  { week: 2, period: '8/20-8/26', phase: '導入', easy: '30-35分 + Stride×4', burpee: 'EMOM 6分 ×4-5/分', quality: 'Threshold 2×8\' / Jog 2\'', aim: '失速を減らす/走効率', note: '', targetWeight: 87.8 },
  { week: 3, period: '8/27-9/2', phase: 'Build 1', easy: '35-40分 + Stride×4-6', burpee: 'EMOM 6分 ×5-6/分', quality: 'Threshold 3×8\' / Jog 2\'', aim: '失速を減らす/走効率', note: '', targetWeight: 87.55 },
  { week: 4, period: '9/3-9/9', phase: 'Build 1', easy: '35-40分 + Stride×4-6', burpee: 'EMOM 6分 ×5-6/分', quality: '4R: 400m + Burpee×8 / 各R 90秒休憩', aim: '失速を減らす/走効率', note: '', targetWeight: 87.3 },
  { week: 5, period: '9/10-9/16', phase: 'Build 2', easy: '40-45分 + Stride×6', burpee: 'EMOM 8分 ×5-7/分', quality: 'Threshold 3×8-10\' / Jog 2\'', aim: '失速を減らす/走効率', note: '', targetWeight: 87.05 },
  { week: 6, period: '9/17-9/23', phase: 'Build 2', easy: '40-45分 + Stride×6', burpee: 'EMOM 8分 ×5-7/分', quality: '5R: 400m + Burpee×8-10 / 各R 90秒休憩', aim: '失速を減らす/走効率', note: '', targetWeight: 86.8 },
  { week: 7, period: '9/24-9/30', phase: '効率化', easy: '40-45分 + Stride×6', burpee: 'EMOM 8分・一定テンポ', quality: 'Threshold 3×10\' / 同ペース維持', aim: '失速を減らす/走効率', note: '', targetWeight: 86.55 },
  { week: 8, period: '10/1-10/7', phase: '効率化', easy: '40-45分 + Stride×6', burpee: 'EMOM 8分・一定テンポ', quality: 'Benchmark: 2km TT または / Burpee 30rep（どちらか）', aim: '失速を減らす/走効率', note: 'Benchmarkはどちらか1つ', targetWeight: 86.3 },
  { week: 9, period: '10/8-10/14', phase: '定着', easy: '40-45分 + Stride×6', burpee: 'EMOM 8分・一定テンポ', quality: 'Threshold 3×10\' / W7より微増', aim: '失速を減らす/走効率', note: '', targetWeight: 86.05 },
  { week: 10, period: '10/15-10/21', phase: '定着', easy: '40-45分 + Stride×6', burpee: 'EMOM 8分・一定テンポ', quality: '5R: 400m + Burpee×10 / 最速-最遅≤5秒目標', aim: '失速を減らす/走効率', note: '', targetWeight: 85.8 },
  { week: 11, period: '10/22-10/28', phase: '定着', easy: '40-45分 + Stride×6', burpee: 'EMOM 8分・一定テンポ', quality: 'Threshold 2×12\' / 余裕を残して完遂', aim: '失速を減らす/走効率', note: '', targetWeight: 85.55 },
  { week: 12, period: '10/29-11/4', phase: 'Deload/Test', easy: '30-35分 + Stride×4', burpee: '軽め/省略', quality: 'Deload/Test: 2km TT または / 5R Benchmark（どちらか）', aim: '失速を減らす/走効率', note: 'W12は補助セット30-40%減', targetWeight: 85.3 },
]

export const DAYS: PlanDay[] = [
  { date: '2026-08-13', dow: '木', week: 1, phase: '導入', am: 'CrossFit', pm: 'Threshold 2×8\' / Jog 2\'', meal: '食A', note: '重WODなら夜中止', kind: 'quality' },
  { date: '2026-08-14', dow: '金', week: 1, phase: '導入', am: '完全休養', pm: '散歩/軽いMobilityのみ', meal: '食C', note: '睡眠優先', kind: 'restday' },
  { date: '2026-08-15', dow: '土', week: 1, phase: '導入', am: 'CrossFit', pm: '上半身Bodymake 30-35\' / ※元気な時のみ', meal: '食A/食B', note: '重い上半身WODなら省略', kind: 'optional' },
  { date: '2026-08-16', dow: '日', week: 1, phase: '導入', am: '休養 / Zone2 / CrossFit', pm: '追加トレなし', meal: '食C/食B', note: '土日CFなら土曜補助削除', kind: 'weekend' },
  { date: '2026-08-17', dow: '月', week: 1, phase: '導入', am: 'CrossFit', pm: '肩・三頭・腹 40-45\'', meal: '食A', note: 'RIR1-3', kind: 'shoulder' },
  { date: '2026-08-18', dow: '火', week: 1, phase: '導入', am: 'CrossFit', pm: 'Easy 30-35\' + Stride×4 / Burpee EMOM 6\'×4-5/分', meal: '食A', note: '重WODなら夜中止', kind: 'easyrun' },
  { date: '2026-08-19', dow: '水', week: 1, phase: '導入', am: 'CrossFit', pm: '背中・二頭・腹 40-50\'', meal: '食A', note: 'RIR1-3', kind: 'back' },
  { date: '2026-08-20', dow: '木', week: 2, phase: '導入', am: 'CrossFit', pm: 'Threshold 2×8\' / Jog 2\'', meal: '食A', note: '重WODなら夜中止', kind: 'quality' },
  { date: '2026-08-21', dow: '金', week: 2, phase: '導入', am: '完全休養', pm: '散歩/軽いMobilityのみ', meal: '食C', note: '睡眠優先', kind: 'restday' },
  { date: '2026-08-22', dow: '土', week: 2, phase: '導入', am: 'CrossFit', pm: '上半身Bodymake 30-35\' / ※元気な時のみ', meal: '食A/食B', note: '重い上半身WODなら省略', kind: 'optional' },
  { date: '2026-08-23', dow: '日', week: 2, phase: '導入', am: '休養 / Zone2 / CrossFit', pm: '追加トレなし', meal: '食C/食B', note: '土日CFなら土曜補助削除', kind: 'weekend' },
  { date: '2026-08-24', dow: '月', week: 2, phase: '導入', am: 'CrossFit', pm: '肩・三頭・腹 40-45\'', meal: '食A', note: 'RIR1-3', kind: 'shoulder' },
  { date: '2026-08-25', dow: '火', week: 2, phase: '導入', am: 'CrossFit', pm: 'Easy 30-35\' + Stride×4 / Burpee EMOM 6\'×4-5/分', meal: '食A', note: '重WODなら夜中止', kind: 'easyrun' },
  { date: '2026-08-26', dow: '水', week: 2, phase: '導入', am: 'CrossFit', pm: '背中・二頭・腹 40-50\'', meal: '食A', note: 'RIR1-3', kind: 'back' },
  { date: '2026-08-27', dow: '木', week: 3, phase: 'Build 1', am: 'CrossFit', pm: 'Threshold 3×8\' / Jog 2\'', meal: '食A', note: '重WODなら夜中止', kind: 'quality' },
  { date: '2026-08-28', dow: '金', week: 3, phase: 'Build 1', am: '完全休養', pm: '散歩/軽いMobilityのみ', meal: '食C', note: '睡眠優先', kind: 'restday' },
  { date: '2026-08-29', dow: '土', week: 3, phase: 'Build 1', am: 'CrossFit', pm: '上半身Bodymake 30-35\' / ※元気な時のみ', meal: '食A/食B', note: '重い上半身WODなら省略', kind: 'optional' },
  { date: '2026-08-30', dow: '日', week: 3, phase: 'Build 1', am: '休養 / Zone2 / CrossFit', pm: '追加トレなし', meal: '食C/食B', note: '土日CFなら土曜補助削除', kind: 'weekend' },
  { date: '2026-08-31', dow: '月', week: 3, phase: 'Build 1', am: 'CrossFit', pm: '肩・三頭・腹 40-45\'', meal: '食A', note: 'RIR1-3', kind: 'shoulder' },
  { date: '2026-09-01', dow: '火', week: 3, phase: 'Build 1', am: 'CrossFit', pm: 'Easy 35-40\' + Stride×4-6 / Burpee EMOM 6\'×5-6/分', meal: '食A', note: '重WODなら夜中止', kind: 'easyrun' },
  { date: '2026-09-02', dow: '水', week: 3, phase: 'Build 1', am: 'CrossFit', pm: '背中・二頭・腹 40-50\'', meal: '食A', note: 'RIR1-3', kind: 'back' },
  { date: '2026-09-03', dow: '木', week: 4, phase: 'Build 1', am: 'CrossFit', pm: '4R: 400m + Burpee×8 / 各R 90秒休憩', meal: '食A', note: '重WODなら夜中止', kind: 'quality' },
  { date: '2026-09-04', dow: '金', week: 4, phase: 'Build 1', am: '完全休養', pm: '散歩/軽いMobilityのみ', meal: '食C', note: '睡眠優先', kind: 'restday' },
  { date: '2026-09-05', dow: '土', week: 4, phase: 'Build 1', am: 'CrossFit', pm: '上半身Bodymake 30-35\' / ※元気な時のみ', meal: '食A/食B', note: '重い上半身WODなら省略', kind: 'optional' },
  { date: '2026-09-06', dow: '日', week: 4, phase: 'Build 1', am: '休養 / Zone2 / CrossFit', pm: '追加トレなし', meal: '食C/食B', note: '土日CFなら土曜補助削除', kind: 'weekend' },
  { date: '2026-09-07', dow: '月', week: 4, phase: 'Build 1', am: 'CrossFit', pm: '肩・三頭・腹 40-45\'', meal: '食A', note: 'RIR1-3', kind: 'shoulder' },
  { date: '2026-09-08', dow: '火', week: 4, phase: 'Build 1', am: 'CrossFit', pm: 'Easy 35-40\' + Stride×4-6 / Burpee EMOM 6\'×5-6/分', meal: '食A', note: '重WODなら夜中止', kind: 'easyrun' },
  { date: '2026-09-09', dow: '水', week: 4, phase: 'Build 1', am: 'CrossFit', pm: '背中・二頭・腹 40-50\'', meal: '食A', note: 'RIR1-3', kind: 'back' },
  { date: '2026-09-10', dow: '木', week: 5, phase: 'Build 2', am: 'CrossFit', pm: 'Threshold 3×8-10\' / Jog 2\'', meal: '食A', note: '重WODなら夜中止', kind: 'quality' },
  { date: '2026-09-11', dow: '金', week: 5, phase: 'Build 2', am: '完全休養', pm: '散歩/軽いMobilityのみ', meal: '食C', note: '睡眠優先', kind: 'restday' },
  { date: '2026-09-12', dow: '土', week: 5, phase: 'Build 2', am: 'CrossFit', pm: '上半身Bodymake 30-35\' / ※元気な時のみ', meal: '食A/食B', note: '重い上半身WODなら省略', kind: 'optional' },
  { date: '2026-09-13', dow: '日', week: 5, phase: 'Build 2', am: '休養 / Zone2 / CrossFit', pm: '追加トレなし', meal: '食C/食B', note: '土日CFなら土曜補助削除', kind: 'weekend' },
  { date: '2026-09-14', dow: '月', week: 5, phase: 'Build 2', am: 'CrossFit', pm: '肩・三頭・腹 40-45\'', meal: '食A', note: 'RIR1-3', kind: 'shoulder' },
  { date: '2026-09-15', dow: '火', week: 5, phase: 'Build 2', am: 'CrossFit', pm: 'Easy 40-45\' + Stride×6 / Burpee EMOM 8\'×5-7/分', meal: '食A', note: '重WODなら夜中止', kind: 'easyrun' },
  { date: '2026-09-16', dow: '水', week: 5, phase: 'Build 2', am: 'CrossFit', pm: '背中・二頭・腹 40-50\'', meal: '食A', note: 'RIR1-3', kind: 'back' },
  { date: '2026-09-17', dow: '木', week: 6, phase: 'Build 2', am: 'CrossFit', pm: '5R: 400m + Burpee×8-10 / 各R 90秒休憩', meal: '食A', note: '重WODなら夜中止', kind: 'quality' },
  { date: '2026-09-18', dow: '金', week: 6, phase: 'Build 2', am: '完全休養', pm: '散歩/軽いMobilityのみ', meal: '食C', note: '睡眠優先', kind: 'restday' },
  { date: '2026-09-19', dow: '土', week: 6, phase: 'Build 2', am: 'CrossFit', pm: '上半身Bodymake 30-35\' / ※元気な時のみ', meal: '食A/食B', note: '重い上半身WODなら省略', kind: 'optional' },
  { date: '2026-09-20', dow: '日', week: 6, phase: 'Build 2', am: '休養 / Zone2 / CrossFit', pm: '追加トレなし', meal: '食C/食B', note: '土日CFなら土曜補助削除', kind: 'weekend' },
  { date: '2026-09-21', dow: '月', week: 6, phase: 'Build 2', am: 'CrossFit', pm: '肩・三頭・腹 40-45\'', meal: '食A', note: 'RIR1-3', kind: 'shoulder' },
  { date: '2026-09-22', dow: '火', week: 6, phase: 'Build 2', am: 'CrossFit', pm: 'Easy 40-45\' + Stride×6 / Burpee EMOM 8\'×5-7/分', meal: '食A', note: '重WODなら夜中止', kind: 'easyrun' },
  { date: '2026-09-23', dow: '水', week: 6, phase: 'Build 2', am: 'CrossFit', pm: '背中・二頭・腹 40-50\'', meal: '食A', note: 'RIR1-3', kind: 'back' },
  { date: '2026-09-24', dow: '木', week: 7, phase: '効率化', am: 'CrossFit', pm: 'Threshold 3×10\' / 同ペース維持', meal: '食A', note: '重WODなら夜中止', kind: 'quality' },
  { date: '2026-09-25', dow: '金', week: 7, phase: '効率化', am: '完全休養', pm: '散歩/軽いMobilityのみ', meal: '食C', note: '睡眠優先', kind: 'restday' },
  { date: '2026-09-26', dow: '土', week: 7, phase: '効率化', am: 'CrossFit', pm: '上半身Bodymake 30-35\' / ※元気な時のみ', meal: '食A/食B', note: '重い上半身WODなら省略', kind: 'optional' },
  { date: '2026-09-27', dow: '日', week: 7, phase: '効率化', am: '休養 / Zone2 / CrossFit', pm: '追加トレなし', meal: '食C/食B', note: '土日CFなら土曜補助削除', kind: 'weekend' },
  { date: '2026-09-28', dow: '月', week: 7, phase: '効率化', am: 'CrossFit', pm: '肩・三頭・腹 40-45\'', meal: '食A', note: 'RIR1-3', kind: 'shoulder' },
  { date: '2026-09-29', dow: '火', week: 7, phase: '効率化', am: 'CrossFit', pm: 'Easy 40-45\' + Stride×6 / Burpee EMOM 8\'・一定テンポ', meal: '食A', note: '重WODなら夜中止', kind: 'easyrun' },
  { date: '2026-09-30', dow: '水', week: 7, phase: '効率化', am: 'CrossFit', pm: '背中・二頭・腹 40-50\'', meal: '食A', note: 'RIR1-3', kind: 'back' },
  { date: '2026-10-01', dow: '木', week: 8, phase: '効率化', am: 'CrossFit', pm: 'Benchmark: 2km TT または / Burpee 30rep（どちらか）', meal: '食A', note: '重WODなら夜中止', kind: 'quality' },
  { date: '2026-10-02', dow: '金', week: 8, phase: '効率化', am: '完全休養', pm: '散歩/軽いMobilityのみ', meal: '食C', note: '睡眠優先', kind: 'restday' },
  { date: '2026-10-03', dow: '土', week: 8, phase: '効率化', am: 'CrossFit', pm: '上半身Bodymake 30-35\' / ※元気な時のみ', meal: '食A/食B', note: '重い上半身WODなら省略', kind: 'optional' },
  { date: '2026-10-04', dow: '日', week: 8, phase: '効率化', am: '休養 / Zone2 / CrossFit', pm: '追加トレなし', meal: '食C/食B', note: '土日CFなら土曜補助削除', kind: 'weekend' },
  { date: '2026-10-05', dow: '月', week: 8, phase: '効率化', am: 'CrossFit', pm: '肩・三頭・腹 40-45\'', meal: '食A', note: 'RIR1-3', kind: 'shoulder' },
  { date: '2026-10-06', dow: '火', week: 8, phase: '効率化', am: 'CrossFit', pm: 'Easy 40-45\' + Stride×6 / Burpee EMOM 8\'・一定テンポ', meal: '食A', note: '重WODなら夜中止', kind: 'easyrun' },
  { date: '2026-10-07', dow: '水', week: 8, phase: '効率化', am: 'CrossFit', pm: '背中・二頭・腹 40-50\'', meal: '食A', note: 'RIR1-3', kind: 'back' },
  { date: '2026-10-08', dow: '木', week: 9, phase: '定着', am: 'CrossFit', pm: 'Threshold 3×10\' / W7より微増', meal: '食A', note: '重WODなら夜中止', kind: 'quality' },
  { date: '2026-10-09', dow: '金', week: 9, phase: '定着', am: '完全休養', pm: '散歩/軽いMobilityのみ', meal: '食C', note: '睡眠優先', kind: 'restday' },
  { date: '2026-10-10', dow: '土', week: 9, phase: '定着', am: 'CrossFit', pm: '上半身Bodymake 30-35\' / ※元気な時のみ', meal: '食A/食B', note: '重い上半身WODなら省略', kind: 'optional' },
  { date: '2026-10-11', dow: '日', week: 9, phase: '定着', am: '休養 / Zone2 / CrossFit', pm: '追加トレなし', meal: '食C/食B', note: '土日CFなら土曜補助削除', kind: 'weekend' },
  { date: '2026-10-12', dow: '月', week: 9, phase: '定着', am: 'CrossFit', pm: '肩・三頭・腹 40-45\'', meal: '食A', note: 'RIR1-3', kind: 'shoulder' },
  { date: '2026-10-13', dow: '火', week: 9, phase: '定着', am: 'CrossFit', pm: 'Easy 40-45\' + Stride×6 / Burpee EMOM 8\'・一定テンポ', meal: '食A', note: '重WODなら夜中止', kind: 'easyrun' },
  { date: '2026-10-14', dow: '水', week: 9, phase: '定着', am: 'CrossFit', pm: '背中・二頭・腹 40-50\'', meal: '食A', note: 'RIR1-3', kind: 'back' },
  { date: '2026-10-15', dow: '木', week: 10, phase: '定着', am: 'CrossFit', pm: '5R: 400m + Burpee×10 / 最速-最遅≤5秒目標', meal: '食A', note: '重WODなら夜中止', kind: 'quality' },
  { date: '2026-10-16', dow: '金', week: 10, phase: '定着', am: '完全休養', pm: '散歩/軽いMobilityのみ', meal: '食C', note: '睡眠優先', kind: 'restday' },
  { date: '2026-10-17', dow: '土', week: 10, phase: '定着', am: 'CrossFit', pm: '上半身Bodymake 30-35\' / ※元気な時のみ', meal: '食A/食B', note: '重い上半身WODなら省略', kind: 'optional' },
  { date: '2026-10-18', dow: '日', week: 10, phase: '定着', am: '休養 / Zone2 / CrossFit', pm: '追加トレなし', meal: '食C/食B', note: '土日CFなら土曜補助削除', kind: 'weekend' },
  { date: '2026-10-19', dow: '月', week: 10, phase: '定着', am: 'CrossFit', pm: '肩・三頭・腹 40-45\'', meal: '食A', note: 'RIR1-3', kind: 'shoulder' },
  { date: '2026-10-20', dow: '火', week: 10, phase: '定着', am: 'CrossFit', pm: 'Easy 40-45\' + Stride×6 / Burpee EMOM 8\'・一定テンポ', meal: '食A', note: '重WODなら夜中止', kind: 'easyrun' },
  { date: '2026-10-21', dow: '水', week: 10, phase: '定着', am: 'CrossFit', pm: '背中・二頭・腹 40-50\'', meal: '食A', note: 'RIR1-3', kind: 'back' },
  { date: '2026-10-22', dow: '木', week: 11, phase: '定着', am: 'CrossFit', pm: 'Threshold 2×12\' / 余裕を残して完遂', meal: '食A', note: '重WODなら夜中止', kind: 'quality' },
  { date: '2026-10-23', dow: '金', week: 11, phase: '定着', am: '完全休養', pm: '散歩/軽いMobilityのみ', meal: '食C', note: '睡眠優先', kind: 'restday' },
  { date: '2026-10-24', dow: '土', week: 11, phase: '定着', am: 'CrossFit', pm: '上半身Bodymake 30-35\' / ※元気な時のみ', meal: '食A/食B', note: '重い上半身WODなら省略', kind: 'optional' },
  { date: '2026-10-25', dow: '日', week: 11, phase: '定着', am: '休養 / Zone2 / CrossFit', pm: '追加トレなし', meal: '食C/食B', note: '土日CFなら土曜補助削除', kind: 'weekend' },
  { date: '2026-10-26', dow: '月', week: 11, phase: '定着', am: 'CrossFit', pm: '肩・三頭・腹 40-45\'', meal: '食A', note: 'RIR1-3', kind: 'shoulder' },
  { date: '2026-10-27', dow: '火', week: 11, phase: '定着', am: 'CrossFit', pm: 'Easy 40-45\' + Stride×6 / Burpee EMOM 8\'・一定テンポ', meal: '食A', note: '重WODなら夜中止', kind: 'easyrun' },
  { date: '2026-10-28', dow: '水', week: 11, phase: '定着', am: 'CrossFit', pm: '背中・二頭・腹 40-50\'', meal: '食A', note: 'RIR1-3', kind: 'back' },
  { date: '2026-10-29', dow: '木', week: 12, phase: 'Deload/Test', am: 'CrossFit', pm: 'Deload/Test: 2km TT または / 5R Benchmark（どちらか）', meal: '食A', note: '重WODなら夜中止', kind: 'quality' },
  { date: '2026-10-30', dow: '金', week: 12, phase: 'Deload/Test', am: '完全休養', pm: '散歩/軽いMobilityのみ', meal: '食C', note: '睡眠優先', kind: 'restday' },
  { date: '2026-10-31', dow: '土', week: 12, phase: 'Deload/Test', am: 'CrossFit', pm: '上半身Bodymake 30-35\' / ※元気な時のみ', meal: '食A/食B', note: '重い上半身WODなら省略', kind: 'optional' },
  { date: '2026-11-01', dow: '日', week: 12, phase: 'Deload/Test', am: '休養 / Zone2 / CrossFit', pm: '追加トレなし', meal: '食C/食B', note: '土日CFなら土曜補助削除', kind: 'weekend' },
  { date: '2026-11-02', dow: '月', week: 12, phase: 'Deload/Test', am: 'CrossFit', pm: '肩・三頭・腹 40-45\' / セット30-40%減', meal: '食A', note: 'RIR1-3', kind: 'shoulder' },
  { date: '2026-11-03', dow: '火', week: 12, phase: 'Deload/Test', am: 'CrossFit', pm: 'Easy 30-35\' + Stride×4 / Burpeeは省略/軽め', meal: '食A', note: '重WODなら夜中止', kind: 'easyrun' },
  { date: '2026-11-04', dow: '水', week: 12, phase: 'Deload/Test', am: 'CrossFit', pm: '背中・二頭・腹 40-50\' / セット30-40%減', meal: '食A', note: 'RIR1-3', kind: 'back' },
  { date: '2026-11-05', dow: '木', week: 13, phase: '★12週後', am: '—', pm: '12週レビュー / 体重・腹囲・写真・WOD・Run・Burpee', meal: '食B/食C', note: '次の12週を再設定', kind: 'review' },
]

export const EXERCISES: Record<'shoulder' | 'back' | 'optional' | 'easyrun' | 'quality', Exercise[]> = {
  shoulder: [
    { name: 'Cable Lateral Raise', sets: '4', reps: '12-20', intensity: 'RIR1-3', aim: '肩幅/サイドデルタ', caution: '朝に大量HSPU/肩高負荷なら2-3setへ', memo: '反動を抑える' },
    { name: 'Machine Lateral Raise', sets: '2', reps: '15-20', intensity: 'RIR1-2', aim: '肩幅', caution: '同上', memo: '' },
    { name: 'Overhead Cable Triceps Ext.', sets: '3', reps: '10-15', intensity: 'RIR1-3', aim: '三頭長頭/腕の厚み', caution: '肘痛なら重量・種目変更', memo: '' },
    { name: 'Rope Pushdown', sets: '2', reps: '12-15', intensity: 'RIR1-2', aim: '三頭', caution: '肘痛なら省略', memo: '' },
    { name: 'Cable Crunch', sets: '4', reps: '8-12', intensity: 'RIR1-2', aim: '腹直筋の厚み', caution: '腰痛が出るフォームは中止', memo: '12回揃ったら重量UP' },
  ],
  back: [
    { name: 'Lat Pulldown', sets: '3', reps: '8-12', intensity: 'RIR1-3', aim: 'V taper/広背筋', caution: 'Pull-up大量WODなら2set', memo: '' },
    { name: 'Chest Supported Row', sets: '3', reps: '8-12', intensity: 'RIR1-3', aim: '背中の厚み', caution: 'Pull系高ボリュームなら2set', memo: '腰の疲労を避ける' },
    { name: 'Incline DB Curl', sets: '3', reps: '8-12', intensity: 'RIR1-2', aim: '上腕二頭筋', caution: '肘/前腕の痛みなら省略', memo: '' },
    { name: 'Hammer Curl', sets: '2', reps: '10-15', intensity: 'RIR1-2', aim: '上腕筋/腕橈骨筋', caution: '同上', memo: '腕のゴツさ' },
    { name: 'Lateral Raise', sets: '2', reps: '15-20', intensity: 'RIR1-2', aim: 'サイドデルタ', caution: '肩疲労強ければ省略', memo: '' },
    { name: 'Hanging Leg Raise', sets: '3', reps: '8-15', intensity: 'RIR1-2', aim: '腹直筋/骨盤後傾', caution: 'Grip疲労大なら別種目', memo: '最後に骨盤を巻く' },
    { name: 'Ab Wheel（任意）', sets: '2', reps: '8-12', intensity: '余裕残す', aim: '腹筋/体幹', caution: '腰が反るなら中止', memo: '' },
  ],
  optional: [
    { name: 'Incline Machine Press', sets: '3', reps: '8-12', intensity: 'RIR1-3', aim: '上胸', caution: '上半身高負荷WODなら全補助中止', memo: '30-35分で終了' },
    { name: 'Lateral Raise', sets: '3', reps: '12-20', intensity: 'RIR1-2', aim: '肩幅', caution: '同上', memo: '' },
    { name: 'Preacher Curl', sets: '2', reps: '10-15', intensity: 'RIR1-2', aim: '二頭', caution: '同上', memo: '' },
    { name: 'Overhead Triceps Ext.', sets: '2', reps: '10-15', intensity: 'RIR1-2', aim: '三頭', caution: '同上', memo: '' },
    { name: 'Ab Wheel', sets: '3', reps: '8-12', intensity: 'RIR1-2', aim: '腹筋', caution: '腰痛なら省略', memo: '' },
  ],
  easyrun: [
    { name: 'Easy Run', sets: '週進行', reps: '30-45分', intensity: 'RPE3-4', aim: 'Running economy', caution: '朝Run/Burpee高負荷なら中止/短縮', memo: '会話可能ペース' },
    { name: 'Stride', sets: '4-6', reps: '15秒', intensity: '80-90%', aim: 'フォーム/脚の反発', caution: '痛み・張りなら省略', memo: '各本60-90秒歩く' },
    { name: 'Burpee EMOM', sets: '6-8分', reps: '4-7/分', intensity: '20-30秒余る', aim: '動作効率', caution: '朝Burpee多ければ中止', memo: '心肺追込みではなく技術' },
  ],
  quality: [
    { name: 'Threshold / 400m+Burpee', sets: '週進行', reps: '別表参照', intensity: 'RPE7前後', aim: '閾値/反復耐性', caution: '大量Run/Burpee/Squat/Oly/RPE9-10なら中止', memo: '1本目から飛ばさない' },
  ],
}

/** 補助トレをやる場所。Jexer はマシン・ケーブルあり、家ジムは自宅の器具のみ */
export type GymLocation = 'jexer' | 'home'

export const HOME_EQUIPMENT =
  'ダンベル・アジャスタブルベンチ・チェストプレスマシン・バイク・ランニングマシン・エリプティカル・バランスボール'

/**
 * 家ジム版の補助トレ。ケーブル・専用マシン・懸垂バーを使う種目を、
 * 自宅にある器具だけで同じ狙いになるよう置き換えている。
 * Run系 (easyrun / quality) は場所で内容が変わらないので同じ配列を参照する。
 */
export const EXERCISES_HOME: typeof EXERCISES = {
  shoulder: [
    { name: 'DB Lateral Raise', sets: '4', reps: '12-20', intensity: 'RIR1-3', aim: '肩幅/サイドデルタ', caution: '朝に大量HSPU/肩高負荷なら2-3setへ', memo: '反動を抑える' },
    { name: 'Seated DB Lateral Raise', sets: '2', reps: '15-20', intensity: 'RIR1-2', aim: '肩幅', caution: '同上', memo: 'ベンチに座って反動を消す' },
    { name: 'DB Overhead Triceps Ext.', sets: '3', reps: '10-15', intensity: 'RIR1-3', aim: '三頭長頭/腕の厚み', caution: '肘痛なら重量・種目変更', memo: '両手でダンベル1本を持つ' },
    { name: 'Bench Dips', sets: '2', reps: '12-15', intensity: 'RIR1-2', aim: '三頭', caution: '肘・肩前面の痛みなら省略', memo: '足を遠くに置くほど強度UP' },
    { name: 'Weighted Ball Crunch', sets: '4', reps: '8-12', intensity: 'RIR1-2', aim: '腹直筋の厚み', caution: '腰痛が出るフォームは中止', memo: 'バランスボールでDBを胸に抱える。12回揃ったら重量UP' },
  ],
  back: [
    { name: 'One-arm DB Row', sets: '3', reps: '8-12', intensity: 'RIR1-3', aim: 'V taper/広背筋', caution: 'Pull-up大量WODなら2set', memo: 'ベンチに手と膝をつく。左右各' },
    { name: 'Chest Supported DB Row', sets: '3', reps: '8-12', intensity: 'RIR1-3', aim: '背中の厚み', caution: 'Pull系高ボリュームなら2set', memo: 'インクラインベンチにうつ伏せ。腰の疲労を避ける' },
    { name: 'Incline DB Curl', sets: '3', reps: '8-12', intensity: 'RIR1-2', aim: '上腕二頭筋', caution: '肘/前腕の痛みなら省略', memo: '' },
    { name: 'Hammer Curl', sets: '2', reps: '10-15', intensity: 'RIR1-2', aim: '上腕筋/腕橈骨筋', caution: '同上', memo: '腕のゴツさ' },
    { name: 'DB Lateral Raise', sets: '2', reps: '15-20', intensity: 'RIR1-2', aim: 'サイドデルタ', caution: '肩疲労強ければ省略', memo: '' },
    { name: 'Lying Leg Raise', sets: '3', reps: '10-15', intensity: 'RIR1-2', aim: '腹直筋/骨盤後傾', caution: '腰が反るなら膝を曲げる', memo: 'ベンチか床で。最後に骨盤を巻く' },
    { name: 'Ball Rollout（任意）', sets: '2', reps: '8-12', intensity: '余裕残す', aim: '腹筋/体幹', caution: '腰が反るなら中止', memo: 'バランスボールに前腕を乗せて転がす' },
  ],
  optional: [
    { name: 'Incline DB Press', sets: '3', reps: '8-12', intensity: 'RIR1-3', aim: '上胸', caution: '上半身高負荷WODなら全補助中止', memo: '30-35分で終了。チェストプレスマシンでも可' },
    { name: 'DB Lateral Raise', sets: '3', reps: '12-20', intensity: 'RIR1-2', aim: '肩幅', caution: '同上', memo: '' },
    { name: 'Concentration Curl', sets: '2', reps: '10-15', intensity: 'RIR1-2', aim: '二頭', caution: '同上', memo: '' },
    { name: 'DB Overhead Triceps Ext.', sets: '2', reps: '10-15', intensity: 'RIR1-2', aim: '三頭', caution: '同上', memo: '' },
    { name: 'Ball Rollout', sets: '3', reps: '8-12', intensity: 'RIR1-2', aim: '腹筋', caution: '腰痛なら省略', memo: 'バランスボールで' },
  ],
  easyrun: EXERCISES.easyrun,
  quality: EXERCISES.quality,
}

export const MEALS: Record<string, MealPattern> = {
  '食A': {
    target: '2部練/ハード日',
    items: [
      { time: '05:00', food: '水400-600ml / コーヒー任意', p: '—', c: '—', f: '—', point: '起床。カフェインは必要時のみ' },
      { time: '05:30', food: 'おにぎり1 + バナナ1 + ホエイ25g', p: '20-25g', c: '50-70g', f: '低め', point: '朝CF前。脂質・食物繊維を増やしすぎない' },
      { time: '08:15', food: '白米250-300g + 肉/魚150-180g + 卵1 + 納豆 + 果物 + 味噌汁', p: '45-55g', c: '100-120g', f: '15-20g', point: '朝CF後の大きい食事' },
      { time: '12:00', food: '白米250-300g + 肉/魚180-200g + 野菜 + 味噌汁', p: '40-50g', c: '90-110g', f: '10-20g', point: '昼食' },
      { time: '16:00', food: 'ギリシャヨーグルト+果物 / ホエイ+バナナ', p: '25-35g', c: '30-50g', f: '低め', point: '午後の補食' },
      { time: '17:30-18:00', food: '夕食①: おにぎり2 + サラダチキン/ホエイ または 白米200g+鶏100-150g', p: '25-35g', c: '60-80g', f: '低め', point: '夜トレ用。ここを抜かない' },
      { time: '20:30-21:00', food: 'Jexer風呂後 夕食②: 白米200-250g + 鶏/白身魚/牛赤身180-200g + 温野菜 + スープ', p: '40-50g', c: '65-90g', f: '10-20g', point: '寝る直前の脂っこい食事は避ける' },
    ],
    total: { time: '1日合計', food: '3,050〜3,150 kcal', p: '190-200g', c: '390-430g', f: '70-80g', point: '夜PMを中止したら食Bへ', kcal: '3,050〜3,150 kcal' },
  },
  '食B': {
    target: 'CrossFitのみ',
    items: [
      { time: '05:30〜昼', food: '朝CF前〜昼は食Aと同様', p: '—', c: '—', f: '—', point: '朝の出力は落とさない' },
      { time: '16:00', food: 'ヨーグルト+果物 / ホエイ+バナナ', p: '25-35g', c: '30-50g', f: '低め', point: '' },
      { time: '夕方〜夜', food: '夕食①は無し〜軽め。夕食は白米200-250g + 高タンパク主菜 + 野菜', p: '40-50g', c: '60-90g', f: '15-25g', point: '食Aより主に炭水化物を減らす' },
    ],
    total: { time: '1日合計', food: '2,900〜3,000 kcal', p: '190-200g', c: '340-380g', f: '70-80g', point: '', kcal: '2,900〜3,000 kcal' },
  },
  '食C': {
    target: '完全休養',
    items: [
      { time: '朝〜昼', food: 'Proteinは維持。白米量を少し減らし、野菜/主菜は維持', p: '—', c: '—', f: '—', point: '極端な低糖質にしない' },
      { time: '夜', food: '白米150-250g + 肉/魚180-200g + 野菜/汁物', p: '40-50g', c: '50-80g', f: '15-25g', point: '翌日ハードなら夜の炭水化物は削りすぎない' },
    ],
    total: { time: '1日合計', food: '2,700〜2,800 kcal', p: '約190g', c: '260-320g', f: '75-80g', point: '金曜の基本', kcal: '2,700〜2,800 kcal' },
  },
}
