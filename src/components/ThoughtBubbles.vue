<template>
  <div class="memory-chamber" ref="chamber" @mousemove="onMouseMove" @touchmove="onTouchMove">
    <!-- ═══ Layer 0: canvas — starfield, drifting dust, reveal accretion ═══ -->
    <canvas ref="fxCanvas" class="fx-canvas"></canvas>
    <div class="nebula-wash" aria-hidden="true"></div>
    <div class="grain" aria-hidden="true"></div>

    <!-- ═══ 星云：只有光点，没有文字 ═══ -->
    <transition-group v-show="mode === 'nebula'" name="point-swap" tag="div" class="point-field">
      <button
        v-for="p in points"
        :key="p.uid"
        type="button"
        class="light-point"
        :style="p.style"
        @click.stop="open(p.data, $event)"
      >
        <span class="lp-drift">
          <span class="lp-inner">
            <span class="lp-halo"></span>
            <span class="lp-core"></span>
          </span>
        </span>
      </button>
    </transition-group>

    <!-- ═══ 瀑布流：把记忆全铺开 ═══ -->
    <div v-show="mode === 'stream'" class="stream-view">
      <header class="stream-head">
        <h1>记忆瀑布</h1>
        <p v-if="ready">{{ pool.length }} 段思绪，沉在星云里</p>
        <p v-else>正在打捞记忆…</p>
      </header>
      <div class="stream-wall">
        <article
          v-for="t in pool"
          :key="t.key"
          class="memory-card memory-card--wall"
          :style="{ '--accent': t.color, '--halo': t.halo }"
          @click="open(t, $event)"
        >
          <p class="mc-text">{{ t.text }}</p>
          <footer class="mc-foot">
            <span class="mc-persona">{{ t.name }}</span>
            <span v-if="t.date" class="mc-date">{{ t.date }}</span>
          </footer>
        </article>
      </div>
    </div>

    <!-- ═══ 展开的记忆卡 ═══ -->
    <transition name="veil">
      <div v-if="revealed" class="reveal-veil" @click="close">
        <article class="memory-card memory-card--full" :style="revealStyle" @click.stop>
          <span class="mc-quote mc-quote--open">「</span>
          <span class="mc-quote mc-quote--close">」</span>
          <p class="mc-text">{{ revealed.text }}</p>
          <footer class="mc-foot mc-foot--full">
            <span class="mc-persona">{{ revealed.name }}</span>
            <span v-if="revealed.date" class="mc-date">{{ revealed.date }}</span>
          </footer>
        </article>
        <p class="reveal-hint">轻触空白处收起</p>
      </div>
    </transition>

    <!-- ═══ UI ═══ -->
    <a href="/" class="chrome chrome--back"><span class="back-arrow">←</span><span class="back-text">回去</span></a>
    <div class="chrome chrome--title"><span class="t-main">思绪</span><span class="t-sub">memory nebula</span></div>

    <p v-if="mode === 'nebula' && !revealed" class="field-hint">
      {{ ready ? '轻触光点，展开一段记忆' : '正在打捞记忆…' }}
    </p>

    <div class="mode-switch">
      <button type="button" :class="{ on: mode === 'nebula' }" @click="setMode('nebula')">星云</button>
      <button type="button" :class="{ on: mode === 'stream' }" @click="setMode('stream')">瀑布</button>
    </div>

    <button class="add-btn" type="button" title="写下思绪" @click="showAddForm = true">+</button>

    <!-- ═══ 写下思绪 ═══ -->
    <transition name="veil">
      <div v-if="showAddForm" class="add-form-overlay" @click.self="showAddForm = false">
        <div class="add-form-card" @click.stop>
          <span class="form-title">留下此刻思绪</span>
          <textarea
            v-model="newText"
            class="form-textarea"
            placeholder="写下你想说的……"
            maxlength="200"
            rows="4"
          ></textarea>
          <div class="form-date-row">
            <label class="form-date-label">日期（可选）</label>
            <input v-model="newDate" type="date" class="form-date-input" />
          </div>
          <div class="form-actions">
            <button class="form-btn cancel" type="button" @click="showAddForm = false">取消</button>
            <button class="form-btn submit" type="button" :disabled="!newText.trim()" @click="submitCustomBubble">放进星云</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
