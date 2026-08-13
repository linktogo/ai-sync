import { createApp } from 'vue';
import App from './App.vue';
import { createBoardRouter } from './router.js';
import './style.css';

const app = createApp(App);
app.use(createBoardRouter());
app.mount('#app');
