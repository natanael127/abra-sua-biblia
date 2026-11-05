/**
 * Navigation between the reader (the Bible) and the other pages of the main
 * menu (help, about).
 *
 * A page is always one history entry above the reader, so that Back on any
 * page returns to the Bible:
 * - from the reader, opening a page creates an entry;
 * - from a page, opening another one replaces its entry;
 * - a page opened directly (link, new tab) gets an entry of the reader ("/",
 *   the last reading) behind it.
 * The entries of the pages are marked in `history.state`, which survives a
 * reload, so a reloaded page does not get a second reader entry.
 */
import { matchPath } from '../router/path';
import type { Router } from '../router/router';

/** Paths of the pages; the reader has all the others. */
export const PAGE_PATHS = { help: '/help', about: '/about' } as const;

export type PageId = keyof typeof PAGE_PATHS;
/** Destinations of the main menu. */
export type Destination = 'reader' | PageId;

const PAGE_STATE = { page: true } as const;

const isPageEntry = (state: unknown): boolean =>
    typeof state === 'object' && state !== null && (state as { page?: unknown }).page === true;

/** Page of the path, or undefined for the reader. */
export function pageAt(path: string): PageId | undefined {
    return (Object.keys(PAGE_PATHS) as PageId[]).find((page) => matchPath(PAGE_PATHS[page], path));
}

/** Call before the router starts: puts the reader behind a page opened directly. */
export function ensureReaderBehindPage(): void {
    const path = window.location.pathname;
    if (!pageAt(path) || isPageEntry(history.state)) return;
    history.replaceState(null, '', '/');
    history.pushState(PAGE_STATE, '', path);
}

/** Goes to a destination of the main menu. */
export function navigateTo(router: Router, destination: Destination): void {
    const onPage = pageAt(window.location.pathname) !== undefined;
    if (destination !== 'reader') {
        router.navigate(PAGE_PATHS[destination], { replace: onPage, state: PAGE_STATE });
    } else if (onPage) {
        // The reader is the entry behind the page
        if (isPageEntry(history.state)) {
            history.back();
        } else {
            router.navigate('/', { replace: true });
        }
    }
}
