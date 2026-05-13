<template>
  <div class="thought-chamber" ref="chamber">
    <!-- ambient particles -->
    <div class="particle-field">
      <span
        v-for="p in particles"
        :key="p.id"
        class="dust-particle"
        :style="p.style"
      ></span>
    </div>

    <!-- starfield -->
    <div class="starfield">
      <span
        v-for="s in stars"
        :key="s.id"
        class="star"
        :style="s.style"
      ></span>
    </div>

    <!-- thinking bubbles -->
    <transition-group name="bubble" tag="div" class="bubble-layer">
      <div
        v-for="b in visibleBubbles"
        :key="b.id"
        class="thought-bubble"
        :class="[b.personaClass, b.shapeClass, { 'is-captured': capturedBubble && capturedBubble.id === b.id }]"
        :style="b.id === (capturedBubble && capturedBubble.id) ? b.capturedStyle : b.style"
        @click.stop="captureBubble(b, $event)"
      >
        <span class="bubble-label">{{ b.personaLabel }}</span>
        <p class="bubble-text">{{ b.text }}</p>
        <div class="bubble-dots">
          <span class="dot" v-for="n in b.dotCount" :key="n"></span>
        </div>
      </div>
    </transition-group>

    <!-- capture overlay -->
    <transition name="overlay-fade">
      <div v-if="capturedBubble" class="capture-overlay" :class="{ releasing }" @click="releaseBubble">
        <!-- vortex blur for ripple effect -->
        <div v-if="captureEffect === 3 && ripples.length" class="vortex-blur" :style="{ left: ripples[0].style['--ox'], top: ripples[0].style['--oy'] }"></div>
        <!-- particles layer: outside capture-bubble so coordinates are viewport-relative -->
        <template v-if="captureEffect === 0">
          <span v-for="sp in sparkles" :key="sp.i" class="sparkle" :class="{ builder: sp.isBuilder }" :style="sp.style"></span>
        </template>
        <template v-if="captureEffect === 1">
          <span v-for="w in wisps" :key="w.i" class="wisp" :style="w.style"></span>
        </template>
        <template v-if="captureEffect === 2">
          <span v-for="sh in shards" :key="sh.i" class="shard" :style="sh.style"></span>
        </template>
        <template v-if="captureEffect === 3">
          <span v-for="r in ripples" :key="r.i" class="ripple-ring" :style="r.style"></span>
        </template>

        <div class="capture-stage" @click.stop>
          <div
            class="capture-bubble"
            :class="[capturedBubble.personaClass, `effect-${captureEffect}`, { releasing }]"
            :style="{
              '--persona-color': capturedBubble.style['--persona-color'],
              '--persona-glow': capturedBubble.style['--persona-glow'],
              '--persona-bg': capturedBubble.style['--persona-bg'],
            }"
          >
            <span v-if="captureEffect === 3" class="reflection"></span>
            <span class="capture-label">{{ capturedBubble.personaLabel }} · 思考中</span>
            <p class="capture-text">{{ capturedBubble.text }}</p>
            <div class="capture-dots">
              <span class="c-dot" v-for="n in capturedBubble.dotCount" :key="n"></span>
            </div>
          </div>
          <div class="capture-hint">点击空白处释放</div>
        </div>
      </div>
    </transition>

    <!-- back link -->
    <a href="/" class="back-link">
      <span class="back-arrow">←</span>
      <span class="back-text">回去</span>
    </a>

    <!-- title hint -->
    <div class="title-hint">
      <span class="hint-line">思绪</span>
      <span class="hint-sub">thoughts drifting...</span>
    </div>
  </div>
</template>

