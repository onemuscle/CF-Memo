/**
 * データ項目の定義 (Webアプリ・API・CLI で共通)
 *
 * ここが「何を記録できるか」の唯一の定義です。
 * - Worker はこの定義で入力を検証し、許可された列だけを SQL に通す
 * - Web アプリはこの定義から入力フォームと一覧表示を組み立てる
 * - CLI (scripts/cfm.ts) はこの定義で引数を解釈する
 *
 * 項目を増やすときは、必ず
 *   1. migrations/ に新しい SQL を追加 (ALTER TABLE ... ADD COLUMN。既存の列は消さない)
 *   2. ここに field を追加
 *   3. npm test (schema と migration の食い違いを検出するテストがある)
 * の順で行う。列の削除・改名は既存データを壊すので行わない (docs/03-data-safety.md)。
 */

export type FieldType =
  | 'text' // 1行テキスト
  | 'longtext' // 複数行テキスト
  | 'int'
  | 'real'
  | 'bool'
  | 'date' // YYYY-MM-DD
  | 'time' // HH:MM
  | 'datetime' // ISO 8601
  | 'enum'
  | 'json' // 配列・オブジェクト (TEXT 列に JSON で保存)
  | 'ref' // 別エンティティの id

export interface FieldDef {
  name: string
  type: FieldType
  label: string
  unit?: string
  required?: boolean
  min?: number
  max?: number
  /** enum の選択肢 [値, 表示名] */
  options?: [string, string][]
  /** ref の参照先 */
  ref?: string
  /** 入力フォームで最初から表示する (それ以外は「詳細」に畳む) */
  primary?: boolean
  /** 入力欄のヒント */
  placeholder?: string
  /** サーバー側で計算する列 (入力は受け付けない) */
  computed?: boolean
}

export interface EntityDef {
  name: string
  table: string
  label: string
  /** 一覧の並び・期間絞り込みに使う日付列 */
  dateField?: string
  /** 一覧で見出しにする列 */
  titleFields: string[]
  /** 同じ値の行は1件にまとめる (例: 1日1件のコンディション) */
  uniqueBy?: string[]
  fields: FieldDef[]
  group: 'training' | 'endurance' | 'body' | 'recovery' | 'plan' | 'system'
}

const SOURCE: FieldDef = {
  name: 'source',
  type: 'enum',
  label: '入力元',
  options: [
    ['web', 'Web'],
    ['agent', 'Claude Code'],
    ['health', 'Apple Health'],
    ['import', 'インポート'],
    ['legacy', '旧CF MEMO'],
  ],
}
const NOTE: FieldDef = { name: 'note', type: 'longtext', label: 'メモ' }
const RPE: FieldDef = { name: 'rpe', type: 'real', label: 'RPE (きつさ)', min: 1, max: 10, placeholder: '1〜10' }
const MODALITY_OPTIONS: [string, string][] = [
  ['run', 'ラン'],
  ['bike', 'バイク'],
  ['row', 'ロウ'],
  ['ski', 'スキー'],
  ['swim', 'スイム'],
  ['walk', 'ウォーク'],
  ['other', 'その他'],
]

