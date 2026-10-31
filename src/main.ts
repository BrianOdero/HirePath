// Import debug loader first to catch early errors
import './debug-loader';

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router';

import { IonicVue } from '@ionic/vue';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/**
 * Theme is managed manually (light / dark / system) via the theme store.
 * Dark palette CSS from Ionic is intentionally not imported; see src/theme/variables.css.
 */

/* Theme variables */
import './theme/variables.css';

import { useThemeStore } from '@/core/stores/useThemeStore';

const app = createApp(App)
  .use(IonicVue)
  .use(createPinia())
  .use(VueQueryPlugin)
  .use(router);

/** Apply the saved theme before mounting so dark-mode users see no light flash. */
router.isReady().then(async () => {
  try {
    console.log('Router ready, initializing theme...');
    await useThemeStore().init();
    console.log('Theme initialized, mounting app...');
    app.mount('#app');
    console.log('App mounted successfully!');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    // Show error in DOM since console might not be visible in production
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif;">
        <h2 style="color: red;">App Initialization Error</h2>
        <p>${error instanceof Error ? error.message : String(error)}</p>
        <pre style="background: #f5f5f5; padding: 10px; overflow: auto;">${error instanceof Error ? error.stack : ''}</pre>
      </div>
    `;
  }
}).catch(error => {
  console.error('Router failed to initialize:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: sans-serif;">
      <h2 style="color: red;">Router Initialization Error</h2>
      <p>${error instanceof Error ? error.message : String(error)}</p>
      <pre style="background: #f5f5f5; padding: 10px; overflow: auto;">${error instanceof Error ? error.stack : ''}</pre>
    </div>
  `;
});
