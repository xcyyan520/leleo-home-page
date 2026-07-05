<!-- src/components/CalendarDialog.vue -->
<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="calendar-card" @click.stop>
      <!-- Month navigation -->
      <div class="cal-header">
        <button class="cal-nav" @click="prevMonth"><v-icon icon="mdi-chevron-left" size="18"></v-icon></button>
        <span class="cal-month">{{ year }}年{{ month }}月</span>
        <button class="cal-nav" @click="nextMonth"><v-icon icon="mdi-chevron-right" size="18"></v-icon></button>
      </div>

      <!-- Weekday headers -->
      <div class="cal-weekdays">
        <span v-for="d in weekdays" :key="d" class="cal-weekday">{{ d }}</span>
      </div>

      <!-- Day grid -->
      <div class="cal-grid">
        <div v-for="(cell, i) in calendarCells" :key="i"
          class="cal-cell"
          :class="{
            'cal-cell--dim': !cell.currentMonth,
            'cal-cell--today': cell.isToday,
            'cal-cell--selected': cell.date === selectedDate,
            'cal-cell--has-entry': cell.hasEntry,
            'cal-cell--has-photo': cell.hasPhoto,
          }"
          @click="cell.currentMonth && cell.hasEntry && selectDate(cell.date)"
        >
          <span class="cal-day-num">{{ cell.day }}</span>
          <span v-if="cell.hasPhoto" class="cal-dot cal-dot--photo"></span>
          <span v-else-if="cell.hasEntry" class="cal-dot"></span>
        </div>
      </div>

      <!-- Selected date: multiple entries -->
      <div v-if="selectedEntries.length > 0" class="cal-preview">
        <div class="cal-preview-date">{{ formatDate(selectedDate) }}</div>
        <div v-for="item in selectedEntries" :key="item.id" class="cal-entry-item">
          <p class="cal-preview-text">{{ item.text }}</p>
          <img v-if="item.image_data || item.image_url" :src="item.image_data || item.image_url" class="cal-preview-img" @click="$emit('viewImage', item.image_data || item.image_url)" />
          <button class="cal-entry-del" @click="deleteEntry(item.id)">删除</button>
        </div>
      </div>
      <div v-else-if="selectedDate && !loadingEntry" class="cal-no-entry">
        这天没有记录
      </div>
      <div v-if="loadingEntry" class="cal-loading">
        <v-progress-circular indeterminate size="16" width="2" color="rgba(200,180,160,0.3)"></v-progress-circular>
      </div>

      <button class="cal-close" @click="$emit('close')">关闭</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CalendarDialog',
  emits: ['close', 'viewImage'],
  data() {
    const now = new Date()
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],
      allEntries: [],
      selectedDate: null,
      selectedEntries: [],
      loadingEntry: false,
    }
  },
  computed: {
    calendarCells() {
      const today = new Date().toISOString().slice(0, 10)
      const daysInMonth = new Date(this.year, this.month, 0).getDate()
      const firstDow = new Date(this.year, this.month - 1, 1).getDay()
      const entrySet = new Set(this.allEntries.map(e => e.date))
      const photoSet = new Set(this.allEntries.filter(e => e.has_image).map(e => e.date))
      const cells = []

      const prevDays = new Date(this.year, this.month - 1, 0).getDate()
      for (let i = firstDow - 1; i >= 0; i--) {
        cells.push({ day: prevDays - i, currentMonth: false })
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${this.year}-${String(this.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        cells.push({
          day: d,
          currentMonth: true,
          date: dateStr,
          isToday: dateStr === today,
          hasEntry: entrySet.has(dateStr),
          hasPhoto: photoSet.has(dateStr),
        })
      }

      const remaining = 7 - (cells.length % 7)
      if (remaining < 7) {
        for (let d = 1; d <= remaining; d++) {
          cells.push({ day: d, currentMonth: false })
        }
      }
      return cells
    },
  },
  async mounted() {
    await this.fetchEntries()
  },
  methods: {
    async fetchEntries() {
      try {
        const res = await fetch('/api/diary')
        if (res.ok) this.allEntries = await res.json()
      } catch (e) { console.error('Failed to load diary entries:', e) }
    },
    prevMonth() {
      if (this.month === 1) { this.year--; this.month = 12 }
      else { this.month-- }
      this.selectedDate = null
      this.selectedEntries = []
    },
    nextMonth() {
      if (this.month === 12) { this.year++; this.month = 1 }
      else { this.month++ }
      this.selectedDate = null
      this.selectedEntries = []
    },
    async selectDate(dateStr) {
      this.selectedDate = dateStr
      this.loadingEntry = true
      try {
        const res = await fetch(`/api/diary?date=${dateStr}`)
        if (res.ok) {
          const data = await res.json()
          this.selectedEntries = Array.isArray(data) ? data : (data ? [data] : [])
        } else {
          this.selectedEntries = []
        }
      } catch (e) { this.selectedEntries = [] }
      this.loadingEntry = false
    },
    async deleteEntry(id) {
      try {
        const res = await fetch(`/api/diary?id=${id}`, { method: 'DELETE' })
        if (res.ok) {
          this.selectedEntries = this.selectedEntries.filter(e => e.id !== id)
          await this.fetchEntries()
        }
      } catch (e) { console.error('Delete failed:', e) }
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      const parts = dateStr.split('-')
      return `${parseInt(parts[0])}年${parseInt(parts[1])}月${parseInt(parts[2])}日`
    },
  },
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(3, 3, 10, 0.8); backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center;
}
.calendar-card {
  background: rgba(15, 13, 22, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px; padding: 20px; width: 520px; max-width: 95vw;
  max-height: 90vh; overflow-y: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
.cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.cal-month { font-size: 15px; color: rgba(215, 210, 200, 0.75); font-family: 'Georgia', 'Noto Serif SC', serif; }
.cal-nav { background: none; border: none; color: rgba(200, 195, 185, 0.35); cursor: pointer; padding: 4px; border-radius: 6px; }
.cal-nav:hover { color: rgba(220, 210, 195, 0.7); background: rgba(255,255,255,0.04); }
.cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 4px; }
.cal-weekday { font-size: 10px; color: rgba(200, 195, 185, 0.25); padding: 4px 0; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.cal-cell {
  aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-radius: 10px; cursor: default; position: relative; font-size: 12px;
  color: rgba(200, 195, 185, 0.5); transition: background 0.15s;
}
.cal-cell--dim { color: rgba(200, 195, 185, 0.15); }
.cal-cell--has-entry { cursor: pointer; }
.cal-cell--has-entry:hover { background: rgba(255, 255, 255, 0.04); }
.cal-cell--today { color: rgba(200, 180, 220, 0.7); font-weight: bold; }
.cal-cell--selected { background: rgba(139, 122, 170, 0.15); color: rgba(210, 200, 220, 0.8); }
.cal-dot {
  width: 4px; height: 4px; border-radius: 50%; background: rgba(139, 122, 170, 0.5);
  position: absolute; bottom: 4px;
}
.cal-dot--photo { background: rgba(200, 180, 130, 0.5); }
.cal-preview { margin-top: 14px; }
.cal-preview-date { font-size: 10px; color: rgba(200, 195, 185, 0.3); margin-bottom: 8px; }
.cal-entry-item {
  padding: 10px 12px; margin-bottom: 8px;
  background: rgba(255,255,255,0.02); border-radius: 10px;
  position: relative;
}
.cal-preview-text { font-size: 12px; color: rgba(210, 205, 195, 0.65); line-height: 1.7; font-family: 'Georgia', 'Noto Serif SC', serif; margin: 0; }
.cal-preview-img { width: 100%; max-height: 240px; object-fit: cover; border-radius: 8px; margin-top: 6px; cursor: pointer; opacity: 0.8; }
.cal-preview-img:hover { opacity: 1; }
.cal-entry-del {
  position: absolute; top: 8px; right: 8px;
  padding: 2px 8px; border-radius: 6px;
  border: 1px solid rgba(220,140,140,0.2);
  background: rgba(220,140,140,0.08);
  color: rgba(220,140,140,0.5); font-size: 10px;
  cursor: pointer; font-family: 'Georgia', 'Noto Serif SC', serif;
}
.cal-entry-del:hover { background: rgba(220,140,140,0.18); color: rgba(220,140,140,0.8); }
.cal-no-entry { text-align: center; padding: 14px; color: rgba(180, 175, 170, 0.3); font-size: 12px; }
.cal-loading { text-align: center; padding: 14px; }
.cal-close { display: block; margin: 14px auto 0; padding: 6px 20px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.03); color: rgba(200,195,185,0.4); font-size: 12px; cursor: pointer; font-family: 'Georgia', 'Noto Serif SC', serif; }
.cal-close:hover { background: rgba(255,255,255,0.06); color: rgba(220,215,205,0.6); }
</style>
