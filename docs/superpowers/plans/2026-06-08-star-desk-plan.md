# 星空桌面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the personal homepage from a left-right split layout into "Star Desk" — floating glass cards on a dark starfield canvas, with a new daily diary feature (星空日记).

**Architecture:** The existing Vue 3 + Vuetify 3 app is refactored from one monolithic App.vue into independent widget components floating on a CSS-positioned canvas. A new D1 table `diary_entries` + Cloudflare Functions API powers the daily diary. The thoughts page (`ThoughtBubbles.vue`, `thoughts.html`) is NOT modified.

**Tech Stack:** Vue 3 (Options API), Vuetify 3, Vite, Cloudflare Pages Functions, D1 (SQLite), TypeIt (typewriter), MetingJS API (music)

---

## File Map

### New Files (8 components + 2 API handlers)
| File | Responsibility |
|---|---|
| `src/components/StarfieldBackground.vue` | Canvas-based starfield particles + CSS star layer + nebula clouds (lightweight fork from ThoughtBubbles) |
| `src/components/ProfileCard.vue` | Avatar, welcome title, TypeIt typewriter text, clock |
| `src/components/DiaryCard.vue` | Shows today's diary entry (text+image preview) or "write something" prompt |
| `src/components/DiaryEditor.vue` | Modal form: text area + image upload (compress to base64) OR image URL + date |
| `src/components/CalendarDialog.vue` | Monthly calendar grid, highlights dates with entries/photos, click to view |
| `src/components/PhotoWall.vue` | Grid of all diary images, each labeled with date |
| `src/components/TagsCard.vue` | Tag chips + social media icon buttons |
| `src/components/ProjectsCard.vue` | Compact horizontal project list with colored left accents |
| `src/components/ControlBar.vue` | Top-right bar: settings, wallpaper, thoughts link, clear screen toggle |
| `src/components/MiniMusicPlayer.vue` | Fixed bottom-right capsule: album art, song/artist, play/pause/skip |
| `functions/api/diary.js` | Diary CRUD: GET (list + by-date), POST (create/update), DELETE |
| `functions/api/diary/photos.js` | GET all diary entries that have images |

### Modified Files
| File | Change |
|---|---|
| `src/App.vue` | Complete rewrite: new template with widget cards instead of left/right split |
| `src/app.js` | Complete rewrite: keep music + wallpaper + cookie logic, remove old layout code |
| `src/config.js` | Remove `polarChart` skills config; keep everything else |
| `functions/_middleware.js` | Add `/api/diary` to `needsAuth` |

### Deleted Files
| File | Reason |
|---|---|
| `src/components/polarchart.vue` | Skills chart removed — personal site, not resume |
| `src/components/hoemright.vue` | Replaced by ProfileCard + ProjectsCard + TagsCard |

### Untouched Files
- `src/components/ThoughtBubbles.vue` — thoughts page (spec requires no changes)
- `src/components/ThoughtBubbles.vue` — reused as starfield particle reference
- `src/components/turntable.vue` — kept in settings dialog
- `src/components/typewriter.vue` — reused in ProfileCard
- `src/components/loader.vue` — reused for loading screen
- `src/components/tabs/*` — kept for settings dialog
- `functions/api/bubbles.js` — no changes
- `functions/api/auth.js` — no changes

---

### Task 1: Diary D1 Table + API Backend

**Files:**
- Create: `functions/api/diary.js`
- Create: `functions/api/diary/photos.js`

- [ ] **Step 1: Create diary CRUD API (`functions/api/diary.js`)**

```javascript
// functions/api/diary.js
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
```

- [ ] **Step 2: Create photos list API (`functions/api/diary/photos.js`)**

```javascript
// functions/api/diary/photos.js
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
```

- [ ] **Step 3: Update middleware to protect diary routes**

Edit `functions/_middleware.js:117` — add `/api/diary` to the `needsAuth` check:

```javascript
// Change line 117 from:
const needsAuth = url.pathname.startsWith('/thoughts') || url.pathname.startsWith('/api/bubbles')

// To:
const needsAuth = url.pathname.startsWith('/thoughts') || url.pathname.startsWith('/api/bubbles') || url.pathname.startsWith('/api/diary')
```

---

### Task 2: StarfieldBackground Component

**Files:**
- Create: `src/components/StarfieldBackground.vue`

- [ ] **Step 1: Create the starfield background component**

This is a lightweight fork of the particle system from `ThoughtBubbles.vue`. Stripped down: fewer particles, no accretion ring, no mouse interaction (static drift only).

