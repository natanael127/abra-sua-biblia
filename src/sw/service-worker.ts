/// <reference lib="webworker" />
/**
 * Service worker: permite usar o site offline sem atrasar atualizações.
 *
 * - JS e CSS gerados pelo build têm hash no nome (imutáveis): ficam em
 *   precache e são servidos do cache.
 * - Todo o resto (página, index.json, Bíblias, manifest) usa rede primeiro:
 *   o cache só é usado offline. A requisição com `cache: 'no-cache'` faz o
 *   servidor responder 304 quando nada mudou, sem reenviar as Bíblias.
 */
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, matchPrecache, precache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

/** Cache usado pelo service worker anterior à migração para Vite. */
const LEGACY_CACHE = 'abra-sua-biblia-v1';
const RUNTIME_CACHE = 'abra-sua-biblia-runtime';
const APP_SHELL = 'index.html';

void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

self.addEventListener('activate', (event) => {
    event.waitUntil(caches.delete(LEGACY_CACHE));
});

const manifest = self.__WB_MANIFEST;
const isAppShell = (entry: (typeof manifest)[number]) =>
    (typeof entry === 'string' ? entry : entry.url) === APP_SHELL;

// A página fica em precache apenas como reserva offline; não é servida pelo precache.
precache(manifest.filter(isAppShell));
precacheAndRoute(manifest.filter((entry) => !isAppShell(entry)));

const networkFirst = new NetworkFirst({
    cacheName: RUNTIME_CACHE,
    fetchOptions: { cache: 'no-cache' },
});

registerRoute(
    new NavigationRoute(async (options) => {
        try {
            return await networkFirst.handle(options);
        } catch {
            return (await matchPrecache(APP_SHELL)) ?? Response.error();
        }
    }),
);

registerRoute(
    ({ request, url }) => request.method === 'GET' && url.origin === self.location.origin,
    networkFirst,
);
