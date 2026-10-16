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
        <ProfileCard :configdata="configdata" :formattedTime="formattedTime" :formattedDate="formattedDate" @edit-avatar="showAvatarEditor = true" />
        <DiaryCard :entry="todayDiary" :loading="diaryLoading" @edit="editDiary" @add="addDiary" />
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
      @activity="showActivity = true"
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
    <DiaryEditor v-if="showDiaryEditor" :existingEntry="editingEntry" @close="showDiaryEditor = false" @saved="loadTodayDiary" />
    <CalendarDialog v-if="showCalendar" @close="showCalendar = false" />
    <PhotoWall v-if="showPhotoWall" @close="showPhotoWall = false" />
    <ActivityTimeline v-if="showActivity" @close="showActivity = false" />

    <!-- Avatar cropper (owner only; the card only emits when the server said so) -->
    <AvatarEditor
      v-if="showAvatarEditor"
      :has-custom="!!avatarCustom"
      @close="showAvatarEditor = false"
      @saved="avatarCustom = $event"
    />

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
                @edit-avatar="openAvatarEditor"
                :fallback="item.value === 'tab-4' ? configdata.avatar : null"
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

/* Vuetify gives .v-application__wrap `min-height: 100vh`, but the app frame is
   inset (96.6% tall => 869px of a 900px viewport). 100vh therefore measured 31px
   TALLER than its own fixed parent and dragged .desk-canvas past the frame's
   bottom edge, where the music player sat on top of the card content.
   Sizing it to the parent instead keeps the desk inside the frame. */
.star-desk-app :deep(.v-application__wrap) {
  min-height: 100%;
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
  /* width:100% is required: `margin:0 auto` cancels the flex parent's
     align-items:stretch, so without it the desk shrink-wraps its content
     (measured 625px inside a 1440px viewport) and every % child collapses. */
  width: 100%;
  /* 76px top clears the fixed ControlBar (20+46=66). 76px bottom clears the
     fixed MiniMusicPlayer (its top edge sits 79px above the viewport bottom),
     which the column would otherwise run underneath.
     height:100% (not 100vh) because the app frame is inset ~1.7% top/bottom —
     100vh measured 30px taller than the frame and pushed the desk past its
     bottom edge (measured canvas bottom 915 in a 900px viewport). */
  padding: 76px 24px;
  max-width: 1240px; margin: 0 auto;
  height: 100%; box-sizing: border-box;
}
.desk-left {
  display: flex; flex-direction: column; gap: 16px;
  overflow-y: auto;
  padding-right: 4px;
}
.desk-right {
  /* A flex column, not a plain block: the projects card is told to fill this
     column so the wide right-hand side is not two-thirds empty (measured: a
     293px card floating in a 720px column, 427px of dead space). */
  flex: 1;
  display: flex; flex-direction: column; gap: 16px;
  overflow-y: auto;
  min-width: 0;
  padding-right: 4px;
}
.desk-right > * { flex: 1 1 auto; min-height: 0; }

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
    /* 100px bottom only reserved room for the music player; it actually sits
       12px off the bottom and is 59px tall, so 84px is enough and the last card
       no longer runs under it. */
    padding: 56px 10px 84px; height: auto; min-height: 100vh;
    overflow-y: auto;
  }
  .desk-left { width: 100% !important; overflow-y: visible; }
  /* The right column must not stretch on mobile: the page itself scrolls, so a
     stretched card would push the grid rows to ~155px each and add ~800px of
     mostly empty page (measured projects-card 875px tall for 5 tiles). */
  .desk-right {
    width: 100% !important; overflow-y: visible;
    flex: 0 0 auto;
  }
  .desk-right > * { flex: 0 0 auto; }
  .glass-card { backdrop-filter: none; -webkit-backdrop-filter: none; background: rgba(20, 18, 40, 0.7); }
}
</style>
