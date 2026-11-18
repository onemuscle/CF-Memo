export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  /** 例: yourname.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN?: string
  /** Access アプリケーションの Audience (AUD) タグ */
  ACCESS_AUD?: string
  /** ログインを許すメールアドレス (カンマ区切り) */
  ALLOWED_EMAILS?: string
  /** Access サービストークンの Client ID (カンマ区切り。方式Bのときだけ) */
  ALLOWED_SERVICE_TOKEN_IDS?: string
  /** Claude Code / ショートカット用のトークン (wrangler secret put API_TOKEN) */
  API_TOKEN?: string
  /** ローカル開発でのみ "1"。.dev.vars にだけ書く */
  DEV_AUTH_BYPASS?: string
}
