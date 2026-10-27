import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { readerPath } from '../src/screens/reader/url';

const FIXTURES = 'tests/fixtures/xml';

/** Abre a página com a Bíblia e a referência informadas e espera a Bíblia carregar. */
async function open(page: Page, quote = 'Jo 3,16', bible = 'ave-maria') {
    await page.goto(readerPath(bible, quote));
    await expect(page.locator('#bible-select')).toHaveValue(bible);
    await waitForBible(page);
}

/** A lista de livros só é preenchida depois que a Bíblia termina de carregar. */
async function waitForBible(page: Page) {
    await expect(page.locator('.book-item').first()).toBeAttached();
}

const result = (page: Page) => page.locator('#result');
const reference = (page: Page) => page.locator('#reference');

test('exibe a referência do link compartilhado', async ({ page }) => {
    await open(page, 'Jo 3,16');
    await expect(result(page).locator('.reference')).toHaveText('João 3 (Ave-Maria)');
    await expect(result(page).locator('.verse-text')).toContainText('Deus amou o mundo');
    await expect(result(page).locator('.verse-reference')).toHaveText('(Jo 3,16)');
});

test('primeira visita abre a Bíblia padrão do índice', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#bible-select')).toHaveValue('ave-maria');
    await waitForBible(page);
    await expect(page).toHaveURL('/ave-maria');
});

test('atualiza o resultado enquanto digita', async ({ page }) => {
    await open(page);
    await reference(page).fill('Mt 5,3-5');
    await expect(result(page).locator('.verse-reference')).toHaveText('(Mt 5,3-5)');
    await expect(result(page).locator('sup')).toHaveText(['3', '4', '5']);
});

test('referência inválida mostra as instruções e esconde as ações', async ({ page }) => {
    await open(page);
    await reference(page).fill('Mt');
    await expect(result(page)).toContainText('Digite a referência bíblica');
    await expect(page.locator('#copy-button')).toBeHidden();
});

test('nome de livro com HTML não é interpretado (XSS)', async ({ page }) => {
    let dialogOpened = false;
    page.on('dialog', (dialog) => {
        dialogOpened = true;
        void dialog.dismiss();
    });
    await open(page, '<img/src=x/onerror=alert(1)> 1');
    await expect(result(page)).toContainText('Livro "<img/src=x/onerror=alert(1)>" não encontrado.');
    await expect(result(page).locator('img')).toHaveCount(0);
    expect(dialogOpened).toBe(false);
});

test('botões de formatação alteram o texto e são lembrados', async ({ page }) => {
    await open(page, 'Jo 3,16-17');
    await expect(result(page).locator('sup')).toHaveCount(2);

    await page.locator('#display-verse-numbers').click();
    await page.locator('#display-quotes').click();
    await expect(result(page).locator('sup')).toHaveCount(0);
    await expect(result(page).locator('.verse-text')).toContainText('"Com efeito');

    await page.reload();
    await expect(page.locator('#display-verse-numbers')).not.toHaveClass(/active/);
    await expect(page.locator('#display-quotes')).toHaveClass(/active/);
    await expect(result(page).locator('sup')).toHaveCount(0);
});

test('navega entre capítulos', async ({ page }) => {
    await open(page, 'Gn 1,3');
    await page.locator('#next-chapter-button').click();
    await expect(reference(page)).toHaveValue('Gn 2');
    await expect(result(page).locator('.reference')).toHaveText('Gênesis 2 (Ave-Maria)');

    await page.locator('#prev-chapter-button').click();
    await page.locator('#prev-chapter-button').click();
    await expect(reference(page)).toHaveValue('Gn 1');
});

test('lista de livros abre o primeiro capítulo', async ({ page }) => {
    await open(page);
    await page.locator('.book-section .expandable-header').click();
    await expect(page.locator('.book-section .expandable-header')).toContainText('Livros (73)');
    await page.locator('.book-item', { hasText: /^Ap$/ }).click();
    await expect(reference(page)).toHaveValue('Ap 1');
    await expect(result(page).locator('.reference')).toHaveText('Apocalipse 1 (Ave-Maria)');
});