<script>
const PERSONAS = [
  {
    file: '/thoughts/shime.txt',
    name: '阿秋',
    cls: 'persona-qiuz',
    color: '#d4a255',
    glow: 'rgba(212,162,85,0.25)',
    shapes: ['bubble-round', 'bubble-organic', 'bubble-wide'],
    dotCount: [2, 2, 3],
  },
  {
    file: '/thoughts/future.txt',
    name: '春燕',
    cls: 'persona-yan',
    color: '#c97a7c',
    glow: 'rgba(201,122,124,0.25)',
    shapes: ['bubble-round', 'bubble-tall', 'bubble-organic'],
    dotCount: [2, 3, 3],
  },
  {
    file: '/thoughts/weiwei.txt',
    name: '小银',
    cls: 'persona-yin',
    color: '#7dab8c',
    glow: 'rgba(125,171,140,0.25)',
    shapes: ['bubble-wide', 'bubble-round', 'bubble-small'],
    dotCount: [2, 2, 2],
  },
  {
    file: '/thoughts/chaos.txt',
    name: '一生阳春悲',
    cls: 'persona-bei',
    color: '#6a8cb5',
    glow: 'rgba(106,140,181,0.25)',
    shapes: ['bubble-tall', 'bubble-wide', 'bubble-organic'],
    dotCount: [3, 3, 4],
  },
]

let nextId = 0

