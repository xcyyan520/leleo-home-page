// GET    /api/avatar  — public: the one avatar every visitor should see.
// POST   /api/avatar  — owner only: replace it.
// DELETE /api/avatar  — owner only: drop it, fall back to the bundled image.
//
// The image lives as a data URI in a one-row settings table rather than in R2
// or KV. A cropped avatar is 320x320 re-encoded to JPEG on the client, which
// lands around 20-40 KB — comfortably inside D1's 1 MB row limit and far
// cheaper than adding a second storage service to a personal site.
//
// GET is deliberately public and deliberately fails open: an avatar that does
// not load is a broken-looking homepage, which is a worse outcome than no
// avatar at all. The WRITES are the opposite — an unauthenticated write to the
// front page's face is defacement, so they require the owner cookie outright.

import { ownerToken, json } from '../_lib/visitor.js'

// A 320x320 JPEG at quality 0.86 measures ~25 KB, so 400 K characters of
// base64 is generous headroom for a PNG that keeps its transparency and still
// nowhere near D1's row limit.
const MAX_AVATAR_CHARS = 400_000
// The whole request body, checked before parsing so an oversized post never
// reaches JSON.parse.
const MAX_BODY_BYTES = 1_000_000

const DATA_URI = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/

/**
 * Checks the decoded BYTES, not just the declared type.
 *
 * The base64 alphabet alone proves nothing: `PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==`
 * is perfectly valid base64 and decodes to `<script>alert(1)</script>`, so a
 * scheme-only check would happily store HTML under an image label. Sniffing the
 * magic number is the difference between "claims to be an image" and "is one".
 *
 * Returns the detected format, or null.
 */
function sniffImage(base64) {
  let head
  try {
    // Only the first few bytes are needed, and atob on a 30KB string just to
    // read its header would be wasted work.
    head = atob(base64.slice(0, 24))
  } catch {
    return null
  }
  const b = i => head.charCodeAt(i)
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'jpeg'
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return 'png'
  // WebP is "RIFF" + 4 size bytes + "WEBP".
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
      b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return 'webp'
  return null
}

// Same trick as the visitor schema: the DDL is idempotent, but Cloudflare
// reuses a module instance for a while, so one successful pass per instance is
// enough.
let ready = false
async function ensureSchema(db) {
  if (ready) return
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
  ready = true
}

export async function onRequestGet(context) {
  const { request, env } = context

  // `owner` lets the editor say "this will show for everyone" up front, instead
  // of letting her crop an image and only then discover a 401.
  let owner = false
  try { owner = !!(await ownerToken(request, env)) } catch { owner = false }

  if (!env.DB) return json({ ok: true, avatar: null, updatedAt: null, owner })

  try {
    await ensureSchema(env.DB)
    const row = await env.DB
      .prepare("SELECT value, updated_at FROM site_settings WHERE key = 'avatar'")
      .first()
    return json({ ok: true, avatar: row?.value || null, updatedAt: row?.updated_at || null, owner })
  } catch {
    return json({ ok: true, avatar: null, updatedAt: null, owner })
  }
}

export async function onRequestPost(context) {
  const { request, env } = context

  if (!env.DB) return json({ error: 'no database' }, 500)
  if (!(await ownerToken(request, env))) return json({ error: 'unauthorized' }, 401)

  const declared = parseInt(request.headers.get('Content-Length') || '0', 10) || 0
  if (declared > MAX_BODY_BYTES) return json({ error: 'too large' }, 413)

  let body
  try { body = await request.json() } catch { return json({ error: 'bad request' }, 400) }

  const avatar = typeof body?.avatar === 'string' ? body.avatar : ''
  if (avatar.length > MAX_AVATAR_CHARS) return json({ error: 'too large' }, 413)
  // The scheme prefix is what keeps this a data URI and not an http:// URL
  // pointing at somebody else's server; the alphabet check keeps the base64
  // syntactically valid so the sniff below cannot throw.
  const match = DATA_URI.exec(avatar)
  if (!match) return json({ error: 'not an image' }, 400)
  const kind = sniffImage(match[2])
  if (!kind) return json({ error: 'not an image' }, 400)
  if (`image/${kind}` !== `image/${match[1]}`) return json({ error: 'not an image' }, 400)

  try {
    await ensureSchema(env.DB)
    await env.DB.prepare(`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES ('avatar', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(avatar).run()
    const row = await env.DB
      .prepare("SELECT updated_at FROM site_settings WHERE key = 'avatar'")
      .first()
    return json({ ok: true, updatedAt: row?.updated_at || null })
  } catch (e) {
    return json({ error: 'db error', detail: e?.message || String(e) }, 500)
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context

  if (!env.DB) return json({ error: 'no database' }, 500)
  if (!(await ownerToken(request, env))) return json({ error: 'unauthorized' }, 401)

  try {
    await ensureSchema(env.DB)
    await env.DB.prepare("DELETE FROM site_settings WHERE key = 'avatar'").run()
    return json({ ok: true, avatar: null })
  } catch (e) {
    return json({ error: 'db error', detail: e?.message || String(e) }, 500)
  }
}
