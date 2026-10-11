<!-- src/components/ProfileCard.vue -->
<template>
  <div class="profile-card glass-card" :class="{ 'is-mobile': isMobile }">
    <v-avatar :size="isMobile ? 70 : 90" class="profile-avatar">
      <v-img :src="configdata.avatar" alt="Avatar"></v-img>
    </v-avatar>
    <div class="profile-name">{{ configdata.welcometitle }}</div>
    <div class="profile-typewriter-wrap">
      <div class="profile-typewriter">
        <typewriter />
      </div>
    </div>
  </div>
</template>

<script>
import typewriter from './typewriter.vue'

export default {
  name: 'ProfileCard',
  components: { typewriter },
  props: {
    configdata: { type: Object, required: true },
  },
  data() {
    return { isMobile: false }
  },
  mounted() {
    this.isMobile = window.innerWidth < 768
  },
}
</script>

<style scoped>
.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 20px 18px;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
  transition: transform 0.3s ease, border-color 0.3s ease;
}
.profile-card:hover { transform: translateY(-2px); }
.profile-avatar {
  border: 2px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 30px rgba(139, 122, 170, 0.15);
}
.profile-name {
  margin-top: 16px;
  font-size: 1.45rem;
  font-weight: 600;
  color: rgba(228, 223, 218, 0.9);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  letter-spacing: 0.04em;
}
.profile-typewriter-wrap {
  position: relative;
  width: 100px;
  height: 62px;
  margin-top: 10px;
}
.profile-typewriter {
  position: absolute;
  left: 50%;
  top: 0;
  width: 320px;
  transform: translateX(-50%) scale(0.5);
  transform-origin: center top;
  pointer-events: none;
}
.is-mobile .profile-name { font-size: 1.1rem; }
.is-mobile .profile-typewriter { transform: translateX(-50%) scale(0.55); }
</style>
