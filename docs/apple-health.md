# Apple Watch・体重計の連携 (Apple ヘルスケア経由)

## しくみ

```
Apple Watch ──────────┐
Bluetooth 体重計のアプリ ─┼─▶ iPhone「ヘルスケア」 ──(自動送信)──▶ VITALOG  /api/ingest/health
(タニタ・オムロン・Withings 等) ┘
```

- Apple のヘルスケアデータを、Web から直接読み出す仕組み (公開 API) はありません。iPhone 上のアプリが読み出して送る必要があります
- **Bluetooth 体重計を Web アプリに直接つなぐことは、iPhone ではできません** (Safari が Web Bluetooth に対応していないため)。体重計のメーカーのアプリでヘルスケア連携をオンにすれば、体重・体脂肪率・除脂肪体重・BMI がヘルスケア経由で入ります
- 送り先: `https://cfm.<名前>.workers.dev/api/ingest/health`
- ヘッダー: `Authorization: Bearer <API_TOKEN>` (GitHub Secrets の API_TOKEN と同じ値)
- 同じ日のデータを何度送っても二重になりません。ゴミ箱に入れた行は送り直しても復活しません

取り込まれる項目:

| ヘルスケアの項目 | VITALOG の記録 |
|---|---|
| 睡眠 (合計・深い・レム・覚醒、就寝・起床時刻) | 睡眠 (入力元: Apple ヘルスケア) |
| 安静時心拍・HRV・歩数・アクティブエネルギー・エクササイズ時間・VO2max・呼吸数 | Apple Watch 日次 |
| 体重・体脂肪率・除脂肪体重・BMI | 体組成 (1日1件、その日の最後の値) |
| ワークアウト (ラン・ウォーク・バイク・ロウ・スイム) | 有酸素 (距離・時間・平均/最大心拍・カロリー) |
| ワークアウト (機能的筋力トレーニング・クロストレーニング・HIIT・筋力トレーニング・ヨガ等) | トレーニング (「Apple Watch: …」というタイトル。心拍・カロリー付き) |

手入力した WOD と Apple Watch のワークアウトが同じ日にある場合、どちらも残しますが、負荷や回数の集計では手入力を優先します (二重に数えない)。

## 方法A: Health Auto Export (おすすめ・ほぼ全自動)

「Health Auto Export – JSON+CSV」というアプリ (App Store、自動送信は有料プラン) を使う方法です。ワークアウトの心拍まで含めて、決まった時刻に自動で送ってくれます。

1. App Store で「Health Auto Export」を入れ、ヘルスケアへのアクセスをすべて許可
2. **Automations** → 新規作成 → 種類 **REST API**
3. 設定 (画面の名前はアプリの版で多少違います):
   - URL: `https://cfm.<名前>.workers.dev/api/ingest/health`
   - Headers: キー `Authorization`、値 `Bearer <API_TOKEN>`
   - Export Format: **JSON**
   - Data Type: **Health Metrics** と **Workouts** (2つ作る必要がある版もある)
   - Metrics: Step Count / Active Energy / Apple Exercise Time / Resting Heart Rate / Heart Rate Variability / VO2 Max / Respiratory Rate / Sleep Analysis / Weight & Body Mass / Body Fat Percentage / Lean Body Mass / Body Mass Index
   - Aggregation (集計): **Days** (日ごと)
   - 期間: 直近 2〜7 日 (毎回少し重ねて送ると取りこぼしが無い)
   - 頻度: 1日数回
4. **Manual Export** で一度送ってみて、VITALOG の **履歴** に「Apple ヘルスケア」の記録が出れば完了

過去の分を一気に送るときは、1回あたり 1〜2週間ずつに分けてください (1回に書き込めるのは新しい順に40件。応答の `deferred` が 0 になるまで送れば続きが入ります)。

## 方法B: iPhone の「ショートカット」(無料・ワークアウト以外)

追加のアプリなしで、毎朝の睡眠・心拍・歩数・体重を送れます。ワークアウトの詳細は送れません。

1. ショートカットアプリ → **+** → 名前「VITALOG 送信」
2. 次のアクションを順に追加:
   1. **ヘルスケアのサンプルを検索** — 種類「睡眠分析」、開始日「過去1日」、値「睡眠中」→ **ヘルスケアのサンプルの詳細を取得: 継続時間** → **統計を計算: 合計** → 名前「睡眠」
   2. 同様に「安静時心拍数」(最新1件)、「心拍変動」(過去1日・平均)、「歩数」(今日・合計)、「体重」(最新1件)、「体脂肪率」(最新1件)
   3. **日付をフォーマット** — カスタム `yyyy-MM-dd` → 名前「今日」
   4. **URL の内容を取得**
      - URL: `https://cfm.<名前>.workers.dev/api/ingest/health`
      - 方法: POST、ヘッダー: `Authorization` = `Bearer <API_TOKEN>`
      - 本文: JSON — `date` = 今日、`sleep_hours` = 睡眠 (時間)、`resting_hr`、`hrv_ms`、`steps`、`weight_kg`、`body_fat_pct`
3. **オートメーション** → **個人用オートメーション** → 「アラームが停止されたとき」または「睡眠集中モードがオフになったとき」→ このショートカット → **すぐに実行**

送れる項目名 (かんたん形式): `date` (必須), `sleep_min` / `sleep_hours`, `deep_min`, `rem_min`, `bed_time`, `wake_time`, `hrv_ms`, `resting_hr`, `steps`, `active_kcal`, `exercise_min`, `vo2max`, `respiratory_rate`, `weight_kg`, `body_fat_pct` (14.2 でも 0.142 でも可), `muscle_kg`, `lean_mass_kg`, `bmi`

## 注意

- `API_TOKEN` はアプリやショートカットの中 (あなたの iPhone 内) に保存されます。ショートカットを他人に共有しないでください
- iPhone がロックされているとヘルスケアを読めないため、起床後に動くトリガーにしています
- 体重計がヘルスケアに書き込んでいるかは、iPhone の「ヘルスケア」→「ブラウズ」→「身体測定値」→「体重」→「データソース」で確認できます