export default {
  name: 'ThoughtBubbles',
  data() {
    return {
      visibleBubbles: [],
      particles: [],
      stars: [],
      personaData: [[], [], [], []],
      bubbleTimer: null,
      maxBubbles: 7,
      capturedBubble: null,
      captureEffect: 0,
      releasing: false,
      sparkles: [],
      wisps: [],
      shards: [],
      ripples: [],
      recentTexts: [], // { text, personaIndex, time } — 10s dedup
    }
  },
  async mounted() {
    this.generateParticles()
    this.generateStars()
    await this.loadAllTexts()
    this.startBubbleCycle()
    document.addEventListener('click', this.handleClick)
  },
  beforeUnmount() {
    clearInterval(this.bubbleTimer)
    document.removeEventListener('click', this.handleClick)
    this.removeEscListener()
  },
  methods: {
    generateParticles() {
      const ps = []
      for (let i = 0; i < 40; i++) {
        ps.push({
          id: `p${i}`,
          style: {
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
            opacity: 0.15 + Math.random() * 0.35,
            animationDelay: `${Math.random() * 12}s`,
            animationDuration: `${8 + Math.random() * 16}s`,
          },
        })
      }
      this.particles = ps
    },
    generateStars() {
      const ss = []
      for (let i = 0; i < 60; i++) {
        ss.push({
          id: `s${i}`,
          style: {
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
            opacity: 0.2 + Math.random() * 0.6,
            animationDelay: `${Math.random() * 6}s`,
            animationDuration: `${2 + Math.random() * 5}s`,
          },
        })
      }
      this.stars = ss
    },
    async loadAllTexts() {
      for (let i = 0; i < PERSONAS.length; i++) {
        try {
          const resp = await fetch(PERSONAS[i].file)
          const raw = await resp.text()
          this.personaData[i] = this.parseParagraphs(raw)
        } catch (e) {
          this.personaData[i] = ['……']
        }
      }
    },
    parseParagraphs(raw) {
      const blocks = raw
        .split(/\n\n+/)
        .map(b => b.replace(/\n/g, ' ').trim())
        .filter(b => b.length > 6 && b.length < 220)
      if (blocks.length === 0) {
        return raw
          .split(/\n/)
          .map(b => b.trim())
          .filter(b => b.length > 4 && b.length < 220)
      }
      return blocks
    },
    pickRandom(arr) {
      if (!arr || arr.length === 0) return '……'
      return arr[Math.floor(Math.random() * arr.length)]
    },
    getFreshText(pi) {
      const now = Date.now()
      const all = this.personaData[pi]
      if (!all.length) return '……'
      // filter out texts shown in last 10s for this persona
      const recent = this.recentTexts.filter(r => r.time > now - 10000)
      const recentSet = new Set(recent.map(r => r.text))
      const fresh = all.filter(t => !recentSet.has(t))
      if (fresh.length === 0) return this.pickRandom(all)
      return this.pickRandom(fresh)
    },
    pruneRecentTexts() {
      const now = Date.now()
      this.recentTexts = this.recentTexts.filter(r => r.time > now - 10000)
    },
    spawnBubble() {
      if (this.personaData.every(d => d.length === 0)) return

      // pick persona with data
      let pi
      do {
        pi = Math.floor(Math.random() * PERSONAS.length)
      } while (this.personaData[pi].length === 0)

      const persona = PERSONAS[pi]
      const text = this.getFreshText(pi)
      // record for dedup
      this.recentTexts.push({ text, personaIndex: pi, time: Date.now() })
      this.pruneRecentTexts()

      const id = nextId++
      const shapeIdx = Math.floor(Math.random() * persona.shapes.length)

      // position: cluster personas in different zones
      const zones = [
        { xMin: 2, xMax: 35 },    // top-left zone
        { xMin: 55, xMax: 93 },    // top-right zone
        { xMin: 20, xMax: 50 },    // center zone
        { xMin: 5, xMax: 90 },     // wide spread
      ]
      const zone = zones[pi]
      const xPos = zone.xMin + Math.random() * (zone.xMax - zone.xMin)

      const bubble = {
        id,
        text,
        personaClass: persona.cls,
        shapeClass: persona.shapes[shapeIdx],
        personaLabel: persona.name,
        dotCount: persona.dotCount[shapeIdx],
        style: {
          left: `${xPos}%`,
          bottom: `${-(10 + Math.random() * 8)}%`,
          '--persona-color': persona.color,
          '--persona-glow': persona.glow,
          '--persona-bg': `${persona.color}14`,
          '--float-duration': `${10 + Math.random() * 12}s`,
          '--float-distance': `${70 + Math.random() * 25}vh`,
          '--wobble-amount': `${-(3 + Math.random() * 6)}deg`,
          '--wobble2-amount': `${3 + Math.random() * 6}deg`,
          transform: `rotate(${-(4 + Math.random() * 8)}deg) scale(0.85)`,
        },
        born: Date.now(),
      }

      this.visibleBubbles.push(bubble)

      // remove old bubbles if too many
      while (this.visibleBubbles.length > this.maxBubbles) {
        this.visibleBubbles.shift()
      }

      // auto-remove after animation
      const lifetime = parseFloat(bubble.style['--float-duration']) * 1000 + 2000
      setTimeout(() => {
        const idx = this.visibleBubbles.findIndex(b => b.id === id)
        if (idx !== -1) {
          this.visibleBubbles.splice(idx, 1)
        }
      }, lifetime)
    },
    startBubbleCycle() {
      const scheduleNext = () => {
        const delay = 1800 + Math.random() * 4200
        this.bubbleTimer = setTimeout(() => {
          this.spawnBubble()
          scheduleNext()
        }, delay)
      }
      // spawn first bubble quickly
      setTimeout(() => this.spawnBubble(), 400)
      scheduleNext()
    },
    handleClick() {
      // spawn extra bubble on click
      if (this.visibleBubbles.length < this.maxBubbles + 2) {
        this.spawnBubble()
      }
    },
    captureBubble(bubble, event) {
      if (this.capturedBubble && this.capturedBubble.id === bubble.id) {
        this.releaseBubble()
        return
      }
      const el = event ? event.currentTarget : null
      const rect = el ? el.getBoundingClientRect() : { left: window.innerWidth/2 - 100, top: window.innerHeight/2 - 40, width: 200, height: 80 }
      const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      // center in pixels (not vw/vh — avoids unit-mixing bugs)
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      // original bubble shatters in place
      bubble.capturedStyle = {
        '--persona-color': bubble.style['--persona-color'],
        '--persona-glow': bubble.style['--persona-glow'],
        '--persona-bg': bubble.style['--persona-bg'],
        position: 'fixed',
        left: `${origin.x}px`,
        top: `${origin.y}px`,
        transform: 'translate(-50%, -50%) scale(0.3)',
        zIndex: 20,
        transition: 'all 0.35s ease-in',
        pointerEvents: 'none',
        opacity: 0,
        filter: 'blur(20px)',
      }
      const c = bubble.style['--persona-color']
      this.captureEffect = Math.floor(Math.random() * 4)
      this.releasing = false
      this.generateEffectDecorations(c, origin, center, bubble.text)
      this.capturedBubble = bubble
      this.$nextTick(() => { this.addEscListener() })
    },
    generateEffectDecorations(color, origin, center, text) {
      const eff = this.captureEffect
      this.sparkles = []
      this.wisps = []
      this.shards = []
      this.ripples = []
      if (eff === 0) {
        // firefly: 24 sparkles — bubble "shatters" into fireflies, they fly to center, then piece the bubble together
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
          const burst = 15 + Math.random() * 70
          const size = 2 + Math.random() * 9
          const isBuilder = i >= 18 // last 6 stay to "build" the outline
          this.sparkles.push({
            i, isBuilder,
            style: {
              '--ox': `${origin.x + Math.cos(angle) * burst}px`,
              '--oy': `${origin.y + Math.sin(angle) * burst}px`,
              '--cx': `${center.x}px`, '--cy': `${center.y}px`,
              '--delay': `${Math.random() * 0.4}s`,
              '--dur': `${0.8 + Math.random() * 1.0}s`,
              '--size': `${size}px`,
              '--builder': isBuilder ? '1' : '0',
              backgroundColor: color,
              boxShadow: `0 0 ${size * 2}px ${size * 0.6}px ${color}cc`,
            },
          })
        }
      } else if (eff === 1) {
        // fog: 10 thick mist clouds dissolve from origin, gather at center, bubble emerges
        for (let i = 0; i < 10; i++) {
          const sx = origin.x + (Math.random() - 0.5) * 120
          const sy = origin.y + (Math.random() - 0.5) * 100
          this.wisps.push({
            i, style: {
              '--ox': `${sx}px`, '--oy': `${sy}px`,
              '--cx': `${center.x}px`, '--cy': `${center.y}px`,
              '--dur': `${1.0 + Math.random() * 0.8}s`,
              '--delay': `${Math.random() * 0.3}s`,
              '--size': `${50 + Math.random() * 90}px`,
              '--op': `${0.3 + Math.random() * 0.45}`,
              background: `radial-gradient(ellipse at center, ${color}aa 0%, ${color}44 50%, transparent 75%)`,
            },
          })
        }
      } else if (eff === 2) {
        // Canvas text reconstruction — bubble shatters, particles reassemble into the text stroke-by-stroke
        this.sampleTextPixelsForEffect2(color, origin, center, text)
      } else {
        // ripple: vortex — rings emanate from origin, center area blurs, bubble rises
        for (let i = 0; i < 6; i++) {
          this.ripples.push({
            i, style: {
              '--ox': `${origin.x}px`, '--oy': `${origin.y}px`,
              '--cx': `${center.x}px`, '--cy': `${center.y}px`,
              '--delay': `${i * 0.15}s`,
              '--size': `${50 + i * 42}px`,
              borderColor: `${color}88`,
              borderWidth: `${3 - i * 0.35}px`,
            },
          })
        }
      }
    },
    sampleTextPixelsForEffect2(color, origin, center, text) {
      this.shards = []
      if (!text) return
      // character-grid approach: measure each char, fill its box with 2.5px particles
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const fontSize = 18
      ctx.font = `400 ${fontSize}px SimSun, 'Microsoft YaHei', serif`
      const maxWidth = 400
      const lines = []
      let cur = ''
      for (const ch of text) {
        if (ctx.measureText(cur + ch).width > maxWidth) { lines.push(cur); cur = ch }
        else { cur += ch }
      }
      if (cur) lines.push(cur)
      const lineH = fontSize * 1.8
      const step = 2.5
      // build grid positions for every character
      const grid = []
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li]
        let cx = 0
        for (let ci = 0; ci < line.length; ci++) {
          const ch = line[ci]
          const cw = ctx.measureText(ch).width
          // skip very narrow chars (spaces, punctuation)
          for (let gx = 0; gx < cw; gx += step) {
            for (let gy = 0; gy < fontSize * 0.85; gy += step) {
              // ~55% density for a particle-grid mosaic look (not solid block)
              if (Math.random() > 0.55) continue
              grid.push({
                x: cx + gx + (Math.random() - 0.5) * 1.5,
                y: li * lineH + gy + (Math.random() - 0.5) * 1.5,
              })
            }
          }
          cx += cw
        }
      }
      if (grid.length === 0) return
      // total text block dimensions
      const totalW = Math.max(...lines.map(l => ctx.measureText(l).width))
      const totalH = lines.length * lineH
      // random sample from grid (limit to 200 particles)
      const limit = Math.min(grid.length, 200)
      const tx = center.x - totalW / 2
      const ty = center.y - totalH / 2
      for (let i = 0; i < limit; i++) {
        const ri = Math.floor(Math.random() * grid.length)
        const p = grid.splice(ri, 1)[0]
        const a = Math.random() * Math.PI * 2
        const burst = 50 + Math.random() * 130
        this.shards.push({
          i, style: {
            '--ox': `${origin.x + Math.cos(a) * burst}px`,
            '--oy': `${origin.y + Math.sin(a) * burst}px`,
            '--cx': `${tx + p.x}px`,
            '--cy': `${ty + p.y}px`,
            '--delay': `${Math.random() * 0.7}s`,
            '--size': `${step * 0.9}px`,
            backgroundColor: color,
            boxShadow: `0 0 3px ${color}cc`,
            opacity: 0.85,
          },
        })
      }
    },
    releaseBubble() {
      if (this.releasing) return
      this.releasing = true
      setTimeout(() => {
        this.capturedBubble = null
        this.releasing = false
        this.sparkles = []
        this.wisps = []
        this.shards = []
        this.ripples = []
        this.removeEscListener()
      }, 500)
    },
    addEscListener() {
      this._escHandler = (e) => {
        if (e.key === 'Escape') this.releaseBubble()
      }
      document.addEventListener('keydown', this._escHandler)
    },
    removeEscListener() {
      if (this._escHandler) {
        document.removeEventListener('keydown', this._escHandler)
        this._escHandler = null
      }
    },
  },
}
</script>