test('troca de tradução mantém a referência', async ({ page }) => {
    // Carrega três Bíblias completas (~8 MB cada)
    test.slow();
    await open(page, 'Sl 23,1');
    await page.locator('#bible-select').selectOption('Edição Pastoral');
    await expect(result(page).locator('.reference')).toContainText('(Edição Pastoral)');
    await expect(reference(page)).toHaveValue('Sl 23,1');

    // Na raiz, vale a preferência salva
    await page.goto('/');
    await expect(page.locator('#bible-select')).toHaveValue('pastoral');
    await expect(reference(page)).toHaveValue('Sl 23,1');
});

test('histórico registra as buscas e permite voltar a elas', async ({ page }) => {
    await open(page, 'Jo 3,16');
    await reference(page).fill('Rm 8,28');
    await expect(result(page).locator('.verse-reference')).toHaveText('(Rm 8,28)');

    await page.locator('#history-button').click();
    const modal = page.locator('#history-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.history-list-item')).toHaveText(['Rm 8,28', 'Jo 3,16']);

    await modal.locator('.history-list-item', { hasText: 'Jo 3,16' }).click();
    await expect(modal).toBeHidden();
    await expect(reference(page)).toHaveValue('Jo 3,16');
});

test('busca textual com navegação por teclado', async ({ page }) => {
    await open(page);
    await page.locator('#text-search-button').click();
    const modal = page.locator('#text-search-modal');
    const input = modal.locator('.text-search-input');
    await expect(input).toBeFocused();

    await input.fill('bem-aventurados os mansos');
    await expect(modal.locator('.text-search-count')).toHaveText('1 resultado');
    await expect(modal.locator('mark')).toHaveText('Bem-aventurados os mansos');

    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(modal).toBeHidden();
    await expect(reference(page)).toHaveValue('Mt 5,5');
});

/** Espera o índice da busca por relevância (montado em segundo plano após a carga da Bíblia). */
async function waitForRankedSearch(page: Page) {
    await expect(page.locator('#text-search-modal .text-search-status')).toHaveAttribute('data-ranked', 'true', {
        timeout: 30_000,
    });
}

test('busca textual ignora acentos e destaca o texto original', async ({ page }) => {
    await open(page);
    await page.locator('#text-search-button').click();
    const modal = page.locator('#text-search-modal');
    await waitForRankedSearch(page);
    await modal.locator('.text-search-input').fill('puros de coracao');
    await expect(modal.locator('.text-search-result-citation').first()).toHaveText('Mateus 5,8');
    await expect(modal.locator('.text-search-result-item').first().locator('mark')).toHaveText('puros de coração');
});

test('busca por relevância: frase exata primeiro, prefixo e erro de digitação', async ({ page }) => {
    await open(page);
    await page.locator('#text-search-button').click();
    const modal = page.locator('#text-search-modal');
    const input = modal.locator('.text-search-input');
    await waitForRankedSearch(page);
    await expect(modal.locator('.text-search-status')).toHaveText('Por relevância');

    await input.fill('Deus amou o mundo');
    await expect(modal.locator('.text-search-result-citation').first()).toHaveText('João 3,16');

    // "pastr": erro de digitação; "bo": prefixo da última palavra
    await input.fill('pastr bo');
    await expect(modal.locator('.text-search-result-citation', { hasText: /^João 10,11$/ })).toHaveCount(1);
});

test('ao reabrir a busca com o índice pronto, mostra a ordem por relevância', async ({ page }) => {
    await open(page);
    await page.locator('#text-search-button').click();
    await waitForRankedSearch(page);
    await page.keyboard.press('Escape');

    await page.locator('#text-search-button').click();
    const status = page.locator('#text-search-modal .text-search-status');
    await expect(status).toHaveAttribute('data-ranked', 'true');
    await expect(status).toHaveText('Por relevância');
});

