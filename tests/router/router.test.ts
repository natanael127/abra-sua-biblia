// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PathParams } from '../../src/router/path';
import { createRouter, type Route, type Router, type Screen } from '../../src/router/router';

interface FakeScreen extends Screen {
    shown: PathParams[];
    hidden: number;
}

function fakeScreen(): FakeScreen {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const screen: FakeScreen = {
        root,
        shown: [],
        hidden: 0,
        show(params) {
            screen.shown.push(params);
        },
        hide() {
            screen.hidden++;
        },
    };
    return screen;
}

/** Waits for the popstate event fired by history.back()/forward() in jsdom. */
const waitPopstate = () =>
    new Promise<void>((resolve) => {
        window.addEventListener(
            'popstate',
            () => {
                resolve();
            },
            { once: true },
        );
    });

let plans: FakeScreen;
let reader: FakeScreen;
let routes: Route[];
const routers: Router[] = [];

function start(path: string, options?: Parameters<typeof createRouter>[1]): Router {
    history.replaceState(null, '', path);
    const router = createRouter(routes, options);
    routers.push(router);
    router.start();
    return router;
}

beforeEach(() => {
    plans = fakeScreen();
    reader = fakeScreen();
    routes = [
        { pattern: '/planos', screen: plans },
        { pattern: '/:bible?/:book?/:chapterVerses?', screen: reader },
    ];
});

afterEach(() => {
    document.body.replaceChildren();
    // Each test creates a router; the previous ones stop listening to events
    for (const router of routers.splice(0)) {
        router.stop();
    }
});

describe('createRouter', () => {
    it('shows the screen of the initial URL and hides the others', () => {
        start('/ave-maria/jo/3,16');
        expect(reader.shown).toEqual([{ bible: 'ave-maria', book: 'jo', chapterVerses: '3,16' }]);
        expect(reader.root.hidden).toBe(false);
        expect(plans.root.hidden).toBe(true);
    });

    it('the first matching route wins', () => {
        start('/planos');
        expect(plans.shown).toEqual([{}]);
        expect(reader.shown).toEqual([]);
        expect(plans.root.hidden).toBe(false);
        expect(reader.root.hidden).toBe(true);
    });

    it('navigate creates a history entry and switches screens', () => {
        const router = start('/ave-maria/jo/3');
        const length = history.length;

        router.navigate('/planos');
        expect(location.pathname).toBe('/planos');
        expect(history.length).toBe(length + 1);
        expect(reader.hidden).toBe(1);
        expect(plans.shown).toEqual([{}]);
        expect(reader.root.hidden).toBe(true);
    });

    it('navigate with replace replaces the current entry', () => {
        const router = start('/ave-maria/jo/3');
        const length = history.length;
        router.navigate('/cnbb/jo/3', { replace: true });
        expect(location.pathname).toBe('/cnbb/jo/3');
        expect(history.length).toBe(length);
        expect(reader.shown.at(-1)).toEqual({ bible: 'cnbb', book: 'jo', chapterVerses: '3' });
    });

    it('updateUrl records the URL without showing the screen again', () => {
        const router = start('/ave-maria/jo/3');
        const length = history.length;

        expect(router.updateUrl('/ave-maria/jo/4')).toBe(true);
        expect(router.updateUrl('/ave-maria/jo/5', { replace: true })).toBe(true);
        expect(location.pathname).toBe('/ave-maria/jo/5');
        expect(history.length).toBe(length + 1);
        expect(reader.shown).toHaveLength(1);
    });

    it('updateUrl ignores the current path, even with a different encoding', () => {
        const router = start('/cnbb/%C3%AAx/20');
        const length = history.length;
        expect(router.updateUrl('/cnbb/êx/20')).toBe(false);
        expect(history.length).toBe(length);
    });

    it('updateUrl discards the query and fragment of the current URL', () => {
        const router = start('/ave-maria?x=1#y');
        expect(router.updateUrl('/ave-maria', { replace: true })).toBe(true);
        expect(location.href).toBe(`${location.origin}/ave-maria`);
    });

    it('Back and Forward show the screen of the URL', async () => {
        const router = start('/ave-maria/jo/3');
        router.updateUrl('/ave-maria/jo/4');
        router.navigate('/planos');

        history.back();
        await waitPopstate();
        expect(location.pathname).toBe('/ave-maria/jo/4');
        expect(reader.shown.at(-1)).toEqual({ bible: 'ave-maria', book: 'jo', chapterVerses: '4' });
        expect(reader.root.hidden).toBe(false);
        expect(plans.hidden).toBe(1);

        history.forward();
        await waitPopstate();
        expect(plans.shown).toHaveLength(2);
    });

    it('path with no route goes to the start, replacing the entry', () => {
        const length = history.length;
        start('/a/b/c/d');
        expect(location.pathname).toBe('/');
        expect(history.length).toBe(length);
        expect(reader.shown).toEqual([{}]);
    });

    it('accepts custom handling for a path with no route', () => {
        const notFound = vi.fn();
        start('/a/b/c/d', { notFound });
        expect(notFound).toHaveBeenCalledWith('/a/b/c/d', expect.anything());
    });

    describe('internal links', () => {
        function click(href: string, init: MouseEventInit = {}, attributes: Record<string, string> = {}) {
            const link = document.createElement('a');
            link.href = href;
            for (const [name, value] of Object.entries(attributes)) link.setAttribute(name, value);
            const child = document.createElement('span');
            link.appendChild(child);
            document.body.appendChild(link);
            const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
            // Records the router's decision and keeps jsdom from following the link
            let handledByRouter = false;
            window.addEventListener(
                'click',
                (e) => {
                    handledByRouter = e.defaultPrevented;
                    e.preventDefault();
                },
                { once: true },
            );
            child.dispatchEvent(event);
            return handledByRouter;
        }

        it('navigate within the SPA without reloading the page', () => {
            start('/ave-maria/jo/3');
            const handled = click('/planos');
            expect(handled).toBe(true);
            expect(location.pathname).toBe('/planos');
            expect(plans.shown).toHaveLength(1);
        });

        it('are left to the browser when they are not internal navigation', () => {
            start('/planos');
            const cases: [string, MouseEventInit?, Record<string, string>?][] = [
                ['https://example.com/planos'],
                ['/ave-maria', { ctrlKey: true }],
                ['/ave-maria', { button: 1 }],
                ['/ave-maria', {}, { target: '_blank' }],
                ['/ave-maria', {}, { download: '' }],
                ['/a/b/c/d'],
            ];
            for (const [href, init, attributes] of cases) {
                expect(click(href, init, attributes), href).toBe(false);
            }
            expect(location.pathname).toBe('/planos');
        });
    });
});
