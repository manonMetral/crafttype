import { createApp } from 'vue';
import { createApi } from './api';
import App from './App.vue';
import { readToken } from './auth';
import './styles/theme.css';

const token = readToken(window.location, window.sessionStorage, window.history);
createApp(App, { api: token === undefined ? undefined : createApi(token) }).mount('#app');
