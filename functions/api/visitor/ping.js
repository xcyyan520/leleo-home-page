// POST /api/visitor/ping — a known visitor lands on the front page again.
//
// Without this the history would only ever contain introductions: the visitor
// cookie spares her the form on every return, so nothing would be written when
// she comes back. The ping is deliberately quiet — `touchVisit` folds anything
// inside a 30-minute window into the visit already on record, so refreshing
// the page repeatedly still reads as one visit.

import { VISITOR_COOKIE, readCookie, touchVisit, ensureVisitorSchema, json } from '../../_lib/visitor.js'

export async function onRequestPost(context) {
  const { request, env } = context

  // Not an error worth surfacing: an unknown or absent visitor simply has
  // nothing to record, and the page ignores the answer either way.
  if (!env.DB) return json({ ok: false }, 200)

  const id = readCookie(request, VISITOR_COOKIE)
  if (!id) return json({ ok: false }, 200)

  let body
  try { body = await request.json() } catch { body = {} }

  try {
    await ensureVisitorSchema(env.DB)
    const counted = await touchVisit(env.DB, id, body?.path)
    return json({ ok: true, counted }, 200)
  } catch (e) {
    return json({ ok: false, detail: e?.message || String(e) }, 200)
  }
}
