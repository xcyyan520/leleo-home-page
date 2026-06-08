async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'thoughts-salt-2026')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

function getLoginPage(error) {
  const msg = error ? `<p class="err">${error}</p>` : ''
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>思绪</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  background:#08080f; height:100vh; display:flex;
  align-items:center; justify-content:center;
  font-family:'Georgia','Noto Serif SC',serif;
}
.card {
  text-align:center; max-width:320px; width:90vw;
}
.title {
  font-size:28px; color:rgba(200,195,185,0.35);
  letter-spacing:0.4em; margin-bottom:4px;
}
.sub {
  font-size:10px; color:rgba(200,195,185,0.15);
  letter-spacing:0.12em; margin-bottom:36px;
}
${msg ? `.err {
  font-size:12px; color:rgba(220,140,140,0.7);
  margin-bottom:12px;
}` : ''}
.input-wrap {
  display:flex; gap:8px;
  border:1px solid rgba(255,255,255,0.08);
  border-radius:14px; padding:6px 6px 6px 16px;
  background:rgba(255,255,255,0.02);
  transition:border-color 0.3s;
}
.input-wrap:focus-within {
  border-color:rgba(255,255,255,0.18);
}
.input-wrap input {
  flex:1; background:none; border:none; outline:none;
  color:rgba(220,215,205,0.85);
  font-family:inherit; font-size:14px;
  letter-spacing:0.04em;
}
.input-wrap input::placeholder {
  color:rgba(200,195,185,0.2);
}
.input-wrap button {
  background:rgba(200,180,160,0.12);
  border:1px solid rgba(200,180,160,0.2);
  border-radius:10px; color:rgba(220,210,195,0.7);
  padding:8px 18px; font-family:inherit; font-size:13px;
  cursor:pointer; transition:all 0.25s;
  white-space:nowrap;
}
.input-wrap button:hover {
  background:rgba(200,180,160,0.2);
  color:rgba(220,210,195,0.9);
}
</style>
</head>
<body>
<div class="card">
  <div class="title">思绪</div>
  <div class="sub">thoughts drifting...</div>
  ${msg}
  <form method="post" action="/api/auth" class="input-wrap" onsubmit="return submitAuth(event)">
    <input type="password" name="password" placeholder="密码……" autofocus>
    <button type="submit">进入</button>
  </form>
</div>
<script>
async function submitAuth(e) {
  e.preventDefault()
  const pw = e.target.password.value
  if (!pw) return
  const btn = e.target.querySelector('button')
  btn.textContent = '…'
  btn.disabled = true
  try {
    const res = await fetch('/api/auth', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({password:pw})
    })
    if (res.ok) { location.href = '/thoughts.html'; return }
    btn.textContent = '进入'
    btn.disabled = false
    const err = document.createElement('p')
    err.className = 'err'
    err.textContent = '密码不对'
    e.target.parentElement.before(err)
  } catch {
    btn.textContent = '进入'
    btn.disabled = false
  }
}
</script>
</body>
</html>`
}

export async function onRequest(context) {
  const { request, next, env } = context
  const url = new URL(request.url)

  // Protect thoughts + bubble API
  const needsAuth = url.pathname.startsWith('/thoughts') || url.pathname.startsWith('/api/bubbles') || url.pathname.startsWith('/api/diary')
  if (!needsAuth) return next()

  // Let auth API through
  if (url.pathname === '/api/auth') {
    return next()
  }

  // No password configured → allow access
  if (!env.THOUGHTS_PASSWORD) {
    return next()
  }

  // Check cookie
  const cookieHeader = request.headers.get('Cookie') || ''
  const match = cookieHeader.match(/(?:^|;\s*)thoughts-auth=([^;]+)/)
  const cookieValue = match ? match[1] : null

  if (cookieValue) {
    const expected = await hashPassword(env.THOUGHTS_PASSWORD)
    if (cookieValue === expected) {
      return next()
    }
  }

  // Blocked
  return new Response(getLoginPage(), {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
