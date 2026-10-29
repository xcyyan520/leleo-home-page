// Owner sessions + login rate limiting.
//
// Lives under functions/_lib/ on purpose: Cloudflare Pages Functions excludes
// any path segment starting with "_" from routing, so this module is importable
// but never exposed as an endpoint. It deliberately imports nothing else from
// _lib so there is no import cycle with visitor.js.
//
// ── WHY THE OLD COOKIE HAD TO GO ──────────────────────────────────────────
// `thoughts-auth` used to hold base64(sha256(password + 'thoughts-salt-2026')).
// Two consequences follow from that one line, and neither is fixed by hashing
// harder:
//   1. The cookie VALUE IS the password's derivation. Anyone who reads the
//      cookie can brute-force the password offline, with no server contact and
//      therefore no rate limit.
//   2. The salt is a public constant in a public repository, so one
//      precomputed table covers every deployment of this code.
// Raising the iteration count (PBKDF2 at 600k) touches neither property, and on
// the Workers Free plan the 10 ms CPU budget caps PBKDF2 at roughly 20k
// iterations anyway — three orders of magnitude short of the recommendation.
// So the fix is to stop putting a password-derived value in a cookie at all.
//
// ── WHAT REPLACES IT ──────────────────────────────────────────────────────
// A login mints 32 random bytes. The cookie carries the token; D1 stores only
// sha256(token + passwordFingerprint). Verifying a request is one SHA-256 plus
// one indexed D1 read (0.5-1 ms) — constant regardless of password hashing
// cost — and deleting the row revokes the session. Because the stored id is
// salted with the password fingerprint, changing THOUGHTS_PASSWORD invalidates
// every outstanding session with no extra bookkeeping.
//
// ── WHY NO LEGACY-COOKIE GRACE PERIOD ─────────────────────────────────────
// Accepting the old value "for a while" would keep the offline-brute-force
// path alive for exactly as long as the migration window, which is the thing
// being removed. The cost is one password re-entry, paid once.

export const SESSION_COOKIE = 'thoughts-auth'
export const SESSION_DAYS = 30

// A personal site sees a handful of logins, not thousands. These bound what an
// attacker can spend of the owner's free D1 allowance, not how hard the
// password is to guess — that is PBKDF2's job, and it is scheduled elsewhere.
export const RATE_WINDOW_MINUTES = 10
export const RATE_MAX_PER_IP = 8
// Above this many failures in the window we stop WRITING new rows. Crucially
// this sheds telemetry, it does not reject the request: a global lockout would
// hand any attacker a trivial way to keep the owner out of her own site.
export const RATE_MAX_GLOBAL_LOGGED = 300

const enc = new TextEncoder()

function toHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(input) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(String(input))))
}

// Compares two secrets without leaking a length or a first-differing-index
// through the comparison time. Both sides are hashed first, so the compared
// strings are always 64 hex characters regardless of input length.
export async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)])
  let diff = 0
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i)
  return diff === 0
}

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || ''
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? match[1] : null
}

// Cloudflare sets CF-Connecting-IP at the edge and overwrites anything the
// client sent. X-Forwarded-For is NOT used here on purpose: it is client
// controlled, so trusting it would let an attacker rotate the "IP" on every
// attempt and bypass the per-address limit entirely.
export function clientIp(request) {
  return (request.headers.get('CF-Connecting-IP') || 'unknown').slice(0, 64)
}

// The stored session id. Salting with the password fingerprint means a password
// change strands every existing row without a sweep — they can never be matched
// again because the derived id no longer agrees.
async function sessionId(token, password) {
  const pw = (await sha256Hex(password)).slice(0, 16)
  return sha256Hex(`${token}|${pw}`)
}

export function mintToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

