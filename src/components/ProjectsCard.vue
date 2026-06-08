<!-- src/components/ProjectsCard.vue -->
<template>
  <div class="projects-card glass-card">
    <span class="section-label">✦ 项目</span>
    <div class="project-list">
      <div
        v-for="(item, i) in displayProjects"
        :key="i"
        class="project-item"
        :style="{ '--accent': accentColors[i % accentColors.length] }"
        @click="item.show = !item.show"
      >
        <div class="project-thumb">
          <v-img :src="item.img" width="36" height="36" cover class="project-img"></v-img>
        </div>
        <div class="project-info">
          <div class="project-title">{{ item.title }}</div>
          <div class="project-subtitle">{{ item.subtitle }}</div>
          <div v-if="item.show" class="project-text">{{ item.text }}</div>
        </div>
        <a :href="item.url" target="_blank" class="project-go" @click.stop>{{ item.go }}</a>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ProjectsCard',
  props: {
    projects: { type: Array, default: () => [] },
  },
  data() {
    return {
      accentColors: ['rgba(139,122,170,0.4)', 'rgba(160,130,150,0.4)', 'rgba(120,140,170,0.4)', 'rgba(170,140,140,0.4)'],
    }
  },
  computed: {
    displayProjects() {
      return (this.projects || []).slice(0, 5)
    },
  },
}
</script>

<style scoped>
.projects-card { padding: 16px 18px; animation: card-float 6s ease-in-out infinite; animation-delay: 0.3s; }
@keyframes card-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
.section-label {
  display: block;
  font-size: 10px; color: rgba(200, 195, 185, 0.35);
  letter-spacing: 0.12em; margin-bottom: 10px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.project-list { display: flex; flex-direction: column; gap: 8px; }
.project-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  border-left: 2px solid var(--accent);
  cursor: pointer;
  transition: all 0.25s;
}
.project-item:hover { background: rgba(255, 255, 255, 0.04); }
.project-thumb { flex-shrink: 0; }
.project-img { border-radius: 6px; }
.project-info { flex: 1; min-width: 0; }
.project-title { font-size: 12px; color: rgba(215, 210, 200, 0.8); font-weight: 500; }
.project-subtitle { font-size: 10px; color: rgba(170, 165, 155, 0.4); margin-top: 2px; }
.project-text { font-size: 10px; color: rgba(180, 175, 165, 0.5); margin-top: 4px; line-height: 1.5; }
.project-go {
  font-size: 10px; color: rgba(180, 170, 160, 0.4);
  text-decoration: none; white-space: nowrap;
  transition: color 0.2s;
  padding: 4px 8px; border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}
.project-go:hover { color: rgba(200, 190, 180, 0.7); }
</style>