<style scoped>
.thought-chamber {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #08080f;
  overflow: hidden;
  cursor: default;
}

/* ── particle dust ── */
.dust-particle {
  position: absolute;
  border-radius: 50%;
  background: rgba(180,170,150,0.4);
  animation: dust-drift linear infinite;
  pointer-events: none;
}
@keyframes dust-drift {
  0%   { transform: translate(0, 0) scale(1); }
  25%  { transform: translate(15px, -25px) scale(1.3); }
  50%  { transform: translate(-10px, -50px) scale(0.8); }
  75%  { transform: translate(-20px, -30px) scale(1.1); }
  100% { transform: translate(5px, 5px) scale(1); }
}

/* ── stars ── */
.star {
  position: absolute;
  border-radius: 50%;
  background: #fff;
  animation: star-twinkle ease-in-out infinite;
  pointer-events: none;
}
@keyframes star-twinkle {
  0%, 100% { opacity: 0.15; }
  50%      { opacity: 0.7; }
}

/* ── bubble layer ── */
.bubble-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
}

/* ── thought bubble ── */
.thought-bubble {
  position: absolute;
  max-width: 320px;
  padding: 18px 22px 14px;
  border-radius: 24px;
  background: var(--persona-bg);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid color-mix(in srgb, var(--persona-color) 25%, transparent);
  box-shadow:
    0 0 30px var(--persona-glow),
    inset 0 0 30px rgba(255,255,255,0.015);
  animation:
    bubble-float var(--float-duration, 16s) 0s ease-in forwards,
    bubble-wobble 5s 0s ease-in-out infinite;
  transition: opacity 1s ease;
}

