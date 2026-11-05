/** Time the button stays highlighted after being clicked. */
const FEEDBACK_MS = 1000;

/**
 * Svelte action: visual feedback shared by all action buttons (highlighted
 * for a moment after the click).
 */
export function clickFeedback(button: HTMLElement): { destroy: () => void } {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onClick = () => {
        button.classList.add('success');
        clearTimeout(timer);
        timer = setTimeout(() => {
            button.classList.remove('success');
        }, FEEDBACK_MS);
    };
    button.addEventListener('click', onClick);
    return {
        destroy() {
            clearTimeout(timer);
            button.removeEventListener('click', onClick);
        },
    };
}
