async function ensureActivitySchema(db) {
  const exists = await db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='activity_log' LIMIT 1")
    .first()

  if (!exists) {
    await db.prepare(`
      CREATE TABLE activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL DEFAULT 'xcyyan',
        action TEXT NOT NULL,
        target TEXT DEFAULT '',
        detail TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run()
  }
}

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '30')

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'no database' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await ensureActivitySchema(env.DB)
    const { results } = await env.DB.prepare(
      'SELECT id, username, action, target, detail, created_at FROM activity_log ORDER BY id DESC LIMIT ?'
    ).bind(Math.min(limit, 100)).all()
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'db error', detail: e?.message || String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function onRequestPost(context) {
  const { request, env } = context

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'no database' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { username, action, target, detail } = body
  if (!action) {
    return new Response(JSON.stringify({ error: 'action required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await ensureActivitySchema(env.DB)
    const { meta } = await env.DB.prepare(
      'INSERT INTO activity_log (username, action, target, detail) VALUES (?, ?, ?, ?)'
    ).bind(username || 'xcyyan', action, target || '', detail || '').run()
    return new Response(JSON.stringify({ ok: true, id: meta.last_row_id }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'db error', detail: e?.message || String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