export const ENTITIES = {
  workouts: {
    name: 'workouts',
    table: 'workouts',
    label: 'トレーニング',
    group: 'training',
    dateField: 'date',
    titleFields: ['title', 'type'],
    fields: [
      { name: 'date', type: 'date', label: '日付', required: true, primary: true },
      {
        name: 'type',
        type: 'enum',
        label: '種類',
        required: true,
        primary: true,
        options: [
          ['crossfit', 'CrossFit (WOD)'],
          ['strength', '筋力'],
          ['accessory', '補助トレ'],
          ['cardio', '有酸素'],
          ['hyrox', 'HYROX練習'],
          ['skill', 'スキル練習'],
          ['mobility', 'モビリティ'],
          ['other', 'その他'],
        ],
      },
      { name: 'time_of_day', type: 'enum', label: '時間帯', options: [['am', '朝'], ['noon', '昼'], ['pm', '夜']] },
      { name: 'title', type: 'text', label: 'タイトル', primary: true, placeholder: 'Fran / 胸・三頭 など' },
      { name: 'format', type: 'text', label: '形式', placeholder: 'AMRAP 12 / For Time / EMOM 10' },
      { name: 'description', type: 'longtext', label: '内容 (WOD)', primary: true, placeholder: '21-15-9 Thruster 43kg / Pull-up' },
      { name: 'result', type: 'text', label: 'スコア', primary: true, placeholder: '5:32 / 8R+5 / 120kg' },
      { name: 'result_seconds', type: 'int', label: 'タイム (秒)', min: 0 },
      { name: 'result_reps', type: 'int', label: '回数スコア', min: 0 },
      { name: 'scale', type: 'enum', label: 'スケール', options: [['rx', 'Rx'], ['scaled', 'Scaled'], ['custom', '独自']] },
      { name: 'duration_min', type: 'real', label: '運動時間', unit: '分', min: 0, max: 600, primary: true },
      { ...RPE, primary: true },
      { name: 'session_load', type: 'real', label: '負荷 (RPE×分)', computed: true },
      { name: 'avg_hr', type: 'int', label: '平均心拍', unit: 'bpm', min: 30, max: 230 },
      { name: 'max_hr', type: 'int', label: '最大心拍', unit: 'bpm', min: 30, max: 240 },
      { name: 'calories', type: 'int', label: '消費カロリー', unit: 'kcal', min: 0 },
      { name: 'attachment_id', type: 'ref', label: '写真', ref: 'attachments' },
      NOTE,
      SOURCE,
    ],
  },
  strength_sets: {
    name: 'strength_sets',
    table: 'strength_sets',
    label: '筋力セット',
    group: 'training',
    dateField: 'date',
    titleFields: ['movement', 'weight_kg', 'reps'],
    fields: [
      { name: 'date', type: 'date', label: '日付', required: true, primary: true },
      { name: 'movement', type: 'text', label: '種目', required: true, primary: true, placeholder: 'Back Squat' },
      { name: 'movement_key', type: 'text', label: '種目キー', computed: true },
      { name: 'weight_kg', type: 'real', label: '重量', unit: 'kg', min: 0, max: 600, primary: true },
      { name: 'reps', type: 'int', label: '回数', min: 0, max: 1000, primary: true },
      { name: 'sets', type: 'int', label: 'セット数', min: 1, max: 100, primary: true, placeholder: '1' },
      { ...RPE, primary: true },
      { name: 'is_test', type: 'bool', label: '1RM測定・PR狙い' },
      { name: 'e1rm_kg', type: 'real', label: '推定1RM', unit: 'kg', computed: true },
      { name: 'workout_id', type: 'ref', label: 'セッション', ref: 'workouts' },
      NOTE,
      SOURCE,
    ],
  },
  skill_logs: {
    name: 'skill_logs',
    table: 'skill_logs',
    label: 'スキル',
    group: 'training',
    dateField: 'date',
    titleFields: ['skill', 'level'],
    fields: [
      { name: 'date', type: 'date', label: '日付', required: true, primary: true },
      { name: 'skill', type: 'text', label: 'スキル', required: true, primary: true, placeholder: 'Ring Muscle-up' },
      { name: 'skill_key', type: 'text', label: 'スキルキー', computed: true },
      {
        name: 'level',
        type: 'enum',
        label: '到達度',
        primary: true,
        options: [
          ['drill', 'ドリル・補助あり'],
          ['first', '初成功'],
          ['inconsistent', 'たまにできる'],
          ['consistent', '安定してできる'],
          ['wod_ready', 'WODで使える'],
        ],
      },
      { name: 'reps', type: 'int', label: '合計回数', min: 0, primary: true },
      { name: 'max_unbroken', type: 'int', label: '最大連続回数', min: 0, primary: true },
      NOTE,
      SOURCE,
    ],
  },
  cardio_sessions: {
    name: 'cardio_sessions',
    table: 'cardio_sessions',
    label: '有酸素',
    group: 'endurance',
    dateField: 'date',
    titleFields: ['modality', 'distance_m', 'duration_s'],
    fields: [
      { name: 'date', type: 'date', label: '日付', required: true, primary: true },
      { name: 'modality', type: 'enum', label: '種目', required: true, primary: true, options: MODALITY_OPTIONS },
      {
        name: 'kind',
        type: 'enum',
        label: '内容',
        primary: true,
        options: [
          ['easy', 'イージー / Zone2'],
          ['long', 'ロング'],
          ['tempo', 'テンポ / 閾値'],
          ['interval', 'インターバル'],
          ['race', 'レース'],
          ['test', 'テスト'],
        ],
      },
      { name: 'distance_m', type: 'real', label: '距離', unit: 'm', min: 0, primary: true },
      { name: 'duration_s', type: 'int', label: '時間', unit: '秒', min: 0, primary: true, placeholder: '30分なら 1800' },
      { name: 'avg_hr', type: 'int', label: '平均心拍', unit: 'bpm', min: 30, max: 230, primary: true },
      { name: 'max_hr', type: 'int', label: '最大心拍', unit: 'bpm', min: 30, max: 240 },
      { name: 'cadence', type: 'int', label: 'ケイデンス', unit: 'spm/rpm', min: 0, max: 260 },
      { name: 'elevation_m', type: 'real', label: '獲得標高', unit: 'm', min: 0 },
      { name: 'zone2_min', type: 'real', label: 'Zone2の時間', unit: '分', min: 0 },
      { name: 'pace_s_per_km', type: 'real', label: 'ペース (秒/km)', computed: true },
      { ...RPE },
      { name: 'calories', type: 'int', label: '消費カロリー', unit: 'kcal', min: 0 },
      { name: 'splits', type: 'json', label: 'スプリット' },
      { name: 'workout_id', type: 'ref', label: 'セッション', ref: 'workouts' },
      NOTE,
      SOURCE,
    ],
  },
  races: {
    name: 'races',
    table: 'races',
    label: '大会',
    group: 'endurance',
    dateField: 'date',
    titleFields: ['name', 'result_text'],
    fields: [
      { name: 'date', type: 'date', label: '日付', required: true, primary: true },
      { name: 'name', type: 'text', label: '大会名', required: true, primary: true },
      {
        name: 'race_type',
        type: 'enum',
        label: '種類',
        primary: true,
        options: [
          ['hyrox', 'HYROX'],
          ['marathon', 'フルマラソン'],
          ['half', 'ハーフ'],
          ['10k', '10km'],
          ['5k', '5km'],
          ['cf_open', 'CrossFit Open'],
          ['cf_comp', 'CrossFit大会'],
          ['other', 'その他'],
        ],
      },
      { name: 'status', type: 'enum', label: '状態', primary: true, options: [['planned', '予定'], ['done', '完了'], ['dns', '不出場']] },
      { name: 'division', type: 'text', label: '部門', placeholder: 'Men Pro / Open など' },
      { name: 'target_text', type: 'text', label: '目標', placeholder: '1:15:00' },
      { name: 'result_text', type: 'text', label: '結果', primary: true, placeholder: '1:18:42' },
      { name: 'result_seconds', type: 'int', label: '結果 (秒)', min: 0 },
      { name: 'rank', type: 'text', label: '順位' },
      { name: 'splits', type: 'json', label: 'スプリット' },
      NOTE,
      SOURCE,
    ],
  },
  body_metrics: {
    name: 'body_metrics',
    table: 'body_metrics',
    label: '体組成',
    group: 'body',
    dateField: 'date',
    titleFields: ['weight_kg', 'body_fat_pct'],
    fields: [
      { name: 'date', type: 'date', label: '日付', required: true, primary: true },
      { name: 'time', type: 'time', label: '時刻' },
      { name: 'weight_kg', type: 'real', label: '体重', unit: 'kg', min: 20, max: 300, primary: true },
      { name: 'body_fat_pct', type: 'real', label: '体脂肪率', unit: '%', min: 2, max: 70, primary: true },
      { name: 'muscle_kg', type: 'real', label: '筋肉量', unit: 'kg', min: 10, max: 150, primary: true },
      { name: 'lean_mass_kg', type: 'real', label: '除脂肪体重', unit: 'kg', min: 10, max: 200 },
      { name: 'waist_cm', type: 'real', label: '腹囲 (へそ周り)', unit: 'cm', min: 40, max: 200, primary: true },
      { name: 'bmi', type: 'real', label: 'BMI', min: 10, max: 60 },
      NOTE,
      SOURCE,
    ],
  },
  nutrition_entries: {
    name: 'nutrition_entries',
    table: 'nutrition_entries',
    label: '食事',
    group: 'body',
    dateField: 'date',
    titleFields: ['meal', 'description'],
    fields: [
      { name: 'date', type: 'date', label: '日付', required: true, primary: true },
      { name: 'time', type: 'time', label: '時刻', primary: true },
      {
        name: 'meal',
        type: 'enum',
        label: '区分',
        primary: true,
        options: [
          ['breakfast', '朝食'],
          ['lunch', '昼食'],
          ['dinner', '夕食'],
          ['snack', '間食'],
          ['pre', 'トレ前'],
          ['post', 'トレ後'],
          ['day_total', '1日合計'],
        ],
      },
      { name: 'description', type: 'longtext', label: '内容', primary: true, placeholder: '鶏むね200g・白米250g・味噌汁' },
      { name: 'kcal', type: 'real', label: 'カロリー', unit: 'kcal', min: 0, max: 10000, primary: true },
      { name: 'protein_g', type: 'real', label: 'たんぱく質 (P)', unit: 'g', min: 0, max: 1000, primary: true },
      { name: 'fat_g', type: 'real', label: '脂質 (F)', unit: 'g', min: 0, max: 1000, primary: true },
      { name: 'carbs_g', type: 'real', label: '炭水化物 (C)', unit: 'g', min: 0, max: 2000, primary: true },
      { name: 'attachment_id', type: 'ref', label: '写真', ref: 'attachments' },
      NOTE,
      SOURCE,
    ],
  },
  nutrition_targets: {
    name: 'nutrition_targets',
    table: 'nutrition_targets',
    label: '栄養目標',
    group: 'plan',
    dateField: 'start_date',
    titleFields: ['phase', 'kcal'],
    fields: [
      { name: 'start_date', type: 'date', label: '適用開始日', required: true, primary: true },
      {
        name: 'phase',
        type: 'enum',
        label: '方針',
        primary: true,
        options: [
          ['cut', '減量'],
          ['maintain', '維持'],
          ['bulk', '増量'],
          ['recomp', 'リコンプ'],
        ],
      },
      { name: 'day_type', type: 'text', label: '対象日', placeholder: '2部練日 / 1部練日 / 休養日 (空欄=全日)' },
      { name: 'kcal', type: 'real', label: 'カロリー', unit: 'kcal', min: 0, primary: true },
      { name: 'protein_g', type: 'real', label: 'P', unit: 'g', min: 0, primary: true },
      { name: 'fat_g', type: 'real', label: 'F', unit: 'g', min: 0, primary: true },
      { name: 'carbs_g', type: 'real', label: 'C', unit: 'g', min: 0, primary: true },
      NOTE,
      SOURCE,
    ],
  },
  supplements: {
    name: 'supplements',
    table: 'supplements',
    label: 'サプリメント',
    group: 'body',
    dateField: 'start_date',
    titleFields: ['name', 'dose'],
    fields: [
      { name: 'name', type: 'text', label: '名前', required: true, primary: true, placeholder: 'クレアチン' },
      { name: 'dose', type: 'text', label: '量', primary: true, placeholder: '5g' },
      { name: 'timing', type: 'text', label: 'タイミング', primary: true, placeholder: '朝食後' },
      { name: 'active', type: 'bool', label: '使用中', primary: true },
      { name: 'start_date', type: 'date', label: '開始日' },
      { name: 'end_date', type: 'date', label: '終了日' },
      NOTE,
      SOURCE,
    ],
  },
  sleep_logs: {
    name: 'sleep_logs',
    table: 'sleep_logs',
    label: '睡眠',
    group: 'recovery',
    dateField: 'date',
    titleFields: ['duration_min', 'quality'],
    uniqueBy: ['date', 'source'],
    fields: [
      { name: 'date', type: 'date', label: '起床日', required: true, primary: true },
      { name: 'bed_time', type: 'time', label: '就寝', primary: true },
      { name: 'wake_time', type: 'time', label: '起床', primary: true },
      { name: 'duration_min', type: 'real', label: '睡眠時間', unit: '分', min: 0, max: 1200, primary: true, placeholder: '6時間なら 360' },
      { name: 'quality', type: 'int', label: '質 (1-5)', min: 1, max: 5, primary: true },
      { name: 'deep_min', type: 'real', label: '深い睡眠', unit: '分', min: 0 },
      { name: 'rem_min', type: 'real', label: 'レム睡眠', unit: '分', min: 0 },
      { name: 'awake_min', type: 'real', label: '覚醒', unit: '分', min: 0 },
      { name: 'hrv_ms', type: 'real', label: 'HRV', unit: 'ms', min: 0, max: 400 },
      { name: 'resting_hr', type: 'int', label: '安静時心拍', unit: 'bpm', min: 25, max: 150 },
      NOTE,
      SOURCE,
    ],
  },
  wellness: {
    name: 'wellness',
    table: 'wellness',
    label: 'コンディション',
    group: 'recovery',
    dateField: 'date',
    titleFields: ['fatigue', 'soreness'],
    uniqueBy: ['date'],
    fields: [
      { name: 'date', type: 'date', label: '日付', required: true, primary: true },
      { name: 'fatigue', type: 'int', label: '疲労 (1=元気 5=ヘトヘト)', min: 1, max: 5, primary: true },
      { name: 'soreness', type: 'int', label: '筋肉痛 (1=なし 5=強い)', min: 1, max: 5, primary: true },
      { name: 'stress', type: 'int', label: 'ストレス (1-5)', min: 1, max: 5, primary: true },
      { name: 'motivation', type: 'int', label: 'やる気 (1=低い 5=高い)', min: 1, max: 5, primary: true },
      { name: 'sick', type: 'bool', label: '体調不良' },
      { name: 'sore_areas', type: 'text', label: '張り・痛みのある部位', placeholder: '腰・右肩' },
      NOTE,
      SOURCE,
    ],
  },
  injuries: {
    name: 'injuries',
    table: 'injuries',
    label: '怪我・不調',
    group: 'recovery',
    dateField: 'started_on',
    titleFields: ['body_part', 'status'],
    fields: [
      { name: 'started_on', type: 'date', label: '発生日', required: true, primary: true },
      { name: 'body_part', type: 'text', label: '部位', required: true, primary: true, placeholder: '腰 / 右肩 / 左手首' },
      { name: 'description', type: 'longtext', label: '症状・きっかけ', primary: true },
      { name: 'severity', type: 'int', label: '重さ (1-5)', min: 1, max: 5, primary: true },
      {
        name: 'status',
        type: 'enum',
        label: '状態',
        primary: true,
        options: [
          ['active', '痛みあり'],
          ['recovering', '回復中'],
          ['resolved', '治った'],
          ['chronic', '慢性'],
        ],
      },
      { name: 'resolved_on', type: 'date', label: '回復日' },
      { name: 'avoid', type: 'text', label: '避ける動き', placeholder: '高回数のTTB / キッピング' },
      NOTE,
      SOURCE,
    ],
  },
  daily_health: {
    name: 'daily_health',
    table: 'daily_health',
    label: 'Apple Watch 日次',
    group: 'recovery',
    dateField: 'date',
    titleFields: ['steps', 'resting_hr'],
    uniqueBy: ['date', 'source'],
    fields: [
      { name: 'date', type: 'date', label: '日付', required: true, primary: true },
      { name: 'steps', type: 'int', label: '歩数', min: 0, primary: true },
      { name: 'active_kcal', type: 'real', label: 'アクティブカロリー', unit: 'kcal', min: 0, primary: true },
      { name: 'exercise_min', type: 'real', label: 'エクササイズ', unit: '分', min: 0 },
      { name: 'resting_hr', type: 'int', label: '安静時心拍', unit: 'bpm', min: 25, max: 150, primary: true },
      { name: 'hrv_ms', type: 'real', label: 'HRV', unit: 'ms', min: 0, max: 400, primary: true },
      { name: 'vo2max', type: 'real', label: 'VO2max', unit: 'ml/kg/min', min: 10, max: 95 },
      { name: 'respiratory_rate', type: 'real', label: '呼吸数', unit: '回/分', min: 4, max: 60 },
      NOTE,
      SOURCE,
    ],
  },
  goals: {
    name: 'goals',
    table: 'goals',
    label: '目標',
    group: 'plan',
    dateField: 'target_date',
    titleFields: ['title', 'status'],
    fields: [
      { name: 'title', type: 'text', label: '目標', required: true, primary: true, placeholder: 'Back Squat 1RM 160kg' },
      {
        name: 'category',
        type: 'enum',
        label: '分類',
        primary: true,
        options: [
          ['strength', '筋力'],
          ['skill', 'スキル'],
          ['endurance', '持久力'],
          ['body', '体組成'],
          ['nutrition', '栄養'],
          ['recovery', '睡眠・回復'],
          ['competition', '大会'],
          ['other', 'その他'],
        ],
      },
      {
        name: 'metric',
        type: 'text',
        label: '測る指標',
        primary: true,
        placeholder: 'e1rm:back squat / weight / waist / skill:ring muscle-up',
      },
      { name: 'start_value', type: 'real', label: '開始時の値' },
      { name: 'target_value', type: 'real', label: '目標値', primary: true },
      { name: 'unit', type: 'text', label: '単位', placeholder: 'kg / 秒 / 回' },
      { name: 'direction', type: 'enum', label: '方向', options: [['up', '上げる'], ['down', '下げる']] },
      { name: 'start_date', type: 'date', label: '開始日' },
      { name: 'target_date', type: 'date', label: '期限', primary: true },
      {
        name: 'status',
        type: 'enum',
        label: '状態',
        primary: true,
        options: [
          ['active', '進行中'],
          ['achieved', '達成'],
          ['paused', '保留'],
          ['dropped', '取り下げ'],
        ],
      },
      { name: 'achieved_on', type: 'date', label: '達成日' },
      { name: 'priority', type: 'int', label: '優先度 (1が最優先)', min: 1, max: 5 },
      NOTE,
      SOURCE,
    ],
  },
  journal: {
    name: 'journal',
    table: 'journal',
    label: 'ノート',
    group: 'plan',
    dateField: 'date',
    titleFields: ['title', 'category'],
    fields: [
      { name: 'date', type: 'date', label: '日付', required: true, primary: true },
      {
        name: 'category',
        type: 'enum',
        label: '分類',
        primary: true,
        options: [
          ['wod', 'WOD'],
          ['meal', '食事'],
          ['rest', '休養'],
          ['coach', 'コーチメモ'],
          ['decision', '方針・決定'],
          ['note', 'その他'],
        ],
      },
      { name: 'title', type: 'text', label: 'タイトル', primary: true },
      { name: 'body', type: 'longtext', label: '本文', primary: true },
      { name: 'tags', type: 'json', label: 'タグ' },
      { name: 'attachment_ids', type: 'json', label: '写真' },
      SOURCE,
    ],
  },
  reports: {
    name: 'reports',
    table: 'reports',
    label: 'レポート',
    group: 'plan',
    dateField: 'end_date',
    titleFields: ['title'],
    fields: [
      { name: 'period', type: 'enum', label: '期間', required: true, primary: true, options: [['week', '週次'], ['month', '月次'], ['year', '年間'], ['custom', '任意']] },
      { name: 'start_date', type: 'date', label: '開始', required: true, primary: true },
      { name: 'end_date', type: 'date', label: '終了', required: true, primary: true },
      { name: 'title', type: 'text', label: 'タイトル', required: true, primary: true },
      { name: 'body_md', type: 'longtext', label: '本文 (Markdown)', required: true, primary: true },
      { name: 'metrics', type: 'json', label: '集計値' },
      SOURCE,
    ],
  },
} as const satisfies Record<string, EntityDef>

