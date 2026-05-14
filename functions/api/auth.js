async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'thoughts-salt-2026')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

export async function onRequestPost(context) {
  const { request, env } = context

  if (!env.THOUGHTS_PASSWORD) {
    return new Response(JSON.stringify({ ok: true }), {
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

  const { password } = body
  if (!password || password !== env.THOUGHTS_PASSWORD) {
    return new Response(JSON.stringify({ error: 'wrong password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const token = await hashPassword(password)
  const cookie = [
    `thoughts-auth=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=2592000',
  ].join('; ')

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  })
}
