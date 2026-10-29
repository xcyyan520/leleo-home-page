// POST /api/auth — exchange the owner password for a session cookie.
//
// The cookie no longer carries a password-derived value. See
// functions/_lib/session.js for why that mattered and what replaces it.

import { json } from '../_lib/visitor.js'
import {
  SESSION_COOKIE, SESSION_DAYS,
  clientIp, createSession, loginGate, recordAttempt, revokeSession, safeEqual,
} from '../_lib/session.js'

function cookieFor(token, maxAge) {
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ')
}

export async function onRequestPost(context) {
  const { request, env } = context

  if (!env.THOUGHTS_PASSWORD) {
    return json({ ok: true })
  }

  // A session has to be recorded somewhere. Without D1 there is nothing to
  // verify against later, so refuse instead of silently falling back to the old
  // password-hash cookie — that fallback would look identical to the owner and
  // be a different, weaker scheme underneath.
  if (!env.DB) {
    return json({ error: 'no database' }, 500)
  }

  const ip = clientIp(request)

  // Checked BEFORE parsing or comparing, so a throttled caller does no work.
  const gate = await loginGate(env.DB, ip)
  if (!gate.allowed) {
    return json(
      { error: 'too many attempts', retryAfter: gate.retryAfter },
      429,
      { 'Retry-After': String(gate.retryAfter) },
    )
  }

  let body
  try { body = await request.json() } catch {
    return json({ error: 'bad request' }, 400)
  }

  const password = typeof body?.password === 'string' ? body.password : ''
  // Length is capped before any hashing: an unbounded body is free CPU for an
  // attacker even when the comparison itself is constant-time.
  const ok = password.length > 0 && password.length <= 256 &&
    await safeEqual(password, env.THOUGHTS_PASSWORD)

  await recordAttempt(env.DB, ip, ok)

  if (!ok) {
    return json({ error: 'wrong password' }, 401)
  }

  const ua = request.headers.get('User-Agent') || ''
  const token = await createSession(env.DB, env.THOUGHTS_PASSWORD, ua)

  return json({ ok: true }, 200, {
    'Set-Cookie': cookieFor(token, SESSION_DAYS * 24 * 60 * 60),
  })
}

// DELETE /api/auth — drop this session server-side and clear the cookie. Not
// linked from any page yet; present so a session can be revoked without
// waiting out its 30 days.
export async function onRequestDelete(context) {
  const { request, env } = context
  const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)thoughts-auth=([^;]+)/)?.[1]
  if (token && env.DB && env.THOUGHTS_PASSWORD) {
    await revokeSession(env.DB, env.THOUGHTS_PASSWORD, token)
  }
  return json({ ok: true }, 200, { 'Set-Cookie': cookieFor('', 0) })
}
