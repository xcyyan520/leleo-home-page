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
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; border-radius: 26px;
  backdrop-filter: blur(16px);
  min-width: 230px;
  transition: transform 0.3s ease, border-color 0.3s ease;
}
.mini-player:hover { transform: translateY(-2px); }
.is-mobile { bottom: 12px; right: 12px; left: 12px; width: auto; border-radius: 20px; min-width: 0; }
.player-art {
  width: 36px; height: 36px; border-radius: 50%;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.player-info {
  flex: 1; min-width: 0; cursor: pointer;
  overflow: hidden;
}
.player-song {
  font-size: 13px; color: rgba(218, 213, 203, 0.82);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.player-artist {
  font-size: 11px; color: rgba(175, 170, 160, 0.45);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-top: 1px;
}
.player-controls { display: flex; gap: 4px; align-items: center; }
.player-btn {
  width: 30px; height: 30px; border-radius: 50%;
  border: none; background: rgba(255, 255, 255, 0.04);
  color: rgba(205, 200, 190, 0.5);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.2s, color 0.2s;
}
.player-btn:hover { background: rgba(255, 255, 255, 0.08); color: rgba(225, 215, 205, 0.8); }
.player-btn--play { width: 34px; height: 34px; background: rgba(200, 180, 160, 0.12); color: rgba(210, 190, 170, 0.7); }
.player-btn--play:hover { background: rgba(200, 180, 160, 0.2); }
</style>
