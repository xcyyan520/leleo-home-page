import ProfileCard from './components/ProfileCard.vue'
import DiaryCard from './components/DiaryCard.vue'
import DiaryEditor from './components/DiaryEditor.vue'
import CalendarDialog from './components/CalendarDialog.vue'
import PhotoWall from './components/PhotoWall.vue'
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

import config from './config.js'
import { getCookie } from './utils/cookieUtils.js'
import { setMeta, getFormattedTime, getFormattedDate, dataConsole } from './utils/common.js'
import { useDisplay } from 'vuetify'

export default {
  components: {
    ProfileCard, DiaryCard, DiaryEditor, CalendarDialog, PhotoWall,
    TagsCard, ProjectsCard, ControlBar, MiniMusicPlayer,
    StarfieldBackground, typewriter, loader, tab1, tab2, tab3,
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
      ],
      // Diary
      showDiaryEditor: false,
      showCalendar: false,
      showPhotoWall: false,
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
      return this.xs ? {} : { width: '36%' }
    },
    deskRightStyle() {
      return this.xs ? {} : { width: '52%', marginTop: '0' }
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

    // Load wallpaper + wait for it
    await this.initBackground()
    this.formattedTime = this.getFormattedTime(new Date())
    this.formattedDate = this.getFormattedDate(new Date())
    setTimeout(() => { this.isloading = false }, 500)

    setInterval(() => {
      this.formattedTime = this.getFormattedTime(new Date())
    }, 1000)

    await this.getMusicInfo()
    this.setupAudioListener()
    await this.loadTodayDiary()
  },
  beforeDestroy() {
    this.$refs.audioPlayer?.removeEventListener('ended', this.nextTrack)
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
        root.style.setProperty('--leleo-background-image-url', `url('${bg[device].datainfo.url}')`)
        this.imageurl = bg[device].datainfo.url
      } else if (bg?.[device]?.type === 'video') {
        this.videosrc = bg[device].datainfo.url
      }

      // Wait for background to load
      if (this.imageurl) {
        await new Promise((resolve) => {
          const img = new Image()
          img.onload = resolve
          img.onerror = resolve
          img.src = this.imageurl
          setTimeout(resolve, 2500)
        })
      } else if (this.videosrc) {
        await new Promise((resolve) => {
          const video = this.$refs.VdPlayer
          if (video) {
            video.onloadedmetadata = () => setTimeout(resolve, 200)
            video.onerror = resolve
          }
          setTimeout(resolve, 2500)
        })
      }
    },

    // Music (kept from original)
    async getMusicInfo() {
      this.musicinfoLoading = true
      try {
        const response = await fetch(`https://api.i-meto.com/meting/api?server=${this.configdata.musicPlayer.server}&type=${this.configdata.musicPlayer.type}&id=${this.configdata.musicPlayer.id}`)
        if (!response.ok) throw new Error('Network error')
        this.musicinfo = await response.json()
        this.musicinfoLoading = false
      } catch (error) {
        console.error('Music load failed:', error)
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