const PERSONAS = [
  { file:'/thoughts/shime.txt',  name:'阿秋',       color:'#d4a255', halo:'rgba(212,162,85,0.30)',  coreSize:9 },
  { file:'/thoughts/future.txt', name:'春燕',       color:'#c97a7c', halo:'rgba(201,122,124,0.30)', coreSize:8 },
  { file:'/thoughts/weiwei.txt', name:'小银',       color:'#7dab8c', halo:'rgba(125,171,140,0.28)', coreSize:7 },
  { file:'/thoughts/chaos.txt',  name:'一生阳春悲', color:'#6a8cb5', halo:'rgba(106,140,181,0.32)', coreSize:10 },
]
const CUSTOM_STYLE = { name:'我自己', color:'#c0b0a0', halo:'rgba(192,176,160,0.28)', coreSize:9 }
const MAX_CUSTOM = 10

let nextId = 0

/* Deterministic PRNG so the sky is the same place on every visit. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default {
  name: 'ThoughtBubbles',
  data() {
    return {
      ready: false,
      mode: 'nebula',

      // ── corpus ──
      personaData: [[], [], [], []],
      customList: [],
      pool: [],

      // ── nebula points ──
      points: [],

      // ── reveal ──
      revealed: null,
      revealStyle: {},

      // ── canvas ──
      ctx: null, cw: 0, ch: 0, dpr: 1,
      stars: [], dust: [], motes: [], rings: [],
      rafId: null, frame: 0,
      mouseX: -9999, mouseY: -9999, mouseActive: false,

      // ── form ──
      showAddForm: false, newText: '', newDate: '',

      // ── flags ──
      isMobile: false, reduceMotion: false,
    }
  },

  async mounted() {
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.isMobile = window.innerWidth < 768

    this.buildStars()
    this.$nextTick(() => this.initCanvas())

    window.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    window.addEventListener('keydown', this.onKeydown)

    await this.loadCorpus()
    this.rebuildPoints()
    this.ready = true
  },

  beforeUnmount() {
    this.stopCanvas()
    window.removeEventListener('resize', this.onResize)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    window.removeEventListener('keydown', this.onKeydown)
  },

  methods: {
    /* ═══════════════════ Corpus ═══════════════════ */

    async loadCorpus() {
      await Promise.all(PERSONAS.map(async (p, i) => {
        try {
          const res = await fetch(p.file)
          const raw = await res.text()
          this.personaData[i] = this.parseParagraphs(raw)
        } catch (e) {
          this.personaData[i] = []
        }
      }))
      this.customList = await this.fetchCustomBubbles()
      this.buildPool()
    },

    parseParagraphs(raw) {
      let blocks = String(raw || '')
        .split(/\n\n+/)
        .map(b => b.replace(/\n/g, ' ').trim())
        .filter(b => b.length > 6 && b.length < 220)
      if (blocks.length === 0) {
        blocks = String(raw || '')
          .split(/\n/)
          .map(b => b.trim())
          .filter(b => b.length > 4 && b.length < 220)
      }
      return blocks
    },

    buildPool() {
      const out = []
      // The visitor's own notes come first — they are the newest memories.
      this.customList.forEach((c, i) => {
        if (!c || !c.text) return
        out.push({
          key: `c${i}`,
          text: c.text,
          name: CUSTOM_STYLE.name,
          color: CUSTOM_STYLE.color,
          halo: CUSTOM_STYLE.halo,
          coreSize: CUSTOM_STYLE.coreSize,
          isCustom: true,
          date: c.date ? this.formatDisplayDate(c.date) : '',
        })
      })
      this.personaData.forEach((list, pi) => {
        const p = PERSONAS[pi]
        list.forEach((text, i) => {
          out.push({
            key: `p${pi}-${i}`,
            text,
            name: p.name,
            color: p.color,
            halo: p.halo,
            coreSize: p.coreSize,
            isCustom: false,
            date: '',
          })
        })
      })
      this.pool = out
    },

    async fetchCustomBubbles() {
      let saved = []
      try {
        const res = await fetch('/api/bubbles', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) saved = data
        }
      } catch (e) { /* offline / gated — the persona texts still carry the page */ }

      if (saved.length === 0) {
        // One-time migration of the old localStorage copy.
        try {
          const raw = localStorage.getItem('thoughts-custom-bubbles')
          if (raw) {
            const parsed = JSON.parse(raw)
            localStorage.removeItem('thoughts-custom-bubbles')
            if (Array.isArray(parsed)) {
              saved = parsed.filter(i => i && i.text)
              saved.forEach(i => this.saveCustomBubbleToApi(i.text, i.date || ''))
            }
          }
        } catch (e) { /* ignore malformed leftovers */ }
      }
      return saved.length > MAX_CUSTOM ? saved.slice(0, MAX_CUSTOM) : saved
    },

    async saveCustomBubbleToApi(text, date) {
      try {
        await fetch('/api/bubbles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, date }),
        })
      } catch (e) { /* the note still shows locally for this session */ }
    },

    formatDisplayDate(dateStr) {
      const d = new Date(dateStr)
      if (Number.isNaN(d.getTime())) return ''
      return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
    },

    /* ═══════════════════ Nebula points ═══════════════════ */

    rebuildPoints() {
      if (this.pool.length === 0) { this.points = []; return }
      const count = Math.min(this.isMobile ? 7 : 13, this.pool.length)
      const slots = this.makeSlots(count)

      // Shuffle the pool so the field never reads in file order.
      const idx = this.pool.map((_, i) => i)
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[idx[i], idx[j]] = [idx[j], idx[i]]
      }

      this.points = slots.map((slot, i) => this.makePoint(this.pool[idx[i]], slot))
    },

    /**
     * Even scatter with jitter. Cells stay inside 8–92% x and 16–84% y so no
     * light point ever lands under the fixed chrome (title / toggle / add).
     */
    makeSlots(count) {
      const cols = Math.ceil(Math.sqrt(count * 1.5))
      const rows = Math.ceil(count / cols)
      const slots = []
      for (let i = 0; i < count; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const cellW = 84 / cols
        const cellH = 68 / rows
        slots.push({
          x: +(8 + (col + 0.5) * cellW + (Math.random() - 0.5) * cellW * 0.55).toFixed(2),
          y: +(16 + (row + 0.5) * cellH + (Math.random() - 0.5) * cellH * 0.5).toFixed(2),
          dx: +((Math.random() - 0.5) * 34).toFixed(1),
          dy: +((Math.random() - 0.5) * 34).toFixed(1),
          dur: +(11 + Math.random() * 9).toFixed(1),
          delay: +(-Math.random() * 12).toFixed(1),
        })
      }
      return slots
    },

    makePoint(data, slot) {
      return {
        uid: nextId++,
        data,
        slot,
        style: {
          '--x': slot.x + '%',
          '--y': slot.y + '%',
          '--core': data.color,
          '--halo': data.halo,
          '--core-size': (data.coreSize || 8) + 'px',
          '--drift-x': slot.dx + 'px',
          '--drift-y': slot.dy + 'px',
          '--dur': slot.dur + 's',
          '--delay': slot.delay + 's',
        },
      }
    },

    /** Once a memory has been read, the light re-lights with a different one. */
    reseedPoint(dataKey) {
      const i = this.points.findIndex(p => p.data.key === dataKey)
      if (i === -1) return
      const onScreen = new Set(this.points.map(p => p.data.key))
      const candidates = this.pool.filter(t => !onScreen.has(t.key))
      if (candidates.length === 0) return
      const next = this.points.slice()
      next[i] = this.makePoint(candidates[Math.floor(Math.random() * candidates.length)], this.points[i].slot)
      this.points = next
    },

    /* ═══════════════════ Reveal / mode ═══════════════════ */

    open(item, event) {
      if (this.revealed || !item) return
      const x = (event && event.clientX) || window.innerWidth / 2
      const y = (event && event.clientY) || window.innerHeight / 2
      this.revealStyle = {
        '--ox': (x - window.innerWidth / 2) + 'px',
        '--oy': (y - window.innerHeight / 2) + 'px',
        '--accent': item.color,
        '--halo': item.halo,
      }
      this.revealed = item
      this.spawnAccretion(x, y, item.color)
      this.reseedPoint(item.key)
    },

    close() {
      this.revealed = null
    },

    setMode(mode) {
      if (this.mode === mode) return
      this.revealed = null
      this.mode = mode
    },

    onKeydown(e) {
      if (e.key === 'Escape') {
        if (this.revealed) this.close()
        else if (this.showAddForm) this.showAddForm = false
      }
    },

    /* ═══════════════════ Custom bubble ═══════════════════ */

    async submitCustomBubble() {
      const text = this.newText.trim()
      if (!text) return
      const dateStr = this.newDate || ''

      const entry = {
        key: `c-new-${nextId++}`,
        text,
        name: CUSTOM_STYLE.name,
        color: CUSTOM_STYLE.color,
        halo: CUSTOM_STYLE.halo,
        coreSize: CUSTOM_STYLE.coreSize,
        isCustom: true,
        date: dateStr ? this.formatDisplayDate(dateStr) : '',
      }
      this.pool = [entry, ...this.pool].slice(0, this.pool.length + 1)

      this.showAddForm = false
      this.newText = ''
      this.newDate = ''

      // Drop it straight into the nebula as a fresh light.
      if (this.points.length > 0) {
        const i = Math.floor(Math.random() * this.points.length)
        const next = this.points.slice()
        next[i] = this.makePoint(entry, this.points[i].slot)
        this.points = next
      } else {
        this.rebuildPoints()
      }

      this.saveCustomBubbleToApi(text, dateStr)
    },

    /* ═══════════════════ Canvas ═══════════════════ */

    buildStars() {
      const rnd = mulberry32(20261014)
      const area = window.innerWidth * window.innerHeight
      const target = this.isMobile ? 74 : 150
      const count = Math.max(36, Math.min(target, Math.round(area / 11000)))
      const stars = []
      for (let i = 0; i < count; i++) {
        stars.push({
          x: rnd(), y: rnd(),
          r: 0.4 + rnd() * 1.6,
          base: 0.16 + rnd() * 0.54,
          phase: rnd() * Math.PI * 2,
          speed: 0.35 + rnd() * 1.05,
          warm: rnd() > 0.72,
        })
      }
      this.stars = stars

      const dustCount = this.isMobile ? 14 : 34
      const dust = []
      for (let i = 0; i < dustCount; i++) {
        dust.push({
          x: rnd(), y: rnd(),
          vx: (rnd() - 0.5) * 0.12,
          vy: (rnd() - 0.5) * 0.12,
          r: 0.7 + rnd() * 1.7,
          a: 0.06 + rnd() * 0.16,
          hue: [265, 215, 300, 195][Math.floor(rnd() * 4)],
        })
      }
      this.dust = dust
    },

    initCanvas() {
      const c = this.$refs.fxCanvas
      if (!c) return
      this.ctx = c.getContext('2d')
      this.resizeCanvas()
      this.startCanvas()
    },

    resizeCanvas() {
      const c = this.$refs.fxCanvas
      if (!c || !this.ctx) return
      // Cap the backing store at 2x — past that the pixels are invisible but
      // the per-frame fill cost keeps scaling with area.
      this.dpr = Math.min(window.devicePixelRatio || 1, 2)
      this.cw = window.innerWidth
      this.ch = window.innerHeight
      c.width = Math.round(this.cw * this.dpr)
      c.height = Math.round(this.ch * this.dpr)
      c.style.width = this.cw + 'px'
      c.style.height = this.ch + 'px'
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    },

    onResize() {
      const wasMobile = this.isMobile
      this.isMobile = window.innerWidth < 768
      this.buildStars()
      this.resizeCanvas()
      if (wasMobile !== this.isMobile) this.rebuildPoints()
    },

    onVisibilityChange() {
      if (document.hidden) this.stopCanvas()
      else this.startCanvas()
    },

    startCanvas() {
      if (this.rafId) return
      this.rafId = requestAnimationFrame(this.tick)
    },

    stopCanvas() {
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null }
    },

    tick(now) {
      this.rafId = requestAnimationFrame(this.tick)
      // Half-rate on phones: the sky reads the same, the battery does not.
      if (this.isMobile && (this.frame++ & 1)) return
      this.draw(now / 1000)
    },

    draw(t) {
      const ctx = this.ctx
      const w = this.cw
      const h = this.ch
      if (!ctx || w === 0) return

      ctx.clearRect(0, 0, w, h)

      // ── stars (twinkle is computed, not a DOM animation) ──
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i]
        const tw = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase)
        const px = s.x * w
        const py = s.y * h
        if (s.r < 1.05) {
          ctx.globalAlpha = s.base * tw * 0.85
          ctx.fillStyle = s.warm ? '#f0e3c8' : '#dfe6ff'
          ctx.fillRect(px, py, s.r, s.r)
        } else {
          ctx.globalAlpha = s.base * tw
          ctx.beginPath()
          ctx.arc(px, py, s.r, 0, Math.PI * 2)
          ctx.fillStyle = s.warm ? '#f2e6cd' : '#e2e9ff'
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1

      // ── drifting dust, nudged away from the cursor ──
      const mx = this.mouseX
      const my = this.mouseY
      for (let i = 0; i < this.dust.length; i++) {
        const d = this.dust[i]
        if (this.mouseActive) {
          const dx = d.x * w - mx
          const dy = d.y * h - my
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 190 && dist > 1) {
            const f = (190 - dist) / 190
            d.vx += (dx / dist) * f * 0.0016
            d.vy += (dy / dist) * f * 0.0016
          }
        }
        d.vx *= 0.995
        d.vy *= 0.995
        d.x += d.vx
        d.y += d.vy
        if (d.x < -0.05) d.x = 1.05
        if (d.x > 1.05) d.x = -0.05
        if (d.y < -0.05) d.y = 1.05
        if (d.y > 1.05) d.y = -0.05

        ctx.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(t * 0.8 + i))
        ctx.beginPath()
        ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsl(${d.hue},55%,72%)`
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // ── reveal accretion: motes that spiral in and settle around the card ──
      for (let i = this.motes.length - 1; i >= 0; i--) {
        const m = this.motes[i]
        m.life++
        m.a += m.spin
        m.r += (m.target - m.r) * m.fall
        if (m.life > m.maxLife) { this.motes.splice(i, 1); continue }
        const fade = m.life < 12 ? m.life / 12 : Math.min(1, (m.maxLife - m.life) / 40)
        ctx.globalAlpha = m.alpha * fade
        ctx.beginPath()
        ctx.arc(m.cx + Math.cos(m.a) * m.r, m.cy + Math.sin(m.a) * m.r * 0.72, m.size, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${m.hue},62%,74%,1)`
        ctx.fill()
      }
      ctx.globalAlpha = 1

      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i]
        r.life++
        r.r += (r.max - r.r) * 0.075
        if (r.life > r.maxLife) { this.rings.splice(i, 1); continue }
        const fade = 1 - r.life / r.maxLife
        ctx.globalAlpha = fade * 0.5
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
        ctx.strokeStyle = r.color
        ctx.lineWidth = 1
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    },

    spawnAccretion(x, y, color) {
      if (this.reduceMotion) return
      const n = this.isMobile ? 18 : 34
      const hues = [265, 215, 300, 40, 195]
      for (let i = 0; i < n; i++) {
        this.motes.push({
          cx: x, cy: y,
          a: Math.random() * Math.PI * 2,
          r: 150 + Math.random() * 220,
          target: 170 + Math.random() * 170,
          spin: 0.010 + Math.random() * 0.020,
          fall: 0.035 + Math.random() * 0.045,
          size: 0.7 + Math.random() * 2.1,
          alpha: 0.28 + Math.random() * 0.5,
          hue: hues[Math.floor(Math.random() * hues.length)],
          life: 0,
          maxLife: 150 + Math.random() * 110,
        })
      }
      this.rings.push({ x, y, r: 8, max: 260, life: 0, maxLife: 52, color: color || '#8b7aaa' })
    },

    /* ═══════════════════ Pointer ═══════════════════ */

    onMouseMove(e) { this.mouseX = e.clientX; this.mouseY = e.clientY; this.mouseActive = true },
    onTouchMove(e) {
      if (e.touches[0]) {
        this.mouseX = e.touches[0].clientX
        this.mouseY = e.touches[0].clientY
        this.mouseActive = true
      }
    },
  },
}
</script>