export type EntityName = keyof typeof ENTITIES

export const ENTITY_NAMES = Object.keys(ENTITIES) as EntityName[]

export function entity(name: string): EntityDef | undefined {
  return (ENTITIES as unknown as Record<string, EntityDef>)[name]
}

/** すべての行が持つ共通列 (各テーブルに必ずある) */
export const BASE_COLUMNS = ['id', 'created_at', 'updated_at', 'deleted_at'] as const

/** 種目名・スキル名の表記ゆれをまとめるキー (小文字・空白1つ・記号除去) */
export function keyOf(name: string): string {
  return name
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
}

/** 推定1RM (Epley式)。10回を超えると誤差が大きいので計算しない */
export function estimate1RM(weightKg: number | null | undefined, reps: number | null | undefined): number | null {
  if (!weightKg || !reps || reps < 1 || reps > 10) return null
  if (reps === 1) return weightKg
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

/** 1行分の値 (APIで受け渡す形) */
export type Row = Record<string, unknown> & {
  id: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

/**
 * 計算列を埋める。Worker の保存直前と、インポート時に呼ぶ。
 * 入力 (row) は検証済みの値。
 */
export function applyComputed(name: EntityName, row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row }
  switch (name) {
    case 'workouts': {
      const rpe = num(out.rpe)
      const dur = num(out.duration_min)
      out.session_load = rpe != null && dur != null ? Math.round(rpe * dur) : null
      break
    }
    case 'strength_sets':
      if (typeof out.movement === 'string') out.movement_key = keyOf(out.movement)
      out.e1rm_kg = estimate1RM(num(out.weight_kg), num(out.reps))
      break
    case 'skill_logs':
      if (typeof out.skill === 'string') out.skill_key = keyOf(out.skill)
      break
    case 'cardio_sessions': {
      const d = num(out.distance_m)
      const s = num(out.duration_s)
      out.pace_s_per_km = d && s && d > 0 ? Math.round((s / (d / 1000)) * 10) / 10 : null
      break
    }
  }
  return out
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** 現在のスキーマ版。migrations/ の最新番号と一致させる (テストで確認) */
export const SCHEMA_VERSION = 1
