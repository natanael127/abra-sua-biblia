export function byId(id: string): HTMLElement;
export function byId<T extends HTMLElement>(id: string, type: new () => T): T;
export function byId(id: string, type: new () => HTMLElement = HTMLElement): HTMLElement {
    const element = document.getElementById(id);
    if (!(element instanceof type)) {
        throw new Error(`Element #${id} not found or of unexpected type`);
    }
    return element;
}
