<template>
  <div class="memory-chamber" ref="chamber" @pointermove="onPointerMove">
    <!-- ═══ Layer 0: canvas — starfield, drifting dust, reveal accretion ═══ -->
    <canvas ref="fxCanvas" class="fx-canvas"></canvas>
    <div class="nebula-wash" aria-hidden="true"></div>
    <div class="grain" aria-hidden="true"></div>

    <!-- ═══ 星云：只有光点，没有文字 ═══
         光点本体画在 canvas 上：每颗是一枚有高光、折射、边光的立体结晶，按 16
         个角度预先烘焙成精灵图，逐帧贴出来 —— 每帧每颗只要两次 drawImage。
         命中判定也走 canvas：点下去时按同一套坐标算出最近的那颗。以前这里有
         13 个会 transform 的 DOM 按钮，每个都被提升成独立合成层，实测把帧率
         从 60 压到 30；现在整个星空只有这一个透明层。

         这一层同时是「无限星云」的拖拽面：世界坐标是无限的，视野只是一扇
         窗，往任何方向拖都会生成新的记忆，拖回去还是原来那些。 -->
    <div
      v-show="mode === 'nebula'"
      class="point-field"
      ref="pointField"
      :class="{ 'is-grabbing': dragging }"
      @pointerdown="onPanStart"
      @pointermove="onPanMove"
      @pointerup="onPanEnd"
      @pointercancel="onPanEnd"
      @pointerleave="onPanEnd"
      @click.stop="onFieldClick"
      @mousemove="onFieldMove"
      @mouseleave="onFieldLeave"
    ></div>

    <!-- 键盘 / 读屏用户走的入口。视觉上不存在，也不参与逐帧绘制。 -->
    <div class="sr-points">
      <button
        v-for="p in points"
        :key="'k' + p.uid"
        type="button"
        class="sr-point"
        :aria-label="'展开一段记忆：' + p.data.name"
        @click="open(p.data, null)"
      >{{ p.data.name }}：{{ p.data.text }}</button>
    </div>

    <!-- ═══ 瀑布流：只在屏幕里缓存 ═══
         所有卡片的位置在进入时一次算好（绝对定位写进 style），滚动时只把可视
         范围 ± 一屏的卡片放进 DOM —— 屏幕外的记忆连节点都不存在，所以 73 段
         也好 730 段也好，节点数始终只有屏上那十几张。 -->
    <div v-show="mode === 'stream'" class="stream-view" ref="streamView" @scroll.passive="onWallScroll">
      <header class="stream-head">
        <h1>记忆瀑布</h1>
        <p v-if="ready">{{ pool.length }} 段思绪 · 屏上 {{ wallVisible.length }} 张</p>
        <p v-else>正在打捞记忆…</p>
      </header>
      <div class="stream-wall" ref="wall" :style="{ height: wallHeight + 'px' }">
        <article
          v-for="t in wallVisible"
          :key="t.key"
          class="memory-card memory-card--wall wall-item"
          :style="t.style"
          @click="open(t.data, $event)"
        >
          <p class="mc-text">{{ t.data.text }}</p>
          <footer class="mc-foot">
            <span class="mc-persona">{{ t.data.name }}</span>
            <span v-if="t.data.date" class="mc-date">{{ t.data.date }}</span>
          </footer>
        </article>
      </div>
      <p v-if="ready" class="stream-tail">— 到底了，{{ pool.length }} 段 —</p>
    </div>

    <!-- 量高度用的一遍，放在容器外面：v-show 的父级是 display:none，
         offsetHeight 会全是 0。这一层在屏幕外、不可见，量完就卸载。 -->
    <div
      v-if="measuring"
      class="wall-measure"
      ref="measure"
      :style="{ width: wallColW + 'px' }"
      aria-hidden="true"
    >
      <article v-for="t in pool" :key="'m' + t.key" class="memory-card memory-card--wall">
        <p class="mc-text">{{ t.text }}</p>
        <footer class="mc-foot">
          <span class="mc-persona">{{ t.name }}</span>
          <span v-if="t.date" class="mc-date">{{ t.date }}</span>
        </footer>
      </article>
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
    <div class="chrome chrome--back">
      <a href="/" class="chrome-link"><span class="back-arrow">←</span><span class="back-text">回去</span></a>
      <a href="/visitors" class="chrome-link chrome-link--sub">来访记录</a>
    </div>
    <div class="chrome chrome--title"><span class="t-main">思绪</span><span class="t-sub">memory nebula</span></div>

    <p v-if="mode === 'nebula' && !revealed" class="field-hint">
      {{ ready ? '拖动星云，继续打捞记忆' : '正在打捞记忆…' }}
    </p>

    <!-- The denominator is TODAY's release, not the whole corpus: only the
         daily set is in the sky, so counting against `pool.length` would show
         progress that can never complete. -->
    <p v-if="mode === 'nebula' && !revealed && ready" class="field-count">
      {{ seenCount }} / {{ todayPool.length }} 段今日已遇见
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

/* Every palette on the page, so the crystal sprites can be baked once for all
   of them instead of being re-rendered whenever a light changes. */
const PALETTES = PERSONAS.map(p => ({ color: p.color, halo: p.halo }))
  .concat([{ color: CUSTOM_STYLE.color, halo: CUSTOM_STYLE.halo }])

/* 16 pre-baked angles per palette. A light is several overlapping gradients,
   which is far too much to redraw every frame; baking means the per-frame cost
   is a single drawImage per light. */
const GEM_ANGLES = 16
/* One sprite holds the whole light — bloom, flare, glow and core together.
   160px is chosen against the size the sprite is actually blitted at: the
   largest light on screen is 58 x MOTE_GLOW x breathe x hover ≈ 88 CSS px, so
   even at devicePixelRatio 2 the blit lands within ~10% of 1:1 and never has to
   resample a soft gradient, which was the most expensive thing on this page once
   rasterisation fell back to the CPU. It also cuts the baked set to
   5 palettes x 16 angles x 160² x 4B ≈ 8MB, down from 12MB at 192px. */
const HALO_SPRITE = 160
/* Blit size as a multiple of a light's nominal size. The sprite's visible bloom
   very nearly fills its square, so this is close to the glow diameter the
   visitor actually sees. */
const MOTE_GLOW = 1.18

/* How long a captured memory stays away before it drifts back, in ms. Long
   enough that the sky visibly changes, short enough that a visitor who stays a
   while sees it return — which is the whole point of the mechanic. */
const ESCAPE_MIN_MS = 20000
const ESCAPE_SPREAD_MS = 35000

/* What share of the corpus is released on any one day, and the floor under it.
   "每天放出的记忆是有限且不一样的" — the sky is a different, bounded set each
   day, so it stays worth coming back to. */
