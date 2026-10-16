<template>
  <div class="dialog-overlay" @click.self="requestClose">
    <div class="av-card">
      <div class="av-head">
        <div class="av-title">✦ 头像</div>
        <div class="av-sub">
          {{ src ? '拖动调整位置，滚轮或滑杆缩放' : '上传一张图片，然后框出你想要的部分' }}
        </div>
      </div>

      <!-- 1 ── nothing chosen yet -->
      <div
        v-if="!src"
        class="av-drop"
        :class="{ over: dragOver }"
        @click="pick"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <div class="av-dropplus">＋</div>
        <div class="av-dropmain">把图片拖到这里</div>
        <div class="av-dropsub">或点击选择文件 · JPG / PNG / WebP</div>
      </div>

      <!-- The reset lives OUTSIDE the `src` block on purpose: with a custom
           avatar already stored but no new file picked, that block is not
           rendered at all, which would leave no way to remove the old one
           without first uploading something to replace it. -->
      <div v-if="!src && hasCustom" class="av-minor standalone">
        <button class="av-mini danger" @click="removeExisting">用回默认头像</button>
      </div>

      <!-- 2 ── the crop stage: the circle is the part that survives -->
      <div v-else class="av-stage">
        <canvas
          ref="view"
          class="av-view"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
          @wheel.prevent="onWheel"
        ></canvas>
      </div>

      <!-- 3 ── controls, only meaningful once there is something to crop -->
      <div v-if="src" class="av-tools">
        <div class="av-zoom">
          <span class="av-zoomlabel">缩放</span>
          <input
            class="av-range"
            type="range"
            min="1"
            max="4"
            step="0.01"
            :value="zoom"
            @input="onSlider"
          >
        </div>
        <div class="av-minor">
          <button class="av-mini" @click="pick">换一张</button>
          <button class="av-mini" @click="recenter">居中</button>
          <button v-if="hasCustom" class="av-mini danger" @click="removeExisting">
            用回默认头像
          </button>
        </div>
      </div>

      <p v-if="error" class="av-error">{{ error }}</p>

      <div class="av-foot">
        <span class="av-hint">{{ hint }}</span>
        <div class="av-buttons">
          <button class="av-btn" :disabled="saving" @click="requestClose">取消</button>
          <button class="av-btn primary" :disabled="!src || saving" @click="save">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>

      <input ref="file" class="av-file" type="file" accept="image/*" @change="onPick">
    </div>
  </div>
</template>

<script>
import { setAvatar, clearAvatar } from '../utils/avatar.js'

// The stage is a fixed square in CSS pixels, so its geometry never has to be
// recomputed on resize.
const VIEW = 268
// Exported at 2x the largest place an avatar is ever drawn (90px in the card,
// 70px on mobile), which leaves room for a retina screen without shipping a
// 1024px image for a 90px hole.
const OUT = 320
const MAX_CHARS = 400000
const MIN_ZOOM = 1
const MAX_ZOOM = 4

