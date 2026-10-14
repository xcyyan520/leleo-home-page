import { hashPassword, ownerToken, readCookie, VISITOR_COOKIE } from './_lib/visitor.js'

function getLoginPage(error, next) {
  const msg = error ? `<p class="err">${error}</p>` : ''
  const target = JSON.stringify(next || '/thoughts.html')
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
    if (res.ok) { location.href = ${target}; return }
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

  // ── Visitor welcome gate ────────────────────────────────────────────────
  // A stranger landing on the front page is asked for her name once; the
  // answer is recorded in the D1 history the owner can read from 思绪.
  // Only the front page is gated: deep links (project02, shared study pages)
  // stay reachable, so a link the owner sends never dead-ends on a form.
  const isFrontPage = url.pathname === '/' || url.pathname === '/index.html'
  if (isFrontPage && !env.NO_VISITOR_GATE) {
    const ua = request.headers.get('User-Agent') || ''
    const wantsHtml = (request.headers.get('Accept') || '').includes('text/html')
    // Link previews and search crawlers must see the real page: a shared URL
    // that unfurls into a name form looks broken.
    const isBot = /bot|crawler|spider|preview|facebookexternalhit|TelegramBot|WhatsApp|Slackbot|Twitterbot|Discordbot|Googlebot|bingbot|Baiduspider|YisouSpider|Sogou/i.test(ua)
    // Anything unexpected here must fail OPEN: a guest who cannot reach the
    // front page is a worse outcome than a visit that goes unrecorded.
    let isOwner = false
    try { isOwner = !!(await ownerToken(request, env)) } catch { isOwner = true }
    if (wantsHtml && !isBot && !isOwner && !readCookie(request, VISITOR_COOKIE)) {
      // `/welcome`, not `/welcome.html`: Pages 308s the .html form, and a
      // redirect into a redirect shows up as a flash on slow connections.
      const back = encodeURIComponent(url.pathname + url.search)
      return Response.redirect(new URL(`/welcome?back=${back}`, url).toString(), 302)
    }
  }

  // Protect thoughts + bubble API + the owner's visitor history
  const needsAuth = url.pathname.startsWith('/thoughts') || url.pathname.startsWith('/api/bubbles') || url.pathname.startsWith('/api/diary') || url.pathname.startsWith('/api/activity') || url.pathname.startsWith('/visitors')
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
  const token = await ownerToken(request, env)
  if (token) {
    return next()
  }

  // Blocked
  return new Response(getLoginPage(null, url.pathname + url.search), {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