test('a busca aberta é refeita por relevância quando o índice fica pronto', async ({ page }) => {
    test.slow();
    await open(page);
    await page.locator('#text-search-button').click();
    const modal = page.locator('#text-search-modal');
    // Logo após a carga, o índice ainda pode estar em preparo: a busca por trecho acha só a frase
    await modal.locator('.text-search-input').fill('puros de coracao');
    await expect(modal.locator('.text-search-result-citation').first()).toHaveText('Mateus 5,8');

    // Sem digitar de novo, os resultados passam a incluir os versículos com os termos separados
    await waitForRankedSearch(page);
    await expect(modal.locator('.text-search-result-item')).not.toHaveCount(1);
    await expect(modal.locator('.text-search-result-citation').first()).toHaveText('Mateus 5,8');
});

test('modais fecham com Esc e com clique fora', async ({ page }) => {
    await open(page);
    const modal = page.locator('#reference-help-modal');

    await page.locator('#reference-help-button').click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    await page.locator('#reference-help-button').click();
    await expect(modal).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(modal).toBeHidden();
});

test('tema alterna entre automático, claro e escuro e é lembrado', async ({ page }) => {
    await open(page);
    const html = page.locator('html');
    const button = page.locator('#theme-button');

    await expect(button).toHaveAttribute('title', 'Tema: Automático');
    await button.click();
    await expect(button).toHaveAttribute('title', 'Tema: Claro');
    await expect(html).not.toHaveAttribute('data-theme');
    await button.click();
    await expect(button).toHaveAttribute('title', 'Tema: Escuro');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
});

test.describe('área de transferência', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

    test('copia o texto exibido', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await page.locator('#copy-button').click();
        await expect(page.locator('.temporary-message')).toHaveText('Texto copiado');
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        expect(copied).toMatch(/^16 Com efeito, de tal modo Deus amou o mundo.*vida eterna\.\n\(Jo 3,16\)\n$/);
    });

    test('sem a Clipboard API, copia pelo método alternativo', async ({ page, context }) => {
        // Como em navegadores antigos ou fora de contexto seguro
        await context.addInitScript(() => {
            Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined });
        });
        await open(page, 'Jo 3,16');
        await page.locator('#copy-button').click();
        await expect(page.locator('.temporary-message')).toHaveText('Texto copiado');
    });

    test('compartilha um link que reabre a mesma referência', async ({ page, baseURL }) => {
        await open(page, 'Jo 3,16');
        await page.locator('#share-button').click();
        await expect(page.locator('.temporary-message')).toHaveText('Link copiado');
        const link = await page.evaluate(() => navigator.clipboard.readText());
        expect(link).toBe(`${baseURL}/ave-maria/jo/3,16`);

        await page.goto(link);
        await expect(result(page).locator('.verse-reference')).toHaveText('(Jo 3,16)');
    });
});

