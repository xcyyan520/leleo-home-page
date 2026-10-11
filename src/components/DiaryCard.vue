<!-- src/components/DiaryCard.vue -->
<template>
  <div class="diary-card glass-card" :class="{ 'is-mobile': isMobile }">
    <span class="section-label">✦ 星空日记</span>

    <div v-if="loading" class="diary-loading">
      <v-progress-circular indeterminate size="18" width="2" color="rgba(200,180,160,0.3)"></v-progress-circular>
    </div>

    <div v-else-if="!entry" class="diary-empty">
      <p class="diary-empty-text">今天想写点什么？</p>
      <button class="diary-action-btn" @click="$emit('edit')">
        <v-icon icon="mdi-feather" size="14"></v-icon>
        <span>写下此刻</span>
      </button>
    </div>

    <div v-else class="diary-content">
      <div class="diary-date">{{ formatDate(entry.date) }}</div>
      <p class="diary-text">{{ entry.text }}</p>
      <div v-if="hasImage" class="diary-image-preview">
        <img :src="imageSrc" alt="日记图片" class="diary-thumb" @click="$emit('viewImage', imageSrc)" />
      </div>
      <div class="diary-actions">
        <button class="diary-action-btn" @click="$emit('edit')">
          <v-icon icon="mdi-pencil" size="12"></v-icon>
          <span>编辑</span>
        </button>
        <button class="diary-action-btn" @click="$emit('add')">
          <v-icon icon="mdi-plus" size="12"></v-icon>
          <span>新增</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DiaryCard',
  props: {
    entry: { type: Object, default: null },
    loading: { type: Boolean, default: false },
  },
  emits: ['edit', 'add', 'viewImage'],
  data() {
    return { isMobile: false }
  },
  computed: {
    hasImage() {
      return !!(this.entry?.image_data || this.entry?.image_url)
    },
    imageSrc() {
      return this.entry?.image_data || this.entry?.image_url || ''
    },
  },
  methods: {
    formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr + 'T00:00:00')
      return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
    },
  },
  mounted() {
    this.isMobile = window.innerWidth < 768
  },
}
</script>

<style scoped>
.diary-card { padding: 16px 18px; transition: transform 0.3s ease, border-color 0.3s ease; }
.diary-card:hover { transform: translateY(-2px); }
.section-label {
  display: block;
  font-size: 11px; color: rgba(200, 195, 185, 0.45);
  letter-spacing: 0.12em; margin-bottom: 10px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.diary-loading { text-align: center; padding: 16px 0; }
.diary-empty { text-align: center; padding: 12px 0; }
.diary-empty-text { font-size: 13px; color: rgba(185, 180, 175, 0.5); margin-bottom: 12px; }
.diary-content { }
.diary-date { font-size: 11px; color: rgba(200, 195, 185, 0.4); margin-bottom: 8px; }
.diary-text {
  font-size: 13px; line-height: 1.75; color: rgba(218, 213, 203, 0.76);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
  overflow: hidden;
}
.diary-image-preview { margin-top: 10px; }
.diary-thumb {
  width: 100%; max-height: 120px; object-fit: cover;
  border-radius: 8px; cursor: pointer; opacity: 0.8;
  transition: opacity 0.2s;
}
.diary-thumb:hover { opacity: 1; }
.diary-actions { display: flex; gap: 8px; margin-top: 12px; }
.diary-action-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 14px; border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(205, 200, 190, 0.5);
  font-size: 12px; cursor: pointer; transition: all 0.2s;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.diary-action-btn:hover { background: rgba(255, 255, 255, 0.06); color: rgba(220, 215, 205, 0.65); }
</style>