```vue
<!-- src/components/StarfieldBackground.vue -->
<template>
  <div class="starfield-bg">
    <!-- CSS stars layer -->
    <div class="css-stars">
      <span v-for="s in stars" :key="s.id" class="star" :style="s.style"></span>
    </div>
    <!-- CSS nebula clouds -->
    <div class="nebula-layer nebula-deep">
      <span v-for="n in nebulae.filter(x=>x.depth===0)" :key="n.id" class="nebula-cloud nebula-cloud--deep" :style="n.style"></span>
    </div>
    <div class="nebula-layer nebula-mid">
      <span v-for="n in nebulae.filter(x=>x.depth===1)" :key="n.id" class="nebula-cloud nebula-cloud--mid" :style="n.style"></span>
    </div>
    <!-- Canvas particles -->
    <canvas ref="particleCanvas" class="particle-canvas"></canvas>
  </div>
</template>

<script>
export default {
  name: 'StarfieldBackground',
  data() {
    return {
      stars: [],
      nebulae: [],
      canvasCtx: null,
      canvasParticles: [],
      canvasWidth: 0,
      canvasHeight: 0,
      rafId: null,
      isMobile: false,
    }
  },
  mounted() {
    this.isMobile = window.innerWidth < 768
    this.generateStars()
    this.generateNebulae()
    this.$nextTick(() => this.initCanvas())
  },
  beforeUnmount() {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', this.resizeCanvas)
  },
  methods: {
    generateStars() {
      const ss = []
      for (let i = 0; i < 50; i++) {
        const size = 0.5 + Math.random() * 2
        ss.push({
          id: `s${i}`,
          style: {
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            width: `${size}px`, height: `${size}px`,
            opacity: 0.1 + Math.random() * 0.5,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${3 + Math.random() * 6}s`,
          },
        })
      }
      this.stars = ss
    },
    generateNebulae() {
      const configs = [
        { color: '70,30,130', x: 10, y: 15, w: 60, h: 55, z: 0 },
        { color: '30,40,100', x: 50, y: 40, w: 55, h: 50, z: 0 },
        { color: '80,35,110', x: 20, y: 30, w: 40, h: 42, z: 1 },
        { color: '100,40,70',  x: 60, y: 25, w: 38, h: 40, z: 1 },
        { color: '160,130,200',x: 35, y: 40, w: 18, h: 16, z: 2 },
        { color: '130,160,190',x: 65, y: 50, w: 16, h: 20, z: 2 },
      ]
      this.nebulae = configs.map((c, i) => ({
        id: `n${i}`,
        depth: c.z,
        style: {
          left: `${c.x}%`, top: `${c.y}%`,
          width: `${c.w}vw`, height: `${c.h}vh`,
          background: c.z === 2
            ? `radial-gradient(ellipse at center, rgba(${c.color},0.15) 0%, rgba(${c.color},0.04) 50%, transparent 75%)`
            : c.z === 1
            ? `radial-gradient(ellipse at center, rgba(${c.color},0.07) 0%, rgba(${c.color},0.01) 50%, transparent 72%)`
            : `radial-gradient(ellipse at center, rgba(${c.color},0.04) 0%, transparent 68%)`,
          animationDuration: `${40 + i * 10}s`,
          animationDelay: `${i * 5}s`,
          filter: c.z === 2 ? 'blur(30px)' : c.z === 1 ? 'blur(50px)' : 'blur(70px)',
        },
      }))
    },
    initCanvas() {
      const c = this.$refs.particleCanvas
      if (!c) return
      this.canvasCtx = c.getContext('2d')
      this.resizeCanvas()
      if (!this.isMobile) this.spawnParticles()
      window.addEventListener('resize', this.resizeCanvas)
      this.animateCanvas()
    },
    resizeCanvas() {
      const c = this.$refs.particleCanvas
      if (!c) return
      const dpr = window.devicePixelRatio || 1
      this.canvasWidth = window.innerWidth
      this.canvasHeight = window.innerHeight
      c.width = this.canvasWidth * dpr
      c.height = this.canvasHeight * dpr
      c.style.width = this.canvasWidth + 'px'
      c.style.height = this.canvasHeight + 'px'
      this.canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    },
    spawnParticles() {
      this.canvasParticles = []
      const count = this.isMobile ? 0 : 40
      const hues = [260, 210, 320, 200, 290, 230, 170, 250]
      for (let i = 0; i < count; i++) {
        this.canvasParticles.push({
          x: Math.random() * this.canvasWidth,
          y: Math.random() * this.canvasHeight,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          size: 0.3 + Math.random() * 1.8,
          opacity: 0.05 + Math.random() * 0.15,
          hue: hues[Math.floor(Math.random() * hues.length)],
          life: Math.random() * 300,
          maxLife: 300 + Math.random() * 200,
        })
      }
    },
    animateCanvas() {
      const ctx = this.canvasCtx
      const w = this.canvasWidth
      const h = this.canvasHeight
      if (!ctx || w === 0 || this.isMobile) {
        this.rafId = requestAnimationFrame(() => this.animateCanvas())
        return
      }
      ctx.clearRect(0, 0, w, h)

      for (const p of this.canvasParticles) {
        p.vx += (Math.random() - 0.5) * 0.005
        p.vy += (Math.random() - 0.5) * 0.005
        p.vx *= 0.998
        p.vy *= 0.998
        p.x += p.vx
        p.y += p.vy
        if (p.x < -20) p.x = w + 20
        if (p.x > w + 20) p.x = -20
        if (p.y < -20) p.y = h + 20
        if (p.y > h + 20) p.y = -20
        p.life++
        if (p.life > p.maxLife) { p.life = 0; p.opacity = 0.05 + Math.random() * 0.15 }
        const lifeFade = p.life < 30 ? p.life / 30 : p.life > p.maxLife - 30 ? (p.maxLife - p.life) / 30 : 1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 40%, 60%, ${p.opacity * lifeFade})`
        ctx.fill()
      }

      this.rafId = requestAnimationFrame(() => this.animateCanvas())
    },
  },
}
</script>

<style scoped>
.starfield-bg {
  position: fixed; inset: 0; z-index: 0;
  background: linear-gradient(170deg, #08081a 0%, #0d0d26 50%, #0a0a1e 100%);
  overflow: hidden; pointer-events: none;
}
.css-stars { position: absolute; inset: 0; }
.star {
  position: absolute; border-radius: 50%;
  background: radial-gradient(circle, rgba(220, 225, 240, 0.9) 0%, rgba(160, 180, 220, 0.3) 50%, transparent 70%);
  animation: star-twinkle ease-in-out infinite;
}
@keyframes star-twinkle {
  0%, 100% { opacity: 0.1; transform: scale(0.7); }
  50%      { opacity: 0.7; transform: scale(1.2); }
}
.nebula-layer { position: absolute; inset: -5%; pointer-events: none; }
.nebula-cloud { position: absolute; border-radius: 50%; opacity: 0.4; }
.nebula-cloud--deep { animation: nebula-breathe-deep ease-in-out infinite alternate; }
.nebula-cloud--mid { animation: nebula-breathe-mid ease-in-out infinite alternate; }
@keyframes nebula-breathe-deep {
  0% { transform: translate(0, 0) scale(0.9); opacity: 0.25; }
  100% { transform: translate(3vw, -2vh) scale(1.1); opacity: 0.5; }
}
@keyframes nebula-breathe-mid {
  0% { transform: translate(0, 0) scale(0.85); opacity: 0.2; }
  100% { transform: translate(-2vw, 2vh) scale(1.15); opacity: 0.45; }
}
.particle-canvas { position: absolute; inset: 0; }
</style>
```

---

### Task 3: ProfileCard Component

**Files:**
- Create: `src/components/ProfileCard.vue`

- [ ] **Step 1: Create ProfileCard — avatar, title, typewriter, clock**

```vue
<!-- src/components/ProfileCard.vue -->
<template>
  <div class="profile-card glass-card" :class="{ 'is-mobile': isMobile }">
    <v-avatar :size="isMobile ? 70 : 90" class="profile-avatar">
      <v-img :src="configdata.avatar" alt="Avatar"></v-img>
    </v-avatar>
    <div class="profile-name">{{ configdata.welcometitle }}</div>
    <div class="profile-typewriter">
      <typewriter />
    </div>
  </div>
</template>

<script>
import typewriter from './typewriter.vue'

export default {
  name: 'ProfileCard',
  components: { typewriter },
  props: {
    configdata: { type: Object, required: true },
  },
  data() {
    return { isMobile: false }
  },
  mounted() {
    this.isMobile = window.innerWidth < 768
  },
}
</script>

<style scoped>
.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 20px 18px;
  text-align: center;
  animation: card-float 5s ease-in-out infinite;
}
@keyframes card-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}
.profile-avatar {
  border: 2px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 30px rgba(139, 122, 170, 0.15);
}
.profile-name {
  margin-top: 14px;
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(225, 220, 215, 0.85);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  letter-spacing: 0.04em;
}
.profile-typewriter {
  margin-top: 8px;
  transform: scale(0.7);
  transform-origin: center top;
}
.is-mobile .profile-name { font-size: 1.1rem; }
.is-mobile .profile-typewriter { transform: scale(0.55); }
</style>
```

---

### Task 4: TagsCard Component

**Files:**
- Create: `src/components/TagsCard.vue`

- [ ] **Step 1: Create TagsCard — tags + social icons**

```vue
<!-- src/components/TagsCard.vue -->
<template>
  <div class="tags-card glass-card" :class="{ 'is-mobile': isMobile }">
    <div class="tags-section">
      <span class="section-label">✦ 标签</span>
      <div class="tags-wrap">
        <span v-for="tag in filteredTags" :key="tag" class="tag-chip">{{ tag }}</span>
      </div>
    </div>
    <div class="social-section">
      <span class="section-label">✦ 社交</span>
      <div class="social-icons">
        <a v-for="item in socialIcons" :key="item.icon" :href="item.link" target="_blank" class="social-link" :title="item.icon">
          <v-icon :icon="item.icon" size="18"></v-icon>
        </a>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TagsCard',
  props: {
    tags: { type: Array, default: () => [] },
    socialIcons: { type: Array, default: () => [] },
  },
  data() {
    return { isMobile: false }
  },
  computed: {
    filteredTags() {
      return (this.tags || []).filter(t => t && t.trim())
    },
  },
  mounted() {
    this.isMobile = window.innerWidth < 768
  },
}
</script>

<style scoped>
.tags-card { padding: 16px 18px; animation: card-float 5.5s ease-in-out infinite; animation-delay: 0.5s; }
@keyframes card-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
.section-label {
  display: block;
  font-size: 10px;
  color: rgba(200, 195, 185, 0.35);
  letter-spacing: 0.12em;
  margin-bottom: 8px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.tags-wrap { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
.tag-chip {
  font-size: 11px; padding: 3px 10px;
  background: rgba(139, 122, 170, 0.12);
  border-radius: 10px;
  color: rgba(200, 190, 220, 0.65);
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.social-icons { display: flex; gap: 2px; flex-wrap: wrap; }
.social-link {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  color: rgba(200, 195, 185, 0.35);
  transition: all 0.25s;
  text-decoration: none;
}
.social-link:hover { color: rgba(220, 210, 195, 0.7); background: rgba(255, 255, 255, 0.04); }
</style>
```

---

### Task 5: ProjectsCard Component

**Files:**
- Create: `src/components/ProjectsCard.vue`

- [ ] **Step 1: Create ProjectsCard — compact horizontal project list**

```vue
<!-- src/components/ProjectsCard.vue -->
<template>
  <div class="projects-card glass-card">
    <span class="section-label">✦ 项目</span>
    <div class="project-list">
      <div
        v-for="(item, i) in displayProjects"
        :key="i"
        class="project-item"
        :style="{ '--accent': accentColors[i % accentColors.length] }"
        @click="item.show = !item.show"
      >
        <div class="project-thumb">
          <v-img :src="item.img" width="36" height="36" cover class="project-img"></v-img>
        </div>
        <div class="project-info">
          <div class="project-title">{{ item.title }}</div>
          <div class="project-subtitle">{{ item.subtitle }}</div>
          <div v-if="item.show" class="project-text">{{ item.text }}</div>
        </div>
        <a :href="item.url" target="_blank" class="project-go" @click.stop>{{ item.go }}</a>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ProjectsCard',
  props: {
    projects: { type: Array, default: () => [] },
  },
  data() {
    return {
      accentColors: ['rgba(139,122,170,0.4)', 'rgba(160,130,150,0.4)', 'rgba(120,140,170,0.4)', 'rgba(170,140,140,0.4)'],
    }
  },
  computed: {
    displayProjects() {
      return (this.projects || []).slice(0, 5)
    },
  },
}
</script>

<style scoped>
.projects-card { padding: 16px 18px; animation: card-float 6s ease-in-out infinite; animation-delay: 0.3s; }
@keyframes card-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
.section-label {
  display: block;
  font-size: 10px; color: rgba(200, 195, 185, 0.35);
  letter-spacing: 0.12em; margin-bottom: 10px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.project-list { display: flex; flex-direction: column; gap: 8px; }
.project-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  border-left: 2px solid var(--accent);
  cursor: pointer;
  transition: all 0.25s;
}
.project-item:hover { background: rgba(255, 255, 255, 0.04); }
.project-thumb { flex-shrink: 0; }
.project-img { border-radius: 6px; }
.project-info { flex: 1; min-width: 0; }
.project-title { font-size: 12px; color: rgba(215, 210, 200, 0.8); font-weight: 500; }
.project-subtitle { font-size: 10px; color: rgba(170, 165, 155, 0.4); margin-top: 2px; }
.project-text { font-size: 10px; color: rgba(180, 175, 165, 0.5); margin-top: 4px; line-height: 1.5; }
.project-go {
  font-size: 10px; color: rgba(180, 170, 160, 0.4);
  text-decoration: none; white-space: nowrap;
  transition: color 0.2s;
  padding: 4px 8px; border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}
.project-go:hover { color: rgba(200, 190, 180, 0.7); }
</style>
```

---

### Task 6: MiniMusicPlayer Component

**Files:**
- Create: `src/components/MiniMusicPlayer.vue`

- [ ] **Step 1: Create MiniMusicPlayer — fixed bottom-right capsule**

This is a pure presentation component. All audio logic stays in App.vue/app.js.

```vue
<!-- src/components/MiniMusicPlayer.vue -->
<template>
  <div class="mini-player glass-card" :class="{ 'is-mobile': isMobile }">
    <div class="player-art" :style="artStyle">
      <v-progress-circular v-if="audioLoading" indeterminate size="22" width="2" color="rgba(200,180,160,0.5)"></v-progress-circular>
    </div>
    <div class="player-info" @click="$emit('expand')">
      <div class="player-song">{{ song?.title || '未在播放' }}</div>
      <div class="player-artist">{{ song?.author || '点击打开播放器' }}</div>
    </div>
    <div class="player-controls">
      <button class="player-btn" @click="$emit('prev')" title="上一首">
        <v-icon icon="mdi-skip-previous" size="16"></v-icon>
      </button>
      <button class="player-btn player-btn--play" @click="$emit('play')" :title="isPlaying ? '暂停' : '播放'">
        <v-icon :icon="isPlaying ? 'mdi-pause' : 'mdi-play'" size="18"></v-icon>
      </button>
      <button class="player-btn" @click="$emit('next')" title="下一首">
        <v-icon icon="mdi-skip-next" size="16"></v-icon>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MiniMusicPlayer',
  props: {
    song: { type: Object, default: null },
    isPlaying: { type: Boolean, default: false },
    audioLoading: { type: Boolean, default: false },
  },
  emits: ['play', 'prev', 'next', 'expand'],
  data() {
    return { isMobile: false }
  },
  computed: {
    artStyle() {
      return {
        background: this.song?.url ? 'rgba(180, 160, 140, 0.2)' : 'rgba(255,255,255,0.03)',
        border: this.isPlaying ? '1px solid rgba(200,180,160,0.3)' : '1px solid rgba(255,255,255,0.05)',
      }
    },
  },
  mounted() {
    this.isMobile = window.innerWidth < 768
  },
}
</script>

<style scoped>
.mini-player {
  position: fixed; bottom: 20px; right: 20px; z-index: 50;
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px; border-radius: 24px;
  backdrop-filter: blur(16px);
  animation: card-float 4.5s ease-in-out infinite;
}
@keyframes card-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
.is-mobile { bottom: 12px; right: 12px; left: 12px; width: auto; border-radius: 20px; }
.player-art {
  width: 32px; height: 32px; border-radius: 50%;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.player-info {
  flex: 1; min-width: 0; cursor: pointer;
  overflow: hidden;
}
.player-song {
  font-size: 11px; color: rgba(215, 210, 200, 0.75);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.player-artist {
  font-size: 9px; color: rgba(170, 165, 155, 0.35);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.player-controls { display: flex; gap: 4px; align-items: center; }
.player-btn {
  width: 28px; height: 28px; border-radius: 50%;
  border: none; background: rgba(255, 255, 255, 0.04);
  color: rgba(200, 195, 185, 0.45);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.player-btn:hover { background: rgba(255, 255, 255, 0.08); color: rgba(220, 210, 200, 0.7); }
.player-btn--play { width: 32px; height: 32px; background: rgba(200, 180, 160, 0.1); color: rgba(200, 180, 160, 0.6); }
.player-btn--play:hover { background: rgba(200, 180, 160, 0.18); }
</style>
```

---

### Task 7: ControlBar Component

**Files:**
- Create: `src/components/ControlBar.vue`

- [ ] **Step 1: Create ControlBar — top-right unified controls**

```vue
<!-- src/components/ControlBar.vue -->
<template>
  <div class="control-bar" :class="{ 'is-mobile': isMobile }">
    <button class="ctrl-btn" @click="$emit('wallpaper')" title="壁纸">
      <v-icon icon="mdi-wallpaper" size="18"></v-icon>
    </button>
    <button class="ctrl-btn" @click="$emit('thoughts')" title="思绪">
      <v-icon icon="mdi-brain" size="18"></v-icon>
    </button>
    <button class="ctrl-btn" @click="$emit('calendar')" title="日记回顾">
      <v-icon icon="mdi-calendar-month" size="18"></v-icon>
    </button>
    <button class="ctrl-btn" @click="$emit('photos')" title="照片墙">
      <v-icon icon="mdi-image-multiple" size="18"></v-icon>
    </button>
    <button class="ctrl-btn" @click="$emit('settings')" title="设置">
      <v-icon icon="mdi-cog" size="18"></v-icon>
    </button>
    <button
      class="ctrl-btn"
      :class="{ 'ctrl-btn--active': isClearScreen }"
      @click="$emit('clearscreen')"
      :title="isClearScreen ? '显示内容' : '清屏'"
    >
      <v-icon :icon="isClearScreen ? 'mdi-eye' : 'mdi-eye-off'" size="18"></v-icon>
    </button>
  </div>
</template>

<script>
export default {
  name: 'ControlBar',
  props: {
    isClearScreen: { type: Boolean, default: false },
  },
  emits: ['settings', 'thoughts', 'wallpaper', 'clearscreen', 'calendar', 'photos'],
  data() {
    return { isMobile: false }
  },
  mounted() {
    this.isMobile = window.innerWidth < 768
  },
}
</script>

<style scoped>
.control-bar {
  position: fixed; top: 20px; right: 20px; z-index: 50;
  display: flex; gap: 6px;
  padding: 6px 10px;
  background: rgba(15, 13, 25, 0.5);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 20px;
}
.is-mobile { top: 10px; right: 10px; gap: 3px; padding: 4px 8px; }
.ctrl-btn {
  width: 34px; height: 34px; border-radius: 50%;
  border: none; background: transparent;
  color: rgba(200, 195, 185, 0.35);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.ctrl-btn:hover { color: rgba(220, 210, 195, 0.7); background: rgba(255, 255, 255, 0.05); }
.ctrl-btn--active { color: rgba(200, 180, 220, 0.6); background: rgba(139, 122, 170, 0.12); }
.is-mobile .ctrl-btn { width: 30px; height: 30px; }
</style>
```

---

### Task 8: DiaryCard Component

**Files:**
- Create: `src/components/DiaryCard.vue`

- [ ] **Step 1: Create DiaryCard — today's entry display**

```vue
<!-- src/components/DiaryCard.vue -->
<template>
  <div class="diary-card glass-card" :class="{ 'is-mobile': isMobile }">
    <span class="section-label">✦ 星空日记</span>
    
    <div v-if="loading" class="diary-loading">
      <v-progress-circular indeterminate size="18" width="2" color="rgba(200,180,160,0.3)"></v-progress-circular>
    </div>

    <div v-else-if="!entry" class="diary-empty">
      <p class="diary-empty-text">今天想写点什么？</p>
      <button class="diary-action-btn" @click="$emit('edit')">
        <v-icon icon="mdi-feather" size="14"></v-icon>
        <span>写下此刻</span>
      </button>
    </div>

    <div v-else class="diary-content">
      <div class="diary-date">{{ formatDate(entry.date) }}</div>
      <p class="diary-text">{{ entry.text }}</p>
      <div v-if="hasImage" class="diary-image-preview">
        <img :src="imageSrc" alt="日记图片" class="diary-thumb" @click="$emit('viewImage', imageSrc)" />
      </div>
      <div class="diary-actions">
        <button class="diary-action-btn" @click="$emit('edit')">
          <v-icon icon="mdi-pencil" size="12"></v-icon>
          <span>编辑</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DiaryCard',
  props: {
    entry: { type: Object, default: null },
    loading: { type: Boolean, default: false },
  },
  emits: ['edit', 'viewImage'],
  data() {
    return { isMobile: false }
  },
  computed: {
    hasImage() {
      return !!(this.entry?.image_data || this.entry?.image_url)
    },
    imageSrc() {
      return this.entry?.image_data || this.entry?.image_url || ''
    },
  },
  methods: {
    formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr + 'T00:00:00')
      return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
    },
  },
  mounted() {
    this.isMobile = window.innerWidth < 768
  },
}
</script>

<style scoped>
.diary-card { padding: 16px 18px; animation: card-float 5s ease-in-out infinite; animation-delay: 0.8s; }
@keyframes card-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
.section-label {
  display: block;
  font-size: 10px; color: rgba(200, 195, 185, 0.35);
  letter-spacing: 0.12em; margin-bottom: 8px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.diary-loading { text-align: center; padding: 16px 0; }
.diary-empty { text-align: center; padding: 12px 0; }
.diary-empty-text { font-size: 12px; color: rgba(180, 175, 170, 0.4); margin-bottom: 10px; }
.diary-content { }
.diary-date { font-size: 9px; color: rgba(200, 195, 185, 0.3); margin-bottom: 6px; }
.diary-text {
  font-size: 12px; line-height: 1.7; color: rgba(215, 210, 200, 0.7);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
  overflow: hidden;
}
.diary-image-preview { margin-top: 8px; }
.diary-thumb {
  width: 100%; max-height: 120px; object-fit: cover;
  border-radius: 8px; cursor: pointer; opacity: 0.8;
  transition: opacity 0.2s;
}
.diary-thumb:hover { opacity: 1; }
.diary-actions { display: flex; gap: 6px; margin-top: 10px; }
.diary-action-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 12px; border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(200, 195, 185, 0.4);
  font-size: 11px; cursor: pointer; transition: all 0.2s;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.diary-action-btn:hover { background: rgba(255, 255, 255, 0.06); color: rgba(220, 215, 205, 0.65); }
</style>
```

---

### Task 9: DiaryEditor Component

**Files:**
- Create: `src/components/DiaryEditor.vue`

- [ ] **Step 1: Create DiaryEditor — modal form with text + image + date**

```vue
<!-- src/components/DiaryEditor.vue -->
<template>
  <div class="editor-overlay" @click.self="$emit('close')">
    <div class="editor-card" @click.stop>
      <span class="editor-title">✦ 星空日记</span>
      
      <input v-model="editDate" type="date" class="editor-date" />

      <textarea
        v-model="editText"
        class="editor-textarea"
        placeholder="今天想写点什么？..."
        maxlength="500"
        rows="5"
        ref="textarea"
      ></textarea>

      <!-- Image tab switcher -->
      <div class="editor-tabs">
        <button :class="{ active: imgTab === 'upload' }" @click="imgTab = 'upload'">上传图片</button>
        <button :class="{ active: imgTab === 'url' }" @click="imgTab = 'url'">粘贴链接</button>
        <button v-if="hasImage" class="tab-remove" @click="clearImage">移除图片</button>
      </div>

      <div v-if="imgTab === 'upload'" class="upload-area" @click="$refs.fileInput.click()" @dragover.prevent @drop.prevent="onDrop">
        <div v-if="!imagePreview" class="upload-hint">
          <v-icon icon="mdi-cloud-upload" size="20"></v-icon>
          <span>点击或拖拽上传图片</span>
        </div>
        <img v-else :src="imagePreview" class="upload-preview" />
        <input ref="fileInput" type="file" accept="image/*" @change="onFileSelected" hidden />
      </div>

      <div v-if="imgTab === 'url'" class="url-input-wrap">
        <input v-model="imageUrl" type="text" class="url-input" placeholder="https://example.com/image.jpg" />
        <img v-if="imageUrl" :src="imageUrl" class="url-preview" @error="imageUrlError = true" v-show="!imageUrlError" />
        <span v-if="imageUrlError" class="url-error">图片加载失败，请检查链接</span>
      </div>

      <div class="editor-actions">
        <button class="editor-btn cancel" @click="$emit('close')">取消</button>
        <button class="editor-btn save" @click="save" :disabled="!editText.trim() || saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DiaryEditor',
  props: {
    existingEntry: { type: Object, default: null },
  },
  emits: ['close', 'saved'],
  data() {
    const today = new Date().toISOString().slice(0, 10)
    return {
      editDate: this.existingEntry?.date || today,
      editText: this.existingEntry?.text || '',
      imgTab: this.existingEntry?.image_data ? 'upload' : (this.existingEntry?.image_url ? 'url' : 'upload'),
      imagePreview: this.existingEntry?.image_data || null,
      imageUrl: this.existingEntry?.image_url || '',
      imageUrlError: false,
      imageData: this.existingEntry?.image_data || '',
      saving: false,
    }
  },
  computed: {
    hasImage() {
      return !!(this.imagePreview || this.imageUrl)
    },
  },
  mounted() {
    this.$nextTick(() => this.$refs.textarea?.focus())
  },
  methods: {
    async onFileSelected(e) {
      const file = e.target.files?.[0]
      if (file) await this.compressAndSet(file)
    },
    async onDrop(e) {
      const file = e.dataTransfer?.files?.[0]
      if (file) await this.compressAndSet(file)
    },
    async compressAndSet(file) {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = await createImageBitmap(file)
        const maxWidth = 1200
        const scale = Math.min(1, maxWidth / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        this.imagePreview = dataUrl
        this.imageData = dataUrl
        this.imageUrl = ''
        this.imageUrlError = false
      } catch (e) {
        console.error('Image compress error:', e)
      }
    },
    clearImage() {
      this.imagePreview = null
      this.imageData = ''
      this.imageUrl = ''
      this.imageUrlError = false
    },
    async save() {
      if (!this.editText.trim()) return
      this.saving = true
      try {
        const body = {
          date: this.editDate,
          text: this.editText.trim(),
          image_url: this.imageUrl,
          image_data: this.imageData,
          image_mime: this.imageData ? 'image/jpeg' : '',
        }
        const res = await fetch('/api/diary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          this.$emit('saved')
          this.$emit('close')
        } else {
          alert('保存失败，请重试')
        }
      } catch (e) {
        alert('保存失败: ' + e.message)
      }
      this.saving = false
    },
  },
}
</script>

<style scoped>
.editor-overlay {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(3, 3, 10, 0.8); backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center;
}
.editor-card {
  background: rgba(15, 13, 22, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  padding: 24px 20px 18px;
  width: 420px; max-width: 92vw; max-height: 90vh; overflow-y: auto;
  display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
.editor-title {
  font-size: 14px; color: rgba(220, 210, 200, 0.55);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  letter-spacing: 0.1em; text-align: center;
}
.editor-date {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px; padding: 6px 10px;
  color: rgba(215, 210, 200, 0.7);
  font-family: 'Georgia', 'Noto Serif SC', serif; font-size: 13px;
  outline: none; color-scheme: dark;
}
.editor-textarea {
  width: 100%; background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px; padding: 12px 14px;
  color: rgba(225, 220, 210, 0.85);
  font-family: 'Georgia', 'Noto Serif SC', serif; font-size: 13px;
  line-height: 1.7; resize: vertical; outline: none;
}
.editor-textarea:focus { border-color: rgba(255, 255, 255, 0.14); }
.editor-textarea::placeholder { color: rgba(190, 185, 175, 0.2); }
.editor-tabs { display: flex; gap: 6px; }
.editor-tabs button {
  padding: 4px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(200, 195, 185, 0.4); font-size: 11px; cursor: pointer;
  font-family: 'Georgia', 'Noto Serif SC', serif; transition: all 0.2s;
}
.editor-tabs button.active { background: rgba(139, 122, 170, 0.12); color: rgba(200, 180, 220, 0.7); border-color: rgba(139, 122, 170, 0.25); }
.editor-tabs button:hover:not(.active) { color: rgba(220, 215, 205, 0.55); }
.tab-remove { color: rgba(220, 140, 140, 0.4) !important; }
.upload-area {
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 10px; padding: 16px; text-align: center; cursor: pointer;
  transition: border-color 0.2s; min-height: 60px;
  display: flex; align-items: center; justify-content: center;
}
.upload-area:hover { border-color: rgba(255, 255, 255, 0.15); }
.upload-hint {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  color: rgba(200, 195, 185, 0.3); font-size: 11px;
}
.upload-preview { max-width: 100%; max-height: 180px; border-radius: 8px; }
.url-input-wrap { display: flex; flex-direction: column; gap: 8px; }
.url-input {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px; padding: 8px 10px;
  color: rgba(220, 215, 205, 0.8);
  font-family: 'Georgia', 'Noto Serif SC', serif; font-size: 12px; outline: none;
}
.url-input::placeholder { color: rgba(190, 185, 175, 0.2); }
.url-preview { max-width: 100%; max-height: 160px; border-radius: 8px; object-fit: cover; }
.url-error { font-size: 10px; color: rgba(220, 140, 140, 0.5); }
.editor-actions { display: flex; gap: 8px; justify-content: flex-end; }
.editor-btn {
  padding: 7px 20px; border-radius: 10px; border: none;
  font-size: 12px; cursor: pointer; transition: all 0.25s;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.editor-btn.cancel { background: rgba(255, 255, 255, 0.03); color: rgba(200, 195, 185, 0.45); border: 1px solid rgba(255, 255, 255, 0.05); }
.editor-btn.cancel:hover { background: rgba(255, 255, 255, 0.06); color: rgba(220, 215, 205, 0.6); }
.editor-btn.save {
  background: rgba(139, 122, 170, 0.15); color: rgba(210, 200, 225, 0.8);
  border: 1px solid rgba(139, 122, 170, 0.25);
}
.editor-btn.save:hover:not(:disabled) { background: rgba(139, 122, 170, 0.25); }
.editor-btn.save:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
```

---

### Task 10: CalendarDialog Component

**Files:**
- Create: `src/components/CalendarDialog.vue`

- [ ] **Step 1: Create CalendarDialog — monthly calendar with diary entry browsing**

```vue
<!-- src/components/CalendarDialog.vue -->
<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="calendar-card" @click.stop>
      <!-- Month navigation -->
      <div class="cal-header">
        <button class="cal-nav" @click="prevMonth"><v-icon icon="mdi-chevron-left" size="18"></v-icon></button>
        <span class="cal-month">{{ year }}年{{ month }}月</span>
        <button class="cal-nav" @click="nextMonth"><v-icon icon="mdi-chevron-right" size="18"></v-icon></button>
      </div>

      <!-- Weekday headers -->
      <div class="cal-weekdays">
        <span v-for="d in weekdays" :key="d" class="cal-weekday">{{ d }}</span>
      </div>

      <!-- Day grid -->
      <div class="cal-grid">
        <div v-for="(cell, i) in calendarCells" :key="i"
          class="cal-cell"
          :class="{
            'cal-cell--dim': !cell.currentMonth,
            'cal-cell--today': cell.isToday,
            'cal-cell--selected': cell.date === selectedDate,
            'cal-cell--has-entry': cell.hasEntry,
            'cal-cell--has-photo': cell.hasPhoto,
          }"
          @click="cell.currentMonth && cell.hasEntry && selectDate(cell.date)"
        >
          <span class="cal-day-num">{{ cell.day }}</span>
          <span v-if="cell.hasPhoto" class="cal-dot cal-dot--photo"></span>
          <span v-else-if="cell.hasEntry" class="cal-dot"></span>
        </div>
      </div>

      <!-- Selected date preview -->
      <div v-if="selectedEntry" class="cal-preview">
        <div class="cal-preview-date">{{ formatDate(selectedDate) }}</div>
        <p class="cal-preview-text">{{ selectedEntry.text }}</p>
        <img v-if="previewImage" :src="previewImage" class="cal-preview-img" @click="$emit('viewImage', previewImage)" />
      </div>
      <div v-else-if="selectedDate && !loadingEntry" class="cal-no-entry">
        这天没有记录
      </div>
      <div v-if="loadingEntry" class="cal-loading">
        <v-progress-circular indeterminate size="16" width="2" color="rgba(200,180,160,0.3)"></v-progress-circular>
      </div>

      <button class="cal-close" @click="$emit('close')">关闭</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CalendarDialog',
  emits: ['close', 'viewImage'],
  data() {
    const now = new Date()
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],
      allEntries: [],
      selectedDate: null,
      selectedEntry: null,
      loadingEntry: false,
    }
  },
  computed: {
    calendarCells() {
      const today = new Date().toISOString().slice(0, 10)
      const daysInMonth = new Date(this.year, this.month, 0).getDate()
      const firstDow = new Date(this.year, this.month - 1, 1).getDay()
      const entrySet = new Set(this.allEntries.map(e => e.date))
      const photoSet = new Set(this.allEntries.filter(e => e.has_image).map(e => e.date))
      const cells = []

      // Previous month filler
      const prevDays = new Date(this.year, this.month - 1, 0).getDate()
      for (let i = firstDow - 1; i >= 0; i--) {
        cells.push({ day: prevDays - i, currentMonth: false })
      }

      // Current month
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${this.year}-${String(this.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        cells.push({
          day: d,
          currentMonth: true,
          date: dateStr,
          isToday: dateStr === today,
          hasEntry: entrySet.has(dateStr),
          hasPhoto: photoSet.has(dateStr),
        })
      }

      // Next month filler
      const remaining = 7 - (cells.length % 7)
      if (remaining < 7) {
        for (let d = 1; d <= remaining; d++) {
          cells.push({ day: d, currentMonth: false })
        }
      }
      return cells
    },
    previewImage() {
      if (!this.selectedEntry) return null
      return this.selectedEntry.image_data || this.selectedEntry.image_url || null
    },
  },
  async mounted() {
    await this.fetchEntries()
  },
  methods: {
    async fetchEntries() {
      try {
        const res = await fetch('/api/diary')
        if (res.ok) this.allEntries = await res.json()
      } catch (e) { console.error('Failed to load diary entries:', e) }
    },
    prevMonth() {
      if (this.month === 1) { this.year--; this.month = 12 }
      else { this.month-- }
      this.selectedDate = null
      this.selectedEntry = null
    },
    nextMonth() {
      if (this.month === 12) { this.year++; this.month = 1 }
      else { this.month++ }
      this.selectedDate = null
      this.selectedEntry = null
    },
    async selectDate(dateStr) {
      this.selectedDate = dateStr
      this.loadingEntry = true
      try {
        const res = await fetch(`/api/diary?date=${dateStr}`)
        if (res.ok) {
          const data = await res.json()
          this.selectedEntry = data
        } else {
          this.selectedEntry = null
        }
      } catch (e) { this.selectedEntry = null }
      this.loadingEntry = false
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      const parts = dateStr.split('-')
      return `${parseInt(parts[0])}年${parseInt(parts[1])}月${parseInt(parts[2])}日`
    },
  },
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(3, 3, 10, 0.8); backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center;
}
.calendar-card {
  background: rgba(15, 13, 22, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px; padding: 20px; width: 380px; max-width: 92vw;
  max-height: 90vh; overflow-y: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
.cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.cal-month { font-size: 15px; color: rgba(215, 210, 200, 0.75); font-family: 'Georgia', 'Noto Serif SC', serif; }
.cal-nav { background: none; border: none; color: rgba(200, 195, 185, 0.35); cursor: pointer; padding: 4px; border-radius: 6px; }
.cal-nav:hover { color: rgba(220, 210, 195, 0.7); background: rgba(255,255,255,0.04); }
.cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 4px; }
.cal-weekday { font-size: 10px; color: rgba(200, 195, 185, 0.25); padding: 4px 0; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.cal-cell {
  aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-radius: 10px; cursor: default; position: relative; font-size: 12px;
  color: rgba(200, 195, 185, 0.5); transition: background 0.15s;
}
.cal-cell--dim { color: rgba(200, 195, 185, 0.15); }
.cal-cell--has-entry { cursor: pointer; }
.cal-cell--has-entry:hover { background: rgba(255, 255, 255, 0.04); }
.cal-cell--today { color: rgba(200, 180, 220, 0.7); font-weight: bold; }
.cal-cell--selected { background: rgba(139, 122, 170, 0.15); color: rgba(210, 200, 220, 0.8); }
.cal-dot {
  width: 4px; height: 4px; border-radius: 50%; background: rgba(139, 122, 170, 0.5);
  position: absolute; bottom: 4px;
}
.cal-dot--photo { background: rgba(200, 180, 130, 0.5); }
.cal-preview { margin-top: 14px; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 10px; }
.cal-preview-date { font-size: 10px; color: rgba(200, 195, 185, 0.3); margin-bottom: 4px; }
.cal-preview-text { font-size: 12px; color: rgba(210, 205, 195, 0.65); line-height: 1.7; font-family: 'Georgia', 'Noto Serif SC', serif; }
.cal-preview-img { width: 100%; max-height: 160px; object-fit: cover; border-radius: 8px; margin-top: 8px; cursor: pointer; opacity: 0.8; }
.cal-preview-img:hover { opacity: 1; }
.cal-no-entry { text-align: center; padding: 14px; color: rgba(180, 175, 170, 0.3); font-size: 12px; }
.cal-loading { text-align: center; padding: 14px; }
.cal-close { display: block; margin: 14px auto 0; padding: 6px 20px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.03); color: rgba(200,195,185,0.4); font-size: 12px; cursor: pointer; font-family: 'Georgia', 'Noto Serif SC', serif; }
.cal-close:hover { background: rgba(255,255,255,0.06); color: rgba(220,215,205,0.6); }
</style>
```

---

### Task 11: PhotoWall Component

**Files:**
- Create: `src/components/PhotoWall.vue`

- [ ] **Step 1: Create PhotoWall — image grid from all diary entries with images**

```vue
<!-- src/components/PhotoWall.vue -->
<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="photowall-card" @click.stop>
      <span class="pw-title">✦ 照片墙</span>

      <div v-if="loading" class="pw-loading">
        <v-progress-circular indeterminate size="18" width="2" color="rgba(200,180,160,0.3)"></v-progress-circular>
      </div>

      <div v-else-if="photos.length === 0" class="pw-empty">
        还没有记录带图片~
      </div>

      <div v-else class="pw-grid">
        <div
          v-for="item in photos"
          :key="item.date"
          class="pw-item"
          @click="selected = item"
        >
          <img :src="item.image_data || item.image_url" class="pw-img" loading="lazy" />
          <span class="pw-date">{{ formatDate(item.date) }}</span>
        </div>
      </div>

      <!-- Detail overlay -->
      <div v-if="selected" class="pw-detail" @click="selected = null">
        <img :src="selected.image_data || selected.image_url" class="pw-detail-img" @click.stop />
        <div class="pw-detail-date">{{ formatDate(selected.date) }}</div>
        <p class="pw-detail-text">{{ selected.text }}</p>
      </div>

      <button class="pw-close" @click="$emit('close')">关闭</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PhotoWall',
  emits: ['close'],
  data() {
    return {
      photos: [],
      loading: true,
      selected: null,
    }
  },
  async mounted() {
    await this.fetchPhotos()
  },
  methods: {
    async fetchPhotos() {
      try {
        const res = await fetch('/api/diary/photos')
        if (res.ok) this.photos = await res.json()
      } catch (e) { console.error('Failed to load photos:', e) }
      this.loading = false
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      const parts = dateStr.split('-')
      return `${parseInt(parts[0])}.${parseInt(parts[1])}.${parseInt(parts[2])}`
    },
  },
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(3, 3, 10, 0.8); backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center;
}
.photowall-card {
  background: rgba(15, 13, 22, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px; padding: 20px;
  width: 500px; max-width: 94vw; max-height: 88vh; overflow-y: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
.pw-title {
  display: block; text-align: center;
  font-size: 14px; color: rgba(220, 210, 200, 0.5);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  letter-spacing: 0.1em; margin-bottom: 14px;
}
.pw-loading { text-align: center; padding: 20px; }
.pw-empty { text-align: center; padding: 20px; color: rgba(180, 175, 170, 0.3); font-size: 12px; }
.pw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
.pw-item { position: relative; border-radius: 10px; overflow: hidden; cursor: pointer; aspect-ratio: 1; }
.pw-img { width: 100%; height: 100%; object-fit: cover; opacity: 0.75; transition: all 0.25s; }
.pw-item:hover .pw-img { opacity: 1; transform: scale(1.05); }
.pw-date {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 4px 8px; background: linear-gradient(transparent, rgba(0,0,0,0.6));
  font-size: 9px; color: rgba(220, 215, 210, 0.5);
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.pw-detail {
  position: fixed; inset: 0; z-index: 65;
  background: rgba(3, 3, 12, 0.92); backdrop-filter: blur(16px);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 20px; cursor: pointer;
}
.pw-detail-img { max-width: 90vw; max-height: 60vh; border-radius: 12px; cursor: default; }
.pw-detail-date { margin-top: 14px; font-size: 11px; color: rgba(200, 195, 185, 0.3); }
.pw-detail-text {
  margin-top: 8px; font-size: 14px; color: rgba(220, 215, 205, 0.7);
  line-height: 1.8; text-align: center; max-width: 400px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.pw-close { display: block; margin: 14px auto 0; padding: 6px 20px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.03); color: rgba(200,195,185,0.4); font-size: 12px; cursor: pointer; font-family: 'Georgia', 'Noto Serif SC', serif; }
.pw-close:hover { background: rgba(255,255,255,0.06); color: rgba(220,215,205,0.6); }
</style>
```

---

### Task 12: App.vue + app.js Rewrite

**Files:**
- Modify: `src/App.vue`
- Modify: `src/app.js`

- [ ] **Step 1: Rewrite `src/App.vue` template**

Replace the entire template with:

```html
<template>
  <v-app class="star-desk-app" style="overflow: hidden;" :style="appFrameStyle">
    <!-- Loading overlay -->
    <transition name="fade">
      <div class="loading" v-show="isloading">
        <loader></loader>
      </div>
    </transition>

    <!-- Wallpaper layer (kept from original) -->
    <video v-if="videosrc" autoplay loop muted class="video-bg" ref="VdPlayer"
      :style="appFrameStyle">
      <source :src="videosrc" type="video/mp4">
    </video>

    <!-- Starfield background -->
    <StarfieldBackground v-if="!videosrc && !imageurl" />

    <!-- Main canvas -->
    <div v-show="!isloading && !isClearScreen" class="desk-canvas">
      <div class="desk-left" :style="deskLeftStyle">
        <ProfileCard :configdata="configdata" :formattedTime="formattedTime" :formattedDate="formattedDate" />
        <DiaryCard :entry="todayDiary" :loading="diaryLoading" @edit="showDiaryEditor = true" />
        <TagsCard :tags="personalizedtags" :socialIcons="socialPlatformIcons" />
      </div>
      <div class="desk-right" :style="deskRightStyle">
        <ProjectsCard :projects="projectcards" />
      </div>
    </div>

    <!-- Fixed UI -->
    <ControlBar
      :isClearScreen="isClearScreen"
      @settings="openSettings"
      @thoughts="openThoughts"
      @wallpaper="openWallpaper"
      @clearscreen="toggleClearScreen"
      @calendar="showCalendar = true"
      @photos="showPhotoWall = true"
    />

    <MiniMusicPlayer
      v-show="!isloading"
      :song="currentSong"
      :isPlaying="isPlaying"
      :audioLoading="audioLoading"
      @play="togglePlay"
      @prev="previousTrack"
      @next="nextTrack"
      @expand="openMusicPlayer"
    />

    <!-- Hidden audio element -->
    <audio v-show="false" ref="audioPlayer" :src="musicinfo?.[playlistIndex]?.url"
      @waiting="onWaiting" @canplay="onCanPlay">
    </audio>

    <!-- Diary dialogs -->
    <DiaryEditor v-if="showDiaryEditor" :existingEntry="todayDiary" @close="showDiaryEditor = false" @saved="loadTodayDiary" />
    <CalendarDialog v-if="showCalendar" @close="showCalendar = false" />
    <PhotoWall v-if="showPhotoWall" @close="showPhotoWall = false" />

    <!-- Settings dialog (kept from original, with tabs) -->
    <v-dialog v-model="dialogSettings" width="1000">
      <v-card elevation="3" style="backdrop-filter: blur(10px); background: rgba(20,18,30,0.95);">
        <v-tabs v-model="tab" :items="settingTabs" align-tabs="center" height="60" slider-color="rgba(139,122,170,0.5)">
          <template v-slot:tab="{ item }">
            <v-tab :prepend-icon="item.icon" :text="item.text" :value="item.value" class="text-none"></v-tab>
          </template>
          <template v-slot:item="{ item }">
            <v-tabs-window-item :value="item.value" class="pa-4">
              <component v-if="item.value !== 'tab-3' || !musicinfoLoading" :is="item.component"
                @cancel="dialogSettings = false"
                :musicinfo="item.value === 'tab-3' ? musicinfo : []"
                :currentIndex="item.value === 'tab-3' ? playlistIndex : null"
                :isPlaying="item.value === 'tab-3' ? isPlaying : null"
                :audioPlayer="item.value === 'tab-3' ? audioPlayer : null"
                :fromLyrics="item.value === 'tab-3' ? lyrics : null"
                :audioLoading="item.value === 'tab-3' ? audioLoading : null"
                @update:current-index="updateCurrentIndex"
                @update:is-playing="updateIsPlaying"
                @update:current-lyrics="updateLyrics"
              ></component>
            </v-tabs-window-item>
          </template>
        </v-tabs>
      </v-card>
    </v-dialog>

    <!-- About dialog (kept from original) -->
    <v-dialog v-model="dialogAbout" width="700">
      <v-card class="ma-3 pa-2" variant="tonal" rounded="lg" style="text-align: center; backdrop-filter: blur(10px);">
        <template v-slot:title><span class="leleo-card-title">关于</span></template>
        <div style="display: flex; flex-direction: column; align-items: center;">
          <p class="ma-6">
            <span v-for="item in configdata.statement">{{ item }}<br></span>
          </p>
        </div>
      </v-card>
    </v-dialog>
  </v-app>
</template>
```

- [ ] **Step 2: Rewrite `src/app.js`**

Replace the entire script with new logic that:
- Keeps music player, wallpaper, cookie, time logic from original
- Adds diary loading, dialog toggles
- Removes old layout code and hover-music-player hack

```javascript
import ProfileCard from './components/ProfileCard.vue'
import DiaryCard from './components/DiaryCard.vue'
import DiaryEditor from './components/DiaryEditor.vue'
import CalendarDialog from './components/CalendarDialog.vue'
import PhotoWall from './components/PhotoWall.vue'
import TagsCard from './components/TagsCard.vue'
import ProjectsCard from './components/ProjectsCard.vue'
import ControlBar from './components/ControlBar.vue'
import MiniMusicPlayer from './components/MiniMusicPlayer.vue'
import StarfieldBackground from './components/StarfieldBackground.vue'

import typewriter from './components/typewriter.vue'
import loader from './components/loader.vue'
import tab1 from './components/tabs/tab1.vue'
import tab2 from './components/tabs/tab2.vue'
import tab3 from './components/tabs/tab3.vue'

import config from './config.js'
import { getCookie } from './utils/cookieUtils.js'
import { setMeta, getFormattedTime, getFormattedDate, dataConsole } from './utils/common.js'
import { useDisplay } from 'vuetify'

export default {
  components: {
    ProfileCard, DiaryCard, DiaryEditor, CalendarDialog, PhotoWall,
    TagsCard, ProjectsCard, ControlBar, MiniMusicPlayer,
    StarfieldBackground, typewriter, loader, tab1, tab2, tab3,
  },
  setup() {
    const { xs, sm, md } = useDisplay()
    return { xs, sm, md }
  },
  data() {
    return {
      isloading: false,
      isClearScreen: false,
      formattedTime: '',
      formattedDate: '',
      configdata: config,
      dialogSettings: false,
      dialogAbout: false,
      personalizedtags: null,
      videosrc: '',
      imageurl: '',
      isPlaying: false,
      playlistIndex: 0,
      audioLoading: false,
      musicinfo: null,
      musicinfoLoading: false,
      lyrics: {},
      socialPlatformIcons: null,
      projectcards: null,
      tab: null,
      settingTabs: [
        { icon: 'mdi-pencil-plus', text: '样式预览', value: 'tab-1', component: 'tab1' },
        { icon: 'mdi-wallpaper', text: '背景预览', value: 'tab-2', component: 'tab2' },
        { icon: 'mdi-music-circle-outline', text: '音乐播放', value: 'tab-3', component: 'tab3' },
      ],
      // Diary
      showDiaryEditor: false,
      showCalendar: false,
      showPhotoWall: false,
      todayDiary: null,
      diaryLoading: false,
    }
  },
  computed: {
    currentSong() {
      return this.musicinfo?.[this.playlistIndex] || null
    },
    audioPlayer() {
      return this.$refs.audioPlayer
    },
    appFrameStyle() {
      return this.xs
        ? { height: '100%', width: '100%', top: '0', left: '0' }
        : this.sm
        ? { height: '98%', width: '98%', top: '1%', left: '1%' }
        : { height: '96.6%', width: '99%', top: '1.7%', left: '0.5%' }
    },
    deskLeftStyle() {
      return this.xs ? {} : { width: '36%' }
    },
    deskRightStyle() {
      return this.xs ? {} : { width: '52%', marginTop: '0' }
    },
  },
  async mounted() {
    if (import.meta.env.VITE_CONFIG) {
      this.configdata = JSON.parse(import.meta.env.VITE_CONFIG)
    }
    this.projectcards = this.configdata.projectcards
    this.socialPlatformIcons = this.configdata.socialPlatformIcons
    this.personalizedtags = this.configdata.tags
    this.isloading = true

    this.dataConsole()
    this.setMeta(this.configdata.metaData.title, this.configdata.metaData.description, this.configdata.metaData.keywords, this.configdata.metaData.icon)

    this.setMainProperty()

    // Load wallpaper + wait for it
    await this.initBackground()
    this.formattedTime = this.getFormattedTime(new Date())
    this.formattedDate = this.getFormattedDate(new Date())
    setTimeout(() => { this.isloading = false }, 500)

    setInterval(() => {
      this.formattedTime = this.getFormattedTime(new Date())
    }, 1000)

    await this.getMusicInfo()
    this.setupAudioListener()
    await this.loadTodayDiary()
  },
  beforeDestroy() {
    this.$refs.audioPlayer?.removeEventListener('ended', this.nextTrack)
  },
  watch: {
    isClearScreen(val) {
      if (!this.videosrc) return
      if (val) {
        this.$refs.VdPlayer.style.zIndex = 0
        this.$refs.VdPlayer.controls = true
      } else {
        this.$refs.VdPlayer.style.zIndex = -100
        this.$refs.VdPlayer.controls = false
      }
    },
    audioLoading(val) {
      this.isPlaying = !val
    },
  },
  methods: {
    getCookie, setMeta, getFormattedTime, getFormattedDate, dataConsole,

    setMainProperty() {
      const root = document.documentElement
      let leleodata = this.getCookie('leleodata')
      if (leleodata) {
        root.style.setProperty('--leleo-welcomtitle-color', leleodata.color.welcometitlecolor)
        root.style.setProperty('--leleo-vcard-color', leleodata.color.themecolor)
        root.style.setProperty('--leleo-brightness', leleodata.brightness + '%')
        root.style.setProperty('--leleo-blur', leleodata.blur + 'px')
      } else {
        root.style.setProperty('--leleo-welcomtitle-color', this.configdata.color.welcometitlecolor)
        root.style.setProperty('--leleo-vcard-color', this.configdata.color.themecolor)
        root.style.setProperty('--leleo-brightness', this.configdata.brightness + '%')
        root.style.setProperty('--leleo-blur', this.configdata.blur + 'px')
      }
    },

    async initBackground() {
      const root = document.documentElement
      let leleodatabackground = this.getCookie('leleodatabackground')
      const bg = leleodatabackground || this.configdata.background
      const device = this.xs ? 'mobile' : 'pc'

      if (bg?.[device]?.type === 'pic') {
        root.style.setProperty('--leleo-background-image-url', `url('${bg[device].datainfo.url}')`)
        this.imageurl = bg[device].datainfo.url
      } else if (bg?.[device]?.type === 'video') {
        this.videosrc = bg[device].datainfo.url
      }

      // Wait for background to load
      if (this.imageurl) {
        await new Promise((resolve) => {
          const img = new Image()
          img.onload = resolve
          img.onerror = resolve
          img.src = this.imageurl
          setTimeout(resolve, 2500)
        })
      } else if (this.videosrc) {
        await new Promise((resolve) => {
          const video = this.$refs.VdPlayer
          if (video) {
            video.onloadedmetadata = () => setTimeout(resolve, 200)
            video.onerror = resolve
          }
          setTimeout(resolve, 2500)
        })
      }
    },

    // Music (kept from original)
    async getMusicInfo() {
      this.musicinfoLoading = true
      try {
        const response = await fetch(`https://api.i-meto.com/meting/api?server=${this.configdata.musicPlayer.server}&type=${this.configdata.musicPlayer.type}&id=${this.configdata.musicPlayer.id}`)
        if (!response.ok) throw new Error('Network error')
        this.musicinfo = await response.json()
        this.musicinfoLoading = false
      } catch (error) {
        console.error('Music load failed:', error)
      }
    },
    setupAudioListener() {
      this.$refs.audioPlayer?.addEventListener('ended', this.nextTrack)
    },
    togglePlay() {
      if (!this.isPlaying) {
        this.audioPlayer?.play()
      } else {
        this.audioPlayer?.pause()
      }
      this.isPlaying = !this.musicinfoLoading && !this.isPlaying
    },
    previousTrack() {
      this.playlistIndex = this.playlistIndex > 0 ? this.playlistIndex - 1 : (this.musicinfo?.length || 1) - 1
      this.updateAudio()
    },
    nextTrack() {
      this.playlistIndex = this.playlistIndex < (this.musicinfo?.length || 1) - 1 ? this.playlistIndex + 1 : 0
      this.updateAudio()
    },
    updateAudio() {
      if (this.audioPlayer && this.currentSong) {
        this.audioPlayer.src = this.currentSong.url
        this.isPlaying = true
        this.audioPlayer.play()
      }
    },
    updateCurrentIndex(index) { this.playlistIndex = index; this.updateAudio() },
    updateIsPlaying(isPlaying) { this.isPlaying = isPlaying },
    updateLyrics(lyrics) { this.lyrics = lyrics },
    onWaiting() { this.audioLoading = true },
    onCanPlay() { this.audioLoading = false },

    // UI actions
    openSettings() { this.dialogSettings = true },
    openThoughts() { window.location.href = '/thoughts.html' },
    openWallpaper() { this.tab = 'tab-2'; this.dialogSettings = true },
    openMusicPlayer() { this.tab = 'tab-3'; this.dialogSettings = true },
    toggleClearScreen() { this.isClearScreen = !this.isClearScreen },

    // Diary
    async loadTodayDiary() {
      this.diaryLoading = true
      const today = new Date().toISOString().slice(0, 10)
      try {
        const res = await fetch(`/api/diary?date=${today}`)
        if (res.ok) {
          const data = await res.json()
          this.todayDiary = data
        }
      } catch (e) { /* ignore */ }
      this.diaryLoading = false
    },
  },
}
```

- [ ] **Step 3: Update App.vue styles**

Replace the `<style scoped>` block with:

```html
<style scoped>
@import url(/css/app.less);
@import url(/css/mobile.less);

