# 運用マニュアル (VITALOG)

専門知識が無くても進められるように、画面の操作を順番に書いています。
所要時間の目安: 初期設定 40〜60分 (1回だけ)。

> Cloudflare・GitHub の画面の文言は変わることがあります。見つからないときは Claude Code に「◯◯の画面が見つからない」と聞いてください。

---

## A. 初期設定 (1回だけ)

### A-1. Cloudflare のアカウントを作る
1. https://dash.cloudflare.com/sign-up でアカウントを作成 (無料プラン。クレジットカード不要)
2. 左メニュー **Workers & Pages** を一度開く。初回は `xxxx.workers.dev` のサブドメイン名を決める画面が出るので、好きな名前を付ける (公開URLの一部になる。本名は避ける)
3. 画面右側などに表示される **Account ID** (32文字) を控える

### A-2. Cloudflare の API トークンを作る (GitHub が自動デプロイに使う)
1. 右上の人型アイコン → **My Profile** → **API Tokens** → **Create Token**
2. テンプレート **Edit Cloudflare Workers** の **Use template**
3. **Permissions** に行を追加: `Account` / `D1` / `Edit`
4. **Account Resources** を自分のアカウントに限定 → **Continue to summary** → **Create Token**
5. 表示されたトークンを控える (一度しか表示されない)

### A-3. 合言葉を2つ用意する
パスワード管理アプリ (iPhone の「パスワード」アプリなど) で、**40文字以上のランダムな文字列** を2つ作る。

| 名前 | 用途 |
|---|---|
| `API_TOKEN` | Claude Code・iPhone ショートカットがデータを読み書きするための鍵 |
| `BACKUP_PASSPHRASE` | 自動バックアップの暗号化の鍵。**無くすとバックアップを開けない**。パスワード管理アプリに保存 |

PC にターミナルがあれば `openssl rand -base64 48` でも作れます。チャット欄には貼らないでください。

### A-4. GitHub に秘密情報を登録する
GitHub のリポジトリ → **Settings** → **Secrets and variables** → **Actions**

**Secrets** タブ → **New repository secret** で次を登録:

| Name | 値 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | A-2 のトークン |
| `CLOUDFLARE_ACCOUNT_ID` | A-1 の Account ID |
| `API_TOKEN` | A-3 で作った1つ目 |
| `BACKUP_PASSPHRASE` | A-3 で作った2つ目 |

### A-5. 最初のデプロイ
1. この作業の PR をマージする (または **Actions** → **Deploy to Cloudflare** → **Run workflow**)
2. 緑のチェックになったら、Cloudflare の **Workers & Pages** に `cfm` ができている。URL は `https://cfm.<A-1で決めた名前>.workers.dev`
3. この時点ではログイン設定が無いので、**データは誰にも読めない状態 (すべて 401)** で動いている。これは正常
4. GitHub の **Settings → Secrets and variables → Actions → Variables** タブで `CFM_URL` = 上の URL を登録 (デプロイ後の自動動作確認に使う)

### A-6. ログイン (Cloudflare Access) を設定する
1. Cloudflare の左メニュー **Zero Trust** → 初回はチーム名を決める (例 `onemuscle`)。プランは **Free** を選ぶ (支払い情報の入力を求められた場合も Free は 0 円)
2. **Settings → Authentication** で **One-time PIN** が有効になっていることを確認
3. **Access → Applications → Add an application → Self-hosted**
   - Application name: `CF MEMO`
   - Domain: `cfm.<名前>.workers.dev` (パスは空欄)
   - Policy: Action **Allow**、Include → **Emails** → 自分のメールアドレス
   - 保存後、アプリの **Overview** にある **Application Audience (AUD) Tag** を控える
4. もう1つアプリを追加 (Claude Code・ショートカット用の入口。Worker 側でトークンを確認するので安全)
   - Application name: `CF MEMO API`
   - Domain: 同じ `cfm.<名前>.workers.dev`、Path: `api/`
   - Policy: Action **Bypass**、Include → **Everyone**
5. GitHub Secrets にさらに3つ登録:

| Name | 値 |
|---|---|
| `ACCESS_TEAM_DOMAIN` | `<チーム名>.cloudflareaccess.com` |
| `ACCESS_AUD` | 手順3の AUD Tag |
| `ALLOWED_EMAILS` | 自分のメールアドレス (複数ならカンマ区切り) |

6. **Actions → Deploy to Cloudflare → Run workflow** でもう一度デプロイ (Secrets が Worker に登録される)
7. スマホで URL を開く → メールアドレスを入力 → 届いた6桁のコードを入力 → アプリが表示されれば完了
8. Safari の共有ボタン → **ホーム画面に追加** でアプリのように使える

### A-6b. WOD 写真の自動読み取りを有効にする (任意・従量課金)
1. https://console.anthropic.com でアカウントを作り、**Billing** で少額 (例 $5) をチャージ
2. **API Keys** → **Create Key** → 表示されたキーを控える
3. GitHub Secrets に `ANTHROPIC_API_KEY` として登録 → **Actions → Deploy to Cloudflare → Run workflow**
4. 費用の目安: 写真1枚の読み取りで数円 (Claude Opus 5.5・思考は浅め)。キーはサーバー (Worker) にだけ置かれ、ブラウザには渡りません

### A-6c. Apple Watch・体重計をつなぐ (任意)
docs/apple-health.md を参照。Bluetooth 体重計は、メーカーのアプリで Apple ヘルスケア連携をオンにすると、ヘルスケア経由で入ります。

