<!-- src/components/DiaryEditor.vue -->
<template>
  <div class="editor-overlay" @click.self="$emit('close')">
    <div class="editor-card" @click.stop>
      <span class="editor-title">✦ 星空日记</span>

      <input v-model="editDate" type="date" class="editor-date" />

      <textarea
        v-model="editText"
        class="editor-textarea"
        placeholder="今天想写点什么？..."
        maxlength="500"
        rows="5"
        ref="textarea"
      ></textarea>

      <!-- Image tab switcher -->
      <div class="editor-tabs">
        <button :class="{ active: imgTab === 'upload' }" @click="imgTab = 'upload'">上传图片</button>
        <button :class="{ active: imgTab === 'url' }" @click="imgTab = 'url'">粘贴链接</button>
        <button v-if="hasImage" class="tab-remove" @click="clearImage">移除图片</button>
      </div>

      <div v-if="imgTab === 'upload'" class="upload-area" @click="$refs.fileInput.click()" @dragover.prevent @drop.prevent="onDrop">
        <div v-if="!imagePreview" class="upload-hint">
          <v-icon icon="mdi-cloud-upload" size="20"></v-icon>
          <span>点击或拖拽上传图片</span>
        </div>
        <img v-else :src="imagePreview" class="upload-preview" />
        <input ref="fileInput" type="file" accept="image/*" @change="onFileSelected" hidden />
      </div>

      <div v-if="imgTab === 'url'" class="url-input-wrap">
        <input v-model="imageUrl" type="text" class="url-input" placeholder="https://example.com/image.jpg" />
        <img v-if="imageUrl" :src="imageUrl" class="url-preview" @error="imageUrlError = true" v-show="!imageUrlError" />
        <span v-if="imageUrlError" class="url-error">图片加载失败，请检查链接</span>
      </div>

      <div class="editor-actions">
        <button class="editor-btn cancel" @click="$emit('close')">取消</button>
        <button class="editor-btn save" @click="save" :disabled="!editText.trim() || saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DiaryEditor',
  props: {
    existingEntry: { type: Object, default: null },
  },
  emits: ['close', 'saved'],
  data() {
    const today = new Date().toISOString().slice(0, 10)
    return {
      editDate: this.existingEntry?.date || today,
      editText: this.existingEntry?.text || '',
      imgTab: this.existingEntry?.image_data ? 'upload' : (this.existingEntry?.image_url ? 'url' : 'upload'),
      imagePreview: this.existingEntry?.image_data || null,
      imageUrl: this.existingEntry?.image_url || '',
      imageUrlError: false,
      imageData: this.existingEntry?.image_data || '',
      saving: false,
    }
  },
  computed: {
    hasImage() {
      return !!(this.imagePreview || this.imageUrl)
    },
  },
  mounted() {
    this.$nextTick(() => this.$refs.textarea?.focus())
  },
  methods: {
    async onFileSelected(e) {
      const file = e.target.files?.[0]
      if (file) await this.compressAndSet(file)
    },
    async onDrop(e) {
      const file = e.dataTransfer?.files?.[0]
      if (file) await this.compressAndSet(file)
    },
    async compressAndSet(file) {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = await createImageBitmap(file)
        const maxWidth = 1200
        const scale = Math.min(1, maxWidth / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        this.imagePreview = dataUrl
        this.imageData = dataUrl
        this.imageUrl = ''
        this.imageUrlError = false
      } catch (e) {
        console.error('Image compress error:', e)
      }
    },
    clearImage() {
      this.imagePreview = null
      this.imageData = ''
      this.imageUrl = ''
      this.imageUrlError = false
    },
    async save() {
      if (!this.editText.trim()) return
      this.saving = true
      try {
        const body = {
          date: this.editDate,
          text: this.editText.trim(),
          image_url: this.imageUrl,
          image_data: this.imageData,
          image_mime: this.imageData ? 'image/jpeg' : '',
        }
        const res = await fetch('/api/diary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          this.$emit('saved')
          this.$emit('close')
        } else {
          alert('保存失败，请重试')
        }
      } catch (e) {
        alert('保存失败: ' + e.message)
      }
      this.saving = false
    },
  },
}
</script>

