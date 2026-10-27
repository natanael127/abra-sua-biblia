/**
 * Casca da SPA: registra as telas e suas rotas. Para uma tela nova, crie-a em
 * src/screens/ e inclua a rota antes da tela de leitura, cujo padrão
 * (/:bible?/...) aceita qualquer primeiro segmento.
 */
import { createRouter, type Router } from './router/router';
import { createReaderScreen } from './screens/reader';
import { READER_PATTERN } from './screens/reader/url';
import { initializeTheme } from './ui/theme';

export function startApp(): Router {
    initializeTheme();

    const router: Router = createRouter([{ pattern: READER_PATTERN, screen: createReaderScreen(() => router) }]);
    router.start();
    return router;
}
