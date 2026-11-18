-- 0001: 初期スキーマ
--
-- ルール (docs/03-data-safety.md):
--   * 一度本番に適用したマイグレーションは書き換えない。変更は新しい番号のファイルで行う
--   * DROP TABLE / DROP COLUMN / 列の改名はしない (既存データが消えるため)
--   * 削除は deleted_at に日時を入れる「論理削除」。行そのものは残す
--   * すべての変更は audit_log に変更前後の値が残る

-- トレーニング
CREATE TABLE workouts (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  time_of_day TEXT,
  title TEXT,
  format TEXT,
  description TEXT,
  result TEXT,
  result_seconds INTEGER,
  result_reps INTEGER,
  scale TEXT,
  duration_min REAL,
  rpe REAL,
  session_load REAL,
  avg_hr INTEGER,
  max_hr INTEGER,
  calories INTEGER,
  attachment_id TEXT,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_workouts_date ON workouts(date);

-- 筋力セット
CREATE TABLE strength_sets (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  movement TEXT NOT NULL,
  movement_key TEXT,
  weight_kg REAL,
  reps INTEGER,
  sets INTEGER,
  rpe REAL,
  is_test INTEGER,
  e1rm_kg REAL,
  workout_id TEXT,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_strength_sets_date ON strength_sets(date);

-- スキル
CREATE TABLE skill_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  skill TEXT NOT NULL,
  skill_key TEXT,
  level TEXT,
  reps INTEGER,
  max_unbroken INTEGER,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_skill_logs_date ON skill_logs(date);

-- 有酸素
CREATE TABLE cardio_sessions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  modality TEXT NOT NULL,
  kind TEXT,
  distance_m REAL,
  duration_s INTEGER,
  avg_hr INTEGER,
  max_hr INTEGER,
  cadence INTEGER,
  elevation_m REAL,
  zone2_min REAL,
  pace_s_per_km REAL,
  rpe REAL,
  calories INTEGER,
  splits TEXT,
  workout_id TEXT,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_cardio_sessions_date ON cardio_sessions(date);

-- 大会
CREATE TABLE races (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  race_type TEXT,
  status TEXT,
  division TEXT,
  target_text TEXT,
  result_text TEXT,
  result_seconds INTEGER,
  rank TEXT,
  splits TEXT,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_races_date ON races(date);

-- 体組成
CREATE TABLE body_metrics (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT,
  weight_kg REAL,
  body_fat_pct REAL,
  muscle_kg REAL,
  lean_mass_kg REAL,
  waist_cm REAL,
  bmi REAL,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_body_metrics_date ON body_metrics(date);

-- 食事
CREATE TABLE nutrition_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT,
  meal TEXT,
  description TEXT,
  kcal REAL,
  protein_g REAL,
  fat_g REAL,
  carbs_g REAL,
  attachment_id TEXT,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_nutrition_entries_date ON nutrition_entries(date);

-- 栄養目標
CREATE TABLE nutrition_targets (
  id TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  phase TEXT,
  day_type TEXT,
  kcal REAL,
  protein_g REAL,
  fat_g REAL,
  carbs_g REAL,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_nutrition_targets_start_date ON nutrition_targets(start_date);

-- サプリメント
CREATE TABLE supplements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dose TEXT,
  timing TEXT,
  active INTEGER,
  start_date TEXT,
  end_date TEXT,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_supplements_start_date ON supplements(start_date);

-- 睡眠
CREATE TABLE sleep_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  bed_time TEXT,
  wake_time TEXT,
  duration_min REAL,
  quality INTEGER,
  deep_min REAL,
  rem_min REAL,
  awake_min REAL,
  hrv_ms REAL,
  resting_hr INTEGER,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_sleep_logs_date ON sleep_logs(date);
CREATE UNIQUE INDEX uq_sleep_logs_date_source ON sleep_logs(date, COALESCE(source, '')) WHERE deleted_at IS NULL;

-- コンディション
CREATE TABLE wellness (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  fatigue INTEGER,
  soreness INTEGER,
  stress INTEGER,
  motivation INTEGER,
  sick INTEGER,
  sore_areas TEXT,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_wellness_date ON wellness(date);
CREATE UNIQUE INDEX uq_wellness_date ON wellness(date) WHERE deleted_at IS NULL;

-- 怪我・不調
CREATE TABLE injuries (
  id TEXT PRIMARY KEY,
  started_on TEXT NOT NULL,
  body_part TEXT NOT NULL,
  description TEXT,
  severity INTEGER,
  status TEXT,
  resolved_on TEXT,
  avoid TEXT,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_injuries_started_on ON injuries(started_on);

-- Apple Watch 日次
CREATE TABLE daily_health (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  steps INTEGER,
  active_kcal REAL,
  exercise_min REAL,
  resting_hr INTEGER,
  hrv_ms REAL,
  vo2max REAL,
  respiratory_rate REAL,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_daily_health_date ON daily_health(date);
CREATE UNIQUE INDEX uq_daily_health_date_source ON daily_health(date, COALESCE(source, '')) WHERE deleted_at IS NULL;

-- 目標
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  metric TEXT,
  start_value REAL,
  target_value REAL,
  unit TEXT,
  direction TEXT,
  start_date TEXT,
  target_date TEXT,
  status TEXT,
  achieved_on TEXT,
  priority INTEGER,
  note TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_goals_target_date ON goals(target_date);

-- ノート
CREATE TABLE journal (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  category TEXT,
  title TEXT,
  body TEXT,
  tags TEXT,
  attachment_ids TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_journal_date ON journal(date);

-- レポート
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  metrics TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_reports_end_date ON reports(end_date);


CREATE INDEX idx_strength_sets_movement ON strength_sets(movement_key, date);
CREATE INDEX idx_skill_logs_skill ON skill_logs(skill_key, date);

-- プロフィール・方針などの key-value (値は JSON)
CREATE TABLE profile (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 写真 (WODのホワイトボード・食事など)。長辺1600pxのJPEGに縮小してから保存する
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  caption TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);

-- 変更履歴。誤って上書き・削除しても、ここから元の値に戻せる
CREATE TABLE audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  before TEXT,
  after TEXT
);
CREATE INDEX idx_audit_row ON audit_log(table_name, row_id);
CREATE INDEX idx_audit_at ON audit_log(at);
