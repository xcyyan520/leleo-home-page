<template>
  <div class="nebula-chamber" ref="chamber" @mousemove="onMouseMove" @touchmove="onTouchMove">
    <!-- ═══ Layer 1: Deep Space ═══ -->
    <div class="starfield">
      <span v-for="s in stars" :key="s.id" class="star" :style="s.style"></span>
    </div>

    <!-- ═══ Layer 2: Nebula Clouds (parallax layers) ═══ -->
    <div class="nebula-layer nebula-deep" :style="nebulaDriftDeep">
      <span v-for="n in nebulae.filter(x=>x.depth===0)" :key="n.id" class="nebula-cloud nebula-cloud--deep" :style="n.style"></span>
    </div>
    <div class="nebula-layer nebula-mid" :style="nebulaDriftMid">
      <span v-for="n in nebulae.filter(x=>x.depth===1)" :key="n.id" class="nebula-cloud nebula-cloud--mid" :style="n.style"></span>
    </div>
    <div class="nebula-layer nebula-high" :style="nebulaDriftHigh">
      <span v-for="n in nebulae.filter(x=>x.depth===2)" :key="n.id" class="nebula-cloud nebula-cloud--highlight" :style="n.style"></span>
    </div>

    <!-- ═══ Canvas: nebula particles + accretion ring ═══ -->
    <canvas ref="particleCanvas" class="particle-canvas"></canvas>

    <!-- ═══ Layer 3: Stellar Thoughts ═══ -->
    <transition-group name="star-birth" tag="div" class="thoughts-layer">
      <div
        v-for="t in visibleThoughts"
        :key="t.id"
        class="stellar-thought"
        :class="[t.personaCls, { captured: capturedId === t.id }]"
        :style="capturedId === t.id ? t.capturedStyle : t.style"
        @click.stop="capture(t, $event)"
      >
        <span class="stellar-core"></span>
        <span class="stellar-aura"></span>
        <p class="stellar-text">{{ t.text }}</p>
        <span v-if="t.date" class="stellar-date">{{ t.date }}</span>
      </div>
    </transition-group>

    <!-- ═══ Layer 4: Capture Overlay ═══ -->
    <transition name="capture-fade">
      <div v-if="capturedId !== null" class="capture-overlay" @click="release">
        <!-- Light rays -->
        <span v-for="r in (isMobile ? 6 : 12)" :key="'r'+r" class="capture-ray" :style="rayStyle(r)"></span>
        <div class="capture-stage" @click.stop>
          <div class="capture-star" :style="captureStarStyle">
            <span class="capture-core"></span>
            <span class="capture-aura"></span>
            <span class="capture-aura capture-aura--outer"></span>
            <span class="capture-label">{{ capturedLabel }} · 凝视中</span>
            <p class="capture-text">{{ capturedText }}</p>
          </div>
          <div class="capture-hint">点击空白处释放</div>
        </div>
      </div>
    </transition>

    <!-- ═══ Layer 5: UI ═══ -->
    <a href="/" class="back-link"><span class="back-arrow">←</span><span class="back-text">回去</span></a>
    <div class="title-hint"><span class="hint-line">思绪</span><span class="hint-sub">stellar thoughts…</span></div>
    <button class="add-btn" @click="showAddForm = true" title="写下思绪">+</button>

    <!-- Add form (unchanged) -->
    <transition name="capture-fade">
      <div v-if="showAddForm" class="add-form-overlay" @click.self="showAddForm = false">
        <div class="add-form-card" @click.stop>
          <span class="form-title">留下此刻思绪</span>
          <textarea v-model="newText" class="form-textarea" placeholder="写下你想说的……" maxlength="200" rows="4" ref="formTextarea"></textarea>
          <div class="form-date-row">
            <label class="form-date-label">日期（可选）</label>
            <input v-model="newDate" type="date" class="form-date-input" />
          </div>
          <div class="form-actions">
            <button class="form-btn cancel" @click="showAddForm = false">取消</button>
            <button class="form-btn submit" @click="submitCustomBubble" :disabled="!newText.trim()">放进星云</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
const PERSONAS = [
  { file:'/thoughts/shime.txt', name:'阿秋', cls:'persona-qiuz', color:'#d4a255', glow:'rgba(212,162,85,0.3)', coreSize:14, auraSize:70 },
  { file:'/thoughts/future.txt', name:'春燕', cls:'persona-yan',  color:'#c97a7c', glow:'rgba(201,122,124,0.3)', coreSize:11, auraSize:55 },
  { file:'/thoughts/weiwei.txt', name:'小银', cls:'persona-yin',  color:'#7dab8c', glow:'rgba(125,171,140,0.28)', coreSize:10, auraSize:50 },
  { file:'/thoughts/chaos.txt',  name:'一生阳春悲', cls:'persona-bei',  color:'#6a8cb5', glow:'rgba(106,140,181,0.32)', coreSize:15, auraSize:80 },
]
const MAX_CUSTOM = 10
let nextId = 0

