<!-- src/components/TagsCard.vue -->
<template>
  <div class="tags-card glass-card" :class="{ 'is-mobile': isMobile }">
    <div class="tags-section">
      <span class="section-label">✦ 标签</span>
      <div class="tags-wrap">
        <span v-for="tag in filteredTags" :key="tag" class="tag-chip">{{ tag }}</span>
      </div>
    </div>
    <div class="social-section">
      <span class="section-label">✦ 社交</span>
      <div class="social-icons">
        <a v-for="item in socialIcons" :key="item.icon" :href="item.link" target="_blank" class="social-link" :title="item.icon">
          <v-icon :icon="item.icon" size="18"></v-icon>
        </a>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TagsCard',
  props: {
    tags: { type: Array, default: () => [] },
    socialIcons: { type: Array, default: () => [] },
  },
  data() {
    return { isMobile: false }
  },
  computed: {
    filteredTags() {
      return (this.tags || []).filter(t => t && t.trim())
    },
  },
  mounted() {
    this.isMobile = window.innerWidth < 768
  },
}
</script>

<style scoped>
.tags-card { padding: 16px 18px; transition: transform 0.3s ease, border-color 0.3s ease; }
.tags-card:hover { transform: translateY(-2px); }
.section-label {
  display: block;
  font-size: 11px;
  color: rgba(200, 195, 185, 0.45);
  letter-spacing: 0.12em;
  margin-bottom: 10px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.tags-wrap { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.tag-chip {
  font-size: 12px; padding: 4px 11px;
  background: rgba(139, 122, 170, 0.14);
  border-radius: 10px;
  color: rgba(205, 195, 225, 0.72);
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.social-icons { display: flex; gap: 2px; flex-wrap: wrap; }
.social-link {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  color: rgba(200, 195, 185, 0.35);
  transition: all 0.25s;
  text-decoration: none;
}
.social-link:hover { color: rgba(220, 210, 195, 0.7); background: rgba(255, 255, 255, 0.04); }
</style>