<style scoped>
/* ═══════════════ Chamber ═══════════════ */
.memory-chamber {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  background: #05050c;
  overflow: hidden;
  font-family: 'Georgia', 'Noto Serif SC', 'Songti SC', serif;
  color: rgba(228, 222, 210, 0.9);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}

/* Canvas holds the starfield, the dust and the reveal accretion, so the DOM
   never carries a hundred twinkling nodes. */
.fx-canvas { position: absolute; inset: 0; z-index: 1; pointer-events: none; }

/* Static gradients only — no blur filter, no animation, so this rasterises
   once and then composites for free. */
.nebula-wash {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 70% 55% at 18% 22%, rgba(94, 58, 150, 0.30) 0%, rgba(94, 58, 150, 0.05) 45%, transparent 72%),
    radial-gradient(ellipse 62% 50% at 78% 34%, rgba(38, 74, 138, 0.26) 0%, rgba(38, 74, 138, 0.04) 46%, transparent 74%),
    radial-gradient(ellipse 56% 46% at 46% 78%, rgba(128, 52, 96, 0.20) 0%, transparent 70%),
    radial-gradient(ellipse 40% 34% at 62% 14%, rgba(180, 140, 220, 0.13) 0%, transparent 70%);
}

/* Paper grain — the thing that makes a card read as "remembered" rather
   than "rendered". Desktop only: it is a full-screen layer. */
