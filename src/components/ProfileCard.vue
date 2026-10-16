<!-- src/components/ProfileCard.vue -->
<template>
  <div class="profile-card glass-card" :class="{ 'is-mobile': isMobile }">
    <div
      class="avatar-wrap"
      :class="{ editable: canEdit }"
      :role="canEdit ? 'button' : null"
      :tabindex="canEdit ? 0 : null"
      :title="canEdit ? '点击更换头像' : null"
      @click="onAvatarClick"
      @keydown.enter.prevent="onAvatarClick"
      @keydown.space.prevent="onAvatarClick"
    >
      <v-avatar :size="isMobile ? 70 : 90" class="profile-avatar">
        <v-img :src="avatarSrc" alt="Avatar"></v-img>
      </v-avatar>
      <!-- The hover affordance is a separate layer rather than a swap of the
           image, so the avatar never disappears mid-hover. -->
      <div v-if="canEdit" class="avatar-edit" :class="{ 'is-mobile': isMobile }">
        <span class="avatar-edit-icon">✎</span>
        <span v-if="!isMobile" class="avatar-edit-text">更换</span>
      </div>
    </div>
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
import { loadAvatar, cachedAvatar, canEditAvatar, onAvatarChange } from '../utils/avatar.js'

export default {
  name: 'ProfileCard',
  components: { typewriter },
  props: {
    configdata: { type: Object, required: true },
  },
  data() {
    return {
      isMobile: false,
      // null means "no custom avatar stored" — the bundled config image shows.
      customAvatar: null,
      canEdit: false,
    }
  },
  computed: {
    avatarSrc() {
      return this.customAvatar || this.configdata.avatar
    },
  },
  mounted() {
    this.isMobile = window.innerWidth < 768
    // Paint the cached value synchronously first: awaiting the request would
    // show the bundled default for a frame on every single reload.
    this.customAvatar = cachedAvatar()
    this.canEdit = canEditAvatar()
    this.unsubscribe = onAvatarChange((value) => {
      this.customAvatar = value
      this.canEdit = canEditAvatar()
    })
    loadAvatar().then((value) => {
      this.customAvatar = value
      this.canEdit = canEditAvatar()
    })
  },
  beforeUnmount() {
    if (this.unsubscribe) this.unsubscribe()
  },
  methods: {
    onAvatarClick() {
      // The server is the one that decides; canEdit only mirrors its answer, so
      // a visitor never gets a button that would 401.
      if (!this.canEdit) return
      this.$emit('edit-avatar')
    },
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
.avatar-wrap {
  position: relative;
  border-radius: 50%;
  line-height: 0;
}
.avatar-wrap.editable {
  cursor: pointer;
  outline: none;
}
.avatar-wrap.editable:focus-visible {
  box-shadow: 0 0 0 2px rgba(196, 169, 112, 0.55);
  border-radius: 50%;
}
.profile-avatar {
  border: 2px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 30px rgba(139, 122, 170, 0.15);
  transition: border-color 0.3s ease;
}
.avatar-wrap.editable:hover .profile-avatar {
  border-color: rgba(196, 169, 112, 0.4);
}
.avatar-edit {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: rgba(8, 6, 16, 0.62);
  color: rgba(230, 214, 178, 0.92);
  font-size: 11px;
  letter-spacing: 0.08em;
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}
.avatar-wrap.editable:hover .avatar-edit,
.avatar-wrap.editable:focus-visible .avatar-edit {
  opacity: 1;
}
.avatar-edit-icon { font-size: 16px; line-height: 1; }
.avatar-edit.is-mobile { font-size: 10px; }
.avatar-edit.is-mobile .avatar-edit-icon { font-size: 14px; }
/* Touch devices have no hover, so the affordance must be visible by default
   there or the feature is undiscoverable on a phone. */
@media (hover: none) {
  .avatar-wrap.editable .avatar-edit { opacity: 0.55; }
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