### A-7. Claude Code とつなぐ
docs/05-claude-integration.md の「接続の設定」を参照。

### A-8. 旧 CF MEMO のデータを移す
旧アプリのデータは **その端末のブラウザの中だけ** にあります。データを入れた端末 (スマホ・PC) ごとに行います。
1. 旧アプリ (GitHub Pages の URL) を、データを入れたブラウザで開く
2. **メモ** タブの一番下 **全データを書き出す (.json)** → ファイルを保存
3. 新アプリ → **設定 → データ → ファイルを選ぶ** → 書き出したファイル
4. 件数を確認 → **確認だけする** (保存されない) → 問題なければ **取り込む**
5. 同じファイルを何度取り込んでも二重にはなりません。旧アプリのデータも消えません

### A-9. 12週プランの情報を登録する (任意)
Claude Code に「12週プランの初期データを登録して」と頼む (`node scripts/seed-from-plan.ts`)。開始時の体組成・食A/B/C の栄養目標・方針が入ります。

### A-10. リポジトリを private にする (推奨・要判断)
健康データ (旧プランの体重など) が公開リポジトリに含まれているため、private を推奨します。
**ただし、先に A-8 をすべての端末で終えてください。** 無料プランでは private にすると GitHub Pages が止まり、旧アプリと「きょうトレ」が開けなくなります。
- きょうトレを公開し続けたい場合は、先に Cloudflare への移設を Claude Code に頼んでください (ロードマップ Phase 2)
- 手順: **Settings → General → 一番下 Danger Zone → Change visibility → Make private**

---

## B. ふだんの使い方

| やること | 方法 |
|---|---|
| 記録 | アプリのホームのボタン、または Claude Code に報告 |
| 振り返り | アプリの **分析**。文章のレポートは Claude Code に「今週のレポート」 |
| 月1回 | **設定 → データ → 書き出す** で JSON を手元に保存 (Cloudflare・GitHub の外の控え) |
| ときどき | GitHub の **Actions → Backup D1** が緑か確認 (毎日 03:17 に自動実行) |

---

## C. 困ったとき・元に戻すとき

### C-1. 1件だけ間違えて消した / 上書きした
- 消した → **設定 → ゴミ箱 → 戻す**
- 上書きした・取り込みを間違えた → **設定 → 変更履歴 → 取り消す** (その変更の直前の値に戻る)

### C-2. データベース全体を、過去7日以内のある時点に戻す (Time Travel)
**現在のデータが上書きされます。** 先に「書き出す」で JSON を取ってから、Claude Code に依頼してください (Claude Code は実行前に必ず確認します)。
```bash
npx wrangler d1 time-travel info cf-memo
```
```bash
npx wrangler d1 time-travel restore cf-memo --timestamp=2026-11-17T09:00:00+09:00
```

### C-3. 毎日の自動バックアップから戻す
1. GitHub → **Actions → Backup D1** → 戻したい日の実行 → **Artifacts** をダウンロードして解凍 (`cf-memo-YYYYMMDD-HHMM.sql.gz.enc`)
2. 復号して展開 (BACKUP_PASSPHRASE が必要):
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in cf-memo-20261117-0317.sql.gz.enc -out restore.sql.gz
```
```bash
gunzip restore.sql.gz
```
3. **既存 DB には上書きせず**、新しい DB に入れて中身を確認する:
```bash
npx wrangler d1 create cf-memo-restore
```
```bash
npx wrangler d1 execute cf-memo-restore --remote --file restore.sql
```
4. 中身が正しければ、GitHub の **Variables** に `D1_DATABASE_ID` = 新しい DB の ID を登録して再デプロイすると、アプリがそちらを使う。元の DB は消さずに残しておく

### C-4. JSON (手動バックアップ) から戻す
アプリの **設定 → データ → ファイルから取り込む**、または `npm run cfm -- import <file>`。既存データは消えず、足りないものだけ追加されます。

### C-5. デプロイが失敗した
- **データが減っていないことを確認** のステップで止まった → 行数が減っている。デプロイ前のバックアップ (`predeploy-backup-*` Artifact) を C-3 の手順で確認し、Claude Code に相談
- それ以外 → 前のバージョンは動き続けています。Cloudflare の **Workers & Pages → cfm → Deployments** から前のバージョンに戻すこともできます (データには影響しない)

### C-6. 「ログインが必要です」と出る
- Access のログインが期限切れ → ページを再読み込みしてメールのコードを入れ直す
- 全員 401 になる → A-6 の Secrets が登録されているか、`ALLOWED_EMAILS` のメールアドレスが正しいか確認して再デプロイ

---

## D. 機能追加・改善の安全な手順 (Claude Code が守る手順)

1. 作業用ブランチを作る
2. 実装。データ構造を変えるときは docs/03-data-safety.md 3.3 の手順 (追加専用マイグレーション)
3. ローカルで確認: `npm run typecheck && npm test && npm run test:persistence`
4. PR を作成 → CI (秘密情報検査・型・単体テスト・ビルド・永続性テスト) が緑になるのを確認
5. ユーザーが内容を確認してマージ
6. 自動デプロイ: テスト → **本番バックアップ** → 行数記録 → マイグレーション → デプロイ → **行数が減っていないか確認** → 動作確認
7. docs/06-roadmap.md と docs/DECISIONS.md を更新

既存データの削除・初期化・作り直しを伴う変更は、どんな場合もユーザーの明示的な確認を取ってから行います。