.grain {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  opacity: 0.045;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 160px 160px;
}

/* ═══════════════ Light points ═══════════════ */
.point-field { position: absolute; inset: 0; z-index: 3; }

.light-point {
  position: absolute;
  left: var(--x); top: var(--y);
  width: 60px; height: 60px;
  margin: -30px 0 0 -30px;
  padding: 0; border: 0; background: none;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  -webkit-tap-highlight-color: transparent;
}
.lp-drift {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  animation: point-drift var(--dur, 14s) var(--delay, 0s) ease-in-out infinite;
}
.lp-inner {
  position: relative;
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.lp-inner::after {
  content: '';
  position: absolute; inset: 12px;
  border-radius: 50%;
  border: 1px solid var(--core, #8b7aaa);
  opacity: 0;
  transform: scale(0.55);
  transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.light-point:hover .lp-inner { transform: scale(1.28); }
.light-point:hover .lp-inner::after { opacity: 0.42; transform: scale(1.1); }

.lp-halo {
  position: absolute;
  width: 60px; height: 60px; border-radius: 50%;
  background: radial-gradient(circle, var(--halo, rgba(139, 122, 170, 0.3)) 0%, transparent 68%);
  opacity: 0.7;
  animation: halo-breathe 5.5s var(--delay, 0s) ease-in-out infinite;
}
.lp-core {
  position: relative;
  width: var(--core-size, 8px); height: var(--core-size, 8px);
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, var(--core, #8b7aaa) 45%, transparent 74%);
  box-shadow:
    0 0 calc(var(--core-size, 8px) * 1.8) var(--core, #8b7aaa),
    0 0 calc(var(--core-size, 8px) * 5.5) var(--halo, rgba(139, 122, 170, 0.3));
  animation: core-breathe 3.8s var(--delay, 0s) ease-in-out infinite;
}
.light-point:focus-visible { outline: none; }
.light-point:focus-visible .lp-inner::after { opacity: 0.8; transform: scale(1.1); }

@keyframes point-drift {
  0%, 100% { transform: translate(0, 0); }
  25%      { transform: translate(var(--drift-x, 14px), calc(var(--drift-y, -10px) * 0.6)); }
  50%      { transform: translate(calc(var(--drift-x, 14px) * 0.4), var(--drift-y, -10px)); }
  75%      { transform: translate(calc(var(--drift-x, 14px) * -0.45), calc(var(--drift-y, -10px) * 0.55)); }
}
@keyframes halo-breathe {
  0%, 100% { opacity: 0.42; transform: scale(0.86); }
  50%      { opacity: 0.85; transform: scale(1.16); }
}
@keyframes core-breathe {
  0%, 100% { opacity: 0.72; transform: scale(0.9); }
  50%      { opacity: 1; transform: scale(1.22); }
}

.point-swap-enter-active { transition: opacity 1.1s ease-out; }
.point-swap-leave-active { transition: opacity 0.7s ease-in; position: absolute; }
.point-swap-enter-from { opacity: 0; }
.point-swap-leave-to { opacity: 0; }

.field-hint {
  position: absolute; left: 50%; bottom: 104px; transform: translateX(-50%);
  z-index: 3; margin: 0; white-space: nowrap; pointer-events: none;
  font-size: 12px; letter-spacing: 0.22em; color: rgba(210, 204, 192, 0.28);
  animation: hint-breathe 6s ease-in-out infinite;
}
@keyframes hint-breathe {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}

/* ═══════════════ Memory card ═══════════════ */
.memory-card {
  position: relative;
  background:
    radial-gradient(ellipse 120% 90% at 50% 0%, rgba(139, 122, 170, 0.10) 0%, transparent 62%),
    rgba(13, 12, 24, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.055);
  border-radius: 14px;
}
.memory-card::before {
  content: '';
  position: absolute; left: 22px; right: 22px; top: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent, #8b7aaa), transparent);
  opacity: 0.5;
}
.mc-text {
  margin: 0;
  font-size: 15px; line-height: 2.0; letter-spacing: 0.045em;
  color: rgba(228, 222, 210, 0.86);
  word-break: break-word;
}
.mc-foot {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 10px; margin-top: 16px;
}
.mc-persona {
  font-size: 11px; letter-spacing: 0.22em;
  color: var(--accent, #8b7aaa); opacity: 0.85;
}
.mc-date {
  font-size: 10.5px; letter-spacing: 0.14em;
  color: rgba(205, 199, 187, 0.32);
}

/* ── wall variant ── */
.memory-card--wall {
  break-inside: avoid;
  margin: 0 0 16px;
  padding: 24px 22px 18px;
  cursor: pointer;
  transition: border-color 0.45s ease, background 0.45s ease;
}
.memory-card--wall:hover {
  border-color: rgba(255, 255, 255, 0.12);
  background:
    radial-gradient(ellipse 120% 90% at 50% 0%, rgba(139, 122, 170, 0.18) 0%, transparent 62%),
    rgba(16, 15, 28, 0.96);
}

/* ── full variant ── */
.memory-card--full {
  position: relative; z-index: 1;
  width: min(600px, 90vw);
  padding: 46px 44px 32px;
  cursor: default;
  background:
    radial-gradient(ellipse 130% 100% at 50% -10%, rgba(139, 122, 170, 0.16) 0%, transparent 60%),
    radial-gradient(ellipse 90% 70% at 50% 112%, rgba(196, 169, 112, 0.07) 0%, transparent 60%),
    rgba(12, 11, 22, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 18px;
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.72);
  animation: memory-arrive 1.05s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.memory-card--full .mc-text {
  font-size: 19px; line-height: 2.15; letter-spacing: 0.06em;
  text-align: center; color: rgba(236, 230, 218, 0.94);
}
.memory-card--full .mc-foot { margin-top: 26px; justify-content: center; gap: 18px; }

.mc-quote {
  position: absolute;
  font-size: 56px; line-height: 1;
  color: var(--accent, #8b7aaa);
  opacity: 0.16;
  pointer-events: none;
}
.mc-quote--open { top: 14px; left: 16px; }
.mc-quote--close { bottom: 6px; right: 16px; }

/* The card grows out of the light point that was touched. */
@keyframes memory-arrive {
  0%   { opacity: 0; transform: translate(var(--ox, 0px), var(--oy, 0px)) scale(0.22); filter: blur(24px); }
  32%  { opacity: 0.9; filter: blur(6px); }
  68%  { transform: translate(0, 0) scale(1.015); filter: blur(0); }
  100% { opacity: 1; transform: translate(0, 0) scale(1); filter: blur(0); }
}

/* ═══════════════ Reveal veil ═══════════════ */
.reveal-veil {
  position: fixed; inset: 0; z-index: 30;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 22px;
  padding: 24px;
  cursor: pointer;
  background: radial-gradient(ellipse at center, rgba(4, 4, 12, 0.40) 0%, rgba(3, 3, 10, 0.93) 78%);
}
.reveal-hint {
  position: relative; z-index: 1; margin: 0;
  font-size: 11px; letter-spacing: 0.14em;
  color: rgba(200, 195, 185, 0.3);
  animation: hint-breathe 3s ease-in-out infinite;
}
.veil-enter-active { transition: opacity 0.5s ease-out; }
.veil-leave-active { transition: opacity 0.85s ease-in; }
.veil-enter-from, .veil-leave-to { opacity: 0; }

/* ═══════════════ Stream (瀑布流) ═══════════════ */
.stream-view {
  position: absolute; inset: 0; z-index: 4;
  overflow-y: auto; overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.stream-head {
  max-width: 1180px; margin: 0 auto;
  padding: 82px 24px 24px;
}
.stream-head h1 {
  margin: 0; font-weight: 400;
  font-size: 25px; letter-spacing: 0.18em;
  color: rgba(236, 230, 218, 0.9);
}
.stream-head p {
  margin: 9px 0 0;
  font-size: 12px; letter-spacing: 0.16em;
  color: rgba(205, 199, 187, 0.34);
}
.stream-wall {
  max-width: 1180px; margin: 0 auto;
  padding: 0 24px 150px;
  column-count: 4; column-gap: 16px;
}

/* ═══════════════ Fixed chrome ═══════════════ */
.chrome {
  position: fixed; z-index: 20;
  display: flex; align-items: center; gap: 6px;
  text-decoration: none;
}
.chrome--back {
  top: 28px; left: 30px;
  color: rgba(200, 195, 185, 0.35);
  font-size: 13px; letter-spacing: 0.08em;
  transition: color 0.4s ease;
}
.chrome--back:hover { color: rgba(220, 210, 195, 0.78); }
.back-arrow { font-size: 15px; transition: transform 0.3s ease; }
.chrome--back:hover .back-arrow { transform: translateX(-4px); }

.chrome--title {
  top: 30px; right: 34px;
  flex-direction: column; align-items: flex-end;
  pointer-events: none;
}
.t-main { font-size: 21px; letter-spacing: 0.35em; color: rgba(200, 195, 185, 0.24); }
.t-sub { font-size: 10px; letter-spacing: 0.14em; color: rgba(200, 195, 185, 0.13); margin-top: 2px; }

.mode-switch {
  position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%);
  z-index: 20;
  display: flex; gap: 2px; padding: 3px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.075);
  background: rgba(10, 10, 20, 0.74);
}
.mode-switch button {
  padding: 7px 20px; border: 0; border-radius: 999px;
  background: none; cursor: pointer;
  font-family: inherit; font-size: 12.5px; letter-spacing: 0.16em;
  color: rgba(205, 199, 187, 0.42);
  transition: color 0.35s ease, background 0.35s ease;
}
.mode-switch button.on {
  color: rgba(238, 232, 220, 0.92);
  background: rgba(139, 122, 170, 0.20);
}

.add-btn {
  position: fixed; right: 28px; bottom: 24px; z-index: 20;
  width: 42px; height: 42px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(12, 11, 22, 0.72);
  color: rgba(220, 215, 205, 0.5);
  font-family: 'Georgia', serif; font-size: 22px;
  cursor: pointer;
  transition: color 0.3s ease, border-color 0.3s ease, background 0.3s ease;
}
.add-btn:hover {
  color: rgba(228, 222, 210, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(20, 18, 34, 0.85);
}

/* ═══════════════ Add form ═══════════════ */
.add-form-overlay {
  position: fixed; inset: 0; z-index: 40;
  display: flex; align-items: center; justify-content: center;
  background: rgba(3, 3, 10, 0.8);
}
.add-form-card {
  width: 380px; max-width: 90vw;
  display: flex; flex-direction: column; gap: 14px;
  padding: 26px 24px 20px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(13, 12, 22, 0.97);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
}
.form-title {
  font-size: 14px; letter-spacing: 0.1em; text-align: center;
  color: rgba(222, 216, 206, 0.66);
}
.form-textarea {
  width: 100%; resize: none; outline: none;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.025);
  color: rgba(232, 226, 214, 0.9);
  font-family: inherit; font-size: 14px; line-height: 1.8;
  transition: border-color 0.3s ease;
}
.form-textarea:focus { border-color: rgba(255, 255, 255, 0.18); }
.form-textarea::placeholder { color: rgba(200, 195, 185, 0.25); }
.form-date-row { display: flex; align-items: center; gap: 10px; }
.form-date-label { font-size: 11px; letter-spacing: 0.08em; color: rgba(200, 195, 185, 0.4); white-space: nowrap; }
.form-date-input {
  flex: 1; padding: 5px 8px; outline: none;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.025);
  color: rgba(222, 216, 206, 0.8);
  font-family: inherit; font-size: 12px;
  color-scheme: dark;
}
.form-actions { display: flex; justify-content: flex-end; gap: 8px; }
.form-btn {
  padding: 7px 18px; border-radius: 8px; border: none;
  font-family: inherit; font-size: 12.5px; letter-spacing: 0.08em;
  cursor: pointer; transition: all 0.25s ease;
}
.form-btn.cancel { background: rgba(255, 255, 255, 0.03); color: rgba(200, 195, 185, 0.45); border: 1px solid rgba(255, 255, 255, 0.05); }
.form-btn.cancel:hover { background: rgba(255, 255, 255, 0.06); color: rgba(220, 215, 205, 0.65); }
.form-btn.submit { background: rgba(139, 122, 170, 0.18); color: rgba(226, 218, 234, 0.88); border: 1px solid rgba(139, 122, 170, 0.3); }
.form-btn.submit:hover:not(:disabled) { background: rgba(139, 122, 170, 0.28); }
.form-btn.submit:disabled { opacity: 0.3; cursor: not-allowed; }

/* ═══════════════ Responsive ═══════════════ */
@media (max-width: 1139px) { .stream-wall { column-count: 3; } }
@media (max-width: 859px)  { .stream-wall { column-count: 2; } }

@media (max-width: 767px) {
  /* A full-screen grain layer costs fill rate on phones for very little. */
  .grain { display: none; }

  .chrome--back { top: 16px; left: 16px; font-size: 12px; }
  .chrome--title { top: 18px; right: 16px; }
  .t-main { font-size: 17px; letter-spacing: 0.26em; }
  .t-sub { display: none; }

  .mode-switch { bottom: 18px; padding: 2px; }
  .mode-switch button { padding: 7px 17px; font-size: 12px; }
  .add-btn { right: 14px; bottom: 14px; width: 40px; height: 40px; }
  .field-hint { bottom: 82px; font-size: 11px; letter-spacing: 0.16em; }

  .stream-head { padding: 66px 16px 20px; }
  .stream-head h1 { font-size: 21px; }
  .stream-wall { padding: 0 16px 132px; column-gap: 12px; }
  .memory-card--wall { margin-bottom: 12px; padding: 20px 18px 16px; }
  .memory-card--wall .mc-text { font-size: 14.5px; line-height: 1.95; }

  .memory-card--full { width: 92vw; padding: 36px 26px 26px; }
  .memory-card--full .mc-text { font-size: 16.5px; line-height: 2.05; letter-spacing: 0.05em; }
  .mc-quote { font-size: 42px; }
  .mc-quote--open { top: 10px; left: 10px; }
  .mc-quote--close { bottom: 4px; right: 10px; }
  .reveal-veil { gap: 16px; padding: 16px; }
}

@media (max-width: 559px) { .stream-wall { column-count: 1; } }

@media (prefers-reduced-motion: reduce) {
  .lp-drift, .lp-halo, .lp-core, .field-hint, .reveal-hint { animation: none !important; }
  .memory-card--full { animation: none; opacity: 1; }
  .point-swap-enter-active, .point-swap-leave-active { transition: none; }
}
</style>
