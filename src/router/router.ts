/**
 * Roteador da SPA: liga a URL (History API) às telas da aplicação.
 *
 * Cada rota associa um padrão de caminho a uma tela. A URL é a fonte da
 * verdade nas navegações externas (carga da página, Voltar/Avançar, links
 * internos): o roteador encontra a rota, exibe a tela dela e esconde as
 * demais. Quando a própria tela muda de estado (ex.: o usuário digita uma
 * referência), ela só registra a nova URL com `updateUrl`, sem ser
 * exibida de novo.
 */
import { matchPath, type PathParams } from './path';

export interface Screen {
    /** Elemento raiz da tela; só o da tela ativa fica visível. */
    readonly root: HTMLElement;
    /** Exibe a tela para os parâmetros da URL; chamado a cada navegação para uma rota dela. */
    show(params: PathParams): void | Promise<void>;
    /** Chamado quando a navegação sai desta tela para outra. */
    hide?(): void;
}

export interface Route {
    /** Ex.: "/planos" ou "/:bible?/:book?/:passage?". A primeira rota correspondente vence. */
    pattern: string;
    screen: Screen;
}

export interface NavigateOptions {
    /** Substitui a entrada atual do histórico em vez de criar outra. */
    replace?: boolean;
}

export interface Router {
    /** Exibe a tela da URL atual e passa a tratar Voltar/Avançar e links internos. */
    start(): void;
    /** Deixa de tratar Voltar/Avançar e links internos. */
    stop(): void;
    /** Vai para outro caminho e exibe a tela correspondente. */
    navigate(path: string, options?: NavigateOptions): void;
    /**
     * Registra no histórico o estado atual da tela, sem exibi-la de novo.
     * Retorna false (sem alterar o histórico) se o caminho já é o atual.
     */
    updateUrl(path: string, options?: NavigateOptions): boolean;
}

export interface RouterOptions {
    /** Caminho sem rota correspondente; o padrão é ir para "/" substituindo a entrada. */
    notFound?: (path: string, router: Router) => void;
}

/** Normaliza o caminho como o navegador (codificação, barras) para poder comparar. */
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

    /** Links internos (<a href="/...">) navegam pela SPA, sem recarregar a página. */
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
