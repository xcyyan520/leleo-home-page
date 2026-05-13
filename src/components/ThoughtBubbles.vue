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
      <div v-if="capturedBubble" class="capture-overlay" @click="releaseBubble">
        <div class="capture-stage" @click.stop>
          <div
            class="capture-bubble"
            :class="[capturedBubble.personaClass]"
            :style="{
              '--persona-color': capturedBubble.style['--persona-color'],
              '--persona-glow': capturedBubble.style['--persona-glow'],
              '--persona-bg': capturedBubble.style['--persona-bg'],
            }"
          >
            <div class="capture-spin-ring"></div>
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
    spawnBubble() {
      if (this.personaData.every(d => d.length === 0)) return

      // pick persona with data
      let pi
      do {
        pi = Math.floor(Math.random() * PERSONAS.length)
      } while (this.personaData[pi].length === 0)

      const persona = PERSONAS[pi]
      const text = this.pickRandom(this.personaData[pi])

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
      // if same bubble clicked again, release
      if (this.capturedBubble && this.capturedBubble.id === bubble.id) {
        this.releaseBubble()
        return
      }
      // add capturedStyle for fly-in animation
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
      this.capturedBubble = bubble
      // after fly animation completes, show overlay content
      this.$nextTick(() => {
        this.addEscListener()
      })
    },
    releaseBubble() {
      this.capturedBubble = null
      this.removeEscListener()
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

/* overlay */
.capture-overlay {
  position: fixed;
  inset: 0;
  z-index: 15;
  background: rgba(4, 4, 10, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.overlay-fade-enter-active {
  transition: all 0.6s ease-out;
}
.overlay-fade-leave-active {
  transition: all 0.5s ease-in;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}
.overlay-fade-enter-from .capture-bubble {
  transform: scale(0.3) rotate(-180deg);
  opacity: 0;
}
.overlay-fade-leave-to .capture-bubble {
  transform: scale(0.5) rotate(90deg);
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
  max-width: 520px;
  min-width: 280px;
  padding: 36px 40px 28px;
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
}

/* spinning ring — the "滴溜溜" effect */
.capture-spin-ring {
  position: absolute;
  inset: -8px;
  border-radius: inherit;
  border: 1.5px solid transparent;
  border-top-color: color-mix(in srgb, var(--persona-color, #d4a255) 40%, transparent);
  border-right-color: color-mix(in srgb, var(--persona-color, #d4a255) 20%, transparent);
  animation: ring-spin 2.5s linear infinite;
  pointer-events: none;
}

.capture-bubble::after {
  content: '';
  position: absolute;
  inset: -16px;
  border-radius: inherit;
  border: 1px solid transparent;
  border-bottom-color: color-mix(in srgb, var(--persona-color, #d4a255) 25%, transparent);
  border-left-color: color-mix(in srgb, var(--persona-color, #d4a255) 15%, transparent);
  animation: ring-spin 4s linear infinite reverse;
  pointer-events: none;
}

@keyframes capture-reveal {
  0% {
    transform: scale(0.2) rotate(-90deg);
    opacity: 0;
  }
  60% {
    transform: scale(1.08) rotate(5deg);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

@keyframes capture-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  30%  { transform: translateY(-6px) rotate(0.5deg); }
  70%  { transform: translateY(4px) rotate(-0.5deg); }
}

@keyframes ring-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
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
}
</style>