const DAY_RELEASE_RATIO = 0.4
const DAY_RELEASE_MIN = 7

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

/* Stable per-light pseudo-randomness. The drift used to be baked into the
   slot, but slots get reused when a light is reseeded; deriving it from the
   uid instead keeps every light's motion its own. */
function hash01(n) {
  let t = Math.imul(n ^ 0x9E3779B9, 2654435761) >>> 0
  t ^= t >>> 15
  t = Math.imul(t, 2246822519) >>> 0
  t ^= t >>> 13
  t = Math.imul(t, 3266489917) >>> 0
  t ^= t >>> 16
  return (t >>> 0) / 4294967296
}

/* How fast a memory drifts, from how much of it there is to say.
   A four-character fragment should skim across the sky and a two-hundred
   character paragraph should barely breathe — the length of the thought is
   what the visitor is reading off the motion, so it has to be legible as
   speed. sqrt keeps the middle of the range spread out instead of letting the
   long memories all pile up at the slow end; the clamp stops the extremes
   from either freezing or strobing.

   MOTION_REF sits near the MEDIAN length of the corpus (~26 characters), not
   in the middle of the theoretical 0..∞ range. It used to be 60, which put
   almost every memory on the fast side of 1.0x: measured off the rendered
   canvas, the correlation between length and drift came out at only
   rho = -0.21, because the whole corpus was crammed into the top of the
   curve. Anchoring at the median lets the short half actually speed up and
   the long half actually slow down. */
const MOTION_REF = 26          // characters at which a memory drifts at 1.0x
const MOTION_MIN = 0.5
const MOTION_MAX = 2.4
function motionScale(text) {
  const n = String(text || '').length
  const s = Math.sqrt(MOTION_REF / Math.max(4, n))
  return Math.max(MOTION_MIN, Math.min(MOTION_MAX, s))
}

/* The nebula plane is carved into cells of this size. A cell is either empty
   or holds one crystal, and the choice is a pure function of the cell's
   coordinates — so the plane is unlimited without storing anything. */
const FIELD_CELL = { w: 260, h: 240, density: 0.72 }

/* Integer hash of a cell coordinate. Two large primes keep neighbouring cells
   from correlating, which would otherwise show up as visible diagonal bands. */
function cellHash(cx, cy) {
  let h = Math.imul(cx | 0, 0x27D4EB2D) ^ Math.imul(cy | 0, 0x165667B1)
  h = Math.imul(h ^ (h >>> 15), 0x2545F491)
  h ^= h >>> 13
  h = Math.imul(h, 0x85EBCA6B)
  h ^= h >>> 16
  return h >>> 0
}

/**
 * Re-alpha an `rgba(...)` palette string.
 *
 * The palettes carry their alpha inline, and every layer of a light wants the
 * same hue at a different strength. Rewriting the trailing number is exact for
 * the one format these strings are written in and avoids a colour parser.
 */
function withAlpha(rgba, a) {
  return String(rgba).replace(/[\d.]+\)\s*$/, a + ')')
}

/**
 * One frame of a memory light.
 *
 * This replaced a hard-edged hexagonal crystal with a blown-out white
 * specular. The problem was scale: these lights are 25–40 CSS px across, and a
 * faceted silhouette that small does not read as a cut stone — what the eye
 * actually gets is a jagged dark blob with a white dot in it. The shape is
 * therefore gone, and what is left is the thing that DOES read at this size:
 * the behaviour of light. A hot core, a soft bloom, a four-point diffraction
 * flare, and a highlight that sweeps around the rim as `phase` advances. That
 * last one is what preserves the "立体物件在转" quality the facets were there
 * for, without needing facets to carry it.
 */
