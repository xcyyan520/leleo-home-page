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
        @click.stop="captureBubble(b)"
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
            <!-- Effect 0: firefly sparkles gathering -->
            <template v-if="captureEffect === 0">
              <span v-for="sp in sparkles" :key="sp.i" class="sparkle" :class="{ perimeter: sp.isPerimeter }" :style="sp.style"></span>
            </template>
            <!-- Effect 1: fog wisps -->
            <template v-if="captureEffect === 1">
              <span v-for="w in wisps" :key="w.i" class="wisp" :style="w.style"></span>
            </template>
            <!-- Effect 2: memory shards -->
            <template v-if="captureEffect === 2">
              <span v-for="sh in shards" :key="sh.i" class="shard" :style="sh.style"></span>
            </template>
            <!-- Effect 3: ripple rings -->
            <template v-if="captureEffect === 3">
              <span v-for="r in ripples" :key="r.i" class="ripple-ring" :style="r.style"></span>
              <span class="reflection"></span>
            </template>

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
          '--animation-delay': `${Math.random() * 3}s`,
          '--float-duration': `${12 + Math.random() * 14}s`,
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
    captureBubble(bubble) {
      if (this.capturedBubble && this.capturedBubble.id === bubble.id) {
        this.releaseBubble()
        return
      }
      bubble.capturedStyle = {
        '--persona-color': bubble.style['--persona-color'],
        '--persona-glow': bubble.style['--persona-glow'],
        '--persona-bg': bubble.style['--persona-bg'],
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%) scale(1.25)',
        zIndex: 20,
        transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        pointerEvents: 'none',
        opacity: 0,
      }
      const c = bubble.style['--persona-color']
      this.captureEffect = Math.floor(Math.random() * 4)
      this.releasing = false
      this.generateEffectDecorations(c)
      this.capturedBubble = bubble
      this.$nextTick(() => { this.addEscListener() })
    },
    generateEffectDecorations(color) {
      const eff = this.captureEffect
      this.sparkles = []
      this.wisps = []
      this.shards = []
      this.ripples = []
      if (eff === 0) {
        // firefly: 22 sparkles from viewport edges, converge to center forming the bubble
        for (let i = 0; i < 22; i++) {
          const edge = i % 4 // 0=top, 1=right, 2=bottom, 3=left — evenly distributed
          let sx, sy
          const jitter = (Math.random() - 0.5) * 100
          switch (edge) {
            case 0: sx = 10 + jitter; sy = -8 - Math.random() * 12; break
            case 1: sx = 108 + Math.random() * 8; sy = 10 + jitter; break
            case 2: sx = 10 + jitter; sy = 108 + Math.random() * 8; break
            case 3: sx = -8 - Math.random() * 12; sy = 10 + jitter; break
          }
          const size = 3 + Math.random() * 12
          const isPerimeter = i >= 16 // last 6 sparkles become orbiting perimeter lights
          this.sparkles.push({
            i,
            isPerimeter,
            style: {
              '--sx': `${sx}vw`,
              '--sy': `${sy}vh`,
              '--delay': `${0.2 + Math.random() * 0.9}s`,
              '--dur': `${1.0 + Math.random() * 1.2}s`,
              '--size': `${size}px`,
              '--glow': `${size * 1.5}px`,
              '--perimeter': isPerimeter ? '1' : '0',
              backgroundColor: color,
              boxShadow: `0 0 ${size * 1.8}px ${size * 0.6}px ${color}cc`,
            },
          })
        }
      } else if (eff === 1) {
        // fog: 9 thick wisps engulfing the bubble
        for (let i = 0; i < 9; i++) {
          this.wisps.push({
            i,
            style: {
              '--wisp-x': `${-50 + Math.random() * 100}%`,
              '--wisp-y': `${-40 + Math.random() * 80}%`,
              '--wisp-dur': `${6 + Math.random() * 8}s`,
              '--wisp-delay': `${Math.random() * 4}s`,
              '--wisp-scale': `${0.8 + Math.random() * 1.2}`,
              '--wisp-opacity': `${0.25 + Math.random() * 0.35}`,
              background: `radial-gradient(ellipse at center, ${color}66 0%, ${color}22 50%, transparent 75%)`,
            },
          })
        }
      } else if (eff === 2) {
        // memory shards: 6 fragments from 6 directions
        const origins = [
          { x: -140, y: -100 }, { x: 0, y: -120 }, { x: 140, y: -100 },
          { x: -140, y: 100 }, { x: 0, y: 120 }, { x: 140, y: 100 },
        ]
        for (let i = 0; i < 6; i++) {
          this.shards.push({
            i,
            style: {
              '--from-x': `${origins[i].x + (Math.random() - 0.5) * 30}px`,
              '--from-y': `${origins[i].y + (Math.random() - 0.5) * 30}px`,
              '--delay': `${i * 0.06}s`,
              '--rotate': `${-40 + i * 12 + Math.random() * 30}deg`,
              '--size': `${22 + Math.random() * 22}px`,
              backgroundColor: color,
              opacity: 0.65 + Math.random() * 0.3,
              boxShadow: `0 0 8px ${color}88`,
            },
          })
        }
      } else {
        // ripple: 5 rings + prominent reflection
        for (let i = 0; i < 5; i++) {
          this.ripples.push({
            i,
            style: {
              '--ripple-delay': `${i * 0.25}s`,
              '--ripple-size': `${70 + i * 45}px`,
              borderColor: `${color}66`,
              borderWidth: `${2 - i * 0.2}px`,
            },
          })
        }
      }
    },
    releaseBubble() {
      if (this.releasing) return
      this.releasing = true
      // let the release animation play, then remove
      setTimeout(() => {
        this.capturedBubble = null
        this.releasing = false
        this.sparkles = []
        this.wisps = []
        this.shards = []
        this.ripples = []
        this.removeEscListener()
      }, 1200)
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
    bubble-float var(--float-duration) var(--animation-delay) ease-in forwards,
    bubble-wobble 5s var(--animation-delay) ease-in-out infinite;
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
  opacity: 0 !important;
  pointer-events: none;
}

