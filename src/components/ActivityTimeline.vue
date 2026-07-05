<!-- src/components/ActivityTimeline.vue -->
<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="timeline-card" @click.stop>
      <span class="tl-title">✦ 活动记录</span>

      <div v-if="loading" class="tl-loading">
        <v-progress-circular indeterminate size="18" width="2" color="rgba(200,180,160,0.3)"></v-progress-circular>
      </div>

      <div v-else-if="activities.length === 0" class="tl-empty">
        暂无活动记录
      </div>

      <div v-else class="tl-list">
        <div v-for="item in activities" :key="item.id" class="tl-item">
          <div class="tl-dot" :class="'tl-dot--' + item.action"></div>
          <div class="tl-body">
            <div class="tl-meta">
              <span class="tl-user">{{ item.username }}</span>
              <span class="tl-action">{{ actionLabel(item.action) }}</span>
              <span v-if="item.target" class="tl-target">{{ item.target.replace('diary:', '') }}</span>
            </div>
            <div v-if="item.detail" class="tl-detail">"{{ item.detail }}"</div>
            <div class="tl-time">{{ formatTime(item.created_at) }}</div>
          </div>
        </div>
      </div>

      <button class="tl-close" @click="$emit('close')">关闭</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ActivityTimeline',
  emits: ['close'],
  data() {
    return {
      activities: [],
      loading: true,
    }
  },
  async mounted() {
    await this.fetchActivities()
  },
  methods: {
    async fetchActivities() {
      try {
        const res = await fetch('/api/activity?limit=40')
        if (res.ok) this.activities = await res.json()
      } catch (e) { console.error('Failed to load activities:', e) }
      this.loading = false
    },
    actionLabel(action) {
      const map = {
        add_diary: '写下了日记',
        edit_diary: '编辑了日记',
        delete_diary: '删除了日记',
      }
      return map[action] || action
    },
    formatTime(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr + 'Z')
      const now = new Date()
      const diff = now - d
      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
      const month = d.getMonth() + 1
      const day = d.getDate()
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      return `${month}月${day}日 ${hours}:${minutes}`
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
.timeline-card {
  background: rgba(15, 13, 22, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px; padding: 20px; width: 480px; max-width: 94vw;
  max-height: 85vh; overflow-y: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
.tl-title {
  display: block; text-align: center;
  font-size: 14px; color: rgba(220, 210, 200, 0.5);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  letter-spacing: 0.1em; margin-bottom: 16px;
}
.tl-loading { text-align: center; padding: 20px; }
.tl-empty { text-align: center; padding: 20px; color: rgba(180, 175, 170, 0.3); font-size: 12px; }
.tl-list { display: flex; flex-direction: column; }
.tl-item {
  display: flex; gap: 12px; padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}
.tl-item:last-child { border-bottom: none; }
.tl-dot {
  width: 10px; height: 10px; border-radius: 50%;
  margin-top: 4px; flex-shrink: 0;
  background: rgba(255,255,255,0.15);
}
.tl-dot--add_diary { background: rgba(140, 200, 140, 0.5); }
.tl-dot--edit_diary { background: rgba(200, 180, 140, 0.5); }
.tl-dot--delete_diary { background: rgba(220, 140, 140, 0.5); }
.tl-body { flex: 1; min-width: 0; }
.tl-meta { font-size: 12px; line-height: 1.6; }
.tl-user { color: rgba(200, 180, 220, 0.6); font-weight: 500; }
.tl-action { color: rgba(200, 195, 185, 0.4); margin: 0 4px; }
.tl-target { color: rgba(180, 175, 170, 0.3); font-size: 10px; }
.tl-detail {
  font-size: 11px; color: rgba(210, 205, 195, 0.5);
  line-height: 1.5; margin-top: 2px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 100%;
}
.tl-time {
  font-size: 9px; color: rgba(180, 175, 170, 0.2); margin-top: 3px;
}
.tl-close {
  display: block; margin: 14px auto 0; padding: 6px 20px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.03);
  color: rgba(200,195,185,0.4); font-size: 12px; cursor: pointer;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.tl-close:hover { background: rgba(255,255,255,0.06); color: rgba(220,215,205,0.6); }
</style>