export default {
  name: 'ThoughtBubbles',
  data() {
    return {
      visibleThoughts: [],
      capturedId: null,
      capturedText: '',
      capturedLabel: '',
      captureStarStyle: {},
      // Space
      stars: [],
      nebulae: [],
      nebulaDriftDeep: { transform:'translate(0px,0px)' },
      nebulaDriftMid: { transform:'translate(0px,0px)' },
      nebulaDriftHigh: { transform:'translate(0px,0px)' },
      // Canvas
      canvasCtx: null, canvasParticles: [], canvasWidth: 0, canvasHeight: 0,
      accreteParticles: [],
      mouseX: -9999, mouseY: -9999, mouseActive: false,
      rafId: null,
      // Data
      personaData: [[],[],[],[]],
      // Cycle
      thoughtTimer: null, maxThoughts: 5,
      recentTexts: [],
      // Add form
      showAddForm: false, newText: '', newDate: '',
      // Flags
      reduceMotion: false, isMobile: false,
      occupiedZones: [],
    }
  },
  async mounted() {
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.isMobile = window.innerWidth < 768
    this.generateStars()
    this.generateNebulae()
    this.$nextTick(() => this.initCanvas())
    await this.loadAllTexts()
    this.loadCustomBubbles()
    this.startCycle()
    document.addEventListener('click', this.onGlobalClick)
  },
  beforeUnmount() {
    clearInterval(this.thoughtTimer)
    this.stopCanvas()
    document.removeEventListener('click', this.onGlobalClick)
    window.removeEventListener('mousemove', this.onMouseMove)
  },

  methods: {
    // ═══ Debug ═══
    debugLog(tag, ...args) {
      console.log(`%c[Nebula] %c${tag}`, 'color:#8ab4f8;font-weight:bold', 'color:#aaa', ...args)
    },

    // ═══ Stars ═══
    generateStars() {
      const ss = []
      for (let i = 0; i < 90; i++) {
        const size = 0.5 + Math.random() * 2.5
        ss.push({
          id: `s${i}`,
          style: {
            left:`${Math.random()*100}%`, top:`${Math.random()*100}%`,
            width:`${size}px`, height:`${size}px`,
            opacity: 0.15 + Math.random()*0.7,
            animationDelay:`${Math.random()*8}s`,
            animationDuration:`${2+Math.random()*6}s`,
            '--chroma': Math.random() > 0.7 ? `0 0 ${2+Math.random()*3}px rgba(180,200,255,0.3)` : 'none',
          },
        })
      }
      this.stars = ss
    },

    // ═══ Nebula Clouds ═══
    generateNebulae() {
      const configs = [
        // Deep layers — slow, large, faint
        { color:'70,30,130', x:5,  y:10, w:70, h:65, speed:0.3, dur:50, z:0 },
        { color:'20,50,110', x:40, y:35, w:65, h:60, speed:0.25, dur:55, z:0 },
        // Mid layers — medium speed, color-shifting
        { color:'90,40,120', x:15, y:25, w:50, h:50, speed:0.5, dur:38, z:1 },
        { color:'40,80,140', x:55, y:20, w:45, h:48, speed:0.55, dur:42, z:1 },
        { color:'110,50,80', x:30, y:50, w:48, h:44, speed:0.45, dur:40, z:1 },
        // Highlight layers — small, bright hotspots
        { color:'180,140,220', x:25, y:35, w:22, h:20, speed:0.7, dur:28, z:2 },
        { color:'140,180,210', x:60, y:45, w:18, h:22, speed:0.65, dur:30, z:2 },
        { color:'200,160,200', x:45, y:60, w:20, h:18, speed:0.6, dur:32, z:2 },
      ]
      this.nebulae = configs.map((c, i) => ({
        id: `n${i}`,
        depth: c.z,
        speed: c.speed,
        style: {
          left:`${c.x}%`, top:`${c.y}%`,
          width:`${c.w}vw`, height:`${c.h}vh`,
          background: c.z===2
            ? `radial-gradient(ellipse at center, rgba(${c.color},0.22) 0%, rgba(${c.color},0.06) 50%, transparent 75%)`
            : c.z===1
            ? `radial-gradient(ellipse at center, rgba(${c.color},0.10) 0%, rgba(${c.color},0.02) 50%, transparent 72%)`
            : `radial-gradient(ellipse at center, rgba(${c.color},0.06) 0%, rgba(${c.color},0.01) 45%, transparent 68%)`,
          animationDuration:`${c.dur}s`,
          animationDelay:`${i*3}s`,
          '--nebula-hue-shift': `${(i%3)*120}deg`,
        },
      }))
    },

    // ═══ Canvas ═══
    initCanvas() {
      const c = this.$refs.particleCanvas
      if (!c) return
      this.canvasCtx = c.getContext('2d')
      this.resizeCanvas()
      this.spawnNebulaParticles()
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
      c.style.width = this.canvasWidth+'px'
      c.style.height = this.canvasHeight+'px'
      this.canvasCtx.setTransform(dpr,0,0,dpr,0,0)
    },

    spawnNebulaParticles() {
      this.canvasParticles = []
      const count = this.isMobile ? 30 : 70
      const hues = [260,210,320,200,290,230,170,340,250,180]
      for (let i = 0; i < count; i++) {
        const isShootingStar = i < (this.isMobile ? 2 : 5)
        this.canvasParticles.push({
          x: Math.random()*this.canvasWidth, y: Math.random()*this.canvasHeight,
          vx: isShootingStar ? 1.5+Math.random()*3 : (Math.random()-0.5)*0.25,
          vy: isShootingStar ? 0.2+Math.random()*0.5 : (Math.random()-0.5)*0.25,
          size: isShootingStar ? 1.5+Math.random()*2 : 0.5+Math.random()*2.5,
          opacity: isShootingStar ? 0.6+Math.random()*0.4 : 0.08+Math.random()*0.22,
          hue: hues[Math.floor(Math.random()*hues.length)],
          life: Math.random()*400, maxLife: isShootingStar ? 200+Math.random()*100 : 400+Math.random()*200,
          isShootingStar,
        })
      }
    },

    onMouseMove(e) { this.mouseX = e.clientX; this.mouseY = e.clientY; this.mouseActive = true },
    onTouchMove(e) {
      if (e.touches[0]) {
        this.mouseX = e.touches[0].clientX; this.mouseY = e.touches[0].clientY
        this.mouseActive = true
      }
    },

    animateCanvas() {
      const ctx = this.canvasCtx; const w = this.canvasWidth; const h = this.canvasHeight
      if (!ctx || w===0) { this.rafId = requestAnimationFrame(()=>this.animateCanvas()); return }

      ctx.clearRect(0,0,w,h)
      const mx = this.mouseX, my = this.mouseY
      const captured = this.capturedId !== null

      // Nebula parallax drift
      const baseX = this.mouseActive ? (mx/w - 0.5)*18 : 0
      const baseY = this.mouseActive ? (my/h - 0.5)*18 : 0
      this.nebulaDriftDeep = { transform:`translate(${baseX*0.2}px, ${baseY*0.2}px)` }
      this.nebulaDriftMid  = { transform:`translate(${baseX*0.6}px, ${baseY*0.6}px)` }
      this.nebulaDriftHigh = { transform:`translate(${baseX*1.1}px, ${baseY*1.1}px)` }

      // Draw nebula particles
      for (const p of this.canvasParticles) {
        // Mouse pull (skip shooting stars)
        if (!p.isShootingStar && this.mouseActive && !captured) {
          const dx = p.x-mx, dy = p.y-my
          const dist = Math.sqrt(dx*dx+dy*dy)
          if (dist < 220 && dist > 1) { const f = (220-dist)/220; p.vx += (dx/dist)*f*0.025; p.vy += (dy/dist)*f*0.025 }
        }
        // Captured: push outward from center (skip shooting stars)
        if (!p.isShootingStar && captured) {
          const cx=w/2, cy=h/2
          const dx=p.x-cx, dy=p.y-cy
          const dist = Math.sqrt(dx*dx+dy*dy)
          if (dist < 350 && dist > 1) { const f = (350-dist)/350; p.vx += (dx/dist)*f*0.1; p.vy += (dy/dist)*f*0.1 }
        }
        if (!p.isShootingStar) {
          p.vx += (Math.random()-0.5)*0.008; p.vy += (Math.random()-0.5)*0.008
          p.vx *= 0.997; p.vy *= 0.997
          const speed = Math.sqrt(p.vx*p.vx+p.vy*p.vy)
          if (speed > 0.7) { p.vx = (p.vx/speed)*0.7; p.vy = (p.vy/speed)*0.7 }
        }
        p.x += p.vx; p.y += p.vy
        // Shooting stars: wrap around
        if (p.isShootingStar) {
          if (p.x > w+50 || p.y > h+50) { p.x = -50; p.y = Math.random()*h*0.7 }
          if (p.x < -50) { p.x = w+50; p.y = Math.random()*h*0.7 }
        } else {
          if (p.x<-30) p.x=w+30; if (p.x>w+30) p.x=-30
          if (p.y<-30) p.y=h+30; if (p.y>h+30) p.y=-30
        }
        p.life++; if (p.life > p.maxLife) { p.life=0; p.opacity = p.isShootingStar ? 0.6+Math.random()*0.4 : 0.08+Math.random()*0.2 }
        const lifeFade = p.life < 30 ? p.life/30 : p.life > p.maxLife-30 ? (p.maxLife-p.life)/30 : 1
        if (p.isShootingStar) {
          // Shooting star with trail
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x-p.vx*8, p.y-p.vy*8)
          ctx.strokeStyle = `hsla(${p.hue},50%,80%,${p.opacity*lifeFade*0.8})`
          ctx.lineWidth = p.size*0.8
          ctx.stroke()
          // Glow dot
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI*2)
          ctx.fillStyle = `hsla(${p.hue},20%,90%,${p.opacity*lifeFade})`
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI*2)
          ctx.fillStyle = `hsla(${p.hue},50%,65%,${p.opacity*lifeFade})`
          ctx.fill()
        }
      }

      // Vignette
      if (!this.isMobile) {
        const vignette = ctx.createRadialGradient(w/2,h/2, w*0.55, w/2,h/2, w*0.9)
        vignette.addColorStop(0, 'rgba(3,3,10,0)')
        vignette.addColorStop(1, 'rgba(3,3,10,0.35)')
        ctx.fillStyle = vignette
        ctx.fillRect(0,0,w,h)
      }

      // Capture: accretion ring
      if (captured && !this.reduceMotion) {
        this.accreteParticles = this.accreteParticles || []
        const maxAccrete = this.isMobile ? 25 : 40
        const spawnRate = this.isMobile ? 2 : 3
        const maxTotal = this.isMobile ? 35 : 60
        if (this.accreteParticles.length < maxAccrete) {
          for (let i=0; i<spawnRate; i++) {
            this.accreteParticles.push({
              angle: Math.random()*Math.PI*2,
              radius: 80+Math.random()*100,
              speed: 0.008+Math.random()*0.015,
              size: 1+Math.random()*3,
              opacity: 0.3+Math.random()*0.5,
              hue: [40,200,320,160,280][Math.floor(Math.random()*5)],
            })
          }
        }
        const cx = w/2, cy = h/2
        for (const a of this.accreteParticles) {
          a.angle += a.speed
          a.radius += (Math.random()-0.5)*0.6
          a.radius = Math.max(60, Math.min(180, a.radius))
          const ax = cx + Math.cos(a.angle)*a.radius
          const ay = cy + Math.sin(a.angle)*a.radius*0.55
          ctx.beginPath()
          ctx.arc(ax, ay, a.size, 0, Math.PI*2)
          ctx.fillStyle = `hsla(${a.hue},60%,70%,${a.opacity})`
          ctx.fill()
        }
        // Trim accretion
        if (this.accreteParticles.length > maxTotal) this.accreteParticles.splice(0, this.accreteParticles.length-maxTotal)
      } else {
        this.accreteParticles = []
      }

      this.rafId = requestAnimationFrame(()=>this.animateCanvas())
    },

    stopCanvas() {
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null }
      window.removeEventListener('resize', this.resizeCanvas)
    },

    // ═══ Data ═══
    async loadAllTexts() {
      this.debugLog('load', 'fetching persona texts...')
      for (let i=0; i<PERSONAS.length; i++) {
        try {
          const resp = await fetch(PERSONAS[i].file)
          const raw = await resp.text()
          this.personaData[i] = this.parseParagraphs(raw)
          this.debugLog('OK', `${PERSONAS[i].name}: ${this.personaData[i].length} texts`)
        } catch(e) { this.personaData[i]=['……']; this.debugLog('ERR', `${PERSONAS[i].name}: ${e.message}`) }
      }
    },
    parseParagraphs(raw) {
      const blocks = raw.split(/\n\n+/).map(b=>b.replace(/\n/g,' ').trim()).filter(b=>b.length>6&&b.length<220)
      if (blocks.length===0) return raw.split(/\n/).map(b=>b.trim()).filter(b=>b.length>4&&b.length<220)
      return blocks
    },
    pickRandom(arr) { return (!arr||arr.length===0)?'……':arr[Math.floor(Math.random()*arr.length)] },

    getFreshText(pi) {
      const all = this.personaData[pi]
      if (!all.length) return '……'
      const now = Date.now()
      const recent = this.recentTexts.filter(r=>r.time>now-12000)
      const set = new Set(recent.map(r=>r.text))
      for (const t of this.visibleThoughts) { if (t.isCustom) set.add(t.text) }
      const fresh = all.filter(t=>!set.has(t))
      return fresh.length>0 ? this.pickRandom(fresh) : this.pickRandom(all)
    },

    // ═══ Thoughts Cycle ═══
    findFreePosition() {
      const maxAttempts = 20
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = 10 + Math.random() * 75
        const y = 15 + Math.random() * 55
        if (!this.occupiedZones.some(z => Math.abs(z.x - x) < 18 && Math.abs(z.y - y) < 18)) {
          return { x, y }
        }
      }
      // fallback: return random anyway
      return { x: 15 + Math.random() * 70, y: 20 + Math.random() * 45 }
    },

    addZone(x, y) {
      this.occupiedZones.push({ x, y, time: Date.now() })
      // cleanup old zones
      this.occupiedZones = this.occupiedZones.filter(z => Date.now() - z.time < 35000)
    },

    spawnThought() {
      if (this.personaData.every(d=>d.length===0)) return
      if (this.isMobile && this.visibleThoughts.length>=5) return
      if (this.capturedId!==null) return

      let pi; do { pi=Math.floor(Math.random()*PERSONAS.length) } while (this.personaData[pi].length===0)
      const persona = PERSONAS[pi]
      const text = this.getFreshText(pi)
      this.recentTexts.push({text, personaIndex:pi, time:Date.now()})

      const id = nextId++
      const pos = this.findFreePosition()
      const xPos = pos.x; const yPos = pos.y
      this.addZone(xPos, yPos)
      const lifetime = 22 + Math.random()*18

      this.visibleThoughts.push({
        id, text, personaCls: persona.cls, date:'',
        isCustom: false,
        style: {
          left:`${xPos}%`, top:`${yPos}%`,
          '--core-color': persona.color,
          '--aura-color': persona.glow,
          '--core-size': `${persona.coreSize}px`,
          '--aura-size': `${persona.auraSize}px`,
          '--drift-x': `${(Math.random()-0.5)*30}px`,
          '--drift-y': `${(Math.random()-0.5)*30}px`,
          '--lifetime': `${lifetime}s`,
          '--emerge-delay': `${Math.random()*0.4}s`,
        },
      })

      const limit = this.isMobile ? 5 : this.maxThoughts
      while (this.visibleThoughts.filter(t=>!t.isCustom).length > limit) {
        const idx = this.visibleThoughts.findIndex(t=>!t.isCustom)
        if (idx!==-1) this.visibleThoughts.splice(idx,1)
      }
      setTimeout(()=>{
        const idx = this.visibleThoughts.findIndex(t=>t.id===id)
        if (idx!==-1) this.visibleThoughts.splice(idx,1)
      }, lifetime*1000+2000)
    },

    startCycle() {
      const schedule = () => {
        const delay = this.isMobile ? 4000+Math.random()*5000 : 1500+Math.random()*2500
        this.thoughtTimer = setTimeout(()=>{ this.spawnThought(); schedule() }, delay)
      }
      setTimeout(()=>this.spawnThought(), 600)
      schedule()
    },

    onGlobalClick() {
      if (this.capturedId===null && this.visibleThoughts.length<this.maxThoughts+2) this.spawnThought()
    },

    // ═══ Capture ═══
    capture(thought, event) {
      if (this.capturedId===thought.id) { this.release(); return }
      this.capturedId = thought.id
      this.capturedText = thought.text
      this.capturedLabel = PERSONAS.find(p=>p.cls===thought.personaCls)?.name || '思绪'
      const el = event?.currentTarget
      const rect = el ? el.getBoundingClientRect() : { left:0, top:0, width:0, height:0 }
      this.captureStarStyle = {
        '--core-color': thought.style['--core-color'],
        '--aura-color': thought.style['--aura-color'],
        '--core-size': thought.style['--core-size'],
        '--aura-size': thought.style['--aura-size'],
      }
      thought.capturedStyle = {
        ...thought.style,
        opacity:0, transform:'scale(0.2)', transition:'all 0.5s ease-in', pointerEvents:'none',
      }
    },

    rayStyle(i) {
      const total = this.isMobile ? 6 : 12
      const angle = (i/total)*360
      const delay = i*0.03
      return {
        '--ray-angle': `${angle}deg`,
        '--ray-delay': `${delay}s`,
        '--ray-color': this.capturedId ? this.captureStarStyle['--core-color'] : '#d4a255',
      }
    },

    release() {
      if (this.capturedId === null) return
      const thought = this.visibleThoughts.find(t=>t.id===this.capturedId)
      this.capturedId = null
      this.capturedText = ''
      this.accreteParticles = []
      if (thought) { thought.capturedStyle = undefined; this.$forceUpdate() }
    },

    // ═══ Custom bubble ═══
    async submitCustomBubble() {
      const text = this.newText.trim()
      if (!text) return
      const dateStr = this.newDate || ''
      const formattedDate = dateStr ? this.formatDisplayDate(dateStr) : ''
      const id = nextId++
      const pos = this.findFreePosition()
      const xPos = pos.x; const yPos = pos.y
      this.addZone(xPos, yPos)
      const lifetime = 26+Math.random()*16

      this.visibleThoughts.push({
        id, text, personaCls:'persona-custom', date:formattedDate,
        isCustom: true,
        style: {
          left:`${xPos}%`, top:`${yPos}%`,
          '--core-color':'#c0b0a0',
          '--aura-color':'rgba(192,176,160,0.25)',
          '--core-size':'11px',
          '--aura-size':'60px',
          '--drift-x':`${(Math.random()-0.5)*25}px`,
          '--drift-y':`${(Math.random()-0.5)*25}px`,
          '--lifetime':`${lifetime}s`,
          '--emerge-delay':'0.1s',
        },
      })
      while (this.visibleThoughts.filter(t=>t.isCustom).length > MAX_CUSTOM) {
        const idx = this.visibleThoughts.findIndex(t=>t.isCustom)
        if (idx!==-1) this.visibleThoughts.splice(idx,1)
      }
      setTimeout(()=>{ const idx = this.visibleThoughts.findIndex(t=>t.id===id); if (idx!==-1) this.visibleThoughts.splice(idx,1) }, lifetime*1000+2000)
      this.recentTexts.push({text, personaIndex:-1, time:Date.now()})
      this.saveCustomBubbleToApi(text, dateStr)
      this.showAddForm = false; this.newText = ''; this.newDate = ''
    },

    async loadCustomBubbles() {
      this.debugLog('api', 'GET /api/bubbles ...')
      let saved = []
      try {
        const res = await fetch('/api/bubbles')
        if (res.ok) { saved = await res.json(); this.debugLog('api', `GET OK → ${saved.length} bubbles`) }
        else { this.debugLog('api', `GET ${res.status}: ${await res.text()}`) }
      } catch(e) { this.debugLog('api', `GET error: ${e.message}`) }
      if (!Array.isArray(saved)||saved.length===0) {
        const raw = localStorage.getItem('thoughts-custom-bubbles')
        if (raw) {
          try { saved=JSON.parse(raw); localStorage.removeItem('thoughts-custom-bubbles'); saved.forEach(i=>{if(i&&i.text)this.saveCustomBubbleToApi(i.text,i.date||'')}) } catch{ saved=[] }
        }
      }
      if (!Array.isArray(saved)||saved.length===0) return
      const count = this.isMobile ? 2 : Math.min(MAX_CUSTOM, saved.length)
      const recent = [...saved].sort(()=>Math.random()-0.5).slice(0,count)
      this.debugLog('done', `displaying ${recent.length}/${saved.length} saved`)
      const now = Date.now()
      recent.forEach((item,i)=>{
        setTimeout(()=>{
          const id = nextId++
          const pos = this.findFreePosition()
          const xPos = pos.x; const yPos = pos.y
          this.addZone(xPos, yPos)
          const lifetime = 28+Math.random()*14
          this.visibleThoughts.push({
            id, text:item.text, personaCls:'persona-custom', date:item.date?this.formatDisplayDate(item.date):'',
            isCustom:true,
            style:{
              left:`${xPos}%`, top:`${yPos}%`,
              '--core-color':'#c0b0a0', '--aura-color':'rgba(192,176,160,0.25)',
              '--core-size':'11px', '--aura-size':'60px',
              '--drift-x':`${(Math.random()-0.5)*25}px`, '--drift-y':`${(Math.random()-0.5)*25}px`,
              '--lifetime':`${lifetime}s`, '--emerge-delay':`${i*0.15}s`,
            },
          })
          setTimeout(()=>{const idx=this.visibleThoughts.findIndex(t=>t.id===id);if(idx!==-1)this.visibleThoughts.splice(idx,1)},lifetime*1000+2000)
        }, i*(this.isMobile?2500:600))
      })
    },

    async saveCustomBubbleToApi(text, date) {
      this.debugLog('api', `POST /api/bubbles "${text.slice(0,20)}…"`)
      try {
        const res = await fetch('/api/bubbles', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text,date}) })
        if (res.ok) { const d=await res.json(); this.debugLog('api',`POST OK → id=${d.id}`) }
        else { this.debugLog('api',`POST FAIL ${res.status}: ${await res.text()}`) }
      } catch(e) { this.debugLog('api',`POST error: ${e.message}`) }
    },

    formatDisplayDate(dateStr) {
      const d = new Date(dateStr)
      return `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`
    },
  },
}
</script>