/* bubble shapes */
.bubble-round {
  border-radius: 40% 60% 55% 45% / 45% 50% 50% 55%;
}
.bubble-organic {
  border-radius: 35% 65% 50% 50% / 55% 40% 60% 45%;
}
.bubble-wide {
  border-radius: 30% 70% 60% 40% / 60% 40% 55% 45%;
  max-width: 380px;
}
.bubble-tall {
  border-radius: 45% 55% 45% 55% / 40% 45% 55% 60%;
  max-width: 260px;
}
.bubble-small {
  border-radius: 42% 58% 52% 48% / 48% 52% 48% 52%;
  max-width: 230px;
}

/* persona color tints */
.persona-qiuz { --persona-tint: rgba(212,162,85,0.13); }
.persona-yan  { --persona-tint: rgba(201,122,124,0.13); }
.persona-yin  { --persona-tint: rgba(125,171,140,0.13); }
.persona-bei  { --persona-tint: rgba(106,140,181,0.13); }

/* bubble label */
.bubble-label {
  display: inline-block;
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--persona-color);
  opacity: 0.6;
  margin-bottom: 6px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}

/* bubble text */
.bubble-text {
  font-size: 14px;
  line-height: 1.7;
  color: rgba(220,215,205,0.9);
  font-family: 'Georgia', 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-weight: 400;
  letter-spacing: 0.02em;
  word-break: break-word;
}