function paintMote(g, s, phase, pal) {
  const cx = s / 2
  const cy = s / 2
  const turn = phase * Math.PI * 2
  const core = s * 0.165      // radius of the bright centre
  const lit = turn - 1.9      // direction the highlight has swept to

  // ── 1. bloom: the outer haze, filling the whole sprite ──
  const bloom = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.5)
  bloom.addColorStop(0.00, withAlpha(pal.halo, 0.62))
  bloom.addColorStop(0.24, withAlpha(pal.halo, 0.38))
  bloom.addColorStop(0.55, withAlpha(pal.halo, 0.11))
  bloom.addColorStop(1.00, withAlpha(pal.halo, 0))
  g.fillStyle = bloom
  g.fillRect(0, 0, s, s)

  // ── 2. diffraction flare: the four-point star a real light throws ──
  // Four long spikes on the axes and four short ones between them, all turning
  // with the light, so the sparkle rotates WITH the object instead of sitting
  // on top of it. Each spike is a thin triangle fading to nothing at the tip.
  const spike = (ang, len, halfW, alpha) => {
    const dx = Math.cos(ang)
    const dy = Math.sin(ang)
    const tipX = cx + dx * len
    const tipY = cy + dy * len
    const grad = g.createLinearGradient(cx, cy, tipX, tipY)
    grad.addColorStop(0, withAlpha(pal.halo, alpha))
    grad.addColorStop(0.30, withAlpha(pal.halo, alpha * 0.42))
    grad.addColorStop(1, withAlpha(pal.halo, 0))
    g.beginPath()
    g.moveTo(cx - dy * halfW, cy + dx * halfW)
    g.lineTo(tipX, tipY)
    g.lineTo(cx + dy * halfW, cy - dx * halfW)
    g.closePath()
    g.fillStyle = grad
    g.fill()
  }
  const flare = turn * 0.5
  for (let i = 0; i < 4; i++) {
    spike(flare + (i * Math.PI) / 2, s * 0.47, s * 0.030, 0.46)
    spike(flare + Math.PI / 4 + (i * Math.PI) / 2, s * 0.30, s * 0.022, 0.30)
  }

  // ── 3. core: the hot centre the whole light is built around ──
  const coreGrad = g.createRadialGradient(cx, cy, 0, cx, cy, core * 2)
  coreGrad.addColorStop(0.00, 'rgba(255,253,248,0.97)')
  coreGrad.addColorStop(0.20, withAlpha(pal.halo, 0.88))
  coreGrad.addColorStop(0.46, withAlpha(pal.halo, 0.34))
  coreGrad.addColorStop(1.00, withAlpha(pal.halo, 0))
  g.fillStyle = coreGrad
  g.beginPath()
  g.arc(cx, cy, core * 2, 0, Math.PI * 2)
  g.fill()

  // ── 4. rim: a polished bead edge, brightest where the light lands ──
  // Short arcs whose alpha follows the angle. This is what makes a light read
  // as a solid object catching light rather than as a flat glow.
  const rimR = core * 1.3
  const SEG = 20
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * Math.PI * 2
    const facing = Math.max(0, Math.cos(a0 - lit))
    g.beginPath()
    g.arc(cx, cy, rimR, a0, a0 + (Math.PI * 2) / SEG + 0.03)
    g.strokeStyle = withAlpha(pal.halo, 0.09 + 0.58 * facing * facing)
    g.lineWidth = s * 0.013
    g.stroke()
  }

  // ── 5. specular: one small hard highlight, the cue that says "solid" ──
  const hx = cx + Math.cos(lit) * core * 0.46
  const hy = cy + Math.sin(lit) * core * 0.46
  const spec = g.createRadialGradient(hx, hy, 0, hx, hy, core * 0.66)
  spec.addColorStop(0.00, 'rgba(255,255,255,0.95)')
  spec.addColorStop(0.38, 'rgba(255,255,255,0.28)')
  spec.addColorStop(1.00, 'rgba(255,255,255,0)')
  g.fillStyle = spec
  g.beginPath()
  g.arc(hx, hy, core * 0.66, 0, Math.PI * 2)
  g.fill()
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
      // The subset of `pool` released today. The nebula draws only from this;
      // the waterfall still shows the whole corpus.
      todayPool: [],

      // ── nebula: an endless plane, panned by dragging ──
      // Only the crystals near the viewport exist at any moment; the plane
      // itself is generated from a hash of the cell coordinates, so panning
      // outward always finds more and panning back finds the same ones again.
      points: [],
      hoverUid: -1,
      panX: 0, panY: 0,     // world coordinate sitting at the viewport's top-left
      panVX: 0, panVY: 0,   // inertia carried after the finger lifts
      lastPanX: 0, lastPanY: 0, // previous frame, to derive velocity while dragging
      dragging: false,
      dragId: null,
      dragX: 0, dragY: 0,
      dragMoved: 0,         // total travel, so a tap is not mistaken for a drag
      overrides: {},        // cellKey → pool index, so a read memory re-lights
      // key → wall-clock seconds when it comes back. A captured memory is not
      // deleted, it is hidden until its time away is up; keeping the key means
      // the plane's layout is unchanged when it returns.
      escapedAt: {},
      flights: [],          // in-flight 逃逸, in screen coordinates
      cellX0: 1, cellY0: 1, cellX1: 0, cellY1: 0, // visible cell range (empty at first)
      seen: {}, seenCount: 0,                     // how much of the corpus has been met

      // ── reveal ──
      revealed: null,
      revealStyle: {},

      // ── crystal sprites (pre-rendered angles) ──
      gemSprites: [],       // [paletteIndex][angleIndex] → canvas

      // ── waterfall (virtualised: only the cards on screen are ever mounted) ──
      wallItems: [],        // { key, data, col, top, height, style }
      wallVisible: [],      // the subset currently in the DOM
      wallHeight: 0,
      wallScroll: 0,
      wallViewH: 0,
      wallTop: 0,           // .stream-wall offset inside the scroller
      wallColW: 0,
      wallGap: 16,
      wallPad: 24,          // .stream-wall horizontal padding (abs-pos origin)
      wallColsAt: 4,
      measuring: false,     // true while the hidden measuring pass is mounted

      // ── canvas ──
      ctx: null, cw: 0, ch: 0, dpr: 1,
      stars: [], dust: [], motes: [], rings: [],
      rafId: null, frame: 0,
      mouseX: -9999, mouseY: -9999, mouseActive: false,
      // Wall-clock seconds of the last drawn frame; the click hit-test reuses it
      // so a tap lands on the crystal the visitor actually saw.
      now: 0,

      // ── form ──
      showAddForm: false, newText: '', newDate: '',

      // ── flags ──
      isMobile: false, reduceMotion: false,
      wallResizeTimer: null,
    }
  },

  async mounted() {
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.isMobile = window.innerWidth < 768

    this.buildStars()
    this.buildGemSprites()
    this.$nextTick(() => this.initCanvas())

    window.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    window.addEventListener('keydown', this.onKeydown)

    await this.loadCorpus()
    this.syncField(true)
    this.layoutWall()
    this.ready = true
  },

  beforeUnmount() {
    this.stopCanvas()
    clearTimeout(this.wallResizeTimer)
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
          this.personaData[i] = this.parseMemories(raw)
        } catch (e) {
          this.personaData[i] = []
        }
      }))
      this.customList = await this.fetchCustomBubbles()
      this.buildPool()
    },

    /**
     * Turn one persona's raw diary into a list of memories.
     *
     * These files were written in a plain text editor on Windows, so every line
     * ends \r\n. The old parser split on /\n\n+/ to find paragraphs, which CANNOT
     * match a blank line in CRLF text — the separator is \r\n\r\n, so there is a
     * \r sitting between the two \n and the pattern never fires. Every file
     * therefore fell through to the per-line fallback and each line became its
     * own "memory", which is how a bare date header ("2023.11.12  20:49") ended
     * up floating in the nebula as a thought.
     *
     * Normalising the newlines first restores the blank-line structure. Within a
     * section the lines are then re-grouped by length rather than one-per-line,
     * because these are conversational fragments — a single "来啦" is not a
     * memory, but "来啦" followed by the sentences it belongs to is.
     *
     * Dates are lifted out of the text (they are metadata, not content) and
     * attached to the memory they head or trail.
     */
    parseMemories(raw) {
      const text = String(raw || '').replace(/\r\n?/g, '\n')
      const DATE = /(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/
      const sections = text
        .split(/\n{2,}/)
        .map(s => s.split('\n').map(l => l.trim()).filter(Boolean))
        .filter(s => s.length)

      const out = []
      for (const section of sections) {
        let pendingDate = ''
        const lines = []
        for (const line of section) {
          // A line that is nothing but a date/time hands its date to what follows.
          const stripped = line
            .replace(new RegExp(DATE.source, 'g'), '')
            .replace(/\d{1,2}:\d{2}/g, '')
            .replace(/[\s\-—:：（）()]+/g, '')
          if (!stripped) {
            const m = line.match(DATE)
            if (m && !pendingDate) pendingDate = `${m[1]}.${+m[2]}.${+m[3]}`
            continue
          }
          lines.push(line)
        }

        let buf = []
        let bufLen = 0
        const flush = () => {
          if (!buf.length) return
          let body = buf.join(' ').replace(/\s+/g, ' ').trim()
          let date = pendingDate
          pendingDate = ''

          const lead = body.match(new RegExp('^' + DATE.source + '[\\s:：]*'))
          if (lead) {
            if (!date) date = `${lead[1]}.${+lead[2]}.${+lead[3]}`
            body = body.slice(lead[0].length).trim()
          }
          const tail = body.match(new RegExp('[\\s\\-—]*' + DATE.source + '\\s*$'))
          if (tail) {
            if (!date) date = `${tail[1]}.${+tail[2]}.${+tail[3]}`
            body = body.slice(0, tail.index).trim()
          }

          body = body
            .replace(/^[\s\-—]+/, '')
            .replace(/[\s\-—]+$/, '')
            .replace(/[\s\-—]*\d{1,2}[.\-/]\d{1,2}\s*$/, '')
            .trim()
          // Trailing "s" left over from "2024-8-18s" and similar typos.
          body = body.replace(/\s+s$/, '').trim()

          if (body.length >= 4 && body.length <= 220) out.push({ text: body, date })
          buf = []
          bufLen = 0
        }

        for (const line of lines) {
          const add = bufLen ? line.length + 1 : line.length
          if (bufLen && bufLen + add > 150) flush()
          buf.push(line)
          bufLen += add
          if (bufLen >= 14) flush()
        }
        flush()
      }
      return out
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
        list.forEach((entry, i) => {
          out.push({
            key: `p${pi}-${i}`,
            text: entry.text,
            name: p.name,
            color: p.color,
            halo: p.halo,
            coreSize: p.coreSize,
            isCustom: false,
            date: entry.date || '',
          })
        })
      })
      this.pool = out
      this.todayPool = this.releaseToday()
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

    /* ═══════════════════ Crystal sprites ═══════════════════ */

    /**
     * Bake every palette at every angle ONCE, at mount.
     * Each frame is a single square sprite holding the bloom, the flare and the
     * core together, so a light point costs exactly one drawImage per frame.
     */
    buildGemSprites() {
      const size = HALO_SPRITE
      this.gemSprites = PALETTES.map(pal => {
        const frames = []
        for (let i = 0; i < GEM_ANGLES; i++) {
          const c = document.createElement('canvas')
          c.width = c.height = size
          paintMote(c.getContext('2d'), size, i / GEM_ANGLES, pal)
          frames.push(c)
        }
        return frames
      })
    },

    paletteIndex(color) {
      const i = PALETTES.findIndex(p => p.color === color)
      return i === -1 ? PALETTES.length - 1 : i
    },

    /* ═══════════════════ Nebula points ═══════════════════ */

    /* ═══════════════════ Nebula plane ═══════════════════ */

    /**
     * Which memories are released today.
     *
     * "每天放出的记忆是有限且不一样的" — the sky holds a bounded, DIFFERENT set
     * each day. The selection is a pure function of the local date, so it is
     * stable across reloads within a day (the same memories are in the same
     * places, which is what makes the plane feel like a real place) and rolls
     * over on its own at midnight with nothing to store or expire.
     *
     * A deterministic shuffle rather than "hash each memory and take the
     * smallest N": hashing each item independently gives a sample, but a
     * different-sized sample each day, and two adjacent days can overlap
     * heavily by chance. Sorting by a per-day hash key gives an exact count and
     * makes today's set a genuinely different subset rather than a reshuffle.
     */
    releaseToday() {
      const pool = this.pool
      if (!pool.length) return []
      const d = new Date()
      // Local date, not UTC: "today" should turn over at the visitor's
      // midnight, not at Greenwich's.
      const day = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
      const want = Math.max(DAY_RELEASE_MIN, Math.round(pool.length * DAY_RELEASE_RATIO))

      const keyed = pool.map((m, i) => ({ i, k: hash01(i * 2654435761 + day * 40503) }))
      keyed.sort((a, b) => a.k - b.k)
      const chosen = keyed.slice(0, want).map(x => x.i)
      // Kept in corpus order so the plane's layout is not reshuffled by the
      // sort — only WHICH memories appear changes from day to day.
      chosen.sort((a, b) => a - b)
      return chosen.map(i => pool[i])
    },

    /**
     * The nebula is an endless plane, not a fixed screen of dots.
     *
     * World space is carved into cells. A cell either holds a crystal or is
     * empty, and WHICH memory it holds comes from a hash of the cell's own
     * coordinates — nothing is stored per cell. Panning outward therefore keeps
     * finding new memories forever, and panning back finds the same ones again,
     * for a cost that stays proportional to what is on screen.
     */
    fieldBounds() {
      const c = FIELD_CELL
      return {
        x0: Math.floor(this.panX / c.w) - 1,
        y0: Math.floor(this.panY / c.h) - 1,
        x1: Math.floor((this.panX + this.cw) / c.w) + 1,
        y1: Math.floor((this.panY + this.ch) / c.h) + 1,
      }
    },

    /** Rebuild the visible set — only when the visible cell range actually moved. */
    syncField(force) {
      if (!this.pool.length || this.mode !== 'nebula') return
      const b = this.fieldBounds()
      if (!force && this.cellX0 === b.x0 && this.cellY0 === b.y0 &&
          this.cellX1 === b.x1 && this.cellY1 === b.y1) return
      this.cellX0 = b.x0; this.cellY0 = b.y0
      this.cellX1 = b.x1; this.cellY1 = b.y1

      const c = FIELD_CELL
      // Only today's released memories are in the sky at all. `pool` stays the
      // full corpus — the waterfall still shows everything — while the nebula
      // is the bounded, daily-changing subset.
      const live = this.todayPool.length ? this.todayPool : this.pool
      const n = live.length
      const taken = new Set()
      const out = []

      for (let cy = b.y0; cy <= b.y1; cy++) {
        for (let cx = b.x0; cx <= b.x1; cx++) {
          const h = cellHash(cx, cy)
          // Sparse: empty cells keep the plane from reading as a grid.
          if ((h >>> 8) / 16777216 > c.density) continue

          const h2 = hash01(h + 1)
          const h3 = hash01(h + 3)
          const h4 = hash01(h + 7)
          const h5 = hash01(h + 11)

          // Pick a memory, probing past ones already on screen so the visitor
          // never sees the same thought twice in one view. With fewer released
          // memories than visible cells, some cells must go empty: the earlier
          // five-step probe gave up and reused a memory, so a busy sky showed
          // the same thought in two places at once — and capturing it then
          // removed both lights. Now the search covers the whole pool and a
          // cell with no free memory is simply left dark.
          const cellKey = cx + ',' + cy
          const pinned = this.overrides[cellKey]
          let data = null
          if (pinned && !taken.has(pinned.key)) {
            data = pinned
          } else {
            let pi = Math.floor(h2 * n) % n
            for (let g = 0; g < n; g++) {
              if (!taken.has(live[pi].key)) { data = live[pi]; break }
              pi = (pi + 1) % n
            }
            if (!data) continue
          }
          taken.add(data.key)

          // A captured memory is gone until it comes back — its cell simply
          // holds nothing, so the sky visibly thins where the visitor has been
          // reading. `escapedAt` is a wall-clock stamp; sweepEscapes() clears
          // it when the memory's time away is up.
          if (this.escapedAt[data.key]) continue

          const size = this.isMobile ? 30 + h3 * 13 : 38 + h3 * 20
          const wx = (cx + 0.15 + h4 * 0.7) * c.w
          const wy = (cy + 0.15 + h5 * 0.7) * c.h

          // Only what is actually on screen counts as "met" — the field keeps a
          // one-cell margin around the viewport for smooth panning, and counting
          // that margin would report memories the visitor has never seen.
          if (wx >= this.panX && wx <= this.panX + this.cw &&
              wy >= this.panY && wy <= this.panY + this.ch) {
            if (!this.seen[data.key]) { this.seen[data.key] = 1; this.seenCount++ }
          }

          out.push({
            // Unique by construction, and stable for a given cell: two crystals
            // can never share a Vue key, and panning back re-finds the same one
            // with the same drift phase.
            uid: this.uidFor(cx, cy),
            cellKey,
            data,
            wx,
            wy,
            size: +size.toFixed(1),
            // The memory's own tempo, from how much of it there is to read.
            ms: +motionScale(data.text).toFixed(3),
            // Touch targets stay finger-sized even when the crystal is small.
            hit: +Math.max(48, size + 16).toFixed(1),
          })
        }
      }
      this.points = out
    },

    /** Stable per-cell identity, shared by the point list and the escape map. */
    uidFor(cx, cy) {
      return ((cx & 0xffff) << 16 | (cy & 0xffff)) >>> 0
    },

    /**
     * Bring back any memory whose time away is up.
     *
     * Called from the frame loop, so a memory returns while the visitor is
     * watching the sky rather than only on the next reload — the reappearance
     * IS the moment the mechanic pays off, and it would be invisible if it only
     * happened between visits.
     */
    sweepEscapes(now) {
      let back = false
      for (const k in this.escapedAt) {
        if (this.escapedAt[k] <= now) {
          delete this.escapedAt[k]
          back = true
        }
      }
      if (back) this.syncField(true)
    },

    /**
     * 被捕获的记忆逃逸。
     *
     * A captured memory does not get swapped for a different one — it LEAVES.
     * The light flies away from the point that was touched, shrinking to
     * nothing over about 0.6s, and the cell then stands empty until the
     * memory's time away is up (ESCAPE_MIN_MS..+ESCAPE_SPREAD_MS). Then it
     * drifts back into the same place, unchanged.
     *
     * The earlier behaviour reseeded the cell with a different memory, which
     * made the sky feel like a slot machine: the same spot always held
     * something, so nothing you did to it was legible. An absence is legible.
     * It is also what makes the return worth watching for.
     */
    capturePoint(dataKey, x, y) {
      const p = this.points.find(q => q.data.key === dataKey)
      if (!p) return
      // Which way it flees: away from the touch, or a random direction when the
      // capture came from the keyboard (no pointer to flee from).
      const pos = this.pointScreenPos(p, this.now)
      let dx = pos.x - x
      let dy = pos.y - y
      const len = Math.hypot(dx, dy)
      if (!len || len < 1) {
        const a = Math.random() * Math.PI * 2
        dx = Math.cos(a); dy = Math.sin(a)
      } else {
        dx /= len; dy /= len
      }
      this.escapedAt[dataKey] = this.now + (ESCAPE_MIN_MS + Math.random() * ESCAPE_SPREAD_MS) / 1000
      // The flight is a screen-space event: it is drawn from its own list, so a
      // pan rebuilding `points` mid-flight cannot cut it short.
      this.flights.push({
        x: pos.x, y: pos.y, dx, dy, t0: this.now,
        size: p.size, pi: this.paletteIndex(p.data.color),
        phase: ((this.now * pos.spin) % 1 + 1) % 1,
      })
      // Gone from the sky at once. syncField() will not put it back while
      // `escapedAt` holds its key, and drawGems() skips it in the meantime.
      this.points = this.points.filter(q => q.data.key !== dataKey)
    },

    /**
     * Where a light point currently is on screen, in CSS pixels.
     * Driven purely by the wall clock, so the hit area and the crystal agree —
     * the crystal is drawn at exactly these coordinates every frame.
     *
     * `ms` is the memory's own speed, from its length (see motionScale): a long
     * memory travels a short distance slowly, a fragment skims. It scales the
     * PERIOD and not just the amplitude, so the difference reads as tempo —
     * scaling amplitude alone would make short memories hover in a tiny box and
     * look stuck rather than quick.
     */
    pointScreenPos(p, t) {
      const u = p.uid
      const d1 = hash01(u * 7 + 1)
      const d2 = hash01(u * 13 + 5)
      const d3 = hash01(u * 29 + 11)
      const d4 = hash01(u * 31 + 17)
      const ms = p.ms || 1
      // The per-light randomness is deliberately NARROW. Length has to be what
      // a visitor reads the speed off, and an earlier version let d1 drive both
      // amplitude (12..38px) and frequency (0.09..0.16) — a 5.7x spread from
      // chance alone, against a 4.4x spread from length. Randomness won, and
      // measured off the rendered canvas the correlation came out at only
      // rho = -0.21. Now chance contributes 1.67 x 1.33 = 2.2x and length
      // contributes 7.8x, so the ordering is visible rather than merely true.
      const ampX = (18 + d1 * 12) * (0.72 + 0.28 * ms)
      const ampY = (15 + d2 * 11) * (0.72 + 0.28 * ms)
      // World → screen. The pan offset is what makes the plane feel endless:
      // the crystal keeps its place in the world and the viewport moves.
      const sx = p.wx - this.panX
      const sy = p.wy - this.panY
      return {
        x: sx + Math.sin(t * (0.105 + d1 * 0.035) * ms + u * 1.7) * ampX,
        y: sy + Math.cos(t * (0.085 + d2 * 0.030) * ms + u * 2.3) * ampY,
        // Deliberately slow: the lights should look like they are floating on
        // their own, not orbiting a shared attractor. The highlight sweeps a
        // little faster than the drift, so a light reads as turning even while
        // it is holding still.
        spin: (0.035 + d3 * 0.045) * (0.75 + 0.5 * ms),
        breathe: 0.9 + d4 * 0.5,
      }
    },

    /**
     * Which crystal is under (x, y), judged by the same maths that drew it.
     *
     * The pointer coordinates arrive in CSS pixels relative to the canvas, so
     * they are directly comparable to pointScreenPos()'s output. The tolerance
     * is the crystal's drawn radius or the finger-sized floor, whichever is
     * larger — a 30px gem is still comfortably tappable.
     */
    hitTest(x, y, t) {
      let best = null
      let bestD = Infinity
      for (let i = 0; i < this.points.length; i++) {
        const p = this.points[i]
        const pos = this.pointScreenPos(p, t)
        const r = Math.max(p.hit, p.size) * 0.9
        const dx = x - pos.x
        const dy = y - pos.y
        const d = dx * dx + dy * dy
        if (d <= r * r && d < bestD) { best = p; bestD = d }
      }
      return best
    },

    onFieldClick(e) {
      if (this.revealed) return
      // A drag that ends over a crystal is not a tap on it.
      if (this.dragMoved > 6) { this.dragMoved = 0; return }
      const r = this.pointFieldRect()
      const p = this.hitTest(e.clientX - r.left, e.clientY - r.top, this.now)
      if (p) this.open(p.data, e)
    },

    onFieldMove(e) {
      const r = this.pointFieldRect()
      const p = this.hitTest(e.clientX - r.left, e.clientY - r.top, this.now)
      const uid = p ? p.uid : -1
      if (uid !== this.hoverUid) this.hoverUid = uid
    },

    onFieldLeave() {
      if (this.hoverUid !== -1) this.hoverUid = -1
    },

    /* ═══════════════════ Panning the endless plane ═══════════════════ */

    onPanStart(e) {
      if (this.revealed) return
      // Ignore secondary buttons; a right-drag is not a pan.
      if (e.pointerType === 'mouse' && e.button !== 0) return
      this.dragging = true
      this.dragId = e.pointerId
      this.dragX = e.clientX
      this.dragY = e.clientY
      this.dragMoved = 0
      this.lastPanX = e.clientX
      this.lastPanY = e.clientY
      this.panVX = 0
      this.panVY = 0
      if (e.currentTarget.setPointerCapture) {
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) { /* pointer already gone */ }
      }
    },

    onPanMove(e) {
      if (!this.dragging) return
      this.dragMoved += Math.abs(e.clientX - this.lastPanX) + Math.abs(e.clientY - this.lastPanY)
      this.lastPanX = e.clientX
      this.lastPanY = e.clientY
      // Drag the world with the finger: moving right reveals what is to the LEFT.
      const dx = e.clientX - this.dragX
      const dy = e.clientY - this.dragY
      this.panX -= dx
      this.panY -= dy
      this.dragX = e.clientX
      this.dragY = e.clientY
      // Velocity for the throw, sampled per move so a fast flick carries far.
      // Clamped: a synthetic drag (or a jumpy trackpad) can report a 120px
      // single-event delta, and unclamped that becomes a throw of a whole
      // screen that no hand actually asked for.
      this.panVX = Math.max(-40, Math.min(40, -dx))
      this.panVY = Math.max(-40, Math.min(40, -dy))
      this.syncField()
    },

    onPanEnd(e) {
      if (!this.dragging) return
      this.dragging = false
      this.dragId = null
      if (e && e.currentTarget && e.currentTarget.releasePointerCapture && e.pointerId != null) {
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (_) { /* already released */ }
      }
    },

    /** Keep the throw going after the finger lifts, then let it settle. */
    applyPanInertia() {
      if (this.dragging) return
      if (Math.abs(this.panVX) < 0.08 && Math.abs(this.panVY) < 0.08) {
        if (this.panVX || this.panVY) { this.panVX = 0; this.panVY = 0 }
        return
      }
      this.panX += this.panVX
      this.panY += this.panVY
      // 0.9 per frame stops the throw in about a second; a slower decay keeps
      // sliding long after the hand has stopped, which reads as drift rather
      // than momentum.
      this.panVX *= 0.9
      this.panVY *= 0.9
      this.syncField()
    },

    pointFieldRect() {
      const el = this.$refs.pointField
      return el ? el.getBoundingClientRect() : { left: 0, top: 0 }
    },

    /** Draw every memory light at its baked angle. One blit per light per frame. */
    drawGems(t, ctx) {
      if (!this.gemSprites.length) return
      const dpr = this.dpr
      const escaped = this.escapedAt
      for (let i = 0; i < this.points.length; i++) {
        const p = this.points[i]
        // A captured memory is gone: its cell holds nothing until it returns.
        // Checked here as well as in syncField() because a capture happens
        // between rebuilds, and the light must stop being drawn immediately.
        if (escaped[p.data.key]) continue
        const pos = this.pointScreenPos(p, t)
        const pi = this.paletteIndex(p.data.color)
        const frames = this.gemSprites[pi]
        if (!frames) continue

        const frame = frames[Math.floor((((t * pos.spin + i * 0.11) % 1) + 1) % 1 * GEM_ANGLES) % GEM_ANGLES]
        const breathe = 1 + 0.055 * Math.sin(t * 1.25 * pos.breathe + p.uid)
        const hot = p.uid === this.hoverUid ? 1.22 : 1
        const gs = p.size * MOTE_GLOW * breathe * hot
        const gx = pos.x - gs / 2
        const gy = pos.y - gs / 2

        ctx.globalAlpha = 0.78 + 0.22 * Math.sin(t * 0.9 + p.uid * 1.7)
        ctx.drawImage(frame, gx, gy, gs, gs)
        ctx.globalAlpha = 1

        // A faint rim ring on hover only — the affordance costs nothing idle.
        if (p.uid === this.hoverUid) {
          const s = gs / MOTE_GLOW
          ctx.globalAlpha = 0.4
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, s * 0.62, 0, Math.PI * 2)
          ctx.strokeStyle = p.data.color
          ctx.lineWidth = 1 / dpr
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      }
      this.drawFlights(t, ctx)
    },

    /**
     * The 逃逸 itself: a captured light flung away from the point that was
     * touched, shrinking and fading over ~0.6s.
     *
     * Held in SCREEN coordinates and drawn from its own list, deliberately not
     * from `points`. A pan rebuilds `points` from the world hash at any moment,
     * and a flight that lived inside that list would blink out mid-air the
     * instant the visitor dragged the sky. A flight is an event that already
     * happened at a place on the screen, so screen space is where it belongs.
     */
    drawFlights(t, ctx) {
      const fly = this.flights
      if (!fly.length) return
      for (let i = fly.length - 1; i >= 0; i--) {
        const f = fly[i]
        const k = (t - f.t0) / 0.62
        if (k >= 1) { fly.splice(i, 1); continue }
        const ease = 1 - (1 - k) * (1 - k)   // decelerating, as if thrown
        const d = ease * 190
        const gs = f.size * MOTE_GLOW * (1 - 0.72 * k)
        const frames = this.gemSprites[f.pi]
        if (!frames) continue
        const frame = frames[Math.floor(((f.phase + k * 0.55) % 1 + 1) % 1 * GEM_ANGLES) % GEM_ANGLES]
        ctx.globalAlpha = Math.max(0, 1 - k) * 0.95
        ctx.drawImage(frame, f.x + f.dx * d - gs / 2, f.y + f.dy * d - gs / 2, gs, gs)
        ctx.globalAlpha = 1
      }
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
      this.capturePoint(item.key, x, y)
    },

    close() {
      this.revealed = null
    },

    setMode(mode) {
      if (this.mode === mode) return
      this.revealed = null
      this.mode = mode
      if (mode === 'stream') {
        // The scroller was display:none until now, so its height and the
        // wall's offset were both 0 while the window was last computed.
        this.$nextTick(() => {
          this.wallTop = 0
          const v = this.$refs.streamView
          if (v) this.wallScroll = v.scrollTop
          this.syncWallWindow(true)
        })
      }
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
      // A note the visitor just wrote is theirs and goes into the sky at once,
      // regardless of whether today's release happened to pick it — waiting for
      // a date rollover to see your own words would be absurd.
      this.todayPool = [entry, ...this.todayPool]

      this.showAddForm = false
      this.newText = ''
      this.newDate = ''

      // Drop it straight into the nebula as a fresh light, pinned to whichever
      // cell happens to be free so panning away and back still finds it.
      if (this.points.length > 0) {
        const i = Math.floor(Math.random() * this.points.length)
        const p = this.points[i]
        this.overrides[p.cellKey] = entry
        const next = this.points.slice()
        next[i] = {
          uid: p.uid, cellKey: p.cellKey, data: entry, wx: p.wx, wy: p.wy,
          size: p.size, ms: +motionScale(entry.text).toFixed(3), hit: p.hit,
        }
        this.points = next
      } else {
        this.syncField(true)
      }

      // The wall is packed, not reflowed — a new memory has to be given a slot.
      if (this.mode === 'stream') this.layoutWall()

      this.saveCustomBubbleToApi(text, dateStr)
    },

    /* ═══════════════════ Waterfall (virtualised) ═══════════════════ */

    /** Column count for the current width — mirrors the CSS breakpoints. */
    wallCols() {
      const w = window.innerWidth
      if (w <= 559) return 1
      if (w <= 859) return 2
      if (w <= 1139) return 3
      return 4
    },

    /**
     * Measure every card ONCE, off screen, then hand out absolute positions.
     *
     * Why measure instead of estimating: a masonry that guesses heights and
     * then corrects itself makes the scrollbar jump under the reader. One
     * hidden pass costs a single reflow at load and is right from then on.
     */
    layoutWall() {
      if (this.pool.length === 0) {
        this.wallItems = []
        this.wallVisible = []
        this.wallHeight = 0
        return
      }

      // Column geometry first: the hidden measure pass needs the card width,
      // otherwise it would measure cards at the wrong wrap.
      const mobile = window.innerWidth <= 767
      const cols = this.wallCols()
      // NOTE: an absolutely positioned child is placed against the PADDING
      // edge of .stream-wall, not its content edge, so the horizontal padding
      // has to be added back into every `left` or the whole wall shifts left.
      const pad = mobile ? 16 : 24
      const wallW = Math.min(1180, window.innerWidth) - pad * 2
      const gap = mobile ? 12 : 16
      const colW = (wallW - gap * (cols - 1)) / cols
      this.wallColsAt = cols
      this.wallColW = colW
      this.wallGap = gap
      this.wallPad = pad

      this.measuring = true
      this.$nextTick(() => {
        const boxes = this.$refs.measure
          ? Array.from(this.$refs.measure.children).map(el => el.offsetHeight)
          : []
        this.measuring = false

        const heights = new Array(cols).fill(0)
        const items = []
        for (let i = 0; i < this.pool.length; i++) {
          const h = boxes[i] || 160 // fallback keeps the layout sane if a card was not measured
          let c = 0
          for (let k = 1; k < cols; k++) if (heights[k] < heights[c] - 0.5) c = k
          items.push({
            key: this.pool[i].key,
            data: this.pool[i],
            col: c,
            top: heights[c],
            height: h,
            style: {
              left: (pad + c * (colW + gap)) + 'px',
              top: heights[c] + 'px',
              width: colW + 'px',
              // The persona's colour rides along with the layout so a wall card
              // keeps its own accent hairline (see .memory-card::before).
              '--accent': this.pool[i].color,
            },
          })
          heights[c] += h + gap
        }

        this.wallItems = items
        this.wallHeight = Math.max(0, Math.max.apply(null, heights) - gap)
        this.syncWallWindow(true)
      })
    },

    onWallScroll(e) {
      this.wallScroll = e.target.scrollTop
      this.syncWallWindow()
    },

    /**
     * Put only the cards intersecting the viewport (± half a screen of slack)
     * into the DOM. 73 memories or 730, the mounted count stays ~15.
     */
    syncWallWindow(force) {
      const view = this.$refs.streamView
      if (!view && !force) return
      const scroll = this.wallScroll
      const vh = view ? view.clientHeight : window.innerHeight
      this.wallViewH = vh
      // The wall sits below the page header inside the same scroller.
      if (view && !this.wallTop) {
        const wall = this.$refs.wall
        if (wall) this.wallTop = wall.offsetTop
      }
      const headH = this.wallTop
      // Cards are packed with their heights already known, so the window can
      // hug the viewport: a tenth of a screen of slack above and a twentieth
      // below. Anything wider is not virtualising — a 1.5-screen window held
      // 31 of 73 cards before this was tightened.
      const from = scroll - headH - vh * 0.1
      const to = scroll - headH + vh * 1.05
      const next = []
      for (let i = 0; i < this.wallItems.length; i++) {
        const it = this.wallItems[i]
        if (it.top + it.height < from) continue
        // No early exit: cards are packed into whichever column is shortest,
        // so `top` is NOT monotonic and a break would silently drop cards.
        if (it.top > to) continue
        next.push(it)
      }
      // Only touch the reactive array when the SET changed — a scroll event
      // must not re-render the list on every pixel.
      if (next.length !== this.wallVisible.length ||
          next.some((it, i) => it.key !== this.wallVisible[i].key)) {
        this.wallVisible = next
      }
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
      this.buildGemSprites()
      this.resizeCanvas()
      if (wasMobile !== this.isMobile) this.syncField(true)
      // Card widths track the viewport continuously, so re-pack on any width
      // change, not just when the column count happens to cross a breakpoint.
      // Debounced: a drag-resize fires this dozens of times a second and each
      // run costs a full measuring pass.
      clearTimeout(this.wallResizeTimer)
      this.wallResizeTimer = setTimeout(() => this.layoutWall(), 180)
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
      // Cached so the click handler can hit-test against the exact position the
      // crystals were last drawn at, without recomputing the drift.
      this.now = now / 1000
      this.applyPanInertia()
      this.sweepEscapes(this.now)
      this.draw(this.now)
    },

    draw(t) {
      const ctx = this.ctx
      const w = this.cw
      const h = this.ch
      if (!ctx || w === 0) return

      ctx.clearRect(0, 0, w, h)

      // ── stars (twinkle is computed, not a DOM animation) ──
      if (this.stars.length) for (let i = 0; i < this.stars.length; i++) {
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
      if (this.dust.length) for (let i = 0; i < this.dust.length; i++) {
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

      // ── crystal light points (baked sprites, blitted) ──
      if (this.mode === 'nebula' && !this.revealed) {
        this.drawGems(t, ctx)
      }

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

    /* Pointer events already unify mouse, touch and pen, so one handler feeds
       the dust's cursor repulsion on every device. */
    onPointerMove(e) { this.mouseX = e.clientX; this.mouseY = e.clientY; this.mouseActive = true },
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
/* The crystals are drawn on the canvas that sits beneath this layer; the field
   itself is a single transparent sheet whose only job is to catch the pointer.
   Nothing here animates and nothing here is composited, so the whole starfield
   costs exactly one layer instead of one per light. */
.point-field {
  position: absolute; inset: 0; z-index: 3;
  /* The plane is pannable, so the grab cursor is the whole affordance. */
  cursor: grab;
  touch-action: none;
}
.point-field.is-grabbing { cursor: grabbing; }

/* Keyboard / screen-reader route to the same memories. Visually hidden but
   focusable, so Tab reaches every thought exactly as a click would. */
.sr-points {
  position: absolute; width: 1px; height: 1px;
  margin: -1px; padding: 0; border: 0;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}
.sr-point {
  font: inherit; color: inherit; background: none; border: 0;
  cursor: pointer;
}
.sr-point:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px rgba(200, 190, 230, 0.45);
}

.field-hint {
  position: absolute; left: 50%; bottom: 104px; transform: translateX(-50%);
  z-index: 3; margin: 0; white-space: nowrap; pointer-events: none;
  font-size: 12px; letter-spacing: 0.22em; color: rgba(210, 204, 192, 0.28);
  animation: hint-breathe 6s ease-in-out infinite;
}

/* How much of the corpus has actually been met. The plane is endless, so
   without this the visitor has no way to tell progress from repetition. */
.field-count {
  position: absolute; left: 50%; bottom: 84px; transform: translateX(-50%);
  z-index: 3; margin: 0; white-space: nowrap; pointer-events: none;
  font-size: 10.5px; letter-spacing: 0.18em; color: rgba(200, 195, 185, 0.2);
  font-variant-numeric: tabular-nums;
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

/* ── wall variant ──
   Cards are positioned absolutely by the virtualiser (left/top/width come in
   through the inline style), so no column-count here: CSS columns would keep
   every card in the layout box and defeat the whole point. */
.wall-item {
  position: absolute;
  margin: 0;
}
.memory-card--wall {
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

/* The one-off measuring pass: laid out for real, never seen. */
.wall-measure {
  position: absolute;
  left: -99999px; top: 0;
  visibility: hidden;
  pointer-events: none;
}
.wall-measure .memory-card--wall { margin: 0; }

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
  /* The halo of the light that was touched, so the card reads as that memory
     opening rather than a generic panel appearing. */
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.72), 0 0 90px var(--halo, rgba(139, 122, 170, 0.25));
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
  position: relative;
  max-width: 1180px; margin: 0 auto;
  /* No bottom padding: this element's height IS the packed card extent, so a
     trailing gap would push the tail caption back up over the last cards. */
  padding: 0 24px;
}
.stream-tail {
  margin: 28px 0 130px;
  text-align: center;
  font-size: 11.5px; letter-spacing: 0.2em;
  color: rgba(205, 199, 187, 0.22);
  pointer-events: none;
}

/* ═══════════════ Fixed chrome ═══════════════ */
.chrome {
  position: fixed; z-index: 20;
  display: flex; align-items: center; gap: 6px;
  text-decoration: none;
}
.chrome--back {
  top: 28px; left: 30px;
  gap: 16px;
  font-size: 13px; letter-spacing: 0.08em;
}
.chrome-link {
  display: flex; align-items: center; gap: 6px;
  color: rgba(200, 195, 185, 0.35);
  text-decoration: none;
  transition: color 0.4s ease;
}
.chrome-link--sub { font-size: 11.5px; letter-spacing: 0.12em; }
.chrome--back:hover .chrome-link { color: rgba(200, 195, 185, 0.22); }
.chrome--back .chrome-link:hover { color: rgba(220, 210, 195, 0.78); }
.back-arrow { font-size: 15px; transition: transform 0.3s ease; }
.chrome--back .chrome-link:hover .back-arrow { transform: translateX(-4px); }

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
/* No column-count anywhere: cards are absolutely positioned by layoutWall(),
   and CSS columns would have no effect on out-of-flow children anyway. The
   matching breakpoints live in wallCols() — keep the two in step. */

@media (max-width: 767px) {
  /* A full-screen grain layer costs fill rate on phones for very little. */
  .grain { display: none; }

  .chrome--back { top: 16px; left: 16px; font-size: 12px; gap: 12px; }
  .chrome--title { top: 18px; right: 16px; }
  .t-main { font-size: 17px; letter-spacing: 0.26em; }
  .t-sub { display: none; }

  .mode-switch { bottom: 18px; padding: 2px; }
  .mode-switch button { padding: 7px 17px; font-size: 12px; }
  .add-btn { right: 14px; bottom: 14px; width: 40px; height: 40px; }
  .field-hint { bottom: 82px; font-size: 11px; letter-spacing: 0.16em; }

  .stream-head { padding: 66px 16px 20px; }
  .stream-head h1 { font-size: 21px; }
  .stream-wall { padding: 0 16px 132px; }
  .memory-card--wall { margin-bottom: 12px; padding: 20px 18px 16px; }
  .memory-card--wall .mc-text { font-size: 14.5px; line-height: 1.95; }

  .memory-card--full { width: 92vw; padding: 36px 26px 26px; }
  .memory-card--full .mc-text { font-size: 16.5px; line-height: 2.05; letter-spacing: 0.05em; }
  .mc-quote { font-size: 42px; }
  .mc-quote--open { top: 10px; left: 10px; }
  .mc-quote--close { bottom: 4px; right: 10px; }
  .reveal-veil { gap: 16px; padding: 16px; }
}

@media (max-width: 559px) {
  /* wallCols() returns 1 here; the wall's geometry comes from JS, not CSS. */
  .stream-head { padding: 66px 16px 18px; }
}

@media (prefers-reduced-motion: reduce) {
  .field-hint, .reveal-hint { animation: none !important; }
  .memory-card--full { animation: none; opacity: 1; }
  .point-swap-enter-active, .point-swap-leave-active { transition: none; }
  .memory-card { transition: none; }
}
</style>
