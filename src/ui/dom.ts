export function byId(id: string): HTMLElement;
export function byId<T extends HTMLElement>(id: string, type: new () => T): T;
export function byId(id: string, type: new () => HTMLElement = HTMLElement): HTMLElement {
    const element = document.getElementById(id);
    if (!(element instanceof type)) {
        throw new Error(`Elemento #${id} não encontrado ou de tipo inesperado`);
    }
    return element;
}