test.describe('upload de Bíblia', () => {
    async function chooseUpload(page: Page) {
        await open(page);
        await page.locator('#bible-select').selectOption('upload');
        await expect(page.locator('#bible-file')).toBeVisible();
        // Sem o arquivo, a referência fica na URL; o livro só existe nas Bíblias de teste
        await expect(page).toHaveURL('/upload/jo/3,16');
        await reference(page).fill('Gen 1,1-2');
        await expect(page).toHaveURL('/upload/gen/1,1-2');
    }

    test('converte OSIS e permite baixar o EBF1', async ({ page }) => {
        await chooseUpload(page);
        await page.locator('#bible-file').setInputFiles(`${FIXTURES}/sample.osis.xml`);
        await expect(result(page).locator('.reference')).toHaveText('Gen 1 (Bíblia de Teste)');
        await expect(page.locator('.book-section .expandable-header')).toContainText('Livros (3)');
        await expect(page).toHaveURL('/upload/gen/1,1-2');

        const downloadPromise = page.waitForEvent('download');
        await page.locator('#download-ebf-button').click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('sample.osis.ebf1.json');
        const content = JSON.parse(readFileSync(await download.path(), 'utf8')) as unknown;
        const legacy = JSON.parse(readFileSync(`${FIXTURES}/legacy-expected.json`, 'utf8')) as Record<
            string,
            { ok: { bible: { name: string; books: unknown[] } } }
        >;
        const { name, books } = legacy['sample.osis.xml']!.ok.bible;
        expect(content).toEqual({ bible: { name, language: 'por', books } });
    });

    test('aceita EBF1 em JSON', async ({ page }) => {
        await chooseUpload(page);
        const ebf = { bible: { name: 'Minha', books: [{ names: ['Gen'], abbreviation: 'Gen', chapters: [{ verses: ['A', 'B'] }] }] } };
        await page.locator('#bible-file').setInputFiles({
            name: 'minha.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(ebf)),
        });
        await expect(result(page).locator('.verse-text')).toContainText('A');
        await expect(result(page).locator('.reference')).toHaveText('Gen 1 (Minha)');
    });

    test('recusa JSON que não é EBF1', async ({ page }) => {
        await chooseUpload(page);
        await page.locator('#bible-file').setInputFiles({
            name: 'outro.json',
            mimeType: 'application/json',
            buffer: Buffer.from('{"livros": []}'),
        });
        await expect(page.locator('.temporary-message')).toHaveText('Arquivo de Bíblia inválido');
        await expect(page.locator('#download-ebf-button')).toBeDisabled();
    });
});

test('carrega a aplicação com um único JS e um único CSS', async ({ page }) => {
    const assets: string[] = [];
    page.on('request', (request) => {
        if (['script', 'stylesheet'].includes(request.resourceType()) && request.url().includes('/assets/')) {
            assets.push(new URL(request.url()).pathname);
        }
    });
    await open(page);
    expect(assets.filter((path) => path.endsWith('.js'))).toHaveLength(1);
    expect(assets.filter((path) => path.endsWith('.css'))).toHaveLength(1);
});

test('não faz requisições a outros domínios (sem analytics)', async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on('request', (request) => {
        if (!request.url().startsWith(baseURL!)) external.push(request.url());
    });
    await open(page, 'Jo 3,16');
    await reference(page).fill('Mt 5,3-12');
    await expect(page).toHaveURL('/ave-maria/mt/5,3-12');
    expect(external).toEqual([]);

    const scripts = await page.locator('script').evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('src') ?? element.textContent),
    );
    expect(scripts.join('\n')).not.toMatch(/gtag|googletagmanager|dataLayer/);
});

