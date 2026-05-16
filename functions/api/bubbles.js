async function ensureBubblesSchema(db) {
  const exists = await db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='bubbles' LIMIT 1")
    .first()

  if (!exists) {
    await db
      .prepare("CREATE TABLE bubbles (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, date TEXT DEFAULT '')")
      .run()
  }

  const { results } = await db.prepare("PRAGMA table_info('bubbles')").all()
  const cols = new Set((results || []).map(r => String(r.name || '').toLowerCase()))

  if (!cols.has('text')) {
    await db.prepare('ALTER TABLE bubbles ADD COLUMN text TEXT').run()
    if (cols.has('content')) {
      await db
        .prepare("UPDATE bubbles SET text = content WHERE (text IS NULL OR text = '') AND content IS NOT NULL")
        .run()
    }
    cols.add('text')
  }

  if (!cols.has('date')) {
    await db.prepare("ALTER TABLE bubbles ADD COLUMN date TEXT DEFAULT ''").run()
    cols.add('date')
  }

  return { hasId: cols.has('id') }
}

export async function onRequestGet(context) {
  const { env } = context

  if (!env.DB) {
    return new Response(JSON.stringify({
      error: 'no database',
      hint: 'Missing D1 binding: DB',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const schema = await ensureBubblesSchema(env.DB)
    const idExpr = schema.hasId ? 'id' : 'rowid AS id'
    const idOrder = schema.hasId ? 'id' : 'rowid'
    const { results } = await env.DB.prepare(
      `SELECT ${idExpr}, text, COALESCE(date, '') AS date FROM bubbles ORDER BY ${idOrder} DESC LIMIT 100`
    ).all()
    return new Response(JSON.stringify(results.reverse()), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const detail = e && e.message ? e.message : String(e)
    return new Response(JSON.stringify({ error: 'db error', detail }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function onRequestPost(context) {
  const { request, env } = context

  if (!env.DB) {
    return new Response(JSON.stringify({
      error: 'no database',
      hint: 'Missing D1 binding: DB',
    }), {
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

  const { text, date } = body
  if (!text || !text.trim()) {
    return new Response(JSON.stringify({ error: 'text required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await ensureBubblesSchema(env.DB)
    const { meta } = await env.DB.prepare(
      'INSERT INTO bubbles (text, date) VALUES (?, ?)'
    ).bind(text.trim(), date || '').run()

    return new Response(JSON.stringify({ ok: true, id: meta.last_row_id }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const detail = e && e.message ? e.message : String(e)
    return new Response(JSON.stringify({ error: 'db error', detail }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
