export function byId(id: string): HTMLElement;
export function byId<T extends HTMLElement>(id: string, type: new () => T): T;
export function byId(id: string, type: new () => HTMLElement = HTMLElement): HTMLElement {
    const element = document.getElementById(id);
    if (!(element instanceof type)) {
        throw new Error(`Elemento #${id} não encontrado ou de tipo inesperado`);
    }
    return element;
}

export function debounce<A extends unknown[]>(func: (...args: A) => void, timeout = 500): (...args: A) => void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return (...args: A) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func(...args);
        }, timeout);
    };
}
