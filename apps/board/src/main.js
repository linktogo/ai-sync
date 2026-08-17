import { createApp } from 'vue';
import App from './App.vue';
import { createBoardRouter } from './router.js';
import { initLocale } from './i18n.js';
import './style.css';

initLocale();

const app = createApp(App);
app.use(createBoardRouter());
app.mount('#app');
