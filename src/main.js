import { createApp } from 'vue'
import App from './App.vue'

// Vuetify — register only the components/directives this app actually renders.
// Importing 'vuetify/components' pulls in all ~90 components (data tables,
// date pickers, steppers, …) and adds hundreds of KB of unexecuted code.
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import {
  VApp,
  VAvatar,
  VBtn,
  VCard,
  VCardActions,
  VCol,
  VColorPicker,
  VContainer,
  VDialog,
  VDivider,
  VForm,
  VIcon,
  VImg,
  VList,
  VListItem,
  VMenu,
  VPagination,
  VProgressCircular,
  VRadioGroup,
  VRow,
  VSlider,
  VSnackbar,
  VSpacer,
  VTab,
  VTabs,
  VTabsWindowItem,
  VTextField,
} from 'vuetify/components'
import { Ripple } from 'vuetify/directives'

// Icon font subset to the 58 glyphs in use (~3.5 KB vs 403 KB upstream).
import './styles/mdi-subset.css'

const components = {
  VApp, VAvatar, VBtn, VCard, VCardActions, VCol, VColorPicker, VContainer,
  VDialog, VDivider, VForm, VIcon, VImg, VList, VListItem, VMenu, VPagination,
  VProgressCircular, VRadioGroup, VRow, VSlider, VSnackbar, VSpacer, VTab,
  VTabs, VTabsWindowItem, VTextField,
}
const directives = { Ripple }

const vuetify = createVuetify({
    components,
    directives,
    icons: {
        defaultSet: 'mdi', // 这已经是默认值-仅用于显示目的 
    },
    defaults: {
        VCard: {
            variant: 'tonal',
        },
    },
})
const app = createApp(App);
app.config.warnHandler = () => {};
app.use(vuetify).mount('#app')

// Tell the visitor history that someone already introduced came back. The
// gateway only asks a stranger for her name; a returning guest walks straight
// in, so this quiet ping is the only thing that records her return. Failures
// are swallowed on purpose — a visit is never worth breaking the page for.
if (!location.pathname.startsWith('/welcome')) {
  fetch('/api/visitor/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: location.pathname }),
    keepalive: true,
  }).catch(() => {})
}

