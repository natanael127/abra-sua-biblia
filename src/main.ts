import { registerSW } from 'virtual:pwa-register';
import './styles/style.css';
import { startApp } from './app';

startApp();

// O service worker se atualiza sozinho; a nova versão vale a partir da próxima carga
registerSW({ immediate: true });
