async function ensureBubblesSchema(db) {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS bubbles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      date TEXT DEFAULT ''
    )`
  )

  const { results } = await db.prepare("PRAGMA table_info('bubbles')").all()
  const cols = new Set((results || []).map(r => String(r.name || '').toLowerCase()))

  if (!cols.has('text')) {
    await db.exec('ALTER TABLE bubbles ADD COLUMN text TEXT')
    if (cols.has('content')) {
      await db.exec(
        "UPDATE bubbles SET text = content WHERE (text IS NULL OR text = '') AND content IS NOT NULL"
      )
    }
    cols.add('text')
  }

  if (!cols.has('date')) {
    await db.exec("ALTER TABLE bubbles ADD COLUMN date TEXT DEFAULT ''")
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