.star-desk-app {
  background: #08081a;
}

/* Wallpaper */
.video-bg {
  position: fixed; object-fit: cover; z-index: -100;
  border-radius: 16px;
}

/* Glass card base (used by child components) */
.glass-card {
  background: rgba(20, 18, 40, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  transition: border-color 0.3s;
}
.glass-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

/* Canvas layout */
.desk-canvas {
  position: relative; z-index: 1;
  display: flex; gap: 24px;
  padding: 80px 24px 100px;
  max-width: 1300px; margin: 0 auto;
  height: 100vh; box-sizing: border-box;
}
.desk-left {
  display: flex; flex-direction: column; gap: 16px;
  overflow-y: auto;
  padding-right: 4px;
}
.desk-right {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

/* Loading */
.loading {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: center; justify-content: center;
  background: #08081a;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.6s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Mobile */
@media (max-width: 767px) {
  .desk-canvas {
    flex-direction: column; gap: 12px;
    padding: 56px 10px 100px; height: auto; min-height: 100vh;
    overflow-y: auto;
  }
  .desk-left { width: 100% !important; overflow-y: visible; }
  .desk-right { width: 100% !important; overflow-y: visible; }
  .glass-card { backdrop-filter: none; -webkit-backdrop-filter: none; background: rgba(20, 18, 40, 0.7); }
}
</style>
```

---

### Task 13: Config Cleanup

**Files:**
- Modify: `src/config.js`

- [ ] **Step 1: Remove skills config from `src/config.js`**

Delete lines 48-52 (the `polarChart` section):

```javascript
// REMOVE these lines:
// polarChart: {
//   skills: [...],
//   skillPoints: [...],
// },
```

Leave everything else intact (metaData, avatar, welcometitle, color, brightness, blur, tags, background, socialPlatformIcons, typeWriterStrings, musicPlayer, wallpaper, projectcards, statement).

---

### Task 14: Cleanup Old Files

**Files:**
- Delete: `src/components/polarchart.vue`
- Delete: `src/components/hoemright.vue`

- [ ] **Step 1: Delete old component files**

Run: `rm "src/components/polarchart.vue" "src/components/hoemright.vue"`

---

### Task 15: Build and Verify

- [ ] **Step 1: Install dependencies (if needed) and build**

Run: `npm install`
Run: `npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 2: Verify build output**

Run: `ls dist/`
Expected: `index.html`, `thoughts.html`, `assets/`, `css/`, `fonts/`, `img/`, `thoughts/` directories exist.

- [ ] **Step 3: Check that thoughts page is untouched**

Run: `diff <(git show HEAD:thoughts.html) thoughts.html`
Expected: No diff (thoughts.html unchanged).

- [ ] **Step 4: Verify key files exist in build**

Run: `ls dist/assets/`
Expected: Generated JS/CSS assets include all new components.

---

### Task 16: Commit

- [ ] **Step 1: Stage all changes**

Run:
```
git add src/App.vue src/app.js src/config.js
git add src/components/StarfieldBackground.vue src/components/ProfileCard.vue src/components/DiaryCard.vue src/components/DiaryEditor.vue
git add src/components/CalendarDialog.vue src/components/PhotoWall.vue src/components/TagsCard.vue src/components/ProjectsCard.vue
git add src/components/ControlBar.vue src/components/MiniMusicPlayer.vue
git add functions/api/diary.js functions/api/diary/photos.js
git add functions/_middleware.js
git rm src/components/polarchart.vue src/components/hoemright.vue
git add docs/superpowers/specs/2026-06-08-star-desk-design.md docs/superpowers/plans/2026-06-08-star-desk-plan.md
```

- [ ] **Step 2: Commit**

```
git commit -m "feat: Star Desk redesign — floating glass cards + daily diary feature"
```
