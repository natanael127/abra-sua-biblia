import { copyTextToClipboard } from './feedback';

export interface ShareData {
    title: string;
    url: string;
}

/**
 * - `shared`: sent through the system share sheet;
 * - `cancelled`: the user closed the sheet without sharing;
 * - `copied`: without the Web Share API (or if it refuses), the link was copied.
 */
export type ShareResult = 'shared' | 'cancelled' | 'copied';

/**
 * Shares through the Web Share API (phones and some desktop browsers) and,
 * without it, copies the link. Rejects only if even copying fails.
 */
export async function shareLink({ title, url }: ShareData): Promise<ShareResult> {
    if ('share' in navigator) {
        try {
            // The text goes along with the link in apps that ignore the title (e.g. WhatsApp)
            await navigator.share({ title, text: title, url });
            return 'shared';
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return 'cancelled';
            }
            // Refused (no permission, unsupported data): copy the link
            console.warn('Web Share API unavailable, copying the link:', error);
        }
    }
    await copyTextToClipboard(url);
    return 'copied';
}