/* overlay with radial vignette */
.capture-overlay {
  position: fixed;
  inset: 0;
  z-index: 15;
  background: radial-gradient(ellipse at center, rgba(4,4,10,0.55) 0%, rgba(4,4,10,0.85) 100%);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.capture-overlay.releasing {
  pointer-events: none;
}

.overlay-fade-enter-active {
  transition: all 0.7s ease-out;
}
.overlay-fade-leave-active {
  transition: all 1.0s ease-in;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

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
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 2px solid color-mix(in srgb, var(--persona-color, #d4a255) 30%, transparent);
  box-shadow:
    0 0 80px var(--persona-glow, rgba(212,162,85,0.3)),
    inset 0 0 60px rgba(255,255,255,0.02);
  animation: capture-reveal 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
             capture-float 4s 1s ease-in-out infinite;
  transition: transform 0.9s ease-in, opacity 0.8s ease-in;
}

/* ── effect entry overrides ── */
.capture-bubble.effect-0 { animation-name: reveal-firefly, capture-float; }
.capture-bubble.effect-1 { animation-name: reveal-fog, capture-float; animation-duration: 1.5s, 4s; }
.capture-bubble.effect-2 { animation-name: reveal-shard, capture-float; }
.capture-bubble.effect-3 { animation-name: reveal-ripple, capture-float; animation-duration: 1.2s, 4s; }

/* ── release ── */
.capture-bubble.releasing {
  animation: release-dissolve 1.1s ease-in forwards !important;
  pointer-events: none;
}

@keyframes capture-reveal {
  0%   { transform: scale(0.15) rotate(-120deg); opacity: 0; }
  55%  { transform: scale(1.06) rotate(4deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes capture-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  30%  { transform: translateY(-5px) rotate(0.4deg); }
  70%  { transform: translateY(3px) rotate(-0.4deg); }
}

/* ── Effect 0: Firefly ── */
@keyframes reveal-firefly {
  0%   { transform: scale(0.6); opacity: 0; }
  35%  { opacity: 0; }
  65%  { opacity: 0.6; transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}

.sparkle {
  position: fixed;
  left: var(--sx, 50vw);
  top: var(--sy, 50vh);
  width: var(--size, 6px);
  height: var(--size, 6px);
  border-radius: 50%;
  pointer-events: none;
  z-index: 18;
  animation: sparkle-gather var(--dur, 1.5s) var(--delay, 0s) ease-out forwards;
}
.sparkle.perimeter {
  animation: sparkle-perimeter var(--dur, 1.5s) var(--delay, 0s) ease-out forwards,
             perimeter-orbit 3s var(--dur, 1.5s) ease-in-out infinite;
}

@keyframes sparkle-gather {
  0%   { transform: translate(0, 0) scale(0.15); opacity: 0; }
  8%   { opacity: 1; }
  65%  { transform: translate(calc(50vw - var(--sx)), calc(50vh - var(--sy))) scale(1.3); opacity: 0.9; }
  85%  { transform: translate(calc(50vw - var(--sx)), calc(50vh - var(--sy))) scale(0.7); opacity: 0.6; }
  100% { transform: translate(calc(50vw - var(--sx)), calc(50vh - var(--sy))) scale(0.3); opacity: 0.3; }
}
@keyframes perimeter-orbit {
  0%, 100% { transform: translate(calc(50vw - var(--sx)), calc(50vh - var(--sy))) rotate(0deg) translateX(0px); }
  25%  { transform: translate(calc(50vw - var(--sx) + 8px), calc(50vh - var(--sy) - 6px)) scale(1.2); }
  50%  { transform: translate(calc(50vw - var(--sx) - 6px), calc(50vh - var(--sy) + 4px)) scale(0.85); }
  75%  { transform: translate(calc(50vw - var(--sx) + 4px), calc(50vh - var(--sy) + 8px)) scale(1.1); }
}

/* ── Effect 1: Fog ── */
@keyframes reveal-fog {
  0%   { transform: scale(0.4); opacity: 0; filter: blur(24px) brightness(2.5); }
  30%  { filter: blur(16px) brightness(1.5); opacity: 0.2; }
  60%  { filter: blur(6px) brightness(1.1); opacity: 0.7; }
  85%  { filter: blur(1px) brightness(1); opacity: 0.95; }
  100% { transform: scale(1); opacity: 1; filter: blur(0) brightness(1); }
}
.wisp {
  position: absolute;
  left: var(--wisp-x, 0);
  top: var(--wisp-y, 0);
  width: 120px;
  height: 70px;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  filter: blur(8px);
  animation: wisp-drift var(--wisp-dur, 8s) var(--wisp-delay, 0s) ease-in-out infinite;
}
@keyframes wisp-drift {
  0%, 100% { transform: translate(0, 0) scale(var(--wisp-scale, 1)) rotate(0deg); opacity: 0; }
  20%      { opacity: var(--wisp-opacity, 0.35); }
  35%      { transform: translate(15px, -20px) scale(calc(var(--wisp-scale, 1) * 1.3)) rotate(8deg); opacity: var(--wisp-opacity, 0.35); }
  60%      { transform: translate(-10px, 10px) scale(calc(var(--wisp-scale, 1) * 0.9)) rotate(-4deg); }
  80%      { opacity: var(--wisp-opacity, 0.35); }
}

/* ── Effect 2: Memory Shards ── */
@keyframes reveal-shard {
  0%   { transform: scale(0.1) rotate(-60deg); opacity: 0; }
  40%  { transform: scale(1.1) rotate(8deg); opacity: 0.9; }
  60%  { transform: scale(0.9) rotate(-3deg); opacity: 1; }
  80%  { transform: scale(1.02) rotate(1deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
.shard {
  position: fixed;
  left: 50%;
  top: 50%;
  width: var(--size, 28px);
  height: var(--size, 28px);
  border-radius: 3px 10px 4px 8px;
  pointer-events: none;
  z-index: 18;
  animation: shard-fly 0.9s var(--delay, 0s) cubic-bezier(0.22, 0.61, 0.36, 1) forwards,
             shard-pulse 3s 1s ease-in-out infinite;
}
@keyframes shard-fly {
  0%   { transform: translate(var(--from-x), var(--from-y)) rotate(var(--rotate)) scale(0.15); opacity: 0; }
  30%  { opacity: 1; }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 0.85; }
}
@keyframes shard-pulse {
  0%, 100% { opacity: 0.7; transform: translate(0, 0) rotate(0deg) scale(1); }
  50%      { opacity: 0.95; transform: translate(4px, -3px) rotate(4deg) scale(1.05); }
}

/* ── Effect 3: Ripple ── */
@keyframes reveal-ripple {
  0%   { transform: scale(0.2); opacity: 0; }
  30%  { transform: scale(0.85); opacity: 0.5; }
  55%  { transform: scale(1.05); opacity: 1; }
  75%  { transform: scale(0.95); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.ripple-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--ripple-size, 90px);
  height: var(--ripple-size, 90px);
  border-radius: 50%;
  border-style: solid;
  pointer-events: none;
  animation: ripple-expand 3s var(--ripple-delay, 0s) ease-out infinite;
}
@keyframes ripple-expand {
  0%   { transform: translate(-50%, -50%) scale(0.15); opacity: 0.8; }
  100% { transform: translate(-50%, -50%) scale(2.0); opacity: 0; }
}
.reflection {
  position: absolute;
  inset: 8px -8px -12px 8px;
  border-radius: inherit;
  background: var(--persona-bg, rgba(212,162,85,0.06));
  pointer-events: none;
  animation: reflection-shift 3s ease-in-out infinite;
  filter: blur(18px);
  opacity: 0.5;
}
@keyframes reflection-shift {
  0%, 100% { transform: translate(4px, 4px) scale(0.9); opacity: 0.3; }
  50%      { transform: translate(-4px, -4px) scale(1.05); opacity: 0.6; }
}

/* ── release dissolve (shared) ── */
@keyframes release-dissolve {
  0%   { transform: scale(1); opacity: 1; filter: blur(0); }
  40%  { opacity: 0.7; filter: blur(2px); }
  100% { transform: scale(0.85) translateY(10px); opacity: 0; filter: blur(8px); }
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
