import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { readerPath } from '../src/screens/reader/url';

const FIXTURES = 'tests/fixtures/xml';

/** Opens the page with the given Bible and reference and waits for the Bible to load. */
async function open(page: Page, quote = 'Jo 3,16', bible = 'por/ave-maria') {
    await page.goto(readerPath(bible, quote));
    await expect(page.locator('#bible-select')).toHaveValue(bible);
    await waitForBible(page);
}

/** The book list is only populated once the Bible has finished loading. */
async function waitForBible(page: Page) {
    await expect(page.locator('.book-item').first()).toBeAttached();
}

const result = (page: Page) => page.locator('#result');
const reference = (page: Page) => page.locator('#reference');

test('shows the reference from the shared link', async ({ page }) => {
    await open(page, 'Jo 3,16');
    await expect(result(page).locator('.reference')).toHaveText('João 3 (Ave-Maria)');
    await expect(result(page).locator('.verse-text')).toContainText('Deus amou o mundo');
    await expect(result(page).locator('.verse-reference')).toHaveText('(Jo 3,16)');
});

test('first visit opens the default Bible from the index', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#bible-select')).toHaveValue('por/ave-maria');
    await waitForBible(page);
    await expect(page).toHaveURL('/por/ave-maria');
});

test('updates the result while typing', async ({ page }) => {
    await open(page);
    await reference(page).fill('Mt 5,3-5');
    await expect(result(page).locator('.verse-reference')).toHaveText('(Mt 5,3-5)');
    await expect(result(page).locator('sup')).toHaveText(['3', '4', '5']);
});

test('invalid reference shows the instructions and hides the actions', async ({ page }) => {
    await open(page);
    await reference(page).fill('Mt');
    await expect(result(page)).toContainText('Digite a referência bíblica');
    await expect(page.locator('#copy-button')).toBeHidden();
});

