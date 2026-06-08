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
