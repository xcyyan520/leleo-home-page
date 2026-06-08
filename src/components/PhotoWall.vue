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
