<!-- src/components/ControlBar.vue -->
<template>
  <div class="control-bar" :class="{ 'is-mobile': isMobile }">
    <button class="ctrl-btn" @click="$emit('wallpaper')" title="壁纸">
      <v-icon icon="mdi-wallpaper" size="18"></v-icon>
    </button>
    <button class="ctrl-btn" @click="$emit('thoughts')" title="思绪">
      <v-icon icon="mdi-brain" size="18"></v-icon>
    </button>
    <button class="ctrl-btn" @click="$emit('calendar')" title="日记回顾">
      <v-icon icon="mdi-calendar-month" size="18"></v-icon>
    </button>
    <button class="ctrl-btn" @click="$emit('photos')" title="照片墙">
      <v-icon icon="mdi-image-multiple" size="18"></v-icon>
    </button>
    <button class="ctrl-btn" @click="$emit('settings')" title="设置">
      <v-icon icon="mdi-cog" size="18"></v-icon>
    </button>
    <button
      class="ctrl-btn"
      :class="{ 'ctrl-btn--active': isClearScreen }"
      @click="$emit('clearscreen')"
      :title="isClearScreen ? '显示内容' : '清屏'"
    >
      <v-icon :icon="isClearScreen ? 'mdi-eye' : 'mdi-eye-off'" size="18"></v-icon>
    </button>
  </div>
</template>

<script>
export default {
  name: 'ControlBar',
  props: {
    isClearScreen: { type: Boolean, default: false },
  },
  emits: ['settings', 'thoughts', 'wallpaper', 'clearscreen', 'calendar', 'photos'],
  data() {
    return { isMobile: false }
  },
  mounted() {
    this.isMobile = window.innerWidth < 768
  },
}
</script>

<style scoped>
.control-bar {
  position: fixed; top: 20px; right: 20px; z-index: 50;
  display: flex; gap: 6px;
  padding: 6px 10px;
  background: rgba(15, 13, 25, 0.5);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 20px;
}
.is-mobile { top: 10px; right: 10px; gap: 3px; padding: 4px 8px; }
.ctrl-btn {
  width: 34px; height: 34px; border-radius: 50%;
  border: none; background: transparent;
  color: rgba(200, 195, 185, 0.35);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.ctrl-btn:hover { color: rgba(220, 210, 195, 0.7); background: rgba(255, 255, 255, 0.05); }
.ctrl-btn--active { color: rgba(200, 180, 220, 0.6); background: rgba(139, 122, 170, 0.12); }
.is-mobile .ctrl-btn { width: 30px; height: 30px; }
</style>
