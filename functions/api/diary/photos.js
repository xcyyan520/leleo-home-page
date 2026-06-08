export async function onRequestGet(context) {
  const { env } = context

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'no database' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Ensure table exists (reuse schema migration)
    const exists = await env.DB
      .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='diary_entries' LIMIT 1")
      .first()
    if (!exists) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { results } = await env.DB.prepare(
      "SELECT date, text, image_url, image_data, image_mime FROM diary_entries WHERE (image_data != '' OR image_url != '') ORDER BY date DESC LIMIT 200"
    ).all()

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
