import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type { Env } from './env.ts'

/**
 * 本人確認。次のどちらかを満たしたリクエストだけを通す (どちらも無ければ拒否 = fail closed)。
 *
 * 1. Cloudflare Access のログイン (ブラウザ)
 *    Access がメールのワンタイムコードで本人確認し、署名付きトークン (JWT) を付けて
 *    Worker に渡す。ここでは署名・発行元・宛先 (AUD)・メールアドレスを自分で検証する。
 *    Access の設定ミスで素通しになっても、ここで止まるようにするため。
 *
 * 2. API トークン (Claude Code・iPhone ショートカット)
 *    `Authorization: Bearer <API_TOKEN>`。トークンは Cloudflare の Secret にだけ置く。
 *    (Access で /api/ をバイパスする構成 = 方式A)
 *
 * 3. Access のサービストークン (方式B)
 *    /api/ もすべて Access の内側に置く構成。Access が CF-Access-Client-Id/Secret を確認し、
 *    ここでは JWT の common_name が ALLOWED_SERVICE_TOKEN_IDS に含まれるかを確認する。
 */

export interface Principal {
  /** 監査ログに残す名前 */
  actor: string
  kind: 'access' | 'token' | 'dev'
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function jwks(team: string) {
  let set = jwksCache.get(team)
  if (!set) {
    set = createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`))
    jwksCache.set(team, set)
  }
  return set
}

export async function authenticate(req: Request, env: Env): Promise<Principal | null> {
  // ローカル開発専用。本番の wrangler.jsonc には絶対に入れない (.dev.vars にだけ書く)
  if (env.DEV_AUTH_BYPASS === '1' && isLocal(req)) return { actor: 'dev', kind: 'dev' }

  const auth = req.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim()
    if (env.API_TOKEN && env.API_TOKEN.length >= 32 && (await safeEqual(token, env.API_TOKEN))) {
      return { actor: 'agent', kind: 'token' }
    }
    return null
  }

  const jwt = req.headers.get('Cf-Access-Jwt-Assertion') ?? cookie(req, 'CF_Authorization')
  if (jwt && env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    let payload: JWTPayload
    try {
      ;({ payload } = await jwtVerify(jwt, jwks(env.ACCESS_TEAM_DOMAIN), {
        issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
        audience: env.ACCESS_AUD,
      }))
    } catch {
      return null
    }
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : ''
    const allowed = (env.ALLOWED_EMAILS ?? '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
    if (email && allowed.includes(email)) return { actor: email, kind: 'access' }
    // Access のサービストークン (機械用) で通ってきた場合。許可した Client ID だけ通す
    const cn = typeof payload.common_name === 'string' ? payload.common_name : ''
    const services = (env.ALLOWED_SERVICE_TOKEN_IDS ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    if (!email && cn && services.includes(cn)) return { actor: 'agent', kind: 'token' }
    return null
  }
  return null
}

function isLocal(req: Request): boolean {
  const host = new URL(req.url).hostname
  return host === 'localhost' || host === '127.0.0.1'
}

function cookie(req: Request, name: string): string | null {
  const raw = req.headers.get('Cookie')
  if (!raw) return null
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

/** 長さや一致位置で時間差が出ないよう、ハッシュ同士を比較する */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ])
  const x = new Uint8Array(ha)
  const y = new Uint8Array(hb)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}
