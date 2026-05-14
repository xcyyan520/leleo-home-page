<template>
  <div class="thought-chamber" ref="chamber">
    <!-- ambient light orbs -->
    <div class="ambient-orbs" v-if="!reduceMotion">
      <span v-for="o in ambientOrbs" :key="o.id" class="orb" :style="o.style"></span>
    </div>

    <!-- canvas constellation particles -->
    <canvas
      ref="particleCanvas"
      class="particle-canvas"
      v-if="!reduceMotion"
    ></canvas>

    <!-- starfield (fallback when canvas disabled) -->
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
        :class="[b.personaClass, b.shapeClass, { 'is-captured': capturedBubble && capturedBubble.id === b.id, 'is-custom': b.isCustom }]"
        :style="b.id === (capturedBubble && capturedBubble.id) ? b.capturedStyle : b.style"
        @click.stop="captureBubble(b, $event)"
      >
        <span class="bubble-highlight"></span>
        <span class="bubble-label">{{ b.personaLabel }}</span>
        <p class="bubble-text">{{ b.text }}</p>
        <div class="bubble-dots">
          <span class="dot" v-for="n in b.dotCount" :key="n"></span>
        </div>
        <span v-if="b.date" class="bubble-date">{{ b.date }}</span>
      </div>
    </transition-group>

    <!-- capture overlay -->
    <transition name="overlay-fade">
      <div v-if="capturedBubble" class="capture-overlay" :class="{ releasing }" @click="releaseBubble">
        <!-- Effect 0: Glass Shatter -->
        <template v-if="captureEffect === 0">
          <span v-for="sh in shards" :key="sh.i" class="shard" :style="sh.style"></span>
        </template>

        <!-- Effect 1: Particle Star Cluster -->
        <template v-if="captureEffect === 1">
          <span v-for="sp in clusterParticles" :key="sp.i" class="cluster-particle" :style="sp.style"></span>
        </template>

        <!-- Effect 2: Vortex Suction -->
        <template v-if="captureEffect === 2">
          <span v-for="vx in vortexArms" :key="vx.i" class="vortex-arm" :style="vx.style"></span>
        </template>

        <!-- Effect 3: Aurora Streams -->
        <template v-if="captureEffect === 3">
          <span v-for="au in auroraBeams" :key="au.i" class="aurora-beam" :style="au.style"></span>
        </template>

        <div class="capture-stage" @click.stop>
          <div
            class="capture-bubble"
            :class="[capturedBubble.personaClass, `ce-${captureEffect}`, { releasing }]"
            :style="{
              '--persona-color': capturedBubble.style['--persona-color'],
              '--persona-glow': capturedBubble.style['--persona-glow'],
              '--persona-bg': capturedBubble.style['--persona-bg'],
            }"
          >
            <span class="capture-highlight"></span>
            <span class="capture-label">{{ capturedBubble.personaLabel }} · 思考中</span>
            <p class="capture-text" v-if="captureEffect !== 2">{{ capturedBubble.text }}</p>
            <p class="capture-text typing" v-if="captureEffect === 2">{{ typedText }}<span class="typing-cursor" :class="{ blink: !typingTimer }">|</span></p>
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

    <!-- add bubble button -->
    <button class="add-bubble-btn" @click="showAddForm = true" title="写下思绪">+</button>

    <!-- add bubble form overlay -->
    <transition name="overlay-fade">
      <div v-if="showAddForm" class="add-form-overlay" @click.self="showAddForm = false">
        <div class="add-form-card" @click.stop>
          <span class="form-title">留下此刻思绪</span>
          <textarea
            v-model="newText"
            class="form-textarea"
            placeholder="写下你想说的……"
            maxlength="200"
            rows="4"
            ref="formTextarea"
          ></textarea>
          <div class="form-date-row">
            <label class="form-date-label">日期（可选）</label>
            <input v-model="newDate" type="date" class="form-date-input" />
          </div>
          <div class="form-actions">
            <button class="form-btn cancel" @click="showAddForm = false">取消</button>
            <button class="form-btn submit" @click="submitCustomBubble" :disabled="!newText.trim()">放进气泡</button>
          </div>
        </div>
      </div>
    </transition>
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
const STORAGE_KEY = 'thoughts-custom-bubbles'
const MAX_CUSTOM = 10

