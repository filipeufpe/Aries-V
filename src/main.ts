import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/index.css'
import Vue3Toastify, { type ToastContainerOptions } from 'vue3-toastify'
import '../node_modules/vue3-toastify/dist/index.css'

const app = createApp(App)

app.use(createPinia())
app.use(Vue3Toastify, {
  autoClose: 3000,
  position: 'top-center',
  theme: 'colored'
} as ToastContainerOptions)

app.mount('#app')