<style scoped>
/* ═══════════════ NEBULA CHAMBER ═══════════════ */
.nebula-chamber {
  position:relative; width:100%; height:100vh;
  background:#02020a; overflow:hidden;
  cursor:default;
  -webkit-tap-highlight-color:transparent;
  -webkit-user-select:none; user-select:none;
  animation:chamber-breathe 12s ease-in-out infinite;
}
@keyframes chamber-breathe {
  0%,100% { background:#02020a; }
  50%     { background:#030312; }
}

/* ═══ Deep Space ═══ */
.starfield { position:absolute; inset:0; z-index:0; pointer-events:none; }
.star {
  position:absolute; border-radius:50%;
  background:radial-gradient(circle, rgba(220,230,255,1) 0%, rgba(180,200,240,0.4) 40%, transparent 70%);
  animation:star-twinkle ease-in-out infinite;
  box-shadow:var(--chroma, none);
}
@keyframes star-twinkle {
  0%,100% { opacity:0.1; transform:scale(0.8); }
  50%     { opacity:0.8; transform:scale(1.3); }
}

/* ═══ Nebula Layers ═══ */
.nebula-layer {
  position:absolute; inset:-10%; z-index:1; pointer-events:none;
  transition:transform 1.8s cubic-bezier(0.25,0,0.35,1);
}
.nebula-cloud {
  position:absolute; border-radius:50%;
  animation:nebula-breathe ease-in-out infinite alternate;
}
.nebula-cloud--deep { filter:blur(80px); opacity:0.5; }
.nebula-cloud--mid { filter:blur(55px); opacity:0.55; }
.nebula-cloud--highlight {
  filter:blur(35px); opacity:0.65;
  animation: nebula-breathe ease-in-out infinite alternate,
             nebula-hue-shift 20s ease-in-out infinite;
}
@keyframes nebula-breathe {
  0%   { transform:translate(0,0) scale(0.85); opacity:0.35; }
  100% { transform:translate(2.5vw, -2vh) scale(1.15); opacity:0.7; }
}
@keyframes nebula-hue-shift {
  0%,100% { filter:blur(35px) hue-rotate(0deg); }
  33%     { filter:blur(38px) hue-rotate(var(--nebula-hue-shift, 10deg)); }
  66%     { filter:blur(32px) hue-rotate(calc(var(--nebula-hue-shift, 10deg) * -0.5)); }
}

/* ═══ Canvas ═══ */
.particle-canvas { position:absolute; inset:0; z-index:2; pointer-events:none; }

/* ═══ Stellar Thoughts ═══ */
.thoughts-layer { position:absolute; inset:0; z-index:3; }
.stellar-thought {
  position:absolute;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer;
  animation: emerge-star 2.5s var(--emerge-delay, 0s) cubic-bezier(0.16,1,0.3,1) forwards,
             drift-star var(--lifetime, 30s) 2.5s ease-in-out infinite,
             dissolve-star 2.5s calc(var(--lifetime, 30s) - 1.5s) ease-out forwards;
  will-change:transform,opacity;
}
.stellar-thought:hover { filter:brightness(1.4); }
.stellar-thought.captured { animation:none !important; opacity:0 !important; pointer-events:none; }
.stellar-thought.persona-custom { --core-color:#c0b0a0; --aura-color:rgba(192,176,160,0.25); }

/* Core glow */
.stellar-core {
  position:absolute;
  width:var(--core-size,12px); height:var(--core-size,12px);
  border-radius:50%;
  background:radial-gradient(circle, rgba(255,255,255,0.95) 0%, var(--core-color,#d4a255) 40%, transparent 70%);
  box-shadow:0 0 calc(var(--core-size,12px)*2) var(--core-color,#d4a255),
             0 0 calc(var(--core-size,12px)*6) var(--aura-color,rgba(212,162,85,0.3));
  animation:core-pulse 3s ease-in-out infinite;
}
@keyframes core-pulse {
  0%,100% { transform:scale(1); opacity:0.8; }
  50%     { transform:scale(1.25); opacity:1; }
}

/* Aura ring */
.stellar-aura {
  position:absolute;
  width:var(--aura-size,60px); height:var(--aura-size,60px);
  border-radius:50%;
  background:radial-gradient(circle, var(--aura-color,rgba(212,162,85,0.2)) 0%, transparent 70%);
  animation:aura-breathe 4s ease-in-out infinite;
}
@keyframes aura-breathe {
  0%,100% { transform:scale(0.8); opacity:0.4; }
  50%     { transform:scale(1.2); opacity:0.7; }
}

/* Text */
.stellar-text {
  position:relative; z-index:1;
  font-size:13px; line-height:1.7; color:rgba(225,220,210,0.82);
  font-family:'Georgia','Noto Serif SC',serif;
  text-align:center; max-width:220px;
  padding:50px 20px;
  letter-spacing:0.03em;
  text-shadow:0 0 20px var(--aura-color,rgba(212,162,85,0.3));
}
.stellar-date {
  position:absolute; bottom:28px; right:24px;
  font-size:9px; color:var(--core-color,#d4a255); opacity:0.45;
  font-family:'Georgia','Noto Serif SC',serif; letter-spacing:0.05em; z-index:1;
}

/* Emerge / Dissolve / Drift */
@keyframes emerge-star {
  0%   { transform:scale(0) translate(0,0); opacity:0; filter:blur(20px) brightness(3); }
  20%  { opacity:0.5; filter:blur(4px) brightness(2); }
  40%  { opacity:0.85; filter:blur(1px) brightness(1.2); }
  100% { transform:scale(1) translate(0,0); opacity:1; filter:blur(0) brightness(1); }
}
@keyframes dissolve-star {
  0%   { opacity:1; filter:blur(0); transform:scale(1); }
  100% { opacity:0; filter:blur(20px) brightness(0.3); transform:scale(0.3); }
}
@keyframes drift-star {
  0%,100% { transform:translate(0, 0); }
  25%     { transform:translate(var(--drift-x, 10px), calc(var(--drift-y, -10px)*0.5)); }
  50%     { transform:translate(calc(var(--drift-x, 10px)*0.3), var(--drift-y, -10px)); }
  75%     { transform:translate(calc(var(--drift-x, 10px)*-0.5), calc(var(--drift-y, -10px)*0.7)); }
}

/* Transition group */
.star-birth-enter-active { transition:all 1.5s cubic-bezier(0.16,1,0.3,1); }
.star-birth-leave-active { transition:all 2.5s ease-out; }
.star-birth-enter-from,.star-birth-leave-to { opacity:0; transform:scale(0); filter:blur(20px); }

/* ═══ Capture Overlay ═══ */
.capture-overlay {
  position:fixed; inset:0; z-index:15;
  background:radial-gradient(ellipse at center, rgba(3,3,10,0.25) 0%, rgba(3,3,10,0.94) 100%);
  backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer;
  overflow:hidden;
}
.capture-fade-enter-active { transition:opacity 0.5s ease-out; }
.capture-fade-leave-active { transition:opacity 0.9s ease-in; }
.capture-fade-enter-from,.capture-fade-leave-to { opacity:0; }

/* ── Light Rays ── */
.capture-ray {
  position:absolute;
  top:50%; left:50%;
  width:2px; height:140vh;
  background:linear-gradient(to top, transparent 0%, var(--ray-color, #d4a255) 40%, rgba(255,255,255,0.6) 55%, transparent 100%);
  transform-origin:center center;
  opacity:0;
  pointer-events:none;
  animation:ray-pierce 0.8s var(--ray-delay, 0s) ease-out forwards,
             ray-pulse 3s 0.8s ease-in-out infinite;
}
@keyframes ray-pierce {
  0%   { transform:translate(-50%,-50%) rotate(var(--ray-angle, 0deg)) scaleY(0); opacity:0; }
  100% { transform:translate(-50%,-50%) rotate(var(--ray-angle, 0deg)) scaleY(1); opacity:0.12; }
}
@keyframes ray-pulse {
  0%,100% { opacity:0.08; transform:translate(-50%,-50%) rotate(var(--ray-angle, 0deg)) scaleY(1); }
  50%     { opacity:0.16; transform:translate(-50%,-50%) rotate(var(--ray-angle, 0deg)) scaleY(1.05); }
}

.capture-stage { display:flex; flex-direction:column; align-items:center; gap:28px; cursor:default; position:relative; z-index:1; }

.capture-star {
  position:relative;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  min-width:240px; min-height:240px;
  animation:capture-reveal 0.6s 0.3s cubic-bezier(0.16,1,0.3,1) forwards, capture-float 4s 1s ease-in-out infinite;
  opacity:0;
}
@keyframes capture-reveal {
  0%   { transform:scale(0.05); opacity:0; filter:blur(40px) brightness(3); }
  15%  { transform:scale(1.08); opacity:0.9; filter:blur(4px) brightness(1.8); }
  40%  { transform:scale(0.95); opacity:1; filter:blur(0) brightness(1); }
  100% { transform:scale(1); opacity:1; filter:blur(0); }
}
@keyframes capture-float {
  0%,100% { transform:translateY(0); }
  50%     { transform:translateY(-8px); }
}

.capture-core {
  position:absolute;
  width:calc(var(--core-size,14px)*1.6); height:calc(var(--core-size,14px)*1.6);
  border-radius:50%;
  background:radial-gradient(circle, rgba(255,255,255,1) 0%, var(--core-color,#d4a255) 35%, transparent 70%);
  box-shadow:0 0 calc(var(--core-size,14px)*3) var(--core-color,#d4a255),
             0 0 calc(var(--core-size,14px)*8) var(--aura-color,rgba(212,162,85,0.4)),
             0 0 calc(var(--core-size,14px)*15) var(--aura-color,rgba(212,162,85,0.2));
  animation:core-pulse 2.5s ease-in-out infinite;
}
.capture-aura {
  position:absolute;
  width:calc(var(--aura-size,70px)*1.5); height:calc(var(--aura-size,70px)*1.5);
  border-radius:50%;
  background:radial-gradient(circle, var(--aura-color,rgba(212,162,85,0.3)) 0%, transparent 70%);
  animation:aura-breathe 3.5s ease-in-out infinite;
}
.capture-aura--outer {
  width:calc(var(--aura-size,70px)*3); height:calc(var(--aura-size,70px)*3);
  background:radial-gradient(circle, var(--aura-color,rgba(212,162,85,0.12)) 0%, transparent 65%);
  animation:aura-breathe 5s 0.5s ease-in-out infinite;
  opacity:0.5;
}

.capture-label {
  margin-top:90px;
  font-size:11px; letter-spacing:0.2em; text-transform:uppercase;
  color:var(--core-color,#d4a255); opacity:0.7;
  font-family:'Georgia','Noto Serif SC',serif;
  position:relative; z-index:1;
}
.capture-text {
  font-size:17px; line-height:2.1; color:rgba(235,230,220,0.92);
  font-family:'Georgia','Noto Serif SC',serif;
  text-align:center; max-width:380px; padding:0 20px;
  letter-spacing:0.05em;
  text-shadow:0 0 30px var(--aura-color,rgba(212,162,85,0.35));
  position:relative; z-index:1;
}
.capture-hint {
  font-size:11px; color:rgba(200,195,185,0.3);
  font-family:'Georgia','Noto Serif SC',serif; letter-spacing:0.1em;
  animation:hint-fade 3s ease-in-out infinite;
}
@keyframes hint-fade {
  0%,100% { opacity:0.2; }
  50%     { opacity:0.5; }
}

/* ═══ UI ═══ */
.back-link {
  position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
  z-index:20; display:flex; align-items:center; gap:6px;
  text-decoration:none;
  color:rgba(200,195,185,0.35); font-family:'Georgia','Noto Serif SC',serif;
  font-size:13px; letter-spacing:0.08em; transition:color 0.4s;
}
.back-link:hover { color:rgba(220,210,195,0.75); }
.back-arrow { font-size:15px; transition:transform 0.3s; }
.back-link:hover .back-arrow { transform:translateX(-4px); }

.title-hint {
  position:fixed; top:32px; right:36px; z-index:20;
  display:flex; flex-direction:column; align-items:flex-end; pointer-events:none;
}
.hint-line { font-size:22px; color:rgba(200,195,185,0.22); font-family:'Georgia','Noto Serif SC',serif; letter-spacing:0.35em; }
.hint-sub { font-size:10px; color:rgba(200,195,185,0.12); letter-spacing:0.12em; margin-top:2px; }

.add-btn {
  position:fixed; bottom:22px; right:26px; z-index:20;
  width:42px; height:42px; border-radius:50%;
  border:1px solid rgba(255,255,255,0.1);
  background:rgba(255,255,255,0.03); backdrop-filter:blur(8px);
  color:rgba(220,215,205,0.5); font-size:22px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all 0.3s; font-family:'Georgia',serif;
}
.add-btn:hover { background:rgba(255,255,255,0.07); color:rgba(220,215,205,0.85); border-color:rgba(255,255,255,0.18); transform:scale(1.08); }

/* ═══ Add Form ═══ */
.add-form-overlay {
  position:fixed; inset:0; z-index:30;
  background:rgba(3,3,10,0.78); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  display:flex; align-items:center; justify-content:center;
}
.add-form-card {
  background:rgba(15,13,20,0.95); border:1px solid rgba(255,255,255,0.06);
  border-radius:18px; padding:26px 22px 18px; width:360px; max-width:90vw;
  display:flex; flex-direction:column; gap:14px;
  box-shadow:0 20px 50px rgba(0,0,0,0.6);
}
.form-title { font-size:14px; color:rgba(220,215,205,0.65); font-family:'Georgia','Noto Serif SC',serif; letter-spacing:0.08em; text-align:center; }
.form-textarea {
  width:100%; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.08);
  border-radius:10px; padding:12px 14px; color:rgba(230,225,215,0.9);
  font-family:'Georgia','Noto Serif SC',serif; font-size:13px; line-height:1.7;
  resize:none; outline:none; transition:border-color 0.3s;
}
.form-textarea:focus { border-color:rgba(255,255,255,0.18); }
.form-textarea::placeholder { color:rgba(200,195,185,0.25); }
.form-date-row { display:flex; align-items:center; gap:10px; }
.form-date-label { font-size:11px; color:rgba(200,195,185,0.4); font-family:'Georgia','Noto Serif SC',serif; white-space:nowrap; }
.form-date-input {
  flex:1; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.08);
  border-radius:8px; padding:5px 8px; color:rgba(220,215,205,0.8);
  font-family:'Georgia','Noto Serif SC',serif; font-size:12px; outline:none; color-scheme:dark;
}
.form-actions { display:flex; gap:8px; justify-content:flex-end; }
.form-btn {
  padding:7px 18px; border-radius:8px; border:none;
  font-size:12px; font-family:'Georgia','Noto Serif SC',serif; cursor:pointer; transition:all 0.25s;
}
.form-btn.cancel { background:rgba(255,255,255,0.03); color:rgba(200,195,185,0.45); border:1px solid rgba(255,255,255,0.05); }
.form-btn.cancel:hover { background:rgba(255,255,255,0.06); color:rgba(220,215,205,0.65); }
.form-btn.submit { background:rgba(150,130,180,0.15); color:rgba(220,210,230,0.85); border:1px solid rgba(150,130,180,0.25); }
.form-btn.submit:hover:not(:disabled) { background:rgba(150,130,180,0.25); border-color:rgba(150,130,180,0.4); }
.form-btn.submit:disabled { opacity:0.3; cursor:not-allowed; }

/* ═══ Mobile ═══ */
@media (max-width:600px) {
  .nebula-chamber { animation:none; }
  .nebula-layer { transition:transform 3s ease-out; }
  .nebula-cloud--deep { filter:blur(50px); }
  .nebula-cloud--mid { filter:blur(35px); }
  .nebula-cloud--highlight { filter:blur(25px); animation:nebula-breathe ease-in-out infinite alternate; }
  .stellar-text { font-size:11px; line-height:1.6; max-width:160px; padding:36px 12px; }
  .stellar-thought { animation-duration:1.8s, var(--lifetime, 25s), 1.8s !important; }
  .capture-star { min-width:160px; min-height:160px; }
  .capture-text { font-size:13px; line-height:1.7; max-width:260px; }
  .capture-overlay { backdrop-filter:none; -webkit-backdrop-filter:none; }
  .capture-ray { display:none; }
  .add-form-overlay { backdrop-filter:none; -webkit-backdrop-filter:none; background:rgba(3,3,10,0.9); }
  .add-btn { backdrop-filter:none; -webkit-backdrop-filter:none; }
}
@media (prefers-reduced-motion:reduce) {
  .stellar-thought { animation:none !important; opacity:1; }
  .capture-star { animation:none !important; opacity:1; }
  .nebula-cloud { animation:none !important; }
}
</style>