let schemaReady = false
async function ensureSchema(db) {
  if (schemaReady) return
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS owner_sessions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      ua_label TEXT NOT NULL DEFAULT ''
    )
  `).run()
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS auth_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL DEFAULT '',
      ok INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_attempts_window ON auth_attempts (ip, created_at)').run()
  schemaReady = true
}

/**
 * Issues a new session and returns the token to put in the cookie.
 *
 * Expired rows are swept here rather than by a cron: a personal site logs in a
 * few times a month, which is exactly often enough to keep the table at a
 * couple of rows without a scheduled worker.
 */
export async function createSession(db, password, uaLabel = '') {
  await ensureSchema(db)
  await db.prepare("DELETE FROM owner_sessions WHERE expires_at <= datetime('now')").run()
  const token = mintToken()
  await db
    .prepare(`INSERT INTO owner_sessions (id, expires_at, ua_label)
              VALUES (?, datetime('now', ?), ?)`)
    .bind(await sessionId(token, password), `+${SESSION_DAYS} days`, String(uaLabel).slice(0, 80))
    .run()
  return token
}

/**
 * True when the cookie's token matches a live row.
 *
 * Never throws: the callers are a public endpoint (avatar GET) and a page gate,
 * and a D1 hiccup must not turn the front page into a 500. Returning false is
 * the fail-CLOSED choice, which is correct for the WRITE endpoints — with D1
 * down the diary and the bubble APIs are unusable anyway, so the owner cannot
 * do anything in there that she is being denied.
 */
export async function verifySession(db, password, token) {
  return (await verifySessionTri(db, password, token)) === true
}

/**
 * Tri-state verification: `true` valid, `false` invalid, `null` could not tell.
 *
 * The distinction exists for the visitor gate, which must fail OPEN: if D1 is
 * unreachable, redirecting the owner to a name form she also cannot submit is a
 * worse outcome than letting a visit go unrecorded. Every other caller wants the
 * plain boolean and should use verifySession.
 */
export async function verifySessionTri(db, password, token) {
  // No DB binding is "cannot tell", not "not the owner": the distinction is the
  // whole reason this function has three states. Collapsing it to `false` would
  // send the owner to the guest gate on a misconfigured deploy.
  if (!db) return null
  // A missing token or password IS a definite no — there is nothing to look up.
  if (!password || !token || token.length > 128) return false
  try {
    await ensureSchema(db)
    const row = await db
      .prepare(`SELECT id FROM owner_sessions
                WHERE id = ? AND expires_at > datetime('now')`)
      .bind(await sessionId(token, password))
      .first()
    return !!row
  } catch {
    return null
  }
}

export async function revokeSession(db, password, token) {
  try {
    await ensureSchema(db)
    await db.prepare('DELETE FROM owner_sessions WHERE id = ?')
      .bind(await sessionId(token, password)).run()
  } catch { /* a failed revoke is not worth failing the request over */ }
}

/**
 * How many failures from this address are still inside the window.
 *
 * Checked BEFORE the password comparison so a throttled caller costs no work
 * beyond one indexed count. This is the limit that actually protects the site:
 * the password is a single high-entropy secret, but nothing stops a script from
 * guessing it forever until this exists.
 */
export async function loginGate(db, ip) {
  if (!db) return { allowed: true }
  try {
    await ensureSchema(db)
    const row = await db
      .prepare(`SELECT COUNT(*) AS n FROM auth_attempts
                WHERE ip = ? AND ok = 0 AND created_at > datetime('now', ?)`)
      .bind(ip, `-${RATE_WINDOW_MINUTES} minutes`)
      .first()
    const n = row?.n || 0
    if (n < RATE_MAX_PER_IP) return { allowed: true, failures: n }
    return { allowed: false, failures: n, retryAfter: RATE_WINDOW_MINUTES * 60 }
  } catch {
    // Never let a broken counter lock the owner out of her own site.
    return { allowed: true }
  }
}

export async function recordAttempt(db, ip, ok) {
  if (!db) return
  try {
    await ensureSchema(db)
    if (ok) {
      // A correct password clears the address's history so a run of typos
      // followed by success does not leave the owner throttled.
      await db.prepare('DELETE FROM auth_attempts WHERE ip = ?').bind(ip).run()
      await db.prepare("DELETE FROM auth_attempts WHERE created_at < datetime('now', '-1 day')").run()
      return
    }
    const total = await db
      .prepare(`SELECT COUNT(*) AS n FROM auth_attempts
                WHERE ok = 0 AND created_at > datetime('now', ?)`)
      .bind(`-${RATE_WINDOW_MINUTES} minutes`)
      .first()
    // Past the global ceiling we simply stop recording. The request still gets
    // its 401; only the telemetry is dropped, so the table cannot be grown
    // without bound by a flood from many addresses.
    if ((total?.n || 0) < RATE_MAX_GLOBAL_LOGGED) {
      await db.prepare('INSERT INTO auth_attempts (ip, ok) VALUES (?, 0)').bind(ip).run()
    }
    // Opportunistic sweep — cheap and bounded, and keeps the login path free of
    // a scheduled job.
    if (Math.random() < 0.1) {
      await db.prepare("DELETE FROM auth_attempts WHERE created_at < datetime('now', '-1 day')").run()
    }
  } catch { /* counting is best-effort; it must never fail the login */ }
}