/* thought dots (comic bubble tail) */
.bubble-dots {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  justify-content: flex-end;
  padding-right: 12px;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--persona-color);
  opacity: 0.35;
}
.dot:nth-child(1) { width: 6px; height: 6px; }
.dot:nth-child(2) { width: 8px; height: 8px; opacity: 0.28; }
.dot:nth-child(3) { width: 6px; height: 6px; }
.dot:nth-child(4) { width: 5px; height: 5px; opacity: 0.22; }

/* animations */
@keyframes bubble-float {
  0% {
    bottom: calc(-10% - 0px);
    opacity: 0;
    transform: rotate(var(--wobble-amount)) scale(0.75);
  }
  8% {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }
  75% {
    opacity: 0.8;
  }
  95% {
    opacity: 0.1;
  }
  100% {
    bottom: var(--float-distance);
    opacity: 0;
    transform: rotate(var(--wobble2-amount)) scale(0.7);
  }
}

@keyframes bubble-wobble {
  0%, 100% { margin-left: 0; }
  25%  { margin-left: 8px; }
  75%  { margin-left: -8px; }
}

/* transition group */
.bubble-enter-active {
  transition: all 0.8s ease-out;
}
.bubble-leave-active {
  transition: all 1.5s ease-in;
}
.bubble-enter-from {
  opacity: 0;
  transform: scale(0.6) translateY(30px);
}
.bubble-leave-to {
  opacity: 0;
  transform: scale(0.5) translateY(-30px);
}

/* ── back link ── */
.back-link {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: rgba(200,195,185,0.45);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  font-size: 13px;
  letter-spacing: 0.08em;
  transition: color 0.4s ease;
}
.back-link:hover {
  color: rgba(220,210,195,0.8);
}
.back-arrow {
  font-size: 15px;
  transition: transform 0.3s ease;
}
.back-link:hover .back-arrow {
  transform: translateX(-4px);
}

/* ── title hint ── */
.title-hint {
  position: fixed;
  top: 32px;
  right: 36px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  pointer-events: none;
}
.hint-line {
  font-size: 22px;
  color: rgba(200,195,185,0.3);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  letter-spacing: 0.35em;
}
.hint-sub {
  font-size: 10px;
  color: rgba(200,195,185,0.18);
  letter-spacing: 0.12em;
  margin-top: 2px;
}

/* ── capture ── */
.is-captured {
  animation: bubble-shatter 0.35s ease-in forwards !important;
  pointer-events: none;
}
@keyframes bubble-shatter {
  0%   { transform: scale(1); opacity: 1; filter: blur(0); }
  30%  { transform: scale(1.06); opacity: 1; }
  100% { transform: scale(0.25); opacity: 0; filter: blur(18px); }
}

.capture-overlay {
  position: fixed;
  inset: 0;
  z-index: 15;
  background: radial-gradient(ellipse at center, rgba(4,4,10,0.5) 0%, rgba(4,4,10,0.88) 100%);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.capture-overlay.releasing { pointer-events: none; }
.overlay-fade-enter-active { transition: opacity 0.5s ease-out; }
.overlay-fade-leave-active { transition: opacity 0.6s ease-in; }
.overlay-fade-enter-from, .overlay-fade-leave-to { opacity: 0; }

/* center stage */
.capture-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  cursor: default;
}

