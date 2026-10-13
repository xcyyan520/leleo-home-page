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
          <v-img :src="item.img" :width="isMobile ? 40 : 52" :height="isMobile ? 40 : 52" cover class="project-img"></v-img>
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
      isMobile: false,
    }
  },
  mounted() {
    this.syncViewport()
    window.addEventListener('resize', this.syncViewport)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.syncViewport)
  },
  methods: {
    syncViewport() {
      this.isMobile = window.innerWidth < 768
    },
  },
  computed: {
    displayProjects() {
      // Render every configured card: the grid packs them into full rows, so an
      // odd count would leave a hole and any `slice` would silently hide cards
      // the user has no other way to reach from the homepage.
      return this.projects || []
    },
  },
}
</script>

<style scoped>
.projects-card {
  padding: 16px 18px;
  transition: transform 0.3s ease, border-color 0.3s ease;
  /* The card is stretched to the full height of the right-hand column, so it
     has to be a flex column for the grid to be able to claim that height. */
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.projects-card:hover { transform: translateY(-2px); }
.section-label {
  display: block;
  font-size: 11px; color: rgba(200, 195, 185, 0.45);
  letter-spacing: 0.12em; margin-bottom: 12px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.project-list {
  /* The card fills the wide right column, so a single stacked column would
     leave most of it empty. auto-fill lets it flow into 2-3 columns.
     minmax(96px, 1fr) rows then spread the tiles over the full height instead
     of bunching them at the top with a dead tail underneath. */
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-rows: minmax(96px, 1fr);
  gap: 10px;
}
.project-item {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  border-left: 2px solid var(--accent);
  cursor: pointer;
  transition: background 0.25s;
}
.project-item:hover { background: rgba(255, 255, 255, 0.04); }
.project-thumb { flex-shrink: 0; }
.project-img { border-radius: 8px; }
.project-info { flex: 1; min-width: 0; }
.project-title { font-size: 15px; color: rgba(220, 215, 205, 0.9); font-weight: 500; line-height: 1.4; }
.project-subtitle { font-size: 12.5px; color: rgba(170, 165, 155, 0.5); margin-top: 4px; }
.project-text { font-size: 12.5px; color: rgba(185, 180, 170, 0.62); margin-top: 8px; line-height: 1.7; }
.project-go {
  font-size: 12px; color: rgba(190, 180, 170, 0.5);
  text-decoration: none; white-space: nowrap;
  transition: color 0.2s;
  padding: 5px 10px; border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  align-self: center;
}
.project-go:hover { color: rgba(210, 200, 190, 0.8); }

/* Mobile: the card is one full-width column inside a scrolling page, so it must
   size to its content instead of stretching, and the tiles must not be blown up
   to fill a 800px-tall grid. */
@media (max-width: 767px) {
  .projects-card { flex: 0 0 auto; }
  .project-list { grid-auto-rows: auto; }
  .project-item { align-items: flex-start; padding: 12px 14px; }
}
</style>
