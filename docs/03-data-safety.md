# 3. 永続保存・認証・バックアップの設計

## 3.1 データを失わないための多重の仕組み

過去のアプリでデータが消えたのは、データが「ブラウザの中」にあり、コードの作り直しやサイトデータの消去と一緒に消えたため。
今回は次のように、**どの1つが壊れても別の層で戻せる** 形にしている。

| 層 | 守るもの | 戻せる範囲 | どこで |
|---|---|---|---|
| 1. コードとデータの分離 | 修正・再デプロイ | — (そもそも消えない) | データは D1、コードは Worker |
| 2. 論理削除 (ゴミ箱) | 誤削除 | いつまでも | 設定 → ゴミ箱 |
| 3. 変更履歴 (audit_log) | 誤った上書き・削除・取り込み | いつまでも (1件ずつ) | 設定 → 変更履歴 → 取り消す |
| 4. 端末の送信待ち | 通信できない時の入力 | 送信されるまで端末に保持 | 自動 |
| 5. D1 Time Travel | DB 全体の事故 | 過去7日 (有料30日) の任意の時点 | `wrangler d1 time-travel restore` |
| 6. 毎日の自動バックアップ | Cloudflare 側の障害・アカウント事故 | 過去90日 (1日単位) | GitHub Actions の Artifacts (暗号化) |
| 7. デプロイ直前のバックアップ | マイグレーションの失敗 | デプロイごと | 同上 |
| 8. 手動 JSON 書き出し | すべて (Cloudflare・GitHub の外に保管) | 書き出した時点 | 設定 → データ → 書き出す |

おすすめ: 月1回「書き出す」で JSON をスマホの「ファイル」や PC、個人のクラウドストレージに保存する (層8)。

## 3.2 データベース構造

`shared/schema.ts` が唯一の定義。画面のフォーム、API の検証、CLI がここから組み上がる。

| テーブル | 内容 | 1日1件 |
|---|---|---|
| workouts | トレーニングセッション (WOD・クラス・補助・HYROX 練習) | |
| strength_sets | 重量×回数×セット (推定1RM を自動計算) | |
| skill_logs | スキル (Ring Muscle-up など) の到達度・連続回数 | |
| cardio_sessions | ラン・バイク・ロウ等 (ペースを自動計算) | |
| races | 大会 (予定・結果・スプリット) | |
| body_metrics | 体重・体脂肪率・筋肉量・腹囲 | |
| nutrition_entries | 食事 (1食ずつ or 1日合計) | |
| nutrition_targets | 栄養目標 (適用開始日つき履歴。上書きせず追加) | |
| supplements | サプリメント | |
| sleep_logs | 睡眠 (時間・質・HRV・安静時心拍) | ✔ (入力元ごと) |
| wellness | 疲労・筋肉痛・ストレス・やる気・体調 | ✔ |
| injuries | 怪我・不調 (状態・避ける動き) | |
| daily_health | Apple Watch の日次値 (歩数・HRV・VO2max など) | ✔ (入力元ごと) |
| goals | 目標 (指標・目標値・期限・状態) | |
| journal | ノート (コーチメモ・方針の決定・旧メモ) | |
| reports | Claude Code が作ったレポート | |
| profile | プロフィール・方針 (key-value) | |
| attachments | 写真 (長辺1600px の JPEG) | |
| audit_log | すべての変更の前後の値 | |

全テーブル共通: `id` (UUID)・`created_at`・`updated_at`・`deleted_at` (論理削除)・`source` (Web / Claude Code / Apple Health / インポート / 旧アプリ)。

「1日1件」のテーブルに同じ日の記録を送ると、新しい行を作らず既存の行に **追記** する (空欄だけ埋まり、入力した項目は上書き。変更前は履歴に残る)。

## 3.3 スキーマ変更 (機能追加) の安全な手順

1. `migrations/000N_説明.sql` を **新規作成** (`ALTER TABLE ... ADD COLUMN`、`CREATE TABLE`、`CREATE INDEX` だけ)
2. `shared/schema.ts` に項目を追加し、`SCHEMA_VERSION` を N にする
3. `npm run migrations:lock` (新しいファイルを確定リストに登録)
4. `npm test` — 次を自動で確認する
   - すべてのマイグレーションが順に適用でき、schema.ts の全項目が列として存在する
   - 確定済みのマイグレーションが書き換えられていない (ハッシュ比較)
   - 2本目以降に DROP / RENAME / DELETE FROM / TRUNCATE が無い
   - 既存データが入った状態で後続のマイグレーションを通しても、データが残る
5. `npm run test:persistence` — ローカルの Cloudflare 環境で、再起動・列追加・バックアップ復元を通しで確認
6. PR → マージ → GitHub Actions が **本番のバックアップを取ってから** マイグレーションとデプロイを実行

列の「削除」や「改名」が必要になったら: 新しい列を追加 → 新旧両方に書く期間を設ける → 読み取りを新しい列へ移す。古い列は消さずに残す。

## 3.4 認証とアクセス制御

```
ブラウザ ──▶ Cloudflare Access (メールにワンタイムコード) ──▶ Worker: JWT の署名・発行元・宛先・メールを検証 ──▶ API
Claude Code / ショートカット ──▶ (Access のバイパス設定) ──▶ Worker: Bearer トークンを検証 ──▶ API
```

- **fail closed**: Access の設定もトークンも無い状態では、すべての API が 401 (誰も読めない)
- Access の設定ミスで素通しになっても、Worker 自身が JWT を検証するので読めない
- 許可するメールアドレスは Worker の Secret (`ALLOWED_EMAILS`) に置く (公開リポジトリに書かない)
- API トークンは 32文字以上のランダム文字列。比較はハッシュ同士 (時間差攻撃対策)
- ブラウザからの書き込みは独自ヘッダー必須 (CSRF 対策)。画面は CSP・X-Frame-Options で保護
- 写真はファイルの先頭バイトで形式を確認 (拡張子や Content-Type の偽装を拒否)
- 検索エンジン除け: noindex・robots.txt
- ローカル開発用の認証省略 (`DEV_AUTH_BYPASS`) は `localhost` でしか効かない

## 3.5 秘密情報・健康データを公開しない対策

**現状の注意: このリポジトリは public です。** 旧アプリの `src/plan/planData.ts` に体重・体脂肪率などがすでに公開状態で含まれています。
推奨: データ移行が終わったら、リポジトリを private にする (手順は OPERATIONS.md)。

| 対策 | 内容 |
|---|---|
| 置き場所の分離 | 健康データは D1 だけ。トークン類は GitHub Secrets と Cloudflare Secrets だけ |
| .gitignore | `.dev.vars` `.env*` `.cfm.json` `backups/` `*.sqlite` バックアップ JSON |
| pre-commit フック | `git config core.hooksPath .githooks` で、コミット前に `scripts/check-secrets.mjs --staged` |
| CI | すべての push で `npm run check:secrets` (API キー・トークン・秘密鍵・バックアップの中身・禁止ファイル) |
| バックアップの暗号化 | GitHub Artifacts のバックアップは AES-256 (パスフレーズは GitHub Secret)。public リポジトリでも中身は読めない |
| CLAUDE.md | 記録データ・メールアドレスを書かない、と明記 |
