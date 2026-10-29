// Shared visitor helpers.
//
// Lives under functions/_lib/ on purpose: Cloudflare Pages Functions excludes
// any path segment starting with "_" from routing, so this module is importable
// but never exposed as an endpoint.

import { SESSION_COOKIE, verifySessionTri } from './session.js'

export const VISITOR_COOKIE = 'visitor-id'
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
export const MAX_NAME = 24
export const MAX_NOTE = 60
// A personal site has tens of guests, not thousands. The cap keeps a scripted
// flood from filling the free D1 tier; raise it if the site ever earns an
// audience.
export const MAX_VISITORS = 2000

// Returns the owner's session token when the request carries a valid one.
//
// This used to compare the cookie against hashPassword(env.THOUGHTS_PASSWORD),
// which made the cookie value a password-derived value — see the header of
// functions/_lib/session.js for what that let an attacker do. Now the cookie is
// an opaque token and validity is a row lookup.
//
// The no-cookie path returns before touching D1. This function runs on EVERY
// front-page request (the visitor gate asks whether the caller is the owner),
// and a guest carries no session to look up. A Worker on the Free plan gets
// 10 ms of CPU per request, so one wasted query here would be paid by every
// visitor forever.
export async function ownerToken(request, env) {
  if (!env.THOUGHTS_PASSWORD) return null
  const value = readCookie(request, SESSION_COOKIE)
  if (!value) return null
  return (await verifySessionTri(env.DB, env.THOUGHTS_PASSWORD, value)) ? value : null
}

// Like ownerToken, but distinguishes "not the owner" from "could not check".
//
// The visitor gate must fail OPEN: if D1 is unreachable, a guest redirected to a
// name form she also cannot submit is a worse outcome than a visit that goes
// unrecorded — and the owner would be locked out of her own front page. Every
// endpoint that guards a WRITE uses plain ownerToken, which fails closed.
export async function ownerState(request, env) {
  if (!env.THOUGHTS_PASSWORD) return true
  const value = readCookie(request, SESSION_COOKIE)
  if (!value) return false
  const tri = await verifySessionTri(env.DB, env.THOUGHTS_PASSWORD, value)
  return tri === null ? true : tri
}

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || ''
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? match[1] : null
}

export function mintVisitorId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Visitors are guests, not attackers: strip control characters and collapse
// whitespace so a name can never break the history layout or smuggle a line
// break into a log row.
export function cleanText(raw, max) {
  return String(raw == null ? '' : raw)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

// Compact, dependency-free UA summary. The owner reads this to tell two
// same-named rows apart, so it only needs to be recognisable, not exhaustive.
export function describeUA(ua) {
  const s = String(ua || '')
  const device = /Mobile|iPhone|Android.*Mobile/i.test(s) ? '手机' : /iPad|Tablet/i.test(s) ? '平板' : '电脑'
  let browser = '未知浏览器'
  if (/MicroMessenger/i.test(s)) browser = '微信'
  else if (/QQBrowser/i.test(s)) browser = 'QQ 浏览器'
  else if (/Edg\//i.test(s)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(s)) browser = 'Opera'
  else if (/Firefox\//i.test(s)) browser = 'Firefox'
  else if (/Chrome\//i.test(s)) browser = 'Chrome'
  else if (/Safari\//i.test(s)) browser = 'Safari'
  let os = ''
  if (/Windows/i.test(s)) os = 'Windows'
  else if (/iPhone|iPad|iOS/i.test(s)) os = 'iOS'
  else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS'
  else if (/Android/i.test(s)) os = 'Android'
  else if (/Linux/i.test(s)) os = 'Linux'
  return { device, label: os ? `${browser} · ${os}` : browser }
}

// The DDL is idempotent, but running six statements on every request is pure
// waste. Cloudflare reuses a module instance for a while, so one successful
// pass is enough for that instance's lifetime.
let schemaReady = false

export async function ensureVisitorSchema(db) {
  if (schemaReady) return
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      visits INTEGER NOT NULL DEFAULT 1,
      device TEXT NOT NULL DEFAULT '',
      ua_label TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT ''
    )
  `).run()
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS visitor_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT '/',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visitor_visits (visitor_id)').run()
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_visitors_name ON visitors (name)').run()
  schemaReady = true
}

// Pick a display label that is unique among *currently different* people.
// Re-registering the SAME visitor id keeps its original label, so a returning
// 张伟 never drifts from "张伟" to "张伟 #3".
export async function pickDisplayName(db, name, selfId) {
  const taken = await db
    .prepare('SELECT display_name FROM visitors WHERE name = ? AND id != ?')
    .bind(name, selfId)
    .all()
  const used = new Set((taken.results || []).map(r => r.display_name))
  if (!used.has(name)) return name
  for (let n = 2; n < 200; n++) {
    const candidate = `${name} #${n}`
    if (!used.has(candidate)) return candidate
  }
  return `${name} #${Date.now() % 1000}`
}

// A "visit" is a session, not a page load: the counter only advances when the
// previous sighting is already older than SESSION_GAP, so refreshing the front
// page twenty times still reads as one visit.
export const SESSION_GAP_MINUTES = 30

export async function touchVisit(db, id, path) {
  const row = await db
    .prepare(`SELECT (last_seen <= datetime('now', ?)) AS stale FROM visitors WHERE id = ?`)
    .bind(`-${SESSION_GAP_MINUTES} minutes`, id)
    .first()
  if (!row) return false
  const isNew = !!row.stale
  await db
    .prepare(`UPDATE visitors SET last_seen = datetime('now'), visits = visits + ? WHERE id = ?`)
    .bind(isNew ? 1 : 0, id)
    .run()
  if (isNew) {
    await db.prepare('INSERT INTO visitor_visits (visitor_id, path) VALUES (?, ?)')
      .bind(id, cleanText(path, 120) || '/').run()
  }
  return isNew
}

export function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}
