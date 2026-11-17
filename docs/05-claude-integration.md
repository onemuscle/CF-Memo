# 5. Claude Code との連携と、会話・プロジェクトの継続

## 仕組み

```
あなた: 「今日はスクワット120kgを5回できた。昨日は6時間しか眠れなかった」
   │
   ▼
Claude Code ── CLAUDE.md の「記録の手順」に従って分解
   │            strength_sets: {date: 今日, movement: Back Squat, weight_kg: 120, reps: 5}
   │            sleep_logs:    {date: 今日(起床日), duration_min: 360}
   ▼
npm run cfm -- batch items.json   (検証 → 全件成功 or 全件失敗)
   │
   ▼
Cloudflare Worker (/api/batch) ── 入力検証・変更履歴 ──▶ D1
   │
   ▼
Web アプリにすぐ反映 (ホーム・分析・目標)
```

## 会話が変わっても引き継がれるもの

| 置き場所 | 中身 | 更新する人 |
|---|---|---|
| `CLAUDE.md` | Claude Code の役割・守るルール・記録手順・開発ルール (個人データは書かない) | Claude Code (ルールが変わったとき) |
| DB `profile` | 呼び名・身長・競技歴・週のスケジュール・長期目標・トレーニング方針・食事方針・制約 | アプリの設定画面 / `cfm profile set` |
| DB `goals` | 目標 (指標・目標値・期限・優先度・状態) | アプリ / Claude Code |
| DB `journal` (category=decision / coach) | 方針の決定とその理由、コーチとしての所見 | Claude Code |
| DB `reports` | 週次・月次・年間レポート | Claude Code |
| DB のその他 | すべての記録 | アプリ / Claude Code / ショートカット |
| `docs/06-roadmap.md` | 実装済み機能・次の開発 | Claude Code (開発のたび) |
| `docs/DECISIONS.md` | 技術・設計の重要な決定 | Claude Code |

個人の健康情報は **DB に置き**、リポジトリ (public) には置かない。新しいセッションでは `npm run cfm -- context` 1回で、プロフィール・目標・直近の記録・コンディション・怪我・記録の抜けが Markdown で読める。

## 接続の設定

### この Claude Code (クラウド環境) から使う場合
1. 接続先 URL を環境変数 `CFM_URL` に設定 (秘密ではないので環境の設定でよい)。Claude Code に「CFM_URL を設定して」と頼めば、環境設定の変更を提案します
2. API トークンは **チャットに貼らない**。Claude Code が表示する安全な入力フォーム (認証情報の登録) で、ホスト `cf-memo.<名前>.workers.dev` に対して `API_TOKEN` の値を登録する。以後、通信時に自動で付与され、Claude Code 自身もトークンの値は見えない
3. `npm run cfm -- doctor` で「認証: OK」になれば完了

### 自分の PC の Claude Code から使う場合
リポジトリ直下に `.cfm.json` を作る (gitignore 済み・コミットされない):
```json
{ "url": "https://cf-memo.<名前>.workers.dev", "token": "<API_TOKEN>" }
```

### Access の構成が「方式B」(/api/ もバイパスしない) の場合
Cloudflare Zero Trust → Access → Service Auth → **Service Tokens** でトークンを作り、
Access アプリのポリシーに **Service Auth** (そのトークン) を追加。GitHub Secret `ALLOWED_SERVICE_TOKEN_IDS` に Client ID を登録して再デプロイ。
CLI 側は `.cfm.json` に `"accessId": "<Client ID>", "accessSecret": "<Client Secret>"` を追加する。

## CLI (`npm run cfm -- <コマンド>`)

| コマンド | 用途 |
|---|---|
| `context [--days 28]` | 現状のまとめ (セッション開始時に必ず読む) |
| `schema [種類]` | 記録できる項目と選択肢 |
| `add <種類> key=value ...` | 1件登録 (`--dry-run` で検証のみ) |
| `batch <file.json \| ->` | 複数件をまとめて登録。`{"items":[{"entity":"...","data":{...}}]}` |
| `list <種類> [--from --to --limit] [key=value]` | 一覧 |
| `update <種類> <id> key=value ...` | 修正 (変更前の値は履歴に残る) |
| `delete <種類> <id> --yes` | ゴミ箱へ (ユーザーの確認後のみ) / `restore` で戻す |
| `summary --period week\|month\|year [--date]` | 期間の集計 |
| `report-save --period --from --to --title --file` | レポートを保存 (アプリに表示) |
| `profile` / `profile set <key> <value>` | プロフィール・方針 |
| `export [--out]` / `import <file> [--dry-run]` | バックアップ (`backups/` はコミットされない) |
| `meta` / `doctor` | 件数・スキーマ版 / 接続確認 |

## 会話の例

**記録**
> 今日のWODは「AMRAP 15: 10 Wall Ball 9kg / 10 T2B / 200m Run」で6ラウンド+12。RPE 9。そのあとバックスクワット 5x5 110kg。

→ `workouts` 1件 (type=crossfit, format="AMRAP 15", description=本文, result="6R+12", duration_min=15, rpe=9) + `strength_sets` 1件 (Back Squat 110kg × 5 × 5セット) を batch で登録し、刺激の分析と夜の補助トレ・ランの可否を回答。

**分析**
> 最近スクワットが伸びない。原因を分析して。

→ `context` と `list strength_sets movement="Back Squat"` を読み、頻度・強度・睡眠・体重変化・負荷比を確認。不足データ (例: RPE が未入力) を指摘したうえで仮説と次の4週の提案。

**レポート**
> 今月のレポートを作って。

→ `summary --period month` → Markdown 作成 → `report-save`。アプリの 分析 → レポート に表示。