/* captured bubble at center */
.capture-bubble {
  position: relative;
  max-width: 440px;
  min-width: 260px;
  padding: 32px 36px 24px;
  border-radius: 35% 65% 55% 45% / 45% 50% 50% 55%;
  background: var(--persona-bg, rgba(212,162,85,0.08));
  border: 2px solid color-mix(in srgb, var(--persona-color, #d4a255) 30%, transparent);
  box-shadow:
    0 0 80px var(--persona-glow, rgba(212,162,85,0.3)),
    inset 0 0 60px rgba(255,255,255,0.02);
  animation: capture-reveal 0.4s 0.3s ease-out forwards,
             capture-float 4s 0.8s ease-in-out infinite;
  opacity: 0;
}
.capture-bubble.releasing {
  animation: release-dissolve 0.4s ease-in forwards !important;
  pointer-events: none;
}

@keyframes capture-reveal {
  0%   { transform: scale(0.25); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes capture-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-5px); }
}
@keyframes release-dissolve {
  0%   { transform: scale(1); opacity: 1; filter: blur(0); }
  100% { transform: scale(0.8); opacity: 0; filter: blur(10px); }
}

/* vortex blur for ripple */
.vortex-blur {
  position: absolute;
  width: 0; height: 0;
  pointer-events: none;
  z-index: 16;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 200px 100px rgba(4,4,10,0.7);
  animation: vortex-expand 1.5s ease-out forwards;
}
@keyframes vortex-expand {
  0%   { box-shadow: 0 0 0 0 rgba(4,4,10,0.95); }
  100% { box-shadow: 0 0 300px 180px rgba(4,4,10,0.55); }
}

/* ── Effect 0: Firefly ── */
.sparkle {
  position: absolute;
  width: var(--size, 8px);
  height: var(--size, 8px);
  border-radius: 50%;
  pointer-events: none;
  z-index: 18;
  animation-name: sparkle-fly;
  animation-duration: var(--dur, 1.4s);
  animation-delay: var(--delay, 0s);
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
}
.sparkle.builder {
  animation-name: sparkle-fly, builder-glow;
  animation-duration: var(--dur, 1.4s), 2s;
  animation-delay: var(--delay, 0s), var(--dur, 1.4s);
  animation-timing-function: ease-out, ease-in-out;
  animation-fill-mode: forwards, none;
  animation-iteration-count: 1, infinite;
}
@keyframes sparkle-fly {
  0%   { left: var(--ox); top: var(--oy); transform: scale(0.05); opacity: 0; }
  8%   { opacity: 1; }
  65%  { left: var(--cx); top: var(--cy); transform: scale(1); opacity: 0.9; }
  100% { left: var(--cx); top: var(--cy); transform: scale(0.25); opacity: 0; }
}
@keyframes builder-glow {
  0%,100% { transform: translate(0,0) scale(0.5); opacity: 0.3; }
  25%  { transform: translate(3px,-5px) scale(1.2); opacity: 0.85; }
  50%  { transform: translate(-4px,2px) scale(0.7); opacity: 0.5; }
  75%  { transform: translate(2px,5px) scale(1.1); opacity: 0.75; }
}
.capture-bubble.effect-0 .capture-text {
  animation: text-build 0.5s 0.3s steps(20) forwards;
  clip-path: inset(0 100% 0 0);
}
@keyframes text-build {
  0%   { clip-path: inset(0 100% 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}

/* ── Effect 1: Fog ── */
.wisp {
  position: absolute;
  width: var(--size, 100px);
  height: var(--size, 100px);
  border-radius: 50%;
  pointer-events: none;
  z-index: 17;
  opacity: 0;
  filter: blur(14px);
  animation-name: wisp-flow;
  animation-duration: var(--dur, 1.2s);
  animation-delay: var(--delay, 0s);
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
}
@keyframes wisp-flow {
  0%   { left: var(--ox); top: var(--oy); transform: scale(0.15) rotate(0deg); opacity: 0; }
  25%  { opacity: var(--op, 0.4); }
  60%  { left: var(--cx); top: var(--cy); transform: scale(1.5) rotate(10deg); opacity: var(--op, 0.4); }
  100% { left: var(--cx); top: var(--cy); transform: scale(0.6) rotate(-5deg); opacity: 0.08; }
}
.capture-bubble.effect-1 {
  animation: emerge-from-fog 0.5s 0.3s ease-out forwards, capture-float 4s 0.8s ease-in-out infinite;
  opacity: 0;
}
@keyframes emerge-from-fog {
  0%   { opacity: 0; filter: blur(20px) brightness(2); }
  100% { opacity: 1; filter: blur(0) brightness(1); }
}

/* ── Effect 2: Canvas pixel text reconstruction ── */
.shard {
  position: absolute;
  width: var(--size, 4px);
  height: var(--size, 4px);
  border-radius: 50%;
  pointer-events: none;
  z-index: 99;
  display: block;
  animation-name: pixel-land;
  animation-duration: 0.7s;
  animation-delay: var(--delay, 0s);
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
}
@keyframes pixel-land {
  0%   { left: var(--ox); top: var(--oy); transform: scale(0); opacity: 0; }
  20%  { opacity: 1; }
  80%  { left: var(--cx); top: var(--cy); transform: scale(1.5); opacity: 1; }
  100% { left: var(--cx); top: var(--cy); transform: scale(1); opacity: 0.88; }
}
/* text shown faintly behind pixel reconstruction for effect 2 */
.capture-bubble.effect-2 .capture-text { opacity: 0.12; transition: opacity 0.8s 0.5s; }
.capture-bubble.effect-2 .capture-dots { opacity: 0.25; }
.capture-bubble.effect-2 {
  animation: reveal-shard 0.35s 0.2s ease-out forwards, capture-float 4s 0.7s ease-in-out infinite;
  opacity: 0;
  background: transparent;
  border-color: color-mix(in srgb, var(--persona-color, #d4a255) 12%, transparent);
}
@keyframes reveal-shard {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}

/* ── Effect 3: Ripple ── */
.ripple-ring {
  position: absolute;
  width: var(--size, 80px);
  height: var(--size, 80px);
  border-radius: 50%;
  border-style: solid;
  pointer-events: none;
  z-index: 17;
  animation-name: ripple-from-origin;
  animation-duration: 2.2s;
  animation-delay: var(--delay, 0s);
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
}
@keyframes ripple-from-origin {
  0%   { left: var(--ox); top: var(--oy); transform: translate(-50%, -50%) scale(0.05); opacity: 1; }
  100% { left: var(--cx); top: var(--cy); transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
}
.capture-bubble.effect-3 {
  animation: reveal-ripple 0.35s 0.2s ease-out forwards, capture-float 4s 0.7s ease-in-out infinite;
  opacity: 0;
}
@keyframes reveal-ripple {
  0%   { transform: scale(0.2) translateY(20px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
.reflection {
  position: absolute;
  inset: 6px -6px -14px 6px;
  border-radius: inherit;
  background: var(--persona-bg, rgba(212,162,85,0.05));
  pointer-events: none;
  animation: reflection-shift 3s ease-in-out infinite;
  filter: blur(20px);
  opacity: 0.35;
}
@keyframes reflection-shift {
  0%,100% { transform: translate(2px, 4px); opacity: 0.2; }
  50%     { transform: translate(-4px, -2px); opacity: 0.45; }
}

/* captured label */
.capture-label {
  display: inline-block;
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--persona-color, #d4a255);
  opacity: 0.7;
  margin-bottom: 10px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}

/* captured text */
.capture-text {
  font-size: 18px;
  line-height: 2;
  color: rgba(230, 225, 215, 0.92);
  font-family: 'Georgia', 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-weight: 400;
  letter-spacing: 0.04em;
  word-break: break-word;
  text-align: center;
}

/* captured dots */
.capture-dots {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  justify-content: center;
}
.c-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--persona-color, #d4a255);
  opacity: 0.4;
  animation: dot-pulse 1.8s ease-in-out infinite;
}
.c-dot:nth-child(2) { animation-delay: 0.25s; width: 10px; height: 10px; opacity: 0.32; }
.c-dot:nth-child(3) { animation-delay: 0.5s; }
.c-dot:nth-child(4) { animation-delay: 0.75s; width: 6px; height: 6px; opacity: 0.28; }

@keyframes dot-pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50%      { opacity: 0.85; transform: scale(1.4); }
}

/* capture hint */
.capture-hint {
  font-size: 12px;
  color: rgba(200, 195, 185, 0.35);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  letter-spacing: 0.1em;
  animation: hint-fade 3s ease-in-out infinite;
}
@keyframes hint-fade {
  0%, 100% { opacity: 0.25; }
  50%      { opacity: 0.55; }
}

/* ── responsive ── */
@media (max-width: 600px) {
  .thought-bubble {
    max-width: 240px;
    padding: 14px 16px 10px;
  }
  .bubble-text { font-size: 12px; line-height: 1.6; }
  .bubble-wide { max-width: 280px; }
  .bubble-tall { max-width: 200px; }
  .bubble-small { max-width: 180px; }
  .capture-bubble {
    max-width: 300px;
    min-width: 200px;
    padding: 24px 22px 18px;
  }
  .capture-text { font-size: 15px; line-height: 1.8; }
}
</style>
