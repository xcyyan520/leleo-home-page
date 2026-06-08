async function ensureDiarySchema(db) {
  const exists = await db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='diary_entries' LIMIT 1")
    .first()

  if (!exists) {
    await db.prepare(`
      CREATE TABLE diary_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        text TEXT NOT NULL,
        image_url TEXT DEFAULT '',
        image_data TEXT DEFAULT '',
        image_mime TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run()
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
      // Get single entry by date
      const entry = await env.DB.prepare(
        'SELECT id, date, text, image_url, image_data, image_mime, created_at, updated_at FROM diary_entries WHERE date = ?'
      ).bind(dateParam).first()

      if (!entry) {
        return new Response(JSON.stringify(null), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify(entry), {
        headers: { 'Content-Type': 'application/json' },
      })
    } else {
      // List all entries (dates + has_image for calendar)
      const { results } = await env.DB.prepare(
        "SELECT date, (image_data != '' OR image_url != '') AS has_image FROM diary_entries ORDER BY date ASC"
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

  const { date, text, image_url, image_data, image_mime } = body
  if (!text || !text.trim() || !date) {
    return new Response(JSON.stringify({ error: 'date and text required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(JSON.stringify({ error: 'invalid date format, use YYYY-MM-DD' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await ensureDiarySchema(env.DB)

    // Upsert: try update first, then insert if no row affected
    const { meta } = await env.DB.prepare(
      `UPDATE diary_entries SET text = ?, image_url = ?, image_data = ?, image_mime = ?, updated_at = datetime('now') WHERE date = ?`
    ).bind(text.trim(), image_url || '', image_data || '', image_mime || '', date).run()

    if (meta.changes === 0) {
      const insertResult = await env.DB.prepare(
        `INSERT INTO diary_entries (date, text, image_url, image_data, image_mime) VALUES (?, ?, ?, ?, ?)`
      ).bind(date, text.trim(), image_url || '', image_data || '', image_mime || '').run()
      return new Response(JSON.stringify({ ok: true, id: insertResult.meta.last_row_id }), {
        headers: { 'Content-Type': 'application/json' },
      })
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

export async function onRequestDelete(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const dateParam = url.searchParams.get('date')

  if (!dateParam) {
    return new Response(JSON.stringify({ error: 'date param required' }), {
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return new Response(JSON.stringify({ error: 'invalid date format, use YYYY-MM-DD' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await ensureDiarySchema(env.DB)
    await env.DB.prepare('DELETE FROM diary_entries WHERE date = ?').bind(dateParam).run()
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
