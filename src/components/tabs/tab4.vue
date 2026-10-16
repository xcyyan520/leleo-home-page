<template>
  <div class="tab-avatar">
    <div class="ta-avatar">
      <v-avatar size="110" class="ta-ring">
        <v-img :src="preview" alt="Avatar"></v-img>
      </v-avatar>
    </div>

    <p class="ta-note">
      上传一张图片，框出你想要的部分即可。保存后<strong>所有访客</strong>都会看到这张。
    </p>

    <div class="ta-actions">
      <v-btn variant="tonal" class="ma-2" :loading="loading" @click="open">选择图片</v-btn>
      <v-btn v-if="custom" variant="tonal" class="ma-2" :loading="loading" @click="reset">用回默认</v-btn>
    </div>

    <p v-if="error" class="ta-error">{{ error }}</p>
    <p class="ta-hint">
      提示：直接点击首页头像也能换。
    </p>
  </div>
</template>

<script>
import { cachedAvatar, canEditAvatar, clearAvatar, loadAvatar, onAvatarChange } from '../../utils/avatar.js'

export default {
  name: 'tab4',
  props: {
    // The bundled default, so the preview never renders empty.
    fallback: { type: String, default: '' },
  },
  emits: ['edit-avatar'],
  data() {
    return { custom: null, canEdit: false, loading: false, error: '' }
  },
  computed: {
    preview() {
      return this.custom || this.fallback || ''
    },
  },
  created() {
    this.loading = true
    this.custom = cachedAvatar()
    this.canEdit = canEditAvatar()
    this.off = onAvatarChange((value) => { this.custom = value; this.canEdit = canEditAvatar() })
    loadAvatar().then((value) => {
      this.custom = value
      this.canEdit = canEditAvatar()
      this.loading = false
    })
  },
  beforeUnmount() {
    if (this.off) this.off()
  },
  methods: {
    open() {
      // The cropper is a top-level dialog that outlives this one being closed,
      // so the parent owns it rather than this tab.
      this.$emit('edit-avatar')
    },
    async reset() {
      this.loading = true
      this.error = ''
      try {
        await clearAvatar()
        this.custom = null
      } catch (err) {
        this.error = (err && err.message) || '删除失败'
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<style scoped>
.tab-avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0 4px;
}
.ta-ring {
  border: 2px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 30px rgba(139, 122, 170, 0.18);
}
.ta-note {
  margin: 20px 0 0;
  max-width: 380px;
  text-align: center;
  font-size: 13px;
  line-height: 1.8;
  color: rgba(210, 204, 196, 0.55);
}
.ta-note strong {
  color: rgba(226, 208, 168, 0.9);
  font-weight: 600;
}
.ta-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 10px;
}
.ta-error {
  margin: 6px 0 0;
  font-size: 12px;
  color: rgba(224, 150, 150, 0.85);
}
.ta-hint {
  margin: 10px 0 0;
  font-size: 11.5px;
  color: rgba(200, 195, 185, 0.26);
}
</style>
