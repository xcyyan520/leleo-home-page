<!-- src/components/ControlBar.vue -->
<template>
  <div class="control-bar" :class="{ 'is-mobile': isMobile }">
    <!-- First in the bar because it changes the whole page, not one panel. The
         icon shows the theme you would GET, not the one you are in, so the
         button always reads as an action. -->
    <button
      class="ctrl-btn ctrl-btn--theme"
      :class="{ 'ctrl-btn--active': theme === 'light' }"
      @click="toggleTheme"
      :title="theme === 'light' ? '切换到夜间' : '切换到白天'"
      :aria-label="theme === 'light' ? '切换到夜间主题' : '切换到白天主题'"
    >
      <v-icon :icon="theme === 'light' ? 'mdi-weather-night' : 'mdi-weather-sunny'" size="18"></v-icon>
    </button>
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
    <button class="ctrl-btn" @click="$emit('activity')" title="活动记录">
      <v-icon icon="mdi-history" size="18"></v-icon>
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
  emits: ['settings', 'thoughts', 'wallpaper', 'clearscreen', 'calendar', 'photos', 'activity'],
  data() {
    return { isMobile: false, theme: 'dark' }
  },
  mounted() {
    this.isMobile = window.innerWidth < 768
    // The theme itself is owned by the classic /js/theme.js boot script, which
    // runs before first paint. This component only mirrors the current value so
    // the icon is right, and asks that script to change it — there is exactly
    // one writer of the attribute, so nothing can drift out of sync.
    const t = window.XTheme
    if (t) {
      this.theme = t.mode
      this.unsubscribeTheme = t.subscribe((mode) => { this.theme = mode })
    }
  },
  beforeUnmount() {
    if (this.unsubscribeTheme) this.unsubscribeTheme()
  },
  methods: {
    toggleTheme() {
      const t = window.XTheme
      if (t) this.theme = t.toggle()
    },
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
/* The theme button is set slightly apart from the panel buttons: it is the only
   one that changes the whole page, and grouping it with 壁纸/设置 read as if it
   opened another dialog. */
.ctrl-btn--theme { margin-right: 2px; }
/* A hairline separator, so the theme button does not read as one more member of
   the 壁纸/思绪/设置 group. Drawn on the NEXT button so the theme button itself
   stays a plain circle. */
.ctrl-btn--theme + .ctrl-btn { position: relative; }
.ctrl-btn--theme + .ctrl-btn::before {
  content: ''; position: absolute; left: -5px; top: 50%;
  width: 1px; height: 16px; margin-top: -8px;
  background: rgba(255, 255, 255, 0.08);
}
.is-mobile .ctrl-btn { width: 30px; height: 30px; }
.is-mobile .ctrl-btn--theme + .ctrl-btn::before { left: -3px; height: 14px; margin-top: -7px; }
</style>