test('book name containing HTML is not interpreted (XSS)', async ({ page }) => {
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

test('formatting buttons change the text and are remembered', async ({ page }) => {
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

test('navigates between chapters', async ({ page }) => {
    await open(page, 'Gn 1,3');
    await page.locator('#next-chapter-button').click();
    await expect(reference(page)).toHaveValue('Gn 2');
    await expect(result(page).locator('.reference')).toHaveText('Gênesis 2 (Ave-Maria)');

    await page.locator('#prev-chapter-button').click();
    await page.locator('#prev-chapter-button').click();
    await expect(reference(page)).toHaveValue('Gn 1');
});

test('book list opens the first chapter', async ({ page }) => {
    await open(page);
    await page.locator('.book-section .expandable-header').click();
    await expect(page.locator('.book-section .expandable-header')).toContainText('Livros (73)');
    await page.locator('.book-item', { hasText: /^Ap$/ }).click();
    await expect(reference(page)).toHaveValue('Ap 1');
    await expect(result(page).locator('.reference')).toHaveText('Apocalipse 1 (Ave-Maria)');
});

test('switching translation keeps the reference', async ({ page }) => {
    // Loads three full Bibles (~8 MB each)
    test.slow();
    await open(page, 'Sl 23,1');
    await page.locator('#bible-select').selectOption('Edição Pastoral');
    await expect(result(page).locator('.reference')).toContainText('(Edição Pastoral)');
    await expect(reference(page)).toHaveValue('Sl 23,1');

    // At the root, the saved preference applies
    await page.goto('/');
    await expect(page.locator('#bible-select')).toHaveValue('por/pastoral');
    await expect(reference(page)).toHaveValue('Sl 23,1');
});

test('history records the searches and allows returning to them', async ({ page }) => {
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

test('text search with keyboard navigation', async ({ page }) => {
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

/** Waits for the relevance search index (built in the background after the Bible loads). */
async function waitForRankedSearch(page: Page) {
    await expect(page.locator('#text-search-modal .text-search-status')).toHaveAttribute('data-ranked', 'true', {
        timeout: 30_000,
    });
}

test('text search ignores accents and highlights the original text', async ({ page }) => {
    await open(page);
    await page.locator('#text-search-button').click();
    const modal = page.locator('#text-search-modal');
    await waitForRankedSearch(page);
    await modal.locator('.text-search-input').fill('puros de coracao');
    await expect(modal.locator('.text-search-result-citation').first()).toHaveText('Mateus 5,8');
    await expect(modal.locator('.text-search-result-item').first().locator('mark')).toHaveText('puros de coração');
});

test('text search can list by book, in Bible order', async ({ page }) => {
    await open(page);
    await page.locator('#text-search-button').click();
    const modal = page.locator('#text-search-modal');
    await waitForRankedSearch(page);

    await modal.locator('.text-search-input').fill('Deus amou o mundo');
    await expect(modal.locator('.text-search-result-citation').first()).toHaveText('João 3,16');

    await modal.getByRole('radio', { name: 'Por livro' }).click();
    await expect(modal.getByRole('radio', { name: 'Por livro' })).toBeChecked();
    await expect(modal.locator('.text-search-status')).toHaveText('Na ordem da Bíblia');
    const citations = await modal.locator('.text-search-result-citation').allTextContents();
    expect(citations.length).toBeGreaterThan(1);
    // The first result comes from a book that precedes John
    expect(citations[0]).not.toBe('João 3,16');
    expect(citations).toContain('João 3,16');
});

test('relevance search: exact phrase first, prefix and typo', async ({ page }) => {
    await open(page);
    await page.locator('#text-search-button').click();
    const modal = page.locator('#text-search-modal');
    const input = modal.locator('.text-search-input');
    await waitForRankedSearch(page);
    await expect(modal.locator('.text-search-status')).toHaveText('Por relevância');

    await input.fill('Deus amou o mundo');
    await expect(modal.locator('.text-search-result-citation').first()).toHaveText('João 3,16');

    // "pastr": typo; "bo": prefix of the last word
    await input.fill('pastr bo');
    await expect(modal.locator('.text-search-result-citation', { hasText: /^João 10,11$/ })).toHaveCount(1);
});

test('reopening the search with the index ready shows relevance order', async ({ page }) => {
    await open(page);
    await page.locator('#text-search-button').click();
    await waitForRankedSearch(page);
    await page.keyboard.press('Escape');

    await page.locator('#text-search-button').click();
    const status = page.locator('#text-search-modal .text-search-status');
    await expect(status).toHaveAttribute('data-ranked', 'true');
    await expect(status).toHaveText('Por relevância');
});

test('an open search is redone by relevance once the index is ready', async ({ page }) => {
    test.slow();
    await open(page);
    await page.locator('#text-search-button').click();
    const modal = page.locator('#text-search-modal');
    // Right after loading, the index may still be building: the substring search finds only the phrase
    await modal.locator('.text-search-input').fill('puros de coracao');
    await expect(modal.locator('.text-search-result-citation').first()).toHaveText('Mateus 5,8');

    // Without typing again, the results now include verses with the terms apart
    await waitForRankedSearch(page);
    await expect(modal.locator('.text-search-result-item')).not.toHaveCount(1);
    await expect(modal.locator('.text-search-result-citation').first()).toHaveText('Mateus 5,8');
});

test('modals close with Esc and with a click outside', async ({ page }) => {
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

test('theme cycles through automatic, light and dark and is remembered', async ({ page }) => {
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

test.describe('clipboard', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

    test('copies the displayed text', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await page.locator('#copy-button').click();
        await expect(page.locator('.temporary-message')).toHaveText('Texto copiado');
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        expect(copied).toMatch(/^16 Com efeito, de tal modo Deus amou o mundo.*vida eterna\.\n\(Jo 3,16\)\n$/);
    });

    test('without the Clipboard API, copies using the fallback method', async ({ page, context }) => {
        // As in old browsers or outside a secure context
        await context.addInitScript(() => {
            Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined });
        });
        await open(page, 'Jo 3,16');
        await page.locator('#copy-button').click();
        await expect(page.locator('.temporary-message')).toHaveText('Texto copiado');
    });

    test('without the Web Share API, sharing copies a link that reopens the same reference', async ({
        page,
        context,
        baseURL,
    }) => {
        await context.addInitScript(() => {
            Reflect.deleteProperty(Navigator.prototype, 'share');
        });
        await open(page, 'Jo 3,16');
        await page.locator('#share-button').click();
        await expect(page.locator('.temporary-message')).toHaveText('Link copiado');
        const link = await page.evaluate(() => navigator.clipboard.readText());
        expect(link).toBe(`${baseURL}/por/ave-maria/jo/3,16`);

        await page.goto(link);
        await expect(result(page).locator('.verse-reference')).toHaveText('(Jo 3,16)');
    });
});

test.describe('sharing via the Web Share API', () => {
    test.beforeEach(async ({ context }) => {
        // Simulates the system share sheet; __shareResult picks the response
        await context.addInitScript(() => {
            const win = window as unknown as { __shared: ShareData[]; __shareResult?: string };
            win.__shared = [];
            Object.defineProperty(Navigator.prototype, 'share', {
                configurable: true,
                value: (data: ShareData) => {
                    win.__shared.push(data);
                    return win.__shareResult
                        ? Promise.reject(new DOMException('', win.__shareResult))
                        : Promise.resolve();
                },
            });
        });
    });

    const shared = (page: Page) => page.evaluate(() => (window as unknown as { __shared: ShareData[] }).__shared);

    test('opens the share sheet with the passage title and link', async ({ page, baseURL }) => {
        await open(page, 'Jo 3,16');
        await page.locator('#share-button').click();
        await expect.poll(() => shared(page)).toEqual([
            { title: 'Jo 3,16 (Ave-Maria)', text: 'Jo 3,16 (Ave-Maria)', url: `${baseURL}/por/ave-maria/jo/3,16` },
        ]);
        // Shared by the system: no copied-link message
        await expect(page.locator('.temporary-message')).toHaveCount(0);
    });

    test('dismissing the sheet neither copies nor shows a message', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await page.evaluate(() => {
            (window as unknown as { __shareResult: string }).__shareResult = 'AbortError';
        });
        await page.locator('#share-button').click();
        await expect.poll(async () => (await shared(page)).length).toBe(1);
        await page.waitForTimeout(300);
        await expect(page.locator('.temporary-message')).toHaveCount(0);
    });

    test('share buttons use the three-node icon', async ({ page }) => {
        await open(page, 'Jo 3,16');
        for (const id of ['#share-button', '#floating-share-button']) {
            const button = page.locator(id);
            await expect(button).toHaveAttribute('aria-label', 'Compartilhar');
            await expect(button.locator('svg.share-icon circle')).toHaveCount(3);
        }
    });
});

test.describe('Bible upload', () => {
    async function chooseUpload(page: Page) {
        await open(page);
        await page.locator('#bible-select').selectOption('upload');
        await expect(page.locator('#bible-file')).toBeVisible();
        // Without the file, the reference stays in the URL; the book only exists in the test Bibles
        await expect(page).toHaveURL('/upload/jo/3,16');
        await reference(page).fill('Gen 1,1-2');
        await expect(page).toHaveURL('/upload/gen/1,1-2');
    }

    test('converts OSIS and allows downloading the EBF1', async ({ page }) => {
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

    test('accepts EBF1 as JSON', async ({ page }) => {
        await chooseUpload(page);
        const ebf = {
            bible: {
                name: 'Minha',
                language: 'por',
                books: [{ names: ['Gen'], abbreviation: 'Gen', usfm_id: 'GEN', chapters: [{ verses: [{ text: 'A' }, { text: 'B' }] }] }],
            },
        };
        await page.locator('#bible-file').setInputFiles({
            name: 'minha.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(ebf)),
        });
        await expect(result(page).locator('.verse-text')).toContainText('A');
        await expect(result(page).locator('.reference')).toHaveText('Gen 1 (Minha)');
    });

    test('rejects JSON outside the official EBF1 schema', async ({ page }) => {
        const errors: string[] = [];
        page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
        });
        await chooseUpload(page);
        // Verse as plain text and no usfm_id/language: the site used to accept this before schema validation
        const ebf = { bible: { name: 'Antiga', books: [{ names: ['Gen'], abbreviation: 'Gen', chapters: [{ verses: ['A'] }] }] } };
        await page.locator('#bible-file').setInputFiles({
            name: 'antiga.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(ebf)),
        });
        await expect(page.locator('.temporary-message')).toHaveText('Arquivo de Bíblia inválido');
        // The reason goes to the console, with the field path
        expect(errors.join('\n')).toContain('/bible/books/0/chapters/0/verses/0');
    });

    test('rejects JSON that is not EBF1', async ({ page }) => {
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

test('loads the app with a single JS and a single CSS file', async ({ page }) => {
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

test('makes no requests to other domains (no analytics)', async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on('request', (request) => {
        if (!request.url().startsWith(baseURL!)) external.push(request.url());
    });
    await open(page, 'Jo 3,16');
    await reference(page).fill('Mt 5,3-12');
    await expect(page).toHaveURL('/por/ave-maria/mt/5,3-12');
    expect(external).toEqual([]);

    const scripts = await page.locator('script').evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('src') ?? element.textContent),
    );
    expect(scripts.join('\n')).not.toMatch(/gtag|googletagmanager|dataLayer/);
});

test('minified inline script applies the saved theme before the bundle', async ({ page, context }) => {
    await context.addInitScript(() => {
        localStorage.setItem('selectedTheme', 'dark');
    });
    // Without the app bundle, only the inline script in index.html can apply the theme
    await page.route(/\/assets\/index-[^/]*\.js$/, (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#theme-icon')).toHaveText('🌓');
});

test('"Sobre" section ends with the build version (commit hash and date)', async ({ page }) => {
    await open(page);
    await page.locator('#about-footer .expandable-header').click();
    const version = page.locator('#about-footer .expandable-content > :last-child');
    await expect(version).toHaveId('build-version');
    // Commit hash and date in UTC, matching git in this repository
    const head = execSync('git show -s --format=%h%n%ct HEAD', { encoding: 'utf8' }).trim().split('\n');
    const date = new Date(Number(head[1]) * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await expect(version).toHaveText(new RegExp(`^Versão da página: ${head[0]}(-dirty)? ${date}$`));
    await expect(version).toHaveCSS('font-style', 'italic');

    const sizes = await version.evaluate((element) => {
        const content = element.closest('.expandable-content')!;
        // Wait for the section's opening animation to finish
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
    // The section has a max height with hidden overflow: the version must not be clipped
    expect(sizes.bottom).toBeLessThanOrEqual(sizes.limit);
});

test('Bibles are published unmodified', async ({ request }) => {
    const file = 'por_pastoral.ebf1.json';
    const response = await request.get(`/assets/data/bibles/${file}`);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/json');

    const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
    expect(sha256(await response.body())).toBe(sha256(readFileSync(`public/assets/data/bibles/${file}`)));
});

test('works offline after the first visit', async ({ page, context }) => {
    test.slow();
    await open(page, 'Jo 3,16');
    await expect(result(page).locator('.verse-text')).toContainText('Deus amou o mundo');
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Reload once under service worker control so that it caches the files
    await page.reload();
    await expect(result(page).locator('.verse-text')).toContainText('Deus amou o mundo');
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(result(page).locator('.verse-text')).toContainText('Deus amou o mundo');
    await reference(page).fill('Jo 1,1');
    await expect(result(page).locator('.verse-text')).toContainText('No princípio era o Verbo');

    // Never-visited address: the service worker serves the same page
    await page.goto('/por/ave-maria/mt/5,3-5');
    await expect(result(page).locator('.verse-reference')).toHaveText('(Mt 5,3-5)');
});

test.describe('URL and browser history', () => {
    const historyLength = (page: Page) => page.evaluate(() => history.length);

    test('the URL and title follow the displayed passage', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await expect(page).toHaveURL('/por/ave-maria/jo/3,16');
        await expect(page).toHaveTitle('Jo 3,16 (Ave-Maria) - Abra sua Bíblia!');

        await reference(page).fill('Mt');
        await expect(page).toHaveURL('/por/ave-maria');
        await expect(page).toHaveTitle('Abra sua Bíblia!');
    });

    test('Back and Forward navigate between passages', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await page.locator('#next-chapter-button').click();
        await expect(page).toHaveURL('/por/ave-maria/jo/4');

        await page.locator('.book-section .expandable-header').click();
        await page.locator('.book-item', { hasText: /^Ap$/ }).click();
        await expect(page).toHaveURL('/por/ave-maria/ap/1');

        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/jo/4');
        await expect(reference(page)).toHaveValue('Jo 4');
        await expect(result(page).locator('.reference')).toHaveText('João 4 (Ave-Maria)');

        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/jo/3,16');
        await expect(result(page).locator('.verse-reference')).toHaveText('(Jo 3,16)');

        await page.goForward();
        await expect(page).toHaveURL('/por/ave-maria/jo/4');
        await expect(reference(page)).toHaveValue('Jo 4');
    });

    test('each reference edit creates a single history entry', async ({ page }) => {
        await open(page, 'Jo 3,16');
        const initialLength = await historyLength(page);

        await reference(page).fill('Mt 5');
        await expect(page).toHaveURL('/por/ave-maria/mt/5');
        await reference(page).fill('Mt 5,3-12');
        await expect(page).toHaveURL('/por/ave-maria/mt/5,3-12');
        expect(await historyLength(page)).toBe(initialLength + 1);

        // Enter ends the edit: the next typing creates another entry
        await reference(page).press('Enter');
        await reference(page).fill('Rm 8');
        await expect(page).toHaveURL('/por/ave-maria/rm/8');
        expect(await historyLength(page)).toBe(initialLength + 2);

        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/mt/5,3-12');
        await expect(reference(page)).toHaveValue('Mt 5,3-12');
        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/jo/3,16');
        await expect(reference(page)).toHaveValue('Jo 3,16');
    });

    test('Enter displays immediately and creates a single entry', async ({ page }) => {
        await open(page, 'Jo 3,16');
        const initialLength = await historyLength(page);
        await reference(page).fill('Rm 8,28');
        await reference(page).press('Enter');
        // Without waiting for the typing pause (immediate read, no expect retries)
        expect(await result(page).locator('.verse-reference').textContent()).toBe('(Rm 8,28)');
        expect(new URL(page.url()).pathname).toBe('/por/ave-maria/rm/8,28');

        // The pending typing update does not create another entry
        await page.waitForTimeout(800);
        expect(await historyLength(page)).toBe(initialLength + 1);

        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/jo/3,16');
    });

    test('switching translation enters the history', async ({ page }) => {
        // Loads two full Bibles (~8 MB each)
        test.slow();
        await open(page, 'Sl 23,1');
        await page.locator('#bible-select').selectOption('Edição Pastoral');
        await expect(page).toHaveURL('/por/pastoral/sl/23,1');
        await expect(result(page).locator('.reference')).toContainText('(Edição Pastoral)');

        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/sl/23,1');
        await expect(page.locator('#bible-select')).toHaveValue('por/ave-maria');
        await expect(result(page).locator('.reference')).toContainText('(Ave-Maria)');
    });

    test('search history and text search create entries', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await reference(page).fill('Rm 8,28');
        await expect(page).toHaveURL('/por/ave-maria/rm/8,28');
        await reference(page).blur();

        await page.locator('#history-button').click();
        await page.locator('#history-modal .history-list-item', { hasText: 'Jo 3,16' }).click();
        await expect(page).toHaveURL('/por/ave-maria/jo/3,16');

        await page.locator('#text-search-button').click();
        await page.locator('#text-search-modal .text-search-input').fill('bem-aventurados os mansos');
        await expect(page.locator('#text-search-modal .text-search-count')).toHaveText('1 resultado');
        await page.locator('#text-search-modal .text-search-input').press('ArrowDown');
        await page.locator('#text-search-modal .text-search-input').press('Enter');
        await expect(page).toHaveURL('/por/ave-maria/mt/5,5');

        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/jo/3,16');
        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/rm/8,28');
    });

    test('the root opens the last reading, with the canonical URL', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await reference(page).fill('Rm 8,28');
        await expect(page).toHaveURL('/por/ave-maria/rm/8,28');

        await page.goto('/');
        await expect(page).toHaveURL('/por/ave-maria/rm/8,28');
        await expect(result(page).locator('.verse-reference')).toHaveText('(Rm 8,28)');
    });

    test('direct links are normalized to the canonical URL', async ({ page }) => {
        await page.goto('/POR/AVE-MARIA/Mateus/5,3-5');
        await expect(page).toHaveURL('/por/ave-maria/mt/5,3-5');
        await expect(reference(page)).toHaveValue('Mt 5,3-5');

        await page.goto('/por/ave-maria/mt');
        await expect(page).toHaveURL('/por/ave-maria/mt/1');
        await expect(reference(page)).toHaveValue('Mt 1');
    });

    test('book with an accent in the URL (Jó is not Jo)', async ({ page }) => {
        await page.goto('/por/ave-maria/J%C3%B3/1,1-3');
        await expect(page).toHaveURL('/por/ave-maria/j%C3%B3/1,1-3');
        await expect(reference(page)).toHaveValue('Jó 1,1-3');
        await expect(result(page).locator('.reference')).toHaveText(/^Jó 1/);
        await expect(result(page).locator('sup')).toHaveText(['1', '2', '3']);
    });

    test('language alone in the URL opens its default Bible', async ({ page }) => {
        await page.goto('/por');
        await expect(page).toHaveURL('/por/ave-maria');
        await expect(page.locator('#bible-select')).toHaveValue('por/ave-maria');
    });

    test('unknown language opens the default Bible and warns', async ({ page }) => {
        await page.goto('/xxx');
        await expect(page.locator('.temporary-message')).toHaveText('Tradução não encontrada');
        await expect(page).toHaveURL('/por/ave-maria');
    });

    test('unknown translation opens the default Bible and warns', async ({ page }) => {
        await page.goto('/por/nao-existe/jo/3,16');
        await expect(page.locator('.temporary-message')).toHaveText('Tradução não encontrada');
        await expect(page).toHaveURL('/por/ave-maria/jo/3,16');
        await expect(result(page).locator('.verse-reference')).toHaveText('(Jo 3,16)');
    });

    test('failure to load the Bible keeps the passage in the URL', async ({ page }) => {
        await page.route('**/por_cnbb.ebf1.json', (route) => route.abort());
        await page.goto('/por/cnbb/jo/3,16');
        await expect(page.locator('.temporary-message')).toHaveText('Erro ao carregar a Bíblia');
        await expect(reference(page)).toHaveValue('jo 3,16');
        expect(new URL(page.url()).pathname).toBe('/por/cnbb/jo/3,16');
    });

    test('path with no matching screen goes back to the start', async ({ page }) => {
        await page.goto('/a/b/c/d/e');
        await expect(page).toHaveURL('/por/ave-maria');
        await waitForBible(page);
    });

    test('Back and Forward between an uploaded and a published Bible', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await page.locator('#bible-select').selectOption('upload');
        await page.locator('#bible-file').setInputFiles(`${FIXTURES}/sample.osis.xml`);
        await reference(page).fill('Gen 1,1-2');
        await expect(page).toHaveURL('/upload/gen/1,1-2');

        // Choosing the upload and typing the reference are two entries
        await page.goBack();
        await expect(page).toHaveURL('/upload');
        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/jo/3,16');
        await expect(page.locator('#bible-select')).toHaveValue('por/ave-maria');
        await expect(page.locator('#bible-file')).toBeHidden();

        await page.goForward();
        await page.goForward();
        await expect(page).toHaveURL('/upload/gen/1,1-2');
        await expect(result(page).locator('.reference')).toHaveText('Gen 1 (Bíblia de Teste)');
    });

    test('links from the previous version redirect to the new URL', async ({ page }) => {
        await page.goto('/?bible=Ave-Maria&quote=Jo%203%2C16');
        const length = await historyLength(page);
        await expect(page).toHaveURL('/por/ave-maria/jo/3,16');
        await expect(result(page).locator('.verse-reference')).toHaveText('(Jo 3,16)');
        // The redirect replaces the entry: Back does not return to the old link
        expect(await historyLength(page)).toBe(length);

        await page.goto('/?bible=CNBB&quote=Sl%2023%2C1-3');
        await expect(page).toHaveURL('/por/cnbb/sl/23,1-3');
        await expect(result(page).locator('.reference')).toContainText('(CNBB)');
    });

    test('old link with an unknown translation opens the default Bible and warns', async ({ page }) => {
        await page.goto('/?bible=N%C3%A3o%20Existe&quote=Jo%203%2C16');
        await expect(page.locator('.temporary-message')).toHaveText('Tradução não encontrada');
        await expect(page).toHaveURL('/por/ave-maria/jo/3,16');
    });

    test('the server serves the page on any SPA path', async ({ request }) => {
        for (const path of ['/por/ave-maria', '/por/ave-maria/mt/5,3-12.21-38', '/por/ave-maria/j%C3%B3/1']) {
            const response = await request.get(path);
            expect(response.ok(), path).toBe(true);
            expect(await response.text(), path).toContain('id="reader"');
        }
    });
});
