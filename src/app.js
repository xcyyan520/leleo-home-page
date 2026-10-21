import ProfileCard from './components/ProfileCard.vue'
import DiaryCard from './components/DiaryCard.vue'
import DiaryEditor from './components/DiaryEditor.vue'
import CalendarDialog from './components/CalendarDialog.vue'
import PhotoWall from './components/PhotoWall.vue'
import ActivityTimeline from './components/ActivityTimeline.vue'
import AvatarEditor from './components/AvatarEditor.vue'
import TagsCard from './components/TagsCard.vue'
import ProjectsCard from './components/ProjectsCard.vue'
import ControlBar from './components/ControlBar.vue'
import MiniMusicPlayer from './components/MiniMusicPlayer.vue'
import StarfieldBackground from './components/StarfieldBackground.vue'

import typewriter from './components/typewriter.vue'
import loader from './components/loader.vue'
import tab1 from './components/tabs/tab1.vue'
import tab2 from './components/tabs/tab2.vue'
import tab3 from './components/tabs/tab3.vue'
import tab4 from './components/tabs/tab4.vue'

import config from './config.js'
import { getCookie } from './utils/cookieUtils.js'
import { setMeta, getFormattedTime, getFormattedDate, dataConsole } from './utils/common.js'
import { loadAvatar, cachedAvatar, canEditAvatar, onAvatarChange } from './utils/avatar.js'
import { wallpaperUrl, WALLPAPER_WAIT_MS } from './utils/wallpaper.js'
import { useDisplay } from 'vuetify'

