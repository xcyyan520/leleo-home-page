async function ensureDiarySchema(db) {
  const exists = await db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='diary_entries' LIMIT 1")
    .first()

  if (!exists) {
    await db.prepare(`
      CREATE TABLE diary_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        text TEXT NOT NULL,
        image_url TEXT DEFAULT '',
        image_data TEXT DEFAULT '',
        image_mime TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run()
    return
  }

  // Migration: if old schema has UNIQUE on date, recreate without it
  const schema = await db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='diary_entries'")
    .first()
  if (schema && schema.sql && schema.sql.includes('UNIQUE')) {
    await db.prepare(`
      CREATE TABLE diary_entries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        text TEXT NOT NULL,
        image_url TEXT DEFAULT '',
        image_data TEXT DEFAULT '',
        image_mime TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run()
    await db.prepare('INSERT INTO diary_entries_new SELECT * FROM diary_entries').run()
    await db.prepare('DROP TABLE diary_entries').run()
    await db.prepare('ALTER TABLE diary_entries_new RENAME TO diary_entries').run()
  }
}

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const dateParam = url.searchParams.get('date')

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'no database' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return new Response(JSON.stringify({ error: 'invalid date format, use YYYY-MM-DD' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await ensureDiarySchema(env.DB)

    if (dateParam) {
      // Get all entries for this date (latest first)
      const { results } = await env.DB.prepare(
        'SELECT id, date, text, image_url, image_data, image_mime, created_at, updated_at FROM diary_entries WHERE date = ? ORDER BY id DESC'
      ).bind(dateParam).all()
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' },
      })
    } else {
      // List unique dates + has_image for calendar
      const { results } = await env.DB.prepare(
        "SELECT date, MAX(image_data != '' OR image_url != '') AS has_image FROM diary_entries GROUP BY date ORDER BY date ASC"
      ).all()
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
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

  const { id, date, text, image_url, image_data, image_mime } = body
  if (!text || !text.trim()) {
    return new Response(JSON.stringify({ error: 'text required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await ensureDiarySchema(env.DB)

    if (id) {
      // Update existing entry by id
      await env.DB.prepare(
        `UPDATE diary_entries SET text = ?, image_url = ?, image_data = ?, image_mime = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(text.trim(), image_url || '', image_data || '', image_mime || '', id).run()
      return new Response(JSON.stringify({ ok: true, id }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } else {
      // Insert new entry
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Response(JSON.stringify({ error: 'valid date required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const insertResult = await env.DB.prepare(
        `INSERT INTO diary_entries (date, text, image_url, image_data, image_mime) VALUES (?, ?, ?, ?, ?)`
      ).bind(date, text.trim(), image_url || '', image_data || '', image_mime || '').run()
      return new Response(JSON.stringify({ ok: true, id: insertResult.meta.last_row_id }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: 'db error', detail: e?.message || String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const idParam = url.searchParams.get('id')
  const dateParam = url.searchParams.get('date')

  if (!idParam && !dateParam) {
    return new Response(JSON.stringify({ error: 'id or date param required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'no database' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await ensureDiarySchema(env.DB)
    if (idParam) {
      await env.DB.prepare('DELETE FROM diary_entries WHERE id = ?').bind(idParam).run()
    } else {
      await env.DB.prepare('DELETE FROM diary_entries WHERE date = ?').bind(dateParam).run()
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'db error', detail: e?.message || String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