test('script inline minificado aplica o tema salvo antes do bundle', async ({ page, context }) => {
    await context.addInitScript(() => {
        localStorage.setItem('selectedTheme', 'dark');
    });
    // Sem o bundle da aplicação, só o script inline do index.html pode aplicar o tema
    await page.route(/\/assets\/index-[^/]*\.js$/, (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#theme-icon')).toHaveText('🌓');
});

test('seção Sobre termina com a versão do build (hash do commit)', async ({ page }) => {
    await open(page);
    await page.locator('#about-footer .expandable-header').click();
    const version = page.locator('#about-footer .expandable-content > :last-child');
    await expect(version).toHaveId('build-version');
    await expect(version).toHaveText(/^Versão da página: [0-9a-f]{7}(-dirty)?$/);
    await expect(version).toHaveCSS('font-style', 'italic');

    const sizes = await version.evaluate((element) => {
        const content = element.closest('.expandable-content')!;
        // Espera a animação de abertura da seção terminar
        return new Promise<{ version: number; text: number; bottom: number; limit: number }>((resolve) => {
            setTimeout(() => {
                resolve({
                    version: parseFloat(getComputedStyle(element).fontSize),
                    text: parseFloat(getComputedStyle(content).fontSize),
                    bottom: element.getBoundingClientRect().bottom,
                    limit: content.getBoundingClientRect().bottom,
                });
            }, 500);
        });
    });
    expect(sizes.version).toBeLessThan(sizes.text);
    // A seção tem altura máxima com overflow oculto: a versão não pode ficar cortada
    expect(sizes.bottom).toBeLessThanOrEqual(sizes.limit);
});

test('Bíblias são publicadas sem alteração', async ({ request }) => {
    const file = 'por_pastoral.ebf1.json';
    const response = await request.get(`/assets/data/bibles/${file}`);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/json');

    const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
    expect(sha256(await response.body())).toBe(sha256(readFileSync(`public/assets/data/bibles/${file}`)));
});

test('funciona offline depois da primeira visita', async ({ page, context }) => {
    test.slow();
    await open(page, 'Jo 3,16');
    await expect(result(page).locator('.verse-text')).toContainText('Deus amou o mundo');
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Recarrega uma vez sob o controle do service worker, para que ele guarde os arquivos
    await page.reload();
    await expect(result(page).locator('.verse-text')).toContainText('Deus amou o mundo');
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(result(page).locator('.verse-text')).toContainText('Deus amou o mundo');
    await reference(page).fill('Jo 1,1');
    await expect(result(page).locator('.verse-text')).toContainText('No princípio era o Verbo');

    // Endereço nunca visitado: o service worker entrega a mesma página
    await page.goto('/ave-maria/mt/5,3-5');
    await expect(result(page).locator('.verse-reference')).toHaveText('(Mt 5,3-5)');
});

test.describe('URL e histórico do navegador', () => {
    const historyLength = (page: Page) => page.evaluate(() => history.length);

    test('a URL e o título acompanham o trecho exibido', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await expect(page).toHaveURL('/ave-maria/jo/3,16');
        await expect(page).toHaveTitle('Jo 3,16 (Ave-Maria) - Abra sua Bíblia!');

        await reference(page).fill('Mt');
        await expect(page).toHaveURL('/ave-maria');
        await expect(page).toHaveTitle('Abra sua Bíblia!');
    });

    test('Voltar e Avançar navegam entre os trechos', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await page.locator('#next-chapter-button').click();
        await expect(page).toHaveURL('/ave-maria/jo/4');

        await page.locator('.book-section .expandable-header').click();
        await page.locator('.book-item', { hasText: /^Ap$/ }).click();
        await expect(page).toHaveURL('/ave-maria/ap/1');

        await page.goBack();
        await expect(page).toHaveURL('/ave-maria/jo/4');
        await expect(reference(page)).toHaveValue('Jo 4');
        await expect(result(page).locator('.reference')).toHaveText('João 4 (Ave-Maria)');

        await page.goBack();
        await expect(page).toHaveURL('/ave-maria/jo/3,16');
        await expect(result(page).locator('.verse-reference')).toHaveText('(Jo 3,16)');

        await page.goForward();
        await expect(page).toHaveURL('/ave-maria/jo/4');
        await expect(reference(page)).toHaveValue('Jo 4');
    });

    test('cada edição da referência cria uma única entrada no histórico', async ({ page }) => {
        await open(page, 'Jo 3,16');
        const initialLength = await historyLength(page);

        await reference(page).fill('Mt 5');
        await expect(page).toHaveURL('/ave-maria/mt/5');
        await reference(page).fill('Mt 5,3-12');
        await expect(page).toHaveURL('/ave-maria/mt/5,3-12');
        expect(await historyLength(page)).toBe(initialLength + 1);

        // Enter encerra a edição: a próxima digitação cria outra entrada
        await reference(page).press('Enter');
        await reference(page).fill('Rm 8');
        await expect(page).toHaveURL('/ave-maria/rm/8');
        expect(await historyLength(page)).toBe(initialLength + 2);

        await page.goBack();
        await expect(page).toHaveURL('/ave-maria/mt/5,3-12');
        await expect(reference(page)).toHaveValue('Mt 5,3-12');
        await page.goBack();
        await expect(page).toHaveURL('/ave-maria/jo/3,16');
        await expect(reference(page)).toHaveValue('Jo 3,16');
    });

    test('Enter exibe na hora e cria uma única entrada', async ({ page }) => {
        await open(page, 'Jo 3,16');
        const initialLength = await historyLength(page);
        await reference(page).fill('Rm 8,28');
        await reference(page).press('Enter');
        // Sem esperar a pausa da digitação (leitura imediata, sem as esperas do expect)
        expect(await result(page).locator('.verse-reference').textContent()).toBe('(Rm 8,28)');
        expect(new URL(page.url()).pathname).toBe('/ave-maria/rm/8,28');

        // A atualização pendente da digitação não cria outra entrada
        await page.waitForTimeout(800);
        expect(await historyLength(page)).toBe(initialLength + 1);

        await page.goBack();
        await expect(page).toHaveURL('/ave-maria/jo/3,16');
    });

    test('troca de tradução entra no histórico', async ({ page }) => {
        // Carrega duas Bíblias completas (~8 MB cada)
        test.slow();
        await open(page, 'Sl 23,1');
        await page.locator('#bible-select').selectOption('Edição Pastoral');
        await expect(page).toHaveURL('/pastoral/sl/23,1');
        await expect(result(page).locator('.reference')).toContainText('(Edição Pastoral)');

        await page.goBack();
        await expect(page).toHaveURL('/ave-maria/sl/23,1');
        await expect(page.locator('#bible-select')).toHaveValue('ave-maria');
        await expect(result(page).locator('.reference')).toContainText('(Ave-Maria)');
    });

    test('histórico de buscas e busca textual criam entradas', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await reference(page).fill('Rm 8,28');
        await expect(page).toHaveURL('/ave-maria/rm/8,28');
        await reference(page).blur();

        await page.locator('#history-button').click();
        await page.locator('#history-modal .history-list-item', { hasText: 'Jo 3,16' }).click();
        await expect(page).toHaveURL('/ave-maria/jo/3,16');

        await page.locator('#text-search-button').click();
        await page.locator('#text-search-modal .text-search-input').fill('bem-aventurados os mansos');
        await expect(page.locator('#text-search-modal .text-search-count')).toHaveText('1 resultado');
        await page.locator('#text-search-modal .text-search-input').press('ArrowDown');
        await page.locator('#text-search-modal .text-search-input').press('Enter');
        await expect(page).toHaveURL('/ave-maria/mt/5,5');

        await page.goBack();
        await expect(page).toHaveURL('/ave-maria/jo/3,16');
        await page.goBack();
        await expect(page).toHaveURL('/ave-maria/rm/8,28');
    });

    test('a raiz abre a última leitura, com a URL canônica', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await reference(page).fill('Rm 8,28');
        await expect(page).toHaveURL('/ave-maria/rm/8,28');

        await page.goto('/');
        await expect(page).toHaveURL('/ave-maria/rm/8,28');
        await expect(result(page).locator('.verse-reference')).toHaveText('(Rm 8,28)');
    });

    test('links diretos são normalizados para a URL canônica', async ({ page }) => {
        await page.goto('/AVE-MARIA/Mateus/5,3-5');
        await expect(page).toHaveURL('/ave-maria/mt/5,3-5');
        await expect(reference(page)).toHaveValue('Mt 5,3-5');

        await page.goto('/ave-maria/mt');
        await expect(page).toHaveURL('/ave-maria/mt/1');
        await expect(reference(page)).toHaveValue('Mt 1');
    });

    test('livro com acento na URL (Jó não é Jo)', async ({ page }) => {
        await page.goto('/ave-maria/J%C3%B3/1,1-3');
        await expect(page).toHaveURL('/ave-maria/j%C3%B3/1,1-3');
        await expect(reference(page)).toHaveValue('Jó 1,1-3');
        await expect(result(page).locator('.reference')).toHaveText(/^Jó 1/);
        await expect(result(page).locator('sup')).toHaveText(['1', '2', '3']);
    });

    test('tradução inexistente abre a padrão e avisa', async ({ page }) => {
        await page.goto('/nao-existe/jo/3,16');
        await expect(page.locator('.temporary-message')).toHaveText('Tradução não encontrada');
        await expect(page).toHaveURL('/ave-maria/jo/3,16');
        await expect(result(page).locator('.verse-reference')).toHaveText('(Jo 3,16)');
    });

    test('falha ao carregar a Bíblia mantém o trecho na URL', async ({ page }) => {
        await page.route('**/por_cnbb.ebf1.json', (route) => route.abort());
        await page.goto('/cnbb/jo/3,16');
        await expect(page.locator('.temporary-message')).toHaveText('Erro ao carregar a Bíblia');
        await expect(reference(page)).toHaveValue('jo 3,16');
        expect(new URL(page.url()).pathname).toBe('/cnbb/jo/3,16');
    });

    test('caminho sem tela correspondente volta ao início', async ({ page }) => {
        await page.goto('/a/b/c/d');
        await expect(page).toHaveURL('/ave-maria');
        await waitForBible(page);
    });

    test('Voltar e Avançar entre Bíblia enviada e publicada', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await page.locator('#bible-select').selectOption('upload');
        await page.locator('#bible-file').setInputFiles(`${FIXTURES}/sample.osis.xml`);
        await reference(page).fill('Gen 1,1-2');
        await expect(page).toHaveURL('/upload/gen/1,1-2');

        // Escolher o upload e digitar a referência são duas entradas
        await page.goBack();
        await expect(page).toHaveURL('/upload');
        await page.goBack();
        await expect(page).toHaveURL('/ave-maria/jo/3,16');
        await expect(page.locator('#bible-select')).toHaveValue('ave-maria');
        await expect(page.locator('#bible-file')).toBeHidden();

        await page.goForward();
        await page.goForward();
        await expect(page).toHaveURL('/upload/gen/1,1-2');
        await expect(result(page).locator('.reference')).toHaveText('Gen 1 (Bíblia de Teste)');
    });

    test('links da versão anterior redirecionam para a URL nova', async ({ page }) => {
        await page.goto('/?bible=Ave-Maria&quote=Jo%203%2C16');
        const length = await historyLength(page);
        await expect(page).toHaveURL('/ave-maria/jo/3,16');
        await expect(result(page).locator('.verse-reference')).toHaveText('(Jo 3,16)');
        // O redirecionamento substitui a entrada: Voltar não retorna ao link antigo
        expect(await historyLength(page)).toBe(length);

        await page.goto('/?bible=CNBB&quote=Sl%2023%2C1-3');
        await expect(page).toHaveURL('/cnbb/sl/23,1-3');
        await expect(result(page).locator('.reference')).toContainText('(CNBB)');
    });

    test('link antigo com tradução inexistente abre a padrão e avisa', async ({ page }) => {
        await page.goto('/?bible=N%C3%A3o%20Existe&quote=Jo%203%2C16');
        await expect(page.locator('.temporary-message')).toHaveText('Tradução não encontrada');
        await expect(page).toHaveURL('/ave-maria/jo/3,16');
    });

    test('o servidor entrega a página em qualquer caminho da SPA', async ({ request }) => {
        for (const path of ['/ave-maria', '/ave-maria/mt/5,3-12.21-38', '/ave-maria/j%C3%B3/1']) {
            const response = await request.get(path);
            expect(response.ok(), path).toBe(true);
            expect(await response.text(), path).toContain('id="reader"');
        }
    });
});
