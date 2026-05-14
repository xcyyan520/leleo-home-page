export async function onRequestGet(context) {
  const { env } = context

  if (!env.DB) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await env.DB.exec(
      `CREATE TABLE IF NOT EXISTS bubbles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        date TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      )`
    )
    const { results } = await env.DB.prepare(
      'SELECT id, text, date FROM bubbles ORDER BY id DESC LIMIT 100'
    ).all()
    return new Response(JSON.stringify(results.reverse()), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'db error' }), {
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

  const { text, date } = body
  if (!text || !text.trim()) {
    return new Response(JSON.stringify({ error: 'text required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await env.DB.exec(
      `CREATE TABLE IF NOT EXISTS bubbles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        date TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      )`
    )
    const { meta } = await env.DB.prepare(
      'INSERT INTO bubbles (text, date) VALUES (?, ?)'
    ).bind(text.trim(), date || '').run()

    return new Response(JSON.stringify({ ok: true, id: meta.last_row_id }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'db error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
