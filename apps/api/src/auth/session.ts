import * as jose from 'jose'

const COOKIE_NAME = 'dg_session'
const DEFAULT_MAX_AGE_SEC = 7 * 24 * 60 * 60 // 7 days

export interface SessionPayload {
  wallet: string
  exp: number
}

export function getSessionSecret(): Uint8Array {
  const isProduction = process.env.NODE_ENV === 'production'
  const secret =
    process.env.SESSION_SECRET ??
    process.env.JWT_SECRET ??
    (!isProduction ? 'dev-secret-min-32-chars-for-session-signing' : undefined)
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET or JWT_SECRET (min 32 chars) required for auth')
  }
  return new TextEncoder().encode(secret)
}

export function createSessionToken(wallet: string, maxAgeSec = DEFAULT_MAX_AGE_SEC): Promise<string> {
  const secret = getSessionSecret()
  const now = Math.floor(Date.now() / 1000)
  return new jose.SignJWT({ wallet })
    .setProtectedHeader({ alg: 'HS256' })
    // `setExpirationTime` expects an absolute timestamp or time expression,
    // not just a max-age value. Use unix time + maxAgeSec.
    .setExpirationTime(now + maxAgeSec)
    .setIssuedAt()
    .sign(secret)
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getSessionSecret()
    const { payload } = await jose.jwtVerify(token, secret)
    const wallet = payload.wallet as string
    if (!wallet || typeof wallet !== 'string') return null
    return { wallet, exp: (payload.exp as number) ?? 0 }
  } catch {
    return null
  }
}

export function getCookieName(): string {
  return COOKIE_NAME
}

export function getCookieOptions(secure: boolean): {
  httpOnly: boolean
  sameSite: 'lax' | 'strict' | 'none'
  secure: boolean
  path: string
  maxAge: number
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: DEFAULT_MAX_AGE_SEC,
  }
}