export default {
  name: 'AvatarEditor',
  props: {
    // Whether a custom avatar is already stored, so the "use the default again"
    // button only appears when there is something to remove.
    hasCustom: { type: Boolean, default: false },
  },
  emits: ['close', 'saved'],
  data() {
    return {
      src: '',
      zoom: 1,
      ox: 0,
      oy: 0,
      dragOver: false,
      saving: false,
      error: '',
      hint: '保存后所有访客都会看到这张',
    }
  },
  created() {
    // Deliberately NOT in data(): these are big non-serialisable objects that
    // would be walked by Vue's reactivity on every frame of a drag.
    this.imgEl = null
    this.nw = 0
    this.nh = 0
    this.baseScale = 1
    this._url = ''
    this._drag = null
  },
  beforeUnmount() {
    if (this._url) URL.revokeObjectURL(this._url)
    this._url = ''
  },
  methods: {
    pick() {
      this.$refs.file && this.$refs.file.click()
    },
    onPick(e) {
      const file = e.target.files && e.target.files[0]
      // Clear the value so choosing the SAME file twice still fires `change`;
      // without this, re-picking the identical file does nothing.
      e.target.value = ''
      this.loadFile(file)
    },
    onDrop(e) {
      this.dragOver = false
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
      this.loadFile(file)
    },
    loadFile(file) {
      if (!file) return
      if (!/^image\//.test(file.type)) {
        this.error = '请选择图片文件'
        return
      }
      if (file.size > 12 * 1024 * 1024) {
        this.error = '图片太大了，请换一张小于 12MB 的'
        return
      }
      this.error = ''
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        if (this._url) URL.revokeObjectURL(this._url)
        this._url = url
        this.imgEl = img
        this.nw = img.naturalWidth
        this.nh = img.naturalHeight
        // At zoom 1 the SHORTER side exactly spans the stage, so the circle is
        // always fully covered and there is never an empty corner to drag into.
        this.baseScale = VIEW / Math.max(1, Math.min(this.nw, this.nh))
        this.src = url
        this.zoom = 1
        this.ox = 0
        this.oy = 0
        this.$nextTick(this.draw)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        this.error = '这张图片读不出来'
      }
      img.src = url
    },

    // ── geometry ───────────────────────────────────────────────────────────
    scale() { return this.baseScale * this.zoom },
    // Keeps the image covering the whole stage: the offset can never exceed
    // half the overhang, which is exactly the point where an edge would enter
    // the circle.
    clampOffset() {
      const s = this.scale()
      const mx = Math.max(0, (this.nw * s - VIEW) / 2)
      const my = Math.max(0, (this.nh * s - VIEW) / 2)
      this.ox = Math.min(mx, Math.max(-mx, this.ox))
      this.oy = Math.min(my, Math.max(-my, this.oy))
    },
    origin() {
      const s = this.scale()
      return {
        left: VIEW / 2 - (this.nw * s) / 2 + this.ox,
        top: VIEW / 2 - (this.nh * s) / 2 + this.oy,
      }
    },
    recenter() {
      this.ox = 0
      this.oy = 0
      this.draw()
    },

    setZoom(next, px, py) {
      const z0 = this.zoom
      const z1 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
      if (z1 === z0) {
        this.zoom = z1
        this.clampOffset()
        this.draw()
        return
      }
      // Anchor the zoom on a point (the cursor, or the stage centre) so the
      // thing under it does not slide away while scaling.
      const ax = px == null ? VIEW / 2 : px
      const ay = py == null ? VIEW / 2 : py
      const s0 = this.baseScale * z0
      const s1 = this.baseScale * z1
      const o0 = this.origin()
      const ix = (ax - o0.left) / s0
      const iy = (ay - o0.top) / s0
      this.zoom = z1
      this.ox = ax - ix * s1 - VIEW / 2 + (this.nw * s1) / 2
      this.oy = ay - iy * s1 - VIEW / 2 + (this.nh * s1) / 2
      this.clampOffset()
      this.draw()
    },
    onSlider(e) {
      this.setZoom(parseFloat(e.target.value))
    },
    onWheel(e) {
      this.setZoom(this.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), ...this.pointOf(e))
    },
    pointOf(e) {
      const r = this.$refs.view.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top]
    },

    // ── dragging ───────────────────────────────────────────────────────────
    onDown(e) {
      if (!this.imgEl) return
      this._drag = { x: e.clientX, y: e.clientY, ox: this.ox, oy: this.oy }
      // Pointer capture keeps a fast drag alive even when it leaves the canvas.
      // Wrapped because a capture request can be refused (an unknown pointer id),
      // and losing the capture only costs us the out-of-bounds part of a drag —
      // it must not abort the drag that was already recorded above.
      try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
      this.$refs.view.style.cursor = 'grabbing'
    },
    onMove(e) {
      if (!this._drag) return
      this.ox = this._drag.ox + (e.clientX - this._drag.x)
      this.oy = this._drag.oy + (e.clientY - this._drag.y)
      this.clampOffset()
      this.draw()
    },
    onUp(e) {
      if (!this._drag) return
      this._drag = null
      if (e.target.releasePointerCapture && e.pointerId != null) {
        try { e.target.releasePointerCapture(e.pointerId) } catch { /* already gone */ }
      }
      if (this.$refs.view) this.$refs.view.style.cursor = 'grab'
    },

    // ── painting ───────────────────────────────────────────────────────────
    draw() {
      const c = this.$refs.view
      if (!c || !this.imgEl) return
      // Back the canvas at device resolution; a 1x canvas on a retina screen
      // makes the crop look softer than the avatar it will produce.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (c.width !== Math.round(VIEW * dpr)) {
        c.width = Math.round(VIEW * dpr)
        c.height = Math.round(VIEW * dpr)
      }
      c.style.width = VIEW + 'px'
      c.style.height = VIEW + 'px'
      const g = c.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, VIEW, VIEW)

      const o = this.origin()
      const s = this.scale()
      g.save()
      g.beginPath()
      g.rect(0, 0, VIEW, VIEW)
      g.clip()
      // A transparent PNG would otherwise show the page through the stage and
      // read as a hole rather than as an image.
      g.fillStyle = '#0f0d16'
      g.fillRect(0, 0, VIEW, VIEW)
      g.imageSmoothingQuality = 'high'
      g.drawImage(this.imgEl, o.left, o.top, this.nw * s, this.nh * s)
      g.restore()

      // Dim everything outside the circle. Filling a rect and punching a
      // counter-clockwise arc through it is one pass; drawing four rectangles
      // around the circle would leave seams at the corners.
      g.save()
      g.beginPath()
      g.rect(0, 0, VIEW, VIEW)
      g.arc(VIEW / 2, VIEW / 2, VIEW / 2 - 1, 0, Math.PI * 2, true)
      g.fillStyle = 'rgba(6,5,12,0.74)'
      g.fill()
      g.restore()

      g.beginPath()
      g.arc(VIEW / 2, VIEW / 2, VIEW / 2 - 1, 0, Math.PI * 2)
      g.strokeStyle = 'rgba(255,255,255,0.22)'
      g.lineWidth = 1
      g.stroke()
    },

    /**
     * Renders exactly what the stage shows, circle-clipped, into a square JPEG.
     * Circular rather than transparent: `v-avatar` clips to a circle anyway, and
     * a JPEG of a circle is a fraction of the size of a PNG with alpha.
     */
    exportDataUri() {
      const out = document.createElement('canvas')
      out.width = OUT
      out.height = OUT
      const g = out.getContext('2d')
      g.fillStyle = '#0f0d16'
      g.fillRect(0, 0, OUT, OUT)
      g.save()
      g.beginPath()
      g.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2)
      g.clip()
      const o = this.origin()
      const s = this.scale() * (OUT / VIEW)
      g.imageSmoothingQuality = 'high'
      g.drawImage(this.imgEl, o.left * (OUT / VIEW), o.top * (OUT / VIEW), this.nw * s, this.nh * s)
      g.restore()

      // A 320px JPEG lands near 30KB, so this loop exists only so a pathological
      // image can never be rejected by the server for being too big.
      let quality = 0.86
      let data = out.toDataURL('image/jpeg', quality)
      while (data.length > MAX_CHARS && quality > 0.45) {
        quality -= 0.12
        data = out.toDataURL('image/jpeg', quality)
      }
      return data
    },

    // ── committing ─────────────────────────────────────────────────────────
    requestClose() {
      if (this.saving) return
      this.$emit('close')
    },
    async save() {
      if (!this.imgEl || this.saving) return
      this.saving = true
      this.error = ''
      try {
        const data = this.exportDataUri()
        await setAvatar(data)
        this.$emit('saved', data)
        this.$emit('close')
      } catch (err) {
        this.error = (err && err.message) || '保存失败'
      } finally {
        this.saving = false
      }
    },
    async removeExisting() {
      if (this.saving) return
      this.saving = true
      this.error = ''
      try {
        await clearAvatar()
        this.$emit('saved', null)
        this.$emit('close')
      } catch (err) {
        this.error = (err && err.message) || '删除失败'
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<style scoped>
/* Same overlay + card vocabulary as PhotoWall and the diary dialogs, so the
   new panel reads as part of the same desk rather than a bolt-on. */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(3, 3, 10, 0.8);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}
.av-card {
  background: rgba(15, 13, 22, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 18px;
  padding: 20px;
  width: 340px;
  max-width: 94vw;
  max-height: 92vh;
  overflow-y: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
  box-sizing: border-box;
}
.av-title {
  font-size: 14px;
  color: rgba(220, 210, 200, 0.55);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  letter-spacing: 0.1em;
}
.av-sub {
  margin-top: 6px;
  font-size: 11.5px;
  line-height: 1.6;
  color: rgba(200, 195, 185, 0.34);
}

/* ── the empty state ─────────────────────────────────────────────────── */
.av-drop {
  margin-top: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 30px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.25s, background 0.25s;
}
.av-drop:hover,
.av-drop.over {
  border-color: rgba(196, 169, 112, 0.45);
  background: rgba(196, 169, 112, 0.05);
}
.av-dropplus {
  font-size: 24px;
  color: rgba(196, 169, 112, 0.5);
  line-height: 1;
}
.av-dropmain {
  margin-top: 10px;
  font-size: 13px;
  color: rgba(220, 215, 205, 0.62);
}
.av-dropsub {
  margin-top: 6px;
  font-size: 11px;
  color: rgba(200, 195, 185, 0.26);
}

/* ── the crop stage ──────────────────────────────────────────────────── */
.av-stage {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}
.av-view {
  display: block;
  border-radius: 14px;
  cursor: grab;
  /* Without this the browser claims a touch drag for scrolling and the pointer
     stream ends after the first move. */
  touch-action: none;
}

/* ── controls ────────────────────────────────────────────────────────── */
.av-tools {
  margin-top: 14px;
}
.av-zoom {
  display: flex;
  align-items: center;
  gap: 10px;
}
.av-zoomlabel {
  font-size: 11.5px;
  color: rgba(200, 195, 185, 0.34);
  flex: 0 0 auto;
}
.av-range {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 2px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.12);
  outline: none;
  cursor: pointer;
}
.av-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: rgba(196, 169, 112, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
}
.av-range::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: rgba(196, 169, 112, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
}
.av-minor {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.av-minor.standalone {
  justify-content: center;
}
.av-mini {
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(200, 195, 185, 0.45);
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
  transition: all 0.25s;
}
.av-mini:hover {
  color: rgba(220, 210, 195, 0.8);
  border-color: rgba(255, 255, 255, 0.16);
}
.av-mini.danger:hover {
  color: rgba(224, 150, 150, 0.85);
  border-color: rgba(224, 150, 150, 0.3);
}

.av-error {
  margin: 12px 0 0;
  font-size: 11.5px;
  color: rgba(224, 150, 150, 0.85);
}

/* ── footer ──────────────────────────────────────────────────────────── */
.av-foot {
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.av-hint {
  font-size: 10.5px;
  color: rgba(200, 195, 185, 0.24);
}
.av-buttons {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
}
.av-btn {
  padding: 7px 18px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(200, 195, 185, 0.5);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.25s;
}
.av-btn:hover:not(:disabled) {
  color: rgba(220, 210, 195, 0.9);
  border-color: rgba(255, 255, 255, 0.18);
}
.av-btn.primary {
  background: rgba(196, 169, 112, 0.14);
  border-color: rgba(196, 169, 112, 0.28);
  color: rgba(226, 208, 168, 0.85);
}
.av-btn.primary:hover:not(:disabled) {
  background: rgba(196, 169, 112, 0.22);
}
.av-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.av-file {
  display: none;
}
</style>
