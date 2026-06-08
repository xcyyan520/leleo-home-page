<!-- src/components/MiniMusicPlayer.vue -->
<template>
  <div class="mini-player glass-card" :class="{ 'is-mobile': isMobile }">
    <div class="player-art" :style="artStyle">
      <v-progress-circular v-if="audioLoading" indeterminate size="22" width="2" color="rgba(200,180,160,0.5)"></v-progress-circular>
    </div>
    <div class="player-info" @click="$emit('expand')">
      <div class="player-song">{{ song?.title || '未在播放' }}</div>
      <div class="player-artist">{{ song?.author || '点击打开播放器' }}</div>
    </div>
    <div class="player-controls">
      <button class="player-btn" @click="$emit('prev')" title="上一首">
        <v-icon icon="mdi-skip-previous" size="16"></v-icon>
      </button>
      <button class="player-btn player-btn--play" @click="$emit('play')" :title="isPlaying ? '暂停' : '播放'">
        <v-icon :icon="isPlaying ? 'mdi-pause' : 'mdi-play'" size="18"></v-icon>
      </button>
      <button class="player-btn" @click="$emit('next')" title="下一首">
        <v-icon icon="mdi-skip-next" size="16"></v-icon>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MiniMusicPlayer',
  props: {
    song: { type: Object, default: null },
    isPlaying: { type: Boolean, default: false },
    audioLoading: { type: Boolean, default: false },
  },
  emits: ['play', 'prev', 'next', 'expand'],
  data() {
    return { isMobile: false }
  },
  computed: {
    artStyle() {
      return {
        background: this.song?.url ? 'rgba(180, 160, 140, 0.2)' : 'rgba(255,255,255,0.03)',
        border: this.isPlaying ? '1px solid rgba(200,180,160,0.3)' : '1px solid rgba(255,255,255,0.05)',
      }
    },
  },
  mounted() {
    this.isMobile = window.innerWidth < 768
  },
}
</script>

<style scoped>
.mini-player {
  position: fixed; bottom: 20px; right: 20px; z-index: 50;
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px; border-radius: 24px;
  backdrop-filter: blur(16px);
  animation: card-float 4.5s ease-in-out infinite;
}
@keyframes card-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
.is-mobile { bottom: 12px; right: 12px; left: 12px; width: auto; border-radius: 20px; }
.player-art {
  width: 32px; height: 32px; border-radius: 50%;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.player-info {
  flex: 1; min-width: 0; cursor: pointer;
  overflow: hidden;
}
.player-song {
  font-size: 11px; color: rgba(215, 210, 200, 0.75);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.player-artist {
  font-size: 9px; color: rgba(170, 165, 155, 0.35);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.player-controls { display: flex; gap: 4px; align-items: center; }
.player-btn {
  width: 28px; height: 28px; border-radius: 50%;
  border: none; background: rgba(255, 255, 255, 0.04);
  color: rgba(200, 195, 185, 0.45);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.player-btn:hover { background: rgba(255, 255, 255, 0.08); color: rgba(220, 210, 200, 0.7); }
.player-btn--play { width: 32px; height: 32px; background: rgba(200, 180, 160, 0.1); color: rgba(200, 180, 160, 0.6); }
.player-btn--play:hover { background: rgba(200, 180, 160, 0.18); }
</style>
