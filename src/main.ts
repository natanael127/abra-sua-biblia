import { registerSW } from 'virtual:pwa-register';
import './styles/style.css';
import { startApp } from './app';

startApp();

// The service worker updates itself; the new version takes effect on the next load
registerSW({ immediate: true });
