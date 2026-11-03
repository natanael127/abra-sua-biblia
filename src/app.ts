/**
 * SPA shell: registers the screens and their routes. To add a screen, create
 * it in src/screens/ and add its route before the reader screen, whose pattern
 * (/:language?/...) accepts any first segment.
 */
import { initializeI18n } from './i18n';
import { createRouter, type Router } from './router/router';
import { createReaderScreen } from './screens/reader';
import { READER_PATTERN } from './screens/reader/url';
import { initializeLanguageSelect } from './ui/language-select';
import { initializeTheme } from './ui/theme';

export function startApp(): Router {
    initializeI18n();
    initializeTheme();
    initializeLanguageSelect();

    const router: Router = createRouter([{ pattern: READER_PATTERN, screen: createReaderScreen(() => router) }]);
    router.start();
    return router;
}
