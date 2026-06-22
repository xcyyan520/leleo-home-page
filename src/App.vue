<template>
  <v-app class="star-desk-app vapp-fullscreen-background" :class="{ 'radius-before': !xs }" style="overflow: hidden;" :style="appFrameStyle">
    <!-- Loading overlay -->
    <transition name="fade">
      <div class="loading" v-show="isloading">
        <loader></loader>
      </div>
    </transition>

    <!-- Wallpaper layer (kept from original) -->
    <video v-if="videosrc" autoplay loop muted class="video-bg" ref="VdPlayer"
      :style="appFrameStyle">
      <source :src="videosrc" type="video/mp4">
    </video>

    <!-- Starfield background -->
    <StarfieldBackground v-if="!videosrc && !imageurl" />

    <!-- Main canvas -->
    <div v-show="!isloading && !isClearScreen" class="desk-canvas">
      <div class="desk-left" :style="deskLeftStyle">
        <ProfileCard :configdata="configdata" :formattedTime="formattedTime" :formattedDate="formattedDate" />
        <DiaryCard :entry="todayDiary" :loading="diaryLoading" @edit="showDiaryEditor = true" />
        <TagsCard :tags="personalizedtags" :socialIcons="socialPlatformIcons" />
      </div>
      <div class="desk-right" :style="deskRightStyle">
        <ProjectsCard :projects="projectcards" />
      </div>
    </div>

    <!-- Fixed UI -->
    <ControlBar
      :isClearScreen="isClearScreen"
      @settings="openSettings"
      @thoughts="openThoughts"
      @wallpaper="openWallpaper"
      @clearscreen="toggleClearScreen"
      @calendar="showCalendar = true"
      @photos="showPhotoWall = true"
    />

    <MiniMusicPlayer
      v-show="!isloading"
      :song="currentSong"
      :isPlaying="isPlaying"
      :audioLoading="audioLoading"
      @play="togglePlay"
      @prev="previousTrack"
      @next="nextTrack"
      @expand="openMusicPlayer"
    />

    <!-- Hidden audio element -->
    <audio v-show="false" ref="audioPlayer" :src="musicinfo?.[playlistIndex]?.url"
      @waiting="onWaiting" @canplay="onCanPlay">
    </audio>

    <!-- Diary dialogs -->
    <DiaryEditor v-if="showDiaryEditor" :existingEntry="todayDiary" @close="showDiaryEditor = false" @saved="loadTodayDiary" />
    <CalendarDialog v-if="showCalendar" @close="showCalendar = false" />
    <PhotoWall v-if="showPhotoWall" @close="showPhotoWall = false" />

    <!-- Settings dialog (kept from original, with tabs) -->
    <v-dialog v-model="dialogSettings" width="1000">
      <v-card elevation="3" style="backdrop-filter: blur(10px); background: rgba(20,18,30,0.95);">
        <v-tabs v-model="tab" :items="settingTabs" align-tabs="center" height="60" slider-color="rgba(139,122,170,0.5)">
          <template v-slot:tab="{ item }">
            <v-tab :prepend-icon="item.icon" :text="item.text" :value="item.value" class="text-none"></v-tab>
          </template>
          <template v-slot:item="{ item }">
            <v-tabs-window-item :value="item.value" class="pa-4">
              <component v-if="item.value !== 'tab-3' || !musicinfoLoading" :is="item.component"
                @cancel="dialogSettings = false"
                :musicinfo="item.value === 'tab-3' ? musicinfo : []"
                :currentIndex="item.value === 'tab-3' ? playlistIndex : null"
                :isPlaying="item.value === 'tab-3' ? isPlaying : null"
                :audioPlayer="item.value === 'tab-3' ? audioPlayer : null"
                :fromLyrics="item.value === 'tab-3' ? lyrics : null"
                :audioLoading="item.value === 'tab-3' ? audioLoading : null"
                @update:current-index="updateCurrentIndex"
                @update:is-playing="updateIsPlaying"
                @update:current-lyrics="updateLyrics"
              ></component>
            </v-tabs-window-item>
          </template>
        </v-tabs>
      </v-card>
    </v-dialog>

    <!-- About dialog (kept from original) -->
    <v-dialog v-model="dialogAbout" width="700">
      <v-card class="ma-3 pa-2" variant="tonal" rounded="lg" style="text-align: center; backdrop-filter: blur(10px);">
        <template v-slot:title><span class="leleo-card-title">关于</span></template>
        <div style="display: flex; flex-direction: column; align-items: center;">
          <p class="ma-6">
            <span v-for="item in configdata.statement">{{ item }}<br></span>
          </p>
        </div>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script src="./app.js"></script>
<style scoped>
@import url(/css/app.less);
@import url(/css/mobile.less);

.star-desk-app {
  background: #08081a;
}

/* Wallpaper */
.video-bg {
  position: fixed; object-fit: cover; z-index: -100;
  border-radius: 16px;
}

/* Glass card base (used by child components) */
.glass-card {
  background: rgba(20, 18, 40, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  transition: border-color 0.3s;
}
.glass-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

/* Canvas layout */
.desk-canvas {
  position: relative; z-index: 1;
  display: flex; gap: 24px;
  padding: 80px 24px 100px;
  max-width: 1300px; margin: 0 auto;
  height: 100vh; box-sizing: border-box;
}
.desk-left {
  display: flex; flex-direction: column; gap: 16px;
  overflow-y: auto;
  padding-right: 4px;
  min-width: 0;
}
.desk-right {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

/* Loading */
.loading {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: center; justify-content: center;
  background: #08081a;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.6s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Mobile */
@media (max-width: 767px) {
  .desk-canvas {
    flex-direction: column; gap: 12px;
    padding: 56px 10px 100px; height: auto; min-height: 100vh;
    overflow-y: auto;
  }
  .desk-left { width: 100% !important; overflow-y: visible; }
  .desk-right { width: 100% !important; overflow-y: visible; }
  .glass-card { backdrop-filter: none; -webkit-backdrop-filter: none; background: rgba(20, 18, 40, 0.7); }
}
</style>
