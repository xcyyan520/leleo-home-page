// POST /api/visitor  — a visitor introduces herself, or returns.
// GET  /api/visitor  — owner-only history.

import {
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
  MAX_NAME,
  MAX_NOTE,
  MAX_VISITORS,
  cleanText,
  describeUA,
  ensureVisitorSchema,
  pickDisplayName,
  mintVisitorId,
  touchVisit,
  readCookie,
  ownerToken,
  json,
} from '../_lib/visitor.js'

export async function onRequestPost(context) {
  const { request, env } = context

  if (!env.DB) return json({ error: 'no database' }, 500)

  let body
  try { body = await request.json() } catch { return json({ error: 'bad request' }, 400) }

  const name = cleanText(body?.name, MAX_NAME)
  const note = cleanText(body?.note, MAX_NOTE)
  // The page she was actually headed for, so the history reads as journeys
  // rather than a wall of identical "/welcome.html" rows.
  const path = cleanText(body?.path, 120) || '/'
  if (!name) return json({ error: 'name required' }, 400)

  const cf = request.cf || {}
  const { device, label } = describeUA(request.headers.get('User-Agent'))
  const country = cf.country || ''
  const city = cf.city || ''

  try {
    await ensureVisitorSchema(env.DB)

    const existingId = readCookie(request, VISITOR_COOKIE)
    const known = existingId
      ? await env.DB.prepare('SELECT id, name, display_name FROM visitors WHERE id = ?').bind(existingId).first()
      : null

    // A guard against a scripted flood: this endpoint is open by design (a
    // guest must be able to introduce herself), so it needs a ceiling that
    // does not depend on the caller behaving.
    if (!known) {
      const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM visitors').first()
      if ((total?.n || 0) >= MAX_VISITORS) return json({ error: 'too many visitors' }, 429)
    }

    // First contact: mint the identity that makes this person recognisable on
    // every future visit, and give her a label unique among current visitors.
    if (!known) {
      const id = existingId || mintVisitorId()
      const display = await pickDisplayName(env.DB, name, id)
      await env.DB.prepare(`
        INSERT INTO visitors (id, name, display_name, note, visits, device, ua_label, country, city)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
      `).bind(id, name, display, note, device, label, country, city).run()
      await env.DB.prepare('INSERT INTO visitor_visits (visitor_id, path) VALUES (?, ?)')
        .bind(id, path).run()
      return json({ ok: true, returning: false, changed: true, displayName: display, name }, 200, {
        'Set-Cookie': `${VISITOR_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${VISITOR_COOKIE_MAX_AGE}`,
      })
    }

    // Returning visitor: refresh the evidence, keep the original label unless
    // she deliberately typed a different name this time. `changed` tells the
    // page whether this was the first time she saw that label.
    const renamed = name !== known.name
    const display = renamed ? await pickDisplayName(env.DB, name, known.id) : known.display_name
    await env.DB.prepare(`
      UPDATE visitors SET name = ?, display_name = ?, note = ?,
        device = ?, ua_label = ?, country = ?, city = ?
      WHERE id = ?
    `).bind(name, display, note, device, label, country, city, known.id).run()
    await touchVisit(env.DB, known.id, path)

    return json({ ok: true, returning: true, changed: renamed, displayName: display, name }, 200, {
      'Set-Cookie': `${VISITOR_COOKIE}=${known.id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${VISITOR_COOKIE_MAX_AGE}`,
    })
  } catch (e) {
    return json({ error: 'db error', detail: e?.message || String(e) }, 500)
  }
}

// Owner-only history. Same password as 思绪 — no second secret to manage.
export async function onRequestGet(context) {
  const { request, env } = context

  if (!env.DB) return json({ error: 'no database' }, 500)
  if (!(await ownerToken(request, env))) return json({ error: 'unauthorized' }, 401)

  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 500)

  try {
    await ensureVisitorSchema(env.DB)
    const visitors = await env.DB.prepare(`
      SELECT id, name, display_name, note, first_seen, last_seen, visits,
             device, ua_label, country, city
      FROM visitors ORDER BY last_seen DESC LIMIT ?
    `).bind(limit).all()
    const visits = await env.DB.prepare(`
      SELECT v.id, v.visitor_id, v.path, v.created_at, s.display_name
      FROM visitor_visits v LEFT JOIN visitors s ON s.id = v.visitor_id
      ORDER BY v.id DESC LIMIT ?
    `).bind(limit).all()
    const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM visitors').first()
    return json({
      ok: true,
      totalVisitors: total?.n || 0,
      visitors: visitors.results || [],
      visits: visits.results || [],
    })
  } catch (e) {
    return json({ error: 'db error', detail: e?.message || String(e) }, 500)
  }
}
