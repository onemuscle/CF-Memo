# CF MEMO — Fitness Notes

クロスフィット・食事・休養に特化したメモWebアプリ。スマホでの利用を前提にしたモバイルファーストのダークUIです。

## 機能

- **今日** — 12週間トレーニングプランの「その日やること」を1画面で表示。AM(CrossFit) / PM(Bodymake・Run・Rest) / 食事パターンをカードで並べ、PMは種目・セット×回数・強度・中止条件まで展開できます。前後の日送り・週カレンダーでの日付切り替え、その日の内容を流し込んだメモの下書き作成、プラン全体 (週ごとの進行・食事パターン・ルール・12週レビュー) の閲覧に対応
- **メモ** — カテゴリ (WOD / 食事 / 休養 / その他)・タグ・複数画像添付に対応
- **検索** — タイトル・本文・タグを対象としたキーワード検索 + カテゴリ絞り込み
- **PR記録** — 種目ごと (Push Press など) にベスト記録・過去履歴・重量の推移グラフを表示。記録入力時にはその種目の過去記録も確認できます
- **WODスキャン** — ホワイトボードのWOD画像を撮影すると自動で文字起こし (OCR / 日本語+英語対応)。結果は保存前に編集でき、自分の記録も添えてメモとして保存されます
- **オフライン動作** — データはすべてブラウザの IndexedDB に保存。OCRのモデル・ワーカーもアプリに同梱しているため、電波の悪いジムでも動作します

## 技術構成

- [Vite](https://vitejs.dev/) + React 18 + TypeScript
- [Tesseract.js](https://tesseract.projectnaptha.com/) によるクライアントサイドOCR (CDN非依存・同梱)
- IndexedDB (メモ・PR記録・画像Blob)
- 依存を最小限にしたプレーンCSS (モバイルファースト)

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm run build    # 型チェック + 本番ビルド (dist/)
npm run preview  # ビルド結果の確認
```

`npm run build` の成果物 (`dist/`) は相対パス構成 (`base: './'`) なので、GitHub Pages などの静的ホスティングにそのまま配置できます。

### OCRアセットについて

- `public/tessdata/` — 言語データ ([tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) の eng / jpn、リポジトリに同梱)
- `public/tesseract/` — ワーカーとWASMコア。`npm run dev` / `npm run build` 時に `scripts/copy-tesseract.mjs` が node_modules から自動コピーします (gitには含まれません)

## トレーニングプランのデータ

「今日」タブが表示するプランは `src/plan/planData.ts` の静的データです。元データは
`CrossFit_BodyMake_12week_Plan_20260813.xlsx` (2026/08/13〜2026/11/04 の12週間プラン) で、
日次ログ・月次カレンダー・トレ詳細・食事パターン・12週レビューの各シートから生成しています。

プランを変更するときはスプレッドシート側を更新し、`src/plan/planData.ts` を差し替えてください。
表示ロジック (日付計算・セッション種別の色分けなど) は `src/plan/plan.ts` にあります。

## データについて

データは端末のブラウザ内 (IndexedDB) にのみ保存され、外部には送信されません。ブラウザのサイトデータを消去すると記録も消えるためご注意ください。
