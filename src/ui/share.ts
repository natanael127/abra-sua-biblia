import { copyTextToClipboard } from './feedback';

export interface ShareData {
    title: string;
    url: string;
}

/**
 * - `shared`: enviado pela folha de compartilhamento do sistema;
 * - `cancelled`: o usuário fechou a folha sem compartilhar;
 * - `copied`: sem a Web Share API (ou se ela recusar), o link foi copiado.
 */
export type ShareResult = 'shared' | 'cancelled' | 'copied';

/**
 * Compartilha pela Web Share API (celulares e alguns navegadores de desktop)
 * e, sem ela, copia o link. Rejeita só se nem a cópia funcionar.
 */
export async function shareLink({ title, url }: ShareData): Promise<ShareResult> {
    if ('share' in navigator) {
        try {
            // O texto acompanha o link nos apps que ignoram o título (ex.: WhatsApp)
            await navigator.share({ title, text: title, url });
            return 'shared';
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return 'cancelled';
            }
            // Recusado (sem permissão, dados não suportados): copia o link
            console.warn('Web Share API indisponível, copiando o link:', error);
        }
    }
    await copyTextToClipboard(url);
    return 'copied';
}