export default {
  components: {
    ProfileCard, DiaryCard, DiaryEditor, CalendarDialog, PhotoWall, ActivityTimeline,
    AvatarEditor,
    TagsCard, ProjectsCard, ControlBar, MiniMusicPlayer,
    StarfieldBackground, typewriter, loader, tab1, tab2, tab3, tab4,
  },
  setup() {
    const { xs, sm, md } = useDisplay()
    return { xs, sm, md }
  },
  data() {
    return {
      isloading: false,
      isClearScreen: false,
      formattedTime: '',
      formattedDate: '',
      configdata: config,
      dialogSettings: false,
      dialogAbout: false,
      personalizedtags: null,
      videosrc: '',
      imageurl: '',
      isPlaying: false,
      playlistIndex: 0,
      audioLoading: false,
      musicinfo: null,
      musicinfoLoading: false,
      lyrics: {},
      socialPlatformIcons: null,
      projectcards: null,
      tab: null,
      settingTabs: [
        { icon: 'mdi-pencil-plus', text: '样式预览', value: 'tab-1', component: 'tab1' },
        { icon: 'mdi-wallpaper', text: '背景预览', value: 'tab-2', component: 'tab2' },
        { icon: 'mdi-music-circle-outline', text: '音乐播放', value: 'tab-3', component: 'tab3' },
        { icon: 'mdi-account-circle-outline', text: '头像', value: 'tab-4', component: 'tab4' },
      ],
      // Diary
      showDiaryEditor: false,
      showCalendar: false,
      showPhotoWall: false,
      showActivity: false,
      showAvatarEditor: false,
      // Mirrors the store: null while the bundled config avatar is in use.
      avatarCustom: null,
      todayDiary: null,
      editingEntry: null,
      diaryLoading: false,
    }
  },
  computed: {
    currentSong() {
      return this.musicinfo?.[this.playlistIndex] || null
    },
    audioPlayer() {
      return this.$refs.audioPlayer
    },
    appFrameStyle() {
      return this.xs
        ? { height: '100%', width: '100%', top: '0', left: '0' }
        : this.sm
        ? { height: '98%', width: '98%', top: '1%', left: '1%' }
        : { height: '96.6%', width: '99%', top: '1.7%', left: '0.5%' }
    },
    deskLeftStyle() {
      // Fixed rail: the left cards are designed for a ~300px column, so a
      // percentage here would stretch them across a wide window.
      return this.xs ? {} : { width: '318px', flex: '0 0 318px' }
    },
    deskRightStyle() {
      // Fills whatever the left rail and the gap leave over.
      return this.xs ? {} : { flex: '1 1 auto', minWidth: '0' }
    },
  },
  async mounted() {
    if (import.meta.env.VITE_CONFIG) {
      this.configdata = JSON.parse(import.meta.env.VITE_CONFIG)
    }
    this.projectcards = this.configdata.projectcards
    this.socialPlatformIcons = this.configdata.socialPlatformIcons
    this.personalizedtags = this.configdata.tags
    this.isloading = true

    this.dataConsole()
    this.setMeta(this.configdata.metaData.title, this.configdata.metaData.description, this.configdata.metaData.keywords, this.configdata.metaData.icon)

    this.setMainProperty()

    // Paint whatever was cached before the request resolves, then reconcile.
    // The store is shared with ProfileCard, so both the card and this dialog
    // state stay in step without either owning the value.
    this.avatarCustom = cachedAvatar()
    this.avatarOff = onAvatarChange((value) => { this.avatarCustom = value })
    loadAvatar().then((value) => { this.avatarCustom = value })

    // Load wallpaper + wait for it (bounded by WALLPAPER_WAIT_MS)
    await this.initBackground()
    this.formattedTime = this.getFormattedTime(new Date())
    this.formattedDate = this.getFormattedDate(new Date())
    // `initBackground()` already caps how long the desk waits for the picture.
    // The old unconditional 500ms parked on top of that was pure padding: on a
    // phone it meant half a second of blank navy after everything was ready.
    this.isloading = false

    setInterval(() => {
      this.formattedTime = this.getFormattedTime(new Date())
    }, 1000)

    this.setupAudioListener()
    // The playlist comes from a third-party host (api.i-meto.com) and is
    // routinely the slowest request on a phone. Nothing on the first screen
    // needs it, so it waits until the desk is up instead of competing for a
    // connection slot with the CSS/JS that actually paint the page.
    this.whenIdle(() => this.getMusicInfo())
    this.loadTodayDiary()
  },

  beforeDestroy() {
    this.$refs.audioPlayer?.removeEventListener('ended', this.nextTrack)
  },
  // `beforeDestroy` above is the Vue 2 name and never fires under Vue 3, so the
  // audio listener it removes is in fact never removed. Left alone (out of scope
  // for the avatar work) but not copied: this hook is the one that runs.
  beforeUnmount() {
    if (this.avatarOff) this.avatarOff()
  },
  watch: {
    isClearScreen(val) {
      if (!this.videosrc) return
      if (val) {
        this.$refs.VdPlayer.style.zIndex = 0
        this.$refs.VdPlayer.controls = true
      } else {
        this.$refs.VdPlayer.style.zIndex = -100
        this.$refs.VdPlayer.controls = false
      }
    },
    audioLoading(val) {
      this.isPlaying = !val
    },
  },
  methods: {
    /** Run work once the first screen is up and the main thread is free. */
    whenIdle(fn) {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(fn, { timeout: 2500 })
      } else {
        setTimeout(fn, 1200)
      }
    },
    // Opening the cropper from inside the settings dialog would put it BEHIND
    // Vuetify's overlay (the overlay's z-index is far above any component
    // layer), so the dialog is dismissed first: two stacked modals is also a
    // worse experience than one.
    openAvatarEditor() {
      this.dialogSettings = false
      this.showAvatarEditor = true
    },
    getCookie, setMeta, getFormattedTime, getFormattedDate, dataConsole,

    setMainProperty() {
      const root = document.documentElement
      let leleodata = this.getCookie('leleodata')
      if (leleodata) {
        root.style.setProperty('--leleo-welcomtitle-color', leleodata.color.welcometitlecolor)
        root.style.setProperty('--leleo-vcard-color', leleodata.color.themecolor)
        root.style.setProperty('--leleo-brightness', leleodata.brightness + '%')
        root.style.setProperty('--leleo-blur', leleodata.blur + 'px')
      } else {
        root.style.setProperty('--leleo-welcomtitle-color', this.configdata.color.welcometitlecolor)
        root.style.setProperty('--leleo-vcard-color', this.configdata.color.themecolor)
        root.style.setProperty('--leleo-brightness', this.configdata.brightness + '%')
        root.style.setProperty('--leleo-blur', this.configdata.blur + 'px')
      }
    },

    async initBackground() {
      const root = document.documentElement
      let leleodatabackground = this.getCookie('leleodatabackground')
      const bg = leleodatabackground || this.configdata.background
      const device = this.xs ? 'mobile' : 'pc'

      if (bg?.[device]?.type === 'pic') {
        const url = wallpaperUrl(bg[device].datainfo.url, device)
        root.style.setProperty('--leleo-background-image-url', `url('${url}')`)
        this.imageurl = url
      } else if (bg?.[device]?.type === 'video') {
        this.videosrc = bg[device].datainfo.url
      }

      // The wallpaper used to be awaited before the loading overlay came off,
      // with a 2.5s timeout. It is 690 KB behind a brightness filter — on a
      // phone that is several seconds of empty screen for a picture the visitor
      // can barely see through. It now gets a bounded head start and then the
      // desk appears regardless; the browser keeps painting it in as it arrives.
      const ready = this.imageurl ? this.preloadImage(this.imageurl) : this.videoReady()
      await Promise.race([ready, new Promise((r) => setTimeout(r, WALLPAPER_WAIT_MS))])
    },

    /** Resolve when the picture has decoded, or immediately if it fails. */
    preloadImage(url) {
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = resolve
        img.onerror = resolve
        img.src = url
      })
    },

    /** Same idea for a video wallpaper: metadata only, never the whole file. */
    videoReady() {
      const video = this.$refs.VdPlayer
      if (!video) return Promise.resolve()
      return new Promise((resolve) => {
        video.addEventListener('loadedmetadata', resolve, { once: true })
        video.addEventListener('error', resolve, { once: true })
      })
    },

    // Music (kept from original)
    async getMusicInfo() {
      this.musicinfoLoading = true
      try {
        const response = await fetch(`https://api.i-meto.com/meting/api?server=${this.configdata.musicPlayer.server}&type=${this.configdata.musicPlayer.type}&id=${this.configdata.musicPlayer.id}`)
        if (!response.ok) throw new Error('Network error')
        this.musicinfo = await response.json()
      } catch (error) {
        console.error('Music load failed:', error)
      } finally {
        // App.vue mounts tab-3 only when this flag is false (`v-if=
        // "item.value !== 'tab-3' || !musicinfoLoading"`), so leaving it
        // stuck on the error path meant a failed playlist call blanked the
        // music tab forever. Clear it either way.
        this.musicinfoLoading = false
      }
    },
    setupAudioListener() {
      this.$refs.audioPlayer?.addEventListener('ended', this.nextTrack)
    },
    togglePlay() {
      if (!this.isPlaying) {
        this.audioPlayer?.play()
      } else {
        this.audioPlayer?.pause()
      }
      this.isPlaying = !this.musicinfoLoading && !this.isPlaying
    },
    previousTrack() {
      this.playlistIndex = this.playlistIndex > 0 ? this.playlistIndex - 1 : (this.musicinfo?.length || 1) - 1
      this.updateAudio()
    },
    nextTrack() {
      this.playlistIndex = this.playlistIndex < (this.musicinfo?.length || 1) - 1 ? this.playlistIndex + 1 : 0
      this.updateAudio()
    },
    updateAudio() {
      if (this.audioPlayer && this.currentSong) {
        this.audioPlayer.src = this.currentSong.url
        this.isPlaying = true
        this.audioPlayer.play()
      }
    },
    updateCurrentIndex(index) { this.playlistIndex = index; this.updateAudio() },
    updateIsPlaying(isPlaying) { this.isPlaying = isPlaying },
    updateLyrics(lyrics) { this.lyrics = lyrics },
    onWaiting() { this.audioLoading = true },
    onCanPlay() { this.audioLoading = false },

    // UI actions
    openSettings() { this.dialogSettings = true },
    openThoughts() { window.location.href = '/thoughts.html' },
    openWallpaper() { this.tab = 'tab-2'; this.dialogSettings = true },
    openMusicPlayer() { this.tab = 'tab-3'; this.dialogSettings = true },
    toggleClearScreen() { this.isClearScreen = !this.isClearScreen },

    editDiary() { this.editingEntry = this.todayDiary; this.showDiaryEditor = true },
    addDiary() { this.editingEntry = null; this.showDiaryEditor = true },

    // Diary
    async loadTodayDiary() {
      // The diary API sits behind the owner gate, so for a visitor this request
      // is a guaranteed 401 — a full round trip (and a session check at the
      // edge) to learn something the browser can be told for free. The avatar
      // request already asks the server who we are; wait for that answer.
      await loadAvatar()
      if (!canEditAvatar()) {
        this.diaryLoading = false
        return
      }
      this.diaryLoading = true
      const today = new Date().toISOString().slice(0, 10)
      try {
        const res = await fetch(`/api/diary?date=${today}`)
        if (res.ok) {
          const data = await res.json()
          this.todayDiary = Array.isArray(data) ? (data[0] || null) : data
        }
      } catch (e) { /* ignore */ }
      this.diaryLoading = false
    },
  },
}