<style scoped>
.editor-overlay {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(3, 3, 10, 0.8); backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center;
}
.editor-card {
  background: rgba(15, 13, 22, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  padding: 24px 20px 18px;
  width: 420px; max-width: 92vw; max-height: 90vh; overflow-y: auto;
  display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
.editor-title {
  font-size: 14px; color: rgba(220, 210, 200, 0.55);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  letter-spacing: 0.1em; text-align: center;
}
.editor-date {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px; padding: 6px 10px;
  color: rgba(215, 210, 200, 0.7);
  font-family: 'Georgia', 'Noto Serif SC', serif; font-size: 13px;
  outline: none; color-scheme: dark;
}
.editor-textarea {
  width: 100%; background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px; padding: 12px 14px;
  color: rgba(225, 220, 210, 0.85);
  font-family: 'Georgia', 'Noto Serif SC', serif; font-size: 13px;
  line-height: 1.7; resize: vertical; outline: none;
}
.editor-textarea:focus { border-color: rgba(255, 255, 255, 0.14); }
.editor-textarea::placeholder { color: rgba(190, 185, 175, 0.2); }
.editor-tabs { display: flex; gap: 6px; }
.editor-tabs button {
  padding: 4px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(200, 195, 185, 0.4); font-size: 11px; cursor: pointer;
  font-family: 'Georgia', 'Noto Serif SC', serif; transition: all 0.2s;
}
.editor-tabs button.active { background: rgba(139, 122, 170, 0.12); color: rgba(200, 180, 220, 0.7); border-color: rgba(139, 122, 170, 0.25); }
.editor-tabs button:hover:not(.active) { color: rgba(220, 215, 205, 0.55); }
.tab-remove { color: rgba(220, 140, 140, 0.4) !important; }
.upload-area {
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 10px; padding: 16px; text-align: center; cursor: pointer;
  transition: border-color 0.2s; min-height: 60px;
  display: flex; align-items: center; justify-content: center;
}
.upload-area:hover { border-color: rgba(255, 255, 255, 0.15); }
.upload-hint {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  color: rgba(200, 195, 185, 0.3); font-size: 11px;
}
.upload-preview { max-width: 100%; max-height: 180px; border-radius: 8px; }
.url-input-wrap { display: flex; flex-direction: column; gap: 8px; }
.url-input {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px; padding: 8px 10px;
  color: rgba(220, 215, 205, 0.8);
  font-family: 'Georgia', 'Noto Serif SC', serif; font-size: 12px; outline: none;
}
.url-input::placeholder { color: rgba(190, 185, 175, 0.2); }
.url-preview { max-width: 100%; max-height: 160px; border-radius: 8px; object-fit: cover; }
.url-error { font-size: 10px; color: rgba(220, 140, 140, 0.5); }
.editor-actions { display: flex; gap: 8px; justify-content: flex-end; }
.editor-btn {
  padding: 7px 20px; border-radius: 10px; border: none;
  font-size: 12px; cursor: pointer; transition: all 0.25s;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.editor-btn.cancel { background: rgba(255, 255, 255, 0.03); color: rgba(200, 195, 185, 0.45); border: 1px solid rgba(255, 255, 255, 0.05); }
.editor-btn.cancel:hover { background: rgba(255, 255, 255, 0.06); color: rgba(220, 215, 205, 0.6); }
.editor-btn.save {
  background: rgba(139, 122, 170, 0.15); color: rgba(210, 200, 225, 0.8);
  border: 1px solid rgba(139, 122, 170, 0.25);
}
.editor-btn.save:hover:not(:disabled) { background: rgba(139, 122, 170, 0.25); }
.editor-btn.save:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