export default {
  name: 'ThoughtBubbles',
  data() {
    return {
      visibleBubbles: [],
      stars: [],
      ambientOrbs: [],
      personaData: [[], [], [], []],
      bubbleTimer: null,
      maxBubbles: 7,
      capturedBubble: null,
      captureEffect: 0,
      releasing: false,
      typedText: '',
      typingTimer: null,
      // canvas particles
      canvasCtx: null,
      canvasParticles: [],
      canvasWidth: 0,
      canvasHeight: 0,
      mouseX: -1000,
      mouseY: -1000,
      rafId: null,
      animPaused: false,
      reduceMotion: false,
      isMobile: false,
      // add bubble form
      showAddForm: false,
      newText: '',
      newDate: '',
      // effect data
      shards: [],
      clusterParticles: [],
      vortexArms: [],
      auroraBeams: [],
      recentTexts: [],
    }
  },
  async mounted() {
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.isMobile = window.innerWidth < 768
    this.generateAmbientOrbs()
    this.generateStars()
    if (!this.reduceMotion) {
      this.$nextTick(() => this.initCanvas())
    }
    await this.loadAllTexts()
    this.loadCustomBubbles()
    this.startBubbleCycle()
    document.addEventListener('click', this.handleClick)
  },
  beforeUnmount() {
    clearInterval(this.bubbleTimer)
    this.stopTyping()
    this.stopCanvas()
    document.removeEventListener('click', this.handleClick)
    this.removeEscListener()
  },
  methods: {
    // ── Ambient orbs ──
    generateAmbientOrbs() {
      const colors = [
        'rgba(180,160,140,0.10)',
        'rgba(160,170,190,0.08)',
        'rgba(190,150,160,0.09)',
        'rgba(150,170,160,0.07)',
      ]
      this.ambientOrbs = colors.map((c, i) => ({
        id: `orb${i}`,
        style: {
          left: `${10 + i * 25 + Math.random() * 10}%`,
          top: `${15 + (i % 2) * 50 + Math.random() * 15}%`,
          width: `${250 + Math.random() * 300}px`,
          height: `${250 + Math.random() * 300}px`,
          background: `radial-gradient(circle, ${c} 0%, transparent 70%)`,
          animationDelay: `${i * 5 + Math.random() * 3}s`,
          animationDuration: `${18 + Math.random() * 14}s`,
        },
      }))
    },

    // ── Stars ──
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

    // ── Canvas constellation ──
    initCanvas() {
      const canvas = this.$refs.particleCanvas
      if (!canvas) return
      this.canvasCtx = canvas.getContext('2d')
      this.resizeCanvas()
      this.spawnCanvasParticles()
      window.addEventListener('resize', this.resizeCanvas)
      document.addEventListener('mousemove', this.onMouseMove)
      document.addEventListener('visibilitychange', this.onVisibility)
      this.animateCanvas()
    },

    resizeCanvas() {
      const canvas = this.$refs.particleCanvas
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      this.canvasWidth = window.innerWidth
      this.canvasHeight = window.innerHeight
      canvas.width = this.canvasWidth * dpr
      canvas.height = this.canvasHeight * dpr
      canvas.style.width = this.canvasWidth + 'px'
      canvas.style.height = this.canvasHeight + 'px'
      this.canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    },

    spawnCanvasParticles() {
      this.canvasParticles = []
      const count = this.isMobile ? 35 : 80
      for (let i = 0; i < count; i++) {
        this.canvasParticles.push({
          x: Math.random() * this.canvasWidth,
          y: Math.random() * this.canvasHeight,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: 1 + Math.random() * 2.5,
          opacity: 0.25 + Math.random() * 0.5,
          hue: 35 + Math.random() * 15, // warm golden range
        })
      }
    },

    onMouseMove(e) {
      this.mouseX = e.clientX
      this.mouseY = e.clientY
    },

    onVisibility() {
      this.animPaused = document.hidden
    },

    animateCanvas() {
      if (this.animPaused || this.reduceMotion) {
        this.rafId = requestAnimationFrame(() => this.animateCanvas())
        return
      }
      const ctx = this.canvasCtx
      const w = this.canvasWidth
      const h = this.canvasHeight
      if (!ctx || w === 0) {
        this.rafId = requestAnimationFrame(() => this.animateCanvas())
        return
      }

      ctx.clearRect(0, 0, w, h)

      const particles = this.canvasParticles
      const mx = this.mouseX
      const my = this.mouseY
      const fastPath = this.isMobile

      // Update + draw particles
      for (const p of particles) {
        // Mouse interaction (skip on mobile touch — no continuous mousemove)
        if (!fastPath) {
          const dx = p.x - mx
          const dy = p.y - my
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 160 && dist > 0.1) {
            const force = (160 - dist) / 160
            p.vx += (dx / dist) * force * 0.06
            p.vy += (dy / dist) * force * 0.06
          }
        }

        p.vx += (Math.random() - 0.5) * 0.015
        p.vy += (Math.random() - 0.5) * 0.015
        p.vx *= 0.998
        p.vy *= 0.998

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > 1.2) {
          p.vx = (p.vx / speed) * 1.2
          p.vy = (p.vy / speed) * 1.2
        }

        p.x += p.vx
        p.y += p.vy

        if (p.x < -20) p.x = w + 20
        if (p.x > w + 20) p.x = -20
        if (p.y < -20) p.y = h + 20
        if (p.y > h + 20) p.y = -20

        if (fastPath) {
          // Mobile: simple circle, no gradient
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(200,185,160,${p.opacity * 0.6})`
          ctx.fill()
        } else {
          // Desktop: glow + core
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
          glow.addColorStop(0, `rgba(200,185,160,${p.opacity})`)
          glow.addColorStop(1, 'rgba(200,185,160,0)')
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.fill()
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(220,210,190,${p.opacity + 0.15})`
          ctx.fill()
        }
      }

      // Draw connections (desktop only — O(n²) is heavy on mobile)
      if (!fastPath) {
        const connDist = 140
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i]
            const b = particles[j]
            const dx = a.x - b.x
            const dy = a.y - b.y
            const dist = dx * dx + dy * dy
            if (dist < connDist * connDist) {
              const alpha = 0.07 * (1 - Math.sqrt(dist) / connDist)
              ctx.beginPath()
              ctx.moveTo(a.x, a.y)
              ctx.lineTo(b.x, b.y)
              ctx.strokeStyle = `rgba(180,170,150,${alpha})`
              ctx.lineWidth = 0.5
              ctx.stroke()
            }
          }
        }
      }

      this.rafId = requestAnimationFrame(() => this.animateCanvas())
    },

    stopCanvas() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId)
        this.rafId = null
      }
      window.removeEventListener('resize', this.resizeCanvas)
      document.removeEventListener('mousemove', this.onMouseMove)
      document.removeEventListener('visibilitychange', this.onVisibility)
    },

    // ── Data loading ──
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

    // ── Bubble lifecycle ──
    spawnBubble() {
      if (this.isMobile && this.visibleBubbles.length >= 3) return
      if (this.personaData.every(d => d.length === 0)) return
      let pi
      do {
        pi = Math.floor(Math.random() * PERSONAS.length)
      } while (this.personaData[pi].length === 0)

      const persona = PERSONAS[pi]
      const text = this.getFreshText(pi)
      this.recentTexts.push({ text, personaIndex: pi, time: Date.now() })
      this.pruneRecentTexts()

      const id = nextId++
      const shapeIdx = Math.floor(Math.random() * persona.shapes.length)

      const zones = [
        { xMin: 2, xMax: 35 },
        { xMin: 55, xMax: 93 },
        { xMin: 20, xMax: 50 },
        { xMin: 5, xMax: 90 },
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
          '--persona-bg': `${persona.color}10`,
          '--float-duration': `${10 + Math.random() * 12}s`,
          '--float-distance': `${70 + Math.random() * 25}vh`,
          '--wobble-amount': `${-(3 + Math.random() * 6)}deg`,
          '--wobble2-amount': `${3 + Math.random() * 6}deg`,
          '--breathe-dur': `${5 + Math.random() * 4}s`,
          '--breathe-delay': `${Math.random() * 5}s`,
          transform: `rotate(${-(4 + Math.random() * 8)}deg) scale(0.85)`,
        },
        born: Date.now(),
      }

      this.visibleBubbles.push(bubble)
      const limit = this.isMobile ? 3 : this.maxBubbles
      // trim only non-custom bubbles
      while (this.visibleBubbles.filter(b => !b.isCustom).length > limit) {
        const idx = this.visibleBubbles.findIndex(b => !b.isCustom)
        if (idx !== -1) this.visibleBubbles.splice(idx, 1)
      }

      const lifetime = parseFloat(bubble.style['--float-duration']) * 1000 + 2000
      setTimeout(() => {
        const idx = this.visibleBubbles.findIndex(b => b.id === id)
        if (idx !== -1) this.visibleBubbles.splice(idx, 1)
      }, lifetime)
    },

    startBubbleCycle() {
      const scheduleNext = () => {
        const delay = this.isMobile ? 2500 + Math.random() * 4500 : 800 + Math.random() * 2000
        this.bubbleTimer = setTimeout(() => {
          this.spawnBubble()
          scheduleNext()
        }, delay)
      }
      setTimeout(() => this.spawnBubble(), 200)
      scheduleNext()
    },

    handleClick() {
      if (this.visibleBubbles.length < this.maxBubbles + 2) {
        this.spawnBubble()
      }
    },

    // ── Custom bubble ──
    submitCustomBubble() {
      const text = this.newText.trim()
      if (!text) return
      const dateStr = this.newDate || ''
      const formattedDate = dateStr ? this.formatDisplayDate(dateStr) : ''

      const id = nextId++
      const shapeIdx = Math.floor(Math.random() * 3)
      const shapes = ['bubble-round', 'bubble-organic', 'bubble-wide']
      const color = '#c0b0a0'

      const bubble = {
        id,
        text,
        date: formattedDate,
        rawDate: dateStr, // stored for localStorage
        isCustom: true,
        personaClass: 'persona-custom',
        shapeClass: shapes[shapeIdx],
        personaLabel: dateStr ? `此刻 · ${formattedDate}` : '此刻',
        dotCount: 2,
        style: {
          left: `${15 + Math.random() * 70}%`,
          bottom: '-10%',
          '--persona-color': color,
          '--persona-glow': 'rgba(192,176,160,0.22)',
          '--persona-bg': 'rgba(192,176,160,0.06)',
          '--float-duration': `${10 + Math.random() * 12}s`,
          '--float-distance': `${70 + Math.random() * 25}vh`,
          '--wobble-amount': `${-(3 + Math.random() * 6)}deg`,
          '--wobble2-amount': `${3 + Math.random() * 6}deg`,
          '--breathe-dur': `${5 + Math.random() * 4}s`,
          '--breathe-delay': `${Math.random() * 5}s`,
          transform: `rotate(${-(4 + Math.random() * 8)}deg) scale(0.85)`,
        },
        born: Date.now(),
      }

      this.visibleBubbles.push(bubble)
      // trim oldest custom if over limit
      while (this.visibleBubbles.filter(b => b.isCustom).length > MAX_CUSTOM) {
        const idx = this.visibleBubbles.findIndex(b => b.isCustom)
        if (idx !== -1) this.visibleBubbles.splice(idx, 1)
      }
      // auto-remove after float (same as regular)
      const lifetime = parseFloat(bubble.style['--float-duration']) * 1000 + 2000
      setTimeout(() => {
        const idx = this.visibleBubbles.findIndex(b => b.id === id)
        if (idx !== -1) this.visibleBubbles.splice(idx, 1)
      }, lifetime)
      this.saveCustomBubbles()

      this.showAddForm = false
      this.newText = ''
      this.newDate = ''
    },

    loadCustomBubbles() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const saved = JSON.parse(raw)
        if (!Array.isArray(saved)) return
        const recent = saved.slice(this.isMobile ? -2 : -MAX_CUSTOM) // only load last N
        const color = '#c0b0a0'
        const shapes = ['bubble-round', 'bubble-organic', 'bubble-wide']
        const now = Date.now()
        const stagger = this.isMobile ? 3000 : 800
        recent.forEach((item, i) => {
          const delay = this.isMobile ? i * stagger : i * 800
          setTimeout(() => {
          const shapeIdx = i % 3
          const bubble = {
            id: nextId++,
            text: item.text,
            date: item.date ? this.formatDisplayDate(item.date) : '',
            rawDate: item.date || '',
            isCustom: true,
            personaClass: 'persona-custom',
            shapeClass: shapes[shapeIdx],
            personaLabel: item.date ? `此刻 · ${this.formatDisplayDate(item.date)}` : '此刻',
            dotCount: 2,
            style: {
              left: `${10 + (i % 5) * 18 + Math.random() * 8}%`,
              bottom: `-${5 + Math.random() * 8}%`,
              '--persona-color': color,
              '--persona-glow': 'rgba(192,176,160,0.22)',
              '--persona-bg': 'rgba(192,176,160,0.06)',
              '--float-duration': `${10 + Math.random() * 12}s`,
              '--float-distance': `${70 + Math.random() * 25}vh`,
              '--wobble-amount': `${-(3 + Math.random() * 6)}deg`,
              '--wobble2-amount': `${3 + Math.random() * 6}deg`,
              '--breathe-dur': `${5 + Math.random() * 4}s`,
              '--breathe-delay': `${Math.random() * 5}s`,
              transform: `rotate(${-(4 + Math.random() * 8)}deg) scale(0.85)`,
            },
            born: now - (i * 2000),
          }
          this.visibleBubbles.push(bubble)
          // auto-remove after float
          const bid = bubble.id
          const lifetime = parseFloat(bubble.style['--float-duration']) * 1000 + 2000
          setTimeout(() => {
            const idx = this.visibleBubbles.findIndex(b => b.id === bid)
            if (idx !== -1) this.visibleBubbles.splice(idx, 1)
          }, lifetime)
          }, delay)
        })
      } catch (e) { /* ignore corrupt storage */ }
    },

    saveCustomBubbles() {
      const customs = this.visibleBubbles
        .filter(b => b.isCustom)
        .map(b => ({ text: b.text, date: b.rawDate || '' }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customs))
    },

    formatDisplayDate(dateStr) {
      const d = new Date(dateStr)
      return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
    },

    // ── Capture ──
    captureBubble(bubble, event) {
      if (this.capturedBubble && this.capturedBubble.id === bubble.id) {
        this.releaseBubble()
        return
      }
      const el = event ? event.currentTarget : null
      const rect = el ? el.getBoundingClientRect() : { left: window.innerWidth / 2 - 100, top: window.innerHeight / 2 - 40, width: 200, height: 80 }
      const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 }

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

      this.captureEffect = Math.floor(Math.random() * 4)
      this.releasing = false
      this.generateEffectDecorations(bubble.style['--persona-color'] || '#d4a255', origin, center, bubble.text)
      this.capturedBubble = bubble
      this.$nextTick(() => { this.addEscListener() })
    },

    generateEffectDecorations(color, origin, center, text) {
      this.shards = []
      this.clusterParticles = []
      this.vortexArms = []
      this.auroraBeams = []
      const eff = this.captureEffect

      if (eff === 0) {
        // ── Glass Shatter ──
        const shardCount = this.isMobile ? 14 : 24
        for (let i = 0; i < shardCount; i++) {
          const angle = (i / shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
          const burstR = 60 + Math.random() * 160
          const midX = origin.x + Math.cos(angle) * burstR
          const midY = origin.y + Math.sin(angle) * burstR
          const size = 6 + Math.random() * 30
          this.shards.push({
            i,
            style: {
              '--ox': `${origin.x}px`, '--oy': `${origin.y}px`,
              '--mx': `${midX}px`, '--my': `${midY}px`,
              '--cx': `${center.x}px`, '--cy': `${center.y}px`,
              '--delay': `${Math.random() * 0.15}s`,
              '--dur': `${0.9 + Math.random() * 0.6}s`,
              '--size': `${size}px`,
              '--rot': `${Math.random() * 360}deg`,
              '--rot2': `${(Math.random() - 0.5) * 180}deg`,
              width: `${size}px`,
              height: `${size * (0.4 + Math.random() * 1.2)}px`,
              background: `rgba(${this.hexToRgb(color)},0.25)`,
              borderColor: `rgba(${this.hexToRgb(color)},0.5)`,
              boxShadow: `0 0 ${size * 0.6}px rgba(${this.hexToRgb(color)},0.4)`,
            },
          })
        }
      } else if (eff === 1) {
        // ── Particle Star Cluster: burst → converge → dissolve ──
        const clusterCount = this.isMobile ? 16 : 30
        for (let i = 0; i < clusterCount; i++) {
          const angle = (i / clusterCount) * Math.PI * 2
          const startR = 10 + Math.random() * 60
          const midR = 100 + Math.random() * 200
          const sx = origin.x + Math.cos(angle) * startR
          const sy = origin.y + Math.sin(angle) * startR
          const mx = origin.x + Math.cos(angle) * midR + (Math.random() - 0.5) * 80
          const my = origin.y + Math.sin(angle) * midR + (Math.random() - 0.5) * 80
          const size = 2 + Math.random() * 5
          this.clusterParticles.push({
            i,
            style: {
              '--ox': `${sx}px`, '--oy': `${sy}px`,
              '--mx': `${mx}px`, '--my': `${my}px`,
              '--cx': `${center.x}px`, '--cy': `${center.y}px`,
              '--delay': `${Math.random() * 0.2}s`,
              '--dur': `${1.0 + Math.random() * 0.5}s`,
              '--size': `${size}px`,
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: color,
              boxShadow: `0 0 ${size * 3}px ${size}px ${color}`,
            },
          })
        }
      } else if (eff === 2) {
        // ── Vortex Suction ──
        this.startTypingEffect(text)
        const arms = this.isMobile ? 5 : 8
        for (let i = 0; i < arms; i++) {
          const angle = (i / arms) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
          const startR = 30 + Math.random() * 80
          const sx = origin.x + Math.cos(angle) * startR
          const sy = origin.y + Math.sin(angle) * startR
          this.vortexArms.push({
            i,
            style: {
              '--ox': `${sx}px`, '--oy': `${sy}px`,
              '--cx': `${center.x}px`, '--cy': `${center.y}px`,
              '--delay': `${i * 0.06}s`,
              '--dur': `${1.0 + Math.random() * 0.35}s`,
              '--spin': `${540 + Math.random() * 360}deg`,
              '--size': `${8 + Math.random() * 14}px`,
              '--color': color,
              width: `${8 + Math.random() * 14}px`,
              height: `${8 + Math.random() * 14}px`,
            },
          })
        }
      } else {
        // ── Aurora Streams ──
        const corners = [
          { x: -80, y: -80, angle: 45 },
          { x: window.innerWidth + 80, y: -80, angle: 135 },
          { x: -80, y: window.innerHeight + 80, angle: -45 },
          { x: window.innerWidth + 80, y: window.innerHeight + 80, angle: -135 },
        ]
        for (let i = 0; i < 4; i++) {
          const c = corners[i]
          const hue = this.colorToHue(color) + (i - 1.5) * 15
          this.auroraBeams.push({
            i,
            style: {
              '--ox': `${c.x}px`, '--oy': `${c.y}px`,
              '--cx': `${center.x}px`, '--cy': `${center.y}px`,
              '--delay': `${i * 0.1}s`,
              '--dur': `${1.0 + i * 0.12}s`,
              '--hue': hue,
              '--angle': `${c.angle}deg`,
              width: `${200 + Math.random() * 100}px`,
            },
          })
        }
      }
    },

    // ── Helpers ──
    hexToRgb(hex) {
      const h = hex.replace('#', '')
      const r = parseInt(h.substring(0, 2), 16)
      const g = parseInt(h.substring(2, 4), 16)
      const b = parseInt(h.substring(4, 6), 16)
      return `${r},${g},${b}`
    },

    colorToHue(hex) {
      const h = hex.replace('#', '')
      const r = parseInt(h.substring(0, 2), 16) / 255
      const g = parseInt(h.substring(2, 4), 16) / 255
      const b = parseInt(h.substring(4, 6), 16) / 255
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      let hue = 0
      if (max === min) return 0
      const d = max - min
      if (max === r) hue = ((g - b) / d) % 6
      else if (max === g) hue = (b - r) / d + 2
      else hue = (r - g) / d + 4
      return Math.round(hue * 60)
    },

    // ── Typing ──
    startTypingEffect(text) {
      this.stopTyping()
      this.typedText = ''
      if (!text) return
      let i = 0
      const chars = [...text]
      const delay = 80 + Math.random() * 60
      this.typingTimer = setInterval(() => {
        if (i >= chars.length) { this.stopTyping(); return }
        const count = 1 + Math.floor(Math.random() * 2)
        this.typedText += chars.slice(i, i + count).join('')
        i += count
      }, delay)
    },

    stopTyping() {
      if (this.typingTimer) { clearInterval(this.typingTimer); this.typingTimer = null }
    },

    // ── Release ──
    releaseBubble() {
      if (this.releasing) return
      this.releasing = true
      this.stopTyping()
      setTimeout(() => {
        this.capturedBubble = null
        this.releasing = false
        this.typedText = ''
        this.shards = []
        this.clusterParticles = []
        this.vortexArms = []
        this.auroraBeams = []
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
  -webkit-tap-highlight-color: transparent;
  -webkit-user-select: none;
  user-select: none;
}

/* ── Ambient orbs ── */
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.7;
  pointer-events: none;
  z-index: 0;
  animation: orb-drift linear infinite;
}
@keyframes orb-drift {
  0%   { transform: translate(0, 0) scale(0.8); }
  25%  { transform: translate(40px, -30px) scale(1.15); }
  50%  { transform: translate(-20px, -60px) scale(0.9); }
  75%  { transform: translate(-50px, -15px) scale(1.1); }
  100% { transform: translate(0, 0) scale(0.8); }
}

/* ── Canvas constellation ── */
.particle-canvas {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

/* ── Stars ── */
.star {
  position: absolute;
  border-radius: 50%;
  background: #fff;
  animation: star-twinkle ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}
@keyframes star-twinkle {
  0%, 100% { opacity: 0.15; }
  50%      { opacity: 0.7; }
}

/* ── Bubble layer ── */
.bubble-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
}

/* ── Liquid Glass thought bubble ── */
.thought-bubble {
  position: absolute;
  max-width: 320px;
  padding: 18px 22px 14px;
  backdrop-filter: blur(14px) saturate(130%);
  -webkit-backdrop-filter: blur(14px) saturate(130%);
  background: var(--persona-bg, rgba(212,162,85,0.06));
  border: 1px solid color-mix(in srgb, var(--persona-color, #d4a255) 22%, transparent);
  border-top: 1px solid color-mix(in srgb, var(--persona-color, #d4a255) 40%, transparent);
  box-shadow:
    0 8px 40px var(--persona-glow),
    0 0 0 1px rgba(255,255,255,0.02) inset,
    0 1px 0 rgba(255,255,255,0.04) inset;
  animation:
    bubble-float var(--float-duration, 16s) 0s ease-in forwards,
    bubble-wobble 5s 0s ease-in-out infinite,
    bubble-breathe var(--breathe-dur, 6s) var(--breathe-delay, 0s) ease-in-out infinite;
  transition: opacity 1s ease, transform 0.3s ease;
  cursor: pointer;
  overflow: hidden;
}
.thought-bubble:hover {
  transform: scale(1.04) translateY(-2px);
  box-shadow:
    0 12px 50px var(--persona-glow),
    0 0 0 1px rgba(255,255,255,0.04) inset,
    0 1px 0 rgba(255,255,255,0.06) inset;
}

/* Top highlight stripe */
.bubble-highlight {
  position: absolute;
  top: 0; left: 8%; right: 8%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
  pointer-events: none;
}

/* Breathing shape animation */
@keyframes bubble-breathe {
  0%, 100% { border-radius: 40% 60% 55% 45% / 45% 50% 50% 55%; }
  25%  { border-radius: 55% 45% 40% 60% / 52% 42% 58% 48%; }
  50%  { border-radius: 42% 58% 52% 48% / 48% 55% 45% 55%; }
  75%  { border-radius: 58% 42% 48% 52% / 42% 52% 48% 58%; }
}

/* shape overrides — use base shapes as starting point, breathe anim does the morphing */
.bubble-round  { border-radius: 40% 60% 55% 45% / 45% 50% 50% 55%; }
.bubble-organic { border-radius: 35% 65% 50% 50% / 55% 40% 60% 45%; }
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

/* persona tints */
.persona-qiuz { --persona-tint: rgba(212,162,85,0.13); }
.persona-yan  { --persona-tint: rgba(201,122,124,0.13); }
.persona-yin  { --persona-tint: rgba(125,171,140,0.13); }
.persona-bei  { --persona-tint: rgba(106,140,181,0.13); }
.persona-custom { --persona-tint: rgba(192,176,160,0.10); }

/* bubble date (bottom-right) */
.bubble-date {
  position: absolute;
  bottom: 8px; right: 14px;
  font-size: 9px;
  color: var(--persona-color);
  opacity: 0.45;
  font-family: 'Georgia', 'Noto Serif SC', serif;
  letter-spacing: 0.04em;
  z-index: 1;
}

.bubble-label {
  display: inline-block;
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--persona-color);
  opacity: 0.6;
  margin-bottom: 6px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
  position: relative;
  z-index: 1;
}
.bubble-text {
  font-size: 14px;
  line-height: 1.7;
  color: rgba(220,215,205,0.9);
  font-family: 'Georgia', 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-weight: 400;
  letter-spacing: 0.02em;
  word-break: break-word;
  position: relative;
  z-index: 1;
}
.bubble-dots {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  justify-content: flex-end;
  padding-right: 12px;
  position: relative;
  z-index: 1;
}
.dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--persona-color);
  opacity: 0.35;
}
.dot:nth-child(1) { width: 6px; height: 6px; }
.dot:nth-child(2) { width: 8px; height: 8px; opacity: 0.28; }
.dot:nth-child(3) { width: 6px; height: 6px; }
.dot:nth-child(4) { width: 5px; height: 5px; opacity: 0.22; }

/* float + wobble */
@keyframes bubble-float {
  0%   { bottom: calc(-10% - 0px); opacity: 0; transform: rotate(var(--wobble-amount)) scale(0.75); }
  8%   { opacity: 1; transform: rotate(0deg) scale(1); }
  75%  { opacity: 0.8; }
  95%  { opacity: 0.1; }
  100% { bottom: var(--float-distance); opacity: 0; transform: rotate(var(--wobble2-amount)) scale(0.7); }
}
@keyframes bubble-wobble {
  0%, 100% { margin-left: 0; }
  25%  { margin-left: 8px; }
  75%  { margin-left: -8px; }
}

/* transition group */
.bubble-enter-active { transition: all 0.8s ease-out; }
.bubble-leave-active { transition: all 1.5s ease-in; }
.bubble-enter-from { opacity: 0; transform: scale(0.6) translateY(30px); }
.bubble-leave-to   { opacity: 0; transform: scale(0.5) translateY(-30px); }

/* ── Back link ── */
.back-link {
  position: fixed; bottom: 28px; left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex; align-items: center; gap: 6px;
  text-decoration: none;
  color: rgba(200,195,185,0.45);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  font-size: 13px; letter-spacing: 0.08em;
  transition: color 0.4s ease;
}
.back-link:hover { color: rgba(220,210,195,0.8); }
.back-arrow { font-size: 15px; transition: transform 0.3s ease; }
.back-link:hover .back-arrow { transform: translateX(-4px); }

/* ── Title hint ── */
.title-hint {
  position: fixed; top: 32px; right: 36px;
  z-index: 10;
  display: flex; flex-direction: column; align-items: flex-end;
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
  letter-spacing: 0.12em; margin-top: 2px;
}

/* ── Add bubble button ── */
.add-bubble-btn {
  position: fixed;
  bottom: 24px; right: 28px;
  z-index: 12;
  width: 44px; height: 44px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: rgba(220,215,205,0.6);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.3s ease;
  font-family: 'Georgia', serif;
}
.add-bubble-btn:hover {
  background: rgba(255,255,255,0.08);
  color: rgba(220,215,205,0.9);
  border-color: rgba(255,255,255,0.2);
  transform: scale(1.08);
  box-shadow: 0 0 20px rgba(255,255,255,0.06);
}

/* ── Add form ── */
.add-form-overlay {
  position: fixed; inset: 0;
  z-index: 20;
  background: rgba(4,4,10,0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
}
.add-form-card {
  background: rgba(20,18,24,0.95);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  padding: 28px 24px 20px;
  width: 380px;
  max-width: 90vw;
  display: flex; flex-direction: column; gap: 16px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}
.form-title {
  font-size: 15px;
  color: rgba(220,215,205,0.7);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  letter-spacing: 0.08em;
  text-align: center;
}
.form-textarea {
  width: 100%;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 12px 14px;
  color: rgba(230,225,215,0.9);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  font-size: 14px;
  line-height: 1.7;
  resize: none;
  outline: none;
  transition: border-color 0.3s ease;
}
.form-textarea::placeholder {
  color: rgba(200,195,185,0.3);
}
.form-textarea:focus {
  border-color: rgba(255,255,255,0.2);
}
.form-date-row {
  display: flex; align-items: center; gap: 12px;
}
.form-date-label {
  font-size: 12px;
  color: rgba(200,195,185,0.45);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  white-space: nowrap;
}
.form-date-input {
  flex: 1;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 6px 10px;
  color: rgba(220,215,205,0.8);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  font-size: 13px;
  outline: none;
  color-scheme: dark;
}
.form-actions {
  display: flex; gap: 10px; justify-content: flex-end;
}
.form-btn {
  padding: 8px 20px;
  border-radius: 10px;
  border: none;
  font-size: 13px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
  cursor: pointer;
  transition: all 0.25s ease;
}
.form-btn.cancel {
  background: rgba(255,255,255,0.04);
  color: rgba(200,195,185,0.5);
  border: 1px solid rgba(255,255,255,0.06);
}
.form-btn.cancel:hover {
  background: rgba(255,255,255,0.08);
  color: rgba(220,215,205,0.7);
}
.form-btn.submit {
  background: rgba(200,180,160,0.12);
  color: rgba(220,210,195,0.85);
  border: 1px solid rgba(200,180,160,0.25);
}
.form-btn.submit:hover:not(:disabled) {
  background: rgba(200,180,160,0.2);
  border-color: rgba(200,180,160,0.4);
}
.form-btn.submit:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* ── Capture overlay ── */
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
  position: fixed; inset: 0;
  z-index: 15;
  background: radial-gradient(ellipse at center, rgba(4,4,10,0.45) 0%, rgba(4,4,10,0.9) 100%);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.capture-overlay.releasing { pointer-events: none; }
.overlay-fade-enter-active { transition: opacity 0.5s ease-out; }
.overlay-fade-leave-active { transition: opacity 0.6s ease-in; }
.overlay-fade-enter-from, .overlay-fade-leave-to { opacity: 0; }

.capture-stage {
  display: flex; flex-direction: column; align-items: center; gap: 18px;
  cursor: default;
}

/* ── Capture bubble ── */
.capture-bubble {
  position: relative;
  max-width: 440px; min-width: 260px;
  padding: 32px 36px 24px;
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  background: var(--persona-bg, rgba(212,162,85,0.06));
  border: 1.5px solid color-mix(in srgb, var(--persona-color, #d4a255) 28%, transparent);
  border-top: 1.5px solid color-mix(in srgb, var(--persona-color, #d4a255) 45%, transparent);
  box-shadow:
    0 0 100px var(--persona-glow),
    0 20px 60px rgba(0,0,0,0.4),
    0 0 0 1px rgba(255,255,255,0.03) inset,
    0 1px 0 rgba(255,255,255,0.05) inset;
  opacity: 0;
  overflow: hidden;
}
.capture-bubble.releasing {
  animation: release-dissolve 0.5s ease-in forwards !important;
  pointer-events: none;
}
.capture-highlight {
  position: absolute;
  top: 0; left: 6%; right: 6%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  pointer-events: none;
}

/* Reveal timings per effect */
.capture-bubble.ce-0 {
  animation: capture-reveal 0.4s 0.7s ease-out forwards,
             capture-float 4s 1.2s ease-in-out infinite;
}
.capture-bubble.ce-1 {
  animation: capture-reveal 0.4s 0.6s ease-out forwards,
             capture-float 4s 1.1s ease-in-out infinite;
}
.capture-bubble.ce-2 {
  animation: capture-reveal 0.35s 1.0s ease-out forwards,
             capture-float 4s 1.5s ease-in-out infinite;
  border-radius: 35% 65% 55% 45% / 45% 50% 50% 55%;
}
.capture-bubble.ce-3 {
  animation: emerge-aurora 0.5s 0.7s ease-out forwards,
             capture-float 4s 1.2s ease-in-out infinite;
}

@keyframes capture-reveal {
  0%   { transform: scale(0.3); opacity: 0; filter: blur(8px); }
  100% { transform: scale(1); opacity: 1; filter: blur(0); }
}
@keyframes emerge-aurora {
  0%   { transform: scale(0.6); opacity: 0; filter: brightness(2.5) blur(12px); }
  100% { transform: scale(1); opacity: 1; filter: brightness(1) blur(0); }
}
@keyframes capture-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}
@keyframes release-dissolve {
  0%   { transform: scale(1); opacity: 1; filter: blur(0); }
  100% { transform: scale(0.75); opacity: 0; filter: blur(14px); }
}

.capture-label {
  display: inline-block;
  font-size: 12px; letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--persona-color, #d4a255);
  opacity: 0.7; margin-bottom: 10px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
  position: relative; z-index: 1;
}
.capture-text {
  font-size: 18px; line-height: 2;
  color: rgba(230, 225, 215, 0.92);
  font-family: 'Georgia', 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-weight: 400; letter-spacing: 0.04em;
  word-break: break-word; text-align: center;
  position: relative; z-index: 1;
}
.capture-dots {
  display: flex; gap: 8px; margin-top: 14px; justify-content: center;
  position: relative; z-index: 1;
}
.c-dot {
  width: 8px; height: 8px; border-radius: 50%;
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

/* Typewriter */
.capture-text.typing { min-height: 1.7em; }
.typing-cursor {
  display: inline;
  color: var(--persona-color, #d4a255);
  font-weight: 300;
  animation: cursor-blink 0.8s step-end infinite;
}
.typing-cursor.blink { animation: cursor-blink 0.8s step-end infinite; }
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}

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

/* ════════════════════════════════════════
   EFFECT 0: Glass Shatter
   ════════════════════════════════════════ */
.shard {
  position: absolute;
  border-radius: 2px;
  border: 1px solid;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  pointer-events: none;
  z-index: 18;
  animation: shard-fly var(--dur, 1.4s) var(--delay, 0s) ease-out forwards;
}
@keyframes shard-fly {
  0%   { left: var(--ox); top: var(--oy); transform: translate(-50%,-50%) scale(0) rotate(0deg); opacity: 0; }
  8%   { opacity: 1; }
  30%  { left: var(--mx); top: var(--my); transform: translate(-50%,-50%) scale(1.1) rotate(var(--rot)); opacity: 0.95; }
  100% { left: var(--cx); top: var(--cy); transform: translate(-50%,-50%) scale(0.15) rotate(var(--rot2)); opacity: 0; }
}

/* ════════════════════════════════════════
   EFFECT 1: Particle Star Cluster
   ════════════════════════════════════════ */
.cluster-particle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 18;
  animation: cluster-burst var(--dur, 1.4s) var(--delay, 0s) ease-out forwards;
}
@keyframes cluster-burst {
  0%   { left: var(--ox); top: var(--oy); transform: translate(-50%,-50%) scale(0); opacity: 0; }
  12%  { opacity: 1; }
  45%  { left: var(--mx); top: var(--my); transform: translate(-50%,-50%) scale(1.15); opacity: 0.9; }
  85%  { left: var(--cx); top: var(--cy); transform: translate(-50%,-50%) scale(0.6); opacity: 0.4; }
  100% { left: var(--cx); top: var(--cy); transform: translate(-50%,-50%) scale(0.05); opacity: 0; }
}

/* ════════════════════════════════════════
   EFFECT 2: Vortex Suction
   ════════════════════════════════════════ */
.vortex-arm {
  position: absolute;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: var(--color, #d4a255);
  border-left-color: color-mix(in srgb, var(--color, #d4a255) 50%, transparent);
  pointer-events: none;
  z-index: 17;
  opacity: 0;
  filter: blur(1px);
  animation: vortex-suck var(--dur, 1.2s) var(--delay, 0s) cubic-bezier(0.25, 0, 0.35, 1) forwards;
}
@keyframes vortex-suck {
  0%   { left: var(--ox); top: var(--oy); width: 4px; height: 4px; transform: translate(-50%,-50%) rotate(0deg); opacity: 0; }
  15%  { opacity: 0.85; }
  55%  { left: var(--cx); top: var(--cy); transform: translate(-50%,-50%) rotate(var(--spin)); opacity: 0.6; }
  85%  { left: var(--cx); top: var(--cy); width: var(--size); height: var(--size); transform: translate(-50%,-50%) rotate(calc(var(--spin) * 1.6)); opacity: 0.2; }
  100% { left: var(--cx); top: var(--cy); width: 2px; height: 2px; transform: translate(-50%,-50%) rotate(calc(var(--spin) * 2.2)); opacity: 0; }
}

/* ════════════════════════════════════════
   EFFECT 3: Aurora Streams
   ════════════════════════════════════════ */
.aurora-beam {
  position: absolute;
  height: 160px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 17;
  opacity: 0;
  filter: blur(35px);
  animation: aurora-flow var(--dur, 1.2s) var(--delay, 0s) ease-out forwards;
  background: linear-gradient(
    var(--angle, 135deg),
    hsl(var(--hue, 30), 60%, 65%) 0%,
    hsl(var(--hue, 30), 50%, 50%) 30%,
    transparent 70%
  );
}
@keyframes aurora-flow {
  0%   { left: var(--ox); top: var(--oy); transform: translate(-50%,-50%) scale(0.1); opacity: 0; }
  30%  { opacity: 0.7; }
  60%  { left: var(--cx); top: var(--cy); transform: translate(-50%,-50%) scale(1.3); opacity: 0.9; }
  100% { left: var(--cx); top: var(--cy); transform: translate(-50%,-50%) scale(1.6); opacity: 0; }
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .thought-bubble {
    max-width: 240px;
    padding: 14px 16px 10px;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: var(--persona-bg, rgba(212,162,85,0.12));
    /* mobile: only float, no wobble/breathe — saves GPU */
    animation: bubble-float var(--float-duration, 16s) 0s ease-in forwards;
  }
  .bubble-text { font-size: 12px; line-height: 1.6; }
  .bubble-wide { max-width: 280px; }
  .bubble-tall { max-width: 200px; }
  .bubble-small { max-width: 180px; }
  .capture-bubble {
    max-width: 300px; min-width: 200px;
    padding: 24px 22px 18px;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: var(--persona-bg, rgba(212,162,85,0.08));
  }
  .capture-overlay {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: radial-gradient(ellipse at center, rgba(4,4,10,0.6) 0%, rgba(4,4,10,0.95) 100%);
  }
  .capture-text { font-size: 15px; line-height: 1.8; }
  .orb { display: none; }
  .shard { backdrop-filter: none; -webkit-backdrop-filter: none; }
  .add-bubble-btn {
    bottom: 16px; right: 12px;
    width: 38px; height: 38px;
    font-size: 20px;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .add-form-card { padding: 20px 16px 16px; }
  /* kill mobile tap highlight flash */
  .capture-overlay {
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none;
    user-select: none;
  }
  .form-textarea { font-size: 13px; }
  .add-form-overlay {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: rgba(4,4,10,0.85);
  }
}

@media (prefers-reduced-motion: reduce) {
  .thought-bubble { animation: none !important; }
  .capture-bubble { animation: none !important; opacity: 1; }
  .star { animation: none !important; opacity: 0.4; }
  .shard, .cluster-particle, .vortex-arm, .aurora-beam { animation-duration: 0.1s !important; }
}
</style>
