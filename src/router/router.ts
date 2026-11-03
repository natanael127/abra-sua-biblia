/**
 * SPA router: connects the URL (History API) to the application screens.
 *
 * Each route associates a path pattern with a screen. The URL is the source of
 * truth for external navigations (page load, Back/Forward, internal links):
 * the router finds the route, shows its screen and hides the others. When the
 * screen itself changes state (e.g. the user types a reference), it only
 * records the new URL with `updateUrl`, without being shown again.
 */
import { matchPath, type PathParams } from './path';

export interface Screen {
    /** Root element of the screen; only the active screen's root is visible. */
    readonly root: HTMLElement;
    /** Shows the screen for the URL parameters; called on every navigation to one of its routes. */
    show(params: PathParams): void | Promise<void>;
    /** Called when navigation leaves this screen for another one. */
    hide?(): void;
}

export interface Route {
    /** E.g.: "/planos" or "/:language?/:bible?/:book?/:chapterVerses?". The first matching route wins. */
    pattern: string;
    screen: Screen;
}

export interface NavigateOptions {
    /** Replaces the current history entry instead of creating a new one. */
    replace?: boolean;
}

export interface Router {
    /** Shows the screen of the current URL and starts handling Back/Forward and internal links. */
    start(): void;
    /** Stops handling Back/Forward and internal links. */
    stop(): void;
    /** Goes to another path and shows the matching screen. */
    navigate(path: string, options?: NavigateOptions): void;
    /**
     * Records the screen's current state in the history, without showing it
     * again. Returns false (leaving the history untouched) if the path is
     * already the current one.
     */
    updateUrl(path: string, options?: NavigateOptions): boolean;
}

export interface RouterOptions {
    /** Path with no matching route; by default, goes to "/" replacing the entry. */
    notFound?: (path: string, router: Router) => void;
}

/** Normalizes the path like the browser does (encoding, slashes) so paths can be compared. */
const normalize = (path: string): string => new URL(path, window.location.origin).pathname;

export function createRouter(routes: readonly Route[], options: RouterOptions = {}): Router {
    let activeScreen: Screen | null = null;

    function resolve(): void {
        const path = window.location.pathname;
        for (const route of routes) {
            const params = matchPath(route.pattern, path);
            if (params) {
                activate(route.screen, params);
                return;
            }
        }
        if (options.notFound) {
            options.notFound(path, router);
        } else {
            router.navigate('/', { replace: true });
        }
    }

    function activate(screen: Screen, params: PathParams): void {
        if (screen !== activeScreen) {
            activeScreen?.hide?.();
            activeScreen = screen;
            for (const route of routes) {
                route.screen.root.hidden = route.screen !== screen;
            }
        }
        void screen.show(params);
    }

    function writeHistory(path: string, replace = false): boolean {
        const target = normalize(path);
        if (target === window.location.pathname && !window.location.search && !window.location.hash) {
            return false;
        }
        if (replace) {
            history.replaceState(null, '', target);
        } else {
            history.pushState(null, '', target);
        }
        return true;
    }

    /** Internal links (<a href="/...">) navigate within the SPA, without reloading the page. */
    function onClick(event: MouseEvent): void {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const target = event.target instanceof Element ? event.target : null;
        const link = target?.closest('a');
        if (!link?.href || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;

        const url = new URL(link.href);
        if (url.origin !== window.location.origin) return;
        if (!routes.some((route) => matchPath(route.pattern, url.pathname))) return;

        event.preventDefault();
        router.navigate(url.pathname);
    }

    const router: Router = {
        start() {
            window.addEventListener('popstate', resolve);
            document.addEventListener('click', onClick);
            resolve();
        },
        stop() {
            window.removeEventListener('popstate', resolve);
            document.removeEventListener('click', onClick);
        },
        navigate(path, { replace = false } = {}) {
            writeHistory(path, replace);
            resolve();
        },
        updateUrl(path, { replace = false } = {}) {
            return writeHistory(path, replace);
        },
    };
    return router;
}
