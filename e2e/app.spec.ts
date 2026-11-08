import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { readerPath } from '../src/screens/reader/url';

const FIXTURES = 'tests/fixtures/xml';
/** Local copy of the Bibles (npm run bibles:fetch, run before the E2E tests). */
const BIBLES_COPY = '.bibles-cache';
/** Origin of the Blob store that holds the Bibles (settings.json). */
const BLOB_ORIGIN = new URL((JSON.parse(readFileSync('settings.json', 'utf8')) as { biblesUrl: string }).biblesUrl).origin;

// The Bibles are served from the local copy instead of the Blob store: faster and independent of the
// network. (Requests made by the service worker are not intercepted and do reach the store.)
test.beforeEach(async ({ context }) => {
    await context.route(`${BLOB_ORIGIN}/**`, (route) => {
        const file = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
        return route.fulfill({
            path: join(BIBLES_COPY, file),
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' },
        });
    });
});

/**
 * Serves the Ave-Maria with a single book (by USFM id). For tests where only a message and the
 * redirect matter: it loads quickly, so the message (3 s) cannot expire while the page is busy
 * loading the full Bible.
 */
async function serveAveMariaWithOnly(page: Page, usfmId: string) {
    const bible = JSON.parse(readFileSync(join(BIBLES_COPY, 'por_ave_maria.ebf1.json'), 'utf8')) as {
        bible: { books: { usfm_id?: string }[] };
    };
    bible.bible.books = bible.bible.books.filter((book) => book.usfm_id === usfmId);
    await page.route(/\/por_ave_maria\.ebf1\.json/, (route) =>
        route.fulfill({ json: bible, headers: { 'access-control-allow-origin': '*' } }),
    );
}

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
    await expect(result(page).locator('.passage-heading')).toHaveText('João 3 (Ave-Maria)');
    await expect(result(page).locator('.verse-text')).toContainText('Deus amou o mundo');
    await expect(result(page).locator('.resulting-reference')).toHaveText('(Jo 3,16)');
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
    await expect(result(page).locator('.resulting-reference')).toHaveText('(Mt 5,3-5)');
    await expect(result(page).locator('sup')).toHaveText(['3', '4', '5']);
});

test('accepts the colon notation and dashes, displaying the reference in the Bible notation', async ({ page }) => {
    await open(page);
    await reference(page).fill('Mt 5:3-5,7');
    await expect(result(page).locator('.resulting-reference')).toHaveText('(Mt 5,3-5.7)');
    await expect(result(page).locator('sup')).toHaveText(['3', '4', '5', '7']);
    await reference(page).press('Enter');
    await expect(page).toHaveURL('/por/ave-maria/mat/5:3-5,7');

    await reference(page).fill('Mt 5,3–5');
    await expect(result(page).locator('.resulting-reference')).toHaveText('(Mt 5,3-5)');
    await expect(reference(page)).not.toHaveAttribute('aria-invalid');
});

test('a link in the colon notation opens the passage', async ({ page }) => {
    await page.goto('/por/ave-maria/jhn/3:16');
    await expect(result(page).locator('.resulting-reference')).toHaveText('(Jo 3,16)');
    await expect(reference(page)).toHaveValue('Jo 3:16');
    await expect(page).toHaveURL('/por/ave-maria/jhn/3:16');
});

test('invalid reference shows the instructions and hides the actions', async ({ page }) => {
    await open(page);
    await reference(page).fill('Mt');
    await expect(result(page)).toContainText('Digite o livro, o capítulo e, se quiser, os versículos');
    await expect(result(page).locator('.help-examples code').first()).toHaveText('Mt 5');
    await expect(page.locator('#copy-button')).toBeHidden();
});

test('a wrong reference turns the field red until it is corrected', async ({ page }) => {
    await open(page);
    const field = reference(page);
    await expect(field).not.toHaveAttribute('aria-invalid');
    const normalBorder = await field.evaluate((element) => getComputedStyle(element).borderTopColor);

    for (const wrong of ['Jo 3;16', 'Jo 3:16.17', 'Xyz 1', 'Jo 99', '1 Cor 13']) {
        await field.fill(wrong);
        await expect(field, wrong).toHaveAttribute('aria-invalid', 'true');
    }
    const wrongBorder = await field.evaluate((element) => getComputedStyle(element).borderTopColor);
    expect(wrongBorder).not.toBe(normalBorder);

    await field.fill('1Cor 13,4');
    await expect(field).not.toHaveAttribute('aria-invalid');
    await field.fill('Mt');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await field.fill('');
    await expect(field).not.toHaveAttribute('aria-invalid');
});

test('a wrong reference from a link also turns the field red', async ({ page }) => {
    await open(page, 'Jo 3,abc');
    await expect(reference(page)).toHaveAttribute('aria-invalid', 'true');
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
    await expect(result(page).locator('.passage-heading')).toHaveText('Gênesis 2 (Ave-Maria)');

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
    await expect(result(page).locator('.passage-heading')).toHaveText('Apocalipse 1 (Ave-Maria)');
});

test('switching translation keeps the reference', async ({ page }) => {
    // Loads three full Bibles (~8 MB each)
    test.slow();
    await open(page, 'Sl 23,1');
    await page.locator('#bible-select').selectOption('Edição Pastoral');
    // Handing 10 MB to the page through the intercepted request takes a few seconds
    await expect(result(page).locator('.passage-heading')).toContainText('(Edição Pastoral)', { timeout: 20_000 });
    await expect(reference(page)).toHaveValue('Sl 23,1');

    // At the root, the saved preference applies
    await page.goto('/');
    await expect(page.locator('#bible-select')).toHaveValue('por/edicao-pastoral');
    await expect(reference(page)).toHaveValue('Sl 23,1');
});

test('history records the searches and allows returning to them', async ({ page }) => {
    await open(page, 'Jo 3,16');
    await reference(page).fill('Rm 8,28');
    await expect(result(page).locator('.resulting-reference')).toHaveText('(Rm 8,28)');

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
    await expect(modal.locator('.text-search-result-reference').first()).toHaveText('Mateus 5,8');
    await expect(modal.locator('.text-search-result-item').first().locator('mark')).toHaveText('puros de coração');
});

test('text search can list by book, in Bible order', async ({ page }) => {
    await open(page);
    await page.locator('#text-search-button').click();
    const modal = page.locator('#text-search-modal');
    await waitForRankedSearch(page);

    await modal.locator('.text-search-input').fill('Deus amou o mundo');
    await expect(modal.locator('.text-search-result-reference').first()).toHaveText('João 3,16');

    await modal.getByRole('radio', { name: 'Por livro' }).click();
    await expect(modal.getByRole('radio', { name: 'Por livro' })).toBeChecked();
    await expect(modal.locator('.text-search-status')).toHaveText('Na ordem da Bíblia');
    const references = await modal.locator('.text-search-result-reference').allTextContents();
    expect(references.length).toBeGreaterThan(1);
    // The first result comes from a book that precedes John
    expect(references[0]).not.toBe('João 3,16');
    expect(references).toContain('João 3,16');
});

test('relevance search: exact phrase first, prefix and typo', async ({ page }) => {
    await open(page);
    await page.locator('#text-search-button').click();
    const modal = page.locator('#text-search-modal');
    const input = modal.locator('.text-search-input');
    await waitForRankedSearch(page);
    await expect(modal.locator('.text-search-status')).toHaveText('Por relevância');

    await input.fill('Deus amou o mundo');
    await expect(modal.locator('.text-search-result-reference').first()).toHaveText('João 3,16');

    // "pastr": typo; "bo": prefix of the last word
    await input.fill('pastr bo');
    await expect(modal.locator('.text-search-result-reference', { hasText: /^João 10,11$/ })).toHaveCount(1);
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
    await expect(modal.locator('.text-search-result-reference').first()).toHaveText('Mateus 5,8');

    // Without typing again, the results now include verses with the terms apart
    await waitForRankedSearch(page);
    await expect(modal.locator('.text-search-result-item')).not.toHaveCount(1);
    await expect(modal.locator('.text-search-result-reference').first()).toHaveText('Mateus 5,8');
});

test('notes: the balloon before the verse text lists the cross-references and opens the one clicked', async ({ page }) => {
    await open(page, 'Gn 9,3-4', 'por/almeida-revista-e-atualizada');
    // Only Gn 9,4 has cross-references
    await expect(result(page).locator('.notes-button')).toHaveCount(1);

    await result(page).locator('.notes-button').click();
    const modal = page.locator('#notes-modal');
    await expect(modal.locator('.app-modal-title')).toHaveText('Referências cruzadas e comentários de Gn 9,4');
    await expect(modal.locator('.notes-comment')).toHaveCount(0);
    // Consecutive verses of the same chapter are grouped
    await expect(modal.locator('.cross-reference-reference')).toHaveText(['Lv 7,26-27', 'Lv 17,10-14', 'Lv 19,26', 'Dt 12,16.23', 'Dt 15,23']);
    await expect(modal.locator('.cross-reference-item').first()).toContainText('Não comereis sangue');

    await modal.getByText('Lv 17,10-14').click();
    await expect(modal).toBeHidden();
    await expect(reference(page)).toHaveValue('Lv 17,10-14');
    await expect(page).toHaveURL(/\/por\/almeida-revista-e-atualizada\/lev\/17,10-14$/);
    await expect(page.locator('#copy-button')).toBeVisible();
});

test('notes: the comments of a verse and of the chapter, each one in its balloon', async ({ page }) => {
    // Lv 1 of the Edição Pastoral has a comment on the chapter and one on verse 1
    await open(page, 'Lv 1,1-2', 'por/edicao-pastoral');
    const modal = page.locator('#notes-modal');

    await result(page).locator('.passage-heading .notes-button').click();
    await expect(modal.locator('.app-modal-title')).toHaveText('Comentários de Lv 1');
    await expect(modal.locator('.notes-comment')).toContainText('Estes capítulos apresentam uma classificação dos sacrifícios');
    await expect(modal.locator('.cross-reference-item')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    // Only verse 1 has a comment
    await expect(result(page).locator('.verse-text .notes-button')).toHaveCount(1);
    await result(page).locator('.verse-text .notes-button').click();
    await expect(modal.locator('.app-modal-title')).toHaveText('Referências cruzadas e comentários de Lv 1,1');
    await expect(modal.locator('.notes-comment')).toContainText('Holocausto é um sacrifício');
});

test('the reference help follows the open Bible, and its examples work', async ({ page }) => {
    // Loads two full Bibles
    test.slow();
    await open(page);
    const examples = page.locator('#help .help-examples code');

    await openFromMenu(page, 'Ajuda');
    await expect(examples).toHaveText([
        'Mt 5',
        'Mt 5,13',
        'Mt 5,3-12',
        'Mt 5,3-',
        'Mt 5,3-12.21-38',
        'Mt 5:3-12,21-38',
        'Mt 5,3–12',
        'Mateus 5',
        'MAT 5',
        '1Cor 13',
        '1CO 13',
    ]);
    await openFromMenu(page, 'Bíblia');

    // In the Almeida Corrigida Fiel, 1 Corinthians is "1Co", which is the USFM id itself ignoring case
    await page.locator('#bible-select').selectOption('Almeida Corrigida e Revisada Fiel');
    await expect(result(page).locator('.passage-heading')).toContainText('(Almeida Corrigida', { timeout: 20_000 });
    await openFromMenu(page, 'Ajuda');
    await expect(examples.filter({ hasText: / 13$/ })).toHaveText(['1Co 13']);
    await openFromMenu(page, 'Bíblia');

    for (const example of ['Mt 5:3-12,21-38', 'Mateus 5', 'MAT 5', '1Co 13', '1CO 13']) {
        await reference(page).fill(example);
        await expect(result(page).locator('.passage-heading'), example).toBeVisible();
        await expect(reference(page), example).not.toHaveAttribute('aria-invalid');
    }
});

test('the reference help fits a narrow screen, with the meaning below the example', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page);
    await openFromMenu(page, 'Ajuda');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const row = page.locator('#help .help-examples tr').first();
    const [example, meaning] = await Promise.all([row.locator('td').first().boundingBox(), row.locator('td').last().boundingBox()]);
    expect(meaning!.y).toBeGreaterThanOrEqual(example!.y + example!.height - 1);
});

test('modals close with Esc and with a click outside', async ({ page }) => {
    await open(page);
    const modal = page.locator('#history-modal');

    await page.locator('#history-button').click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    await page.locator('#history-button').click();
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
        expect(copied).toMatch(/^¹⁶ Com efeito, de tal modo Deus amou o mundo.*vida eterna\.\n\(Jo 3,16\)$/);
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
        expect(link).toBe(`${baseURL}/por/ave-maria/jhn/3,16`);

        await page.goto(link);
        await expect(result(page).locator('.resulting-reference')).toHaveText('(Jo 3,16)');
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
            { title: 'Jo 3,16 (Ave-Maria)', text: 'Jo 3,16 (Ave-Maria)', url: `${baseURL}/por/ave-maria/jhn/3,16` },
        ]);
        // Shared by the system: no copied-link message
        await expect(page.locator('.temporary-message')).toHaveCount(0);
    });

    test('shares with the same title as the page: the resulting reference', async ({ page }) => {
        await open(page);
        await reference(page).fill('joão 3, 18.16.17');
        await expect(page).toHaveTitle('Jo 3,16-18 (Ave-Maria) - Abra sua Bíblia!');
        await page.locator('#share-button').click();
        await expect.poll(() => shared(page)).toMatchObject([{ title: 'Jo 3,16-18 (Ave-Maria)', text: 'Jo 3,16-18 (Ave-Maria)' }]);
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
        await expect(page).toHaveURL('/upload/jhn/3,16');
        await reference(page).fill('Gen 1,1-2');
        await expect(page).toHaveURL('/upload/gen/1,1-2');
    }

    test('converts OSIS and allows downloading the EBF1', async ({ page }) => {
        await chooseUpload(page);
        await page.locator('#bible-file').setInputFiles(`${FIXTURES}/sample.osis.xml`);
        await expect(result(page).locator('.passage-heading')).toHaveText('Gen 1 (Bíblia de Teste)');
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
        await expect(result(page).locator('.passage-heading')).toHaveText('Gen 1 (Minha)');
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

test('makes no requests to other domains, except the Blob store with the Bibles (no analytics)', async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on('request', (request) => {
        if (!request.url().startsWith(baseURL!) && !request.url().startsWith(`${BLOB_ORIGIN}/`)) external.push(request.url());
    });
    await open(page, 'Jo 3,16');
    await reference(page).fill('Mt 5,3-12');
    await expect(page).toHaveURL('/por/ave-maria/mat/5,3-12');
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
});

test('the About page ends with the build version (commit hash and date)', async ({ page }) => {
    await open(page);
    await openFromMenu(page, 'Sobre');
    const about = page.locator('#about');
    await expect(about.locator('.container > :last-child')).toHaveId('build-version');
    const version = page.locator('#build-version');
    // Commit hash and date in UTC, matching git in this repository
    const head = execSync('git show -s --format=%h%n%ct HEAD', { encoding: 'utf8' }).trim().split('\n');
    const date = new Date(Number(head[1]) * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await expect(version).toHaveText(new RegExp(`^Versão da página: ${head[0]}(-dirty)? ${date}$`));
    await expect(version).toHaveCSS('font-style', 'italic');
    const sizes = await version.evaluate((element) => ({
        version: parseFloat(getComputedStyle(element).fontSize),
        text: parseFloat(getComputedStyle(element.parentElement!).fontSize),
    }));
    expect(sizes.version).toBeLessThan(sizes.text);
});

/** Opens a page from the main menu (hamburger), by the label of its item. */
async function openFromMenu(page: Page, label: string) {
    await page.locator('.menu-button:visible').click();
    const menu = page.locator('#main-menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: label }).click();
    await expect(menu).toBeHidden();
}

test.describe('main menu', () => {
    test('lists the destinations, each one with an emoji', async ({ page }) => {
        await open(page);
        await page.locator('.menu-button:visible').click();
        const items = page.locator('#main-menu .main-menu-item');
        await expect(items.first()).toHaveText('📖 Bíblia');
        await expect(items.first()).toHaveAttribute('aria-current', 'page');
        await expect(page.locator('#main-menu').getByRole('link', { name: 'Sobre' })).toContainText('ℹ️');
        await page.keyboard.press('Escape');
        await expect(page.locator('#main-menu')).toBeHidden();
    });

    test('the About page has the credits and the contact; Back returns to the Bible', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await openFromMenu(page, 'Sobre');
        await expect(page).toHaveURL('/about');
        await expect(page).toHaveTitle('Sobre - Abra sua Bíblia!');
        await expect(page.locator('#reader')).toBeHidden();
        const about = page.locator('#about');
        await expect(about.locator('.screen-title')).toHaveText('ℹ️ Sobre');
        await expect(about.getByRole('link', { name: 'Natanael de Souza Figueiredo' })).toBeVisible();
        await expect(about.getByRole('link', { name: 'contato@abrasuabiblia.com.br' })).toBeVisible();

        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
        await expect(result(page).locator('.resulting-reference')).toHaveText('(Jo 3,16)');
        await expect(page).toHaveTitle('Jo 3,16 (Ave-Maria) - Abra sua Bíblia!');
    });

    test('the Help page explains the buttons and how to type a reference, with the open Bible', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await openFromMenu(page, 'Ajuda');
        await expect(page).toHaveURL('/help');
        await expect(page).toHaveTitle('Ajuda - Abra sua Bíblia!');
        const help = page.locator('#help');
        await expect(help.locator('.screen-title')).toHaveText('❓ Ajuda');
        await expect(help).toContainText('Mostra o número de cada versículo.');
        await expect(help).toContainText('Busca textual: procura palavras no texto da Bíblia');
        // The upload help: formats and where to find Bibles
        await expect(help.getByRole('link', { name: 'Easy Bible Format' })).toHaveAttribute('href', 'https://github.com/natanael127/easy-bible-format');
        await expect(help.getByRole('link', { name: 'Bíblias convertidas para EBF' })).toBeVisible();
        // The same help as the modal, with the books of the open Bible
        await expect(help.locator('.help-examples code').first()).toHaveText('Mt 5');
        // How to install it as an app, on Android and on iOS
        await expect(help.getByRole('heading', { name: 'Instalar como aplicativo' })).toBeVisible();
        await expect(help).toContainText('toque em “Adicionar à Tela de Início”');
        await expect(help).toContainText('Abra este site no Chrome.');

        // From one page to another, Back still returns to the Bible
        await openFromMenu(page, 'Sobre');
        await expect(page).toHaveURL('/about');
        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
        await expect(page.locator('#reader')).toBeVisible();
    });

    test('the pages follow the interface language', async ({ page }) => {
        await open(page);
        await openFromMenu(page, 'Ajuda');
        await page.evaluate(() => {
            localStorage.setItem('uiLanguage', 'eng');
        });
        await page.reload();
        await expect(page.locator('#help .screen-title')).toHaveText('❓ Help');
        await expect(page).toHaveTitle('Help - Open Your Bible!');
        await expect(page.locator('#help')).toContainText('Shows the number of each verse.');
    });

    test('the Bible item of the menu goes back to the passage, without a new history entry', async ({ page }) => {
        await open(page, 'Jo 3,16');
        const length = await page.evaluate(() => history.length);
        await openFromMenu(page, 'Sobre');
        await openFromMenu(page, 'Bíblia');
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
        await expect(page.locator('#reader')).toBeVisible();
        await page.goForward();
        await expect(page).toHaveURL('/about');
        expect(await page.evaluate(() => history.length)).toBe(length + 1);
    });

    test('a page opened directly also goes back to the Bible, even after a reload', async ({ page }) => {
        await page.goto('/');
        await waitForBible(page);
        await reference(page).fill('Rm 8,28');
        await expect(page).toHaveURL('/por/ave-maria/rom/8,28');

        await page.goto('/about');
        await expect(page.locator('#about')).toBeVisible();
        await page.reload();
        await expect(page.locator('#about')).toBeVisible();
        await page.goBack();
        // The last reading
        await expect(page).toHaveURL('/por/ave-maria/rom/8,28');
        await expect(result(page).locator('.resulting-reference')).toHaveText('(Rm 8,28)');
    });
});

test('the Bibles come from the Blob store, versioned by hash, and not from the site', async ({ page }) => {
    const bibleRequest = page.waitForRequest(/\/por_ave_maria\.ebf1\.json\?v=[0-9a-f]{12}$/);
    await open(page);
    expect(new URL((await bibleRequest).url()).origin).toBe(BLOB_ORIGIN);
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
    await expect(result(page).locator('.resulting-reference')).toHaveText('(Mt 5,3-5)');
});

test.describe('URL and browser history', () => {
    const historyLength = (page: Page) => page.evaluate(() => history.length);

    test('the URL and title follow the displayed passage', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
        await expect(page).toHaveTitle('Jo 3,16 (Ave-Maria) - Abra sua Bíblia!');

        await reference(page).fill('Mt');
        await expect(page).toHaveURL('/por/ave-maria');
        await expect(page).toHaveTitle('Abra sua Bíblia!');
    });

    test('the title shows the resulting reference, not the typed reference', async ({ page }) => {
        await open(page);
        await reference(page).fill('joão 3, 18.16.17');
        await expect(page).toHaveTitle('Jo 3,16-18 (Ave-Maria) - Abra sua Bíblia!');
    });

    test('Back and Forward navigate between passages', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await page.locator('#next-chapter-button').click();
        await expect(page).toHaveURL('/por/ave-maria/jhn/4');

        await page.locator('.book-section .expandable-header').click();
        await page.locator('.book-item', { hasText: /^Ap$/ }).click();
        await expect(page).toHaveURL('/por/ave-maria/rev/1');

        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/jhn/4');
        await expect(reference(page)).toHaveValue('Jo 4');
        await expect(result(page).locator('.passage-heading')).toHaveText('João 4 (Ave-Maria)');

        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
        await expect(result(page).locator('.resulting-reference')).toHaveText('(Jo 3,16)');

        await page.goForward();
        await expect(page).toHaveURL('/por/ave-maria/jhn/4');
        await expect(reference(page)).toHaveValue('Jo 4');
    });

    test('each reference edit creates a single history entry', async ({ page }) => {
        await open(page, 'Jo 3,16');
        const initialLength = await historyLength(page);

        await reference(page).fill('Mt 5');
        await expect(page).toHaveURL('/por/ave-maria/mat/5');
        await reference(page).fill('Mt 5,3-12');
        await expect(page).toHaveURL('/por/ave-maria/mat/5,3-12');
        expect(await historyLength(page)).toBe(initialLength + 1);

        // Enter ends the edit: the next typing creates another entry
        await reference(page).press('Enter');
        await reference(page).fill('Rm 8');
        await expect(page).toHaveURL('/por/ave-maria/rom/8');
        expect(await historyLength(page)).toBe(initialLength + 2);

        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/mat/5,3-12');
        await expect(reference(page)).toHaveValue('Mt 5,3-12');
        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
        await expect(reference(page)).toHaveValue('Jo 3,16');
    });

    test('Enter displays immediately and creates a single entry', async ({ page }) => {
        await open(page, 'Jo 3,16');
        const initialLength = await historyLength(page);
        await reference(page).fill('Rm 8,28');
        await reference(page).press('Enter');
        // Without waiting for the typing pause (immediate read, no expect retries)
        expect(await result(page).locator('.resulting-reference').textContent()).toBe('(Rm 8,28)');
        expect(new URL(page.url()).pathname).toBe('/por/ave-maria/rom/8,28');

        // The pending typing update does not create another entry
        await page.waitForTimeout(800);
        expect(await historyLength(page)).toBe(initialLength + 1);

        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
    });

    test('switching translation enters the history', async ({ page }) => {
        // Loads two full Bibles (~8 MB each)
        test.slow();
        await open(page, 'Sl 23,1');
        await page.locator('#bible-select').selectOption('Edição Pastoral');
        await expect(page).toHaveURL('/por/edicao-pastoral/psa/23,1');
        await expect(result(page).locator('.passage-heading')).toContainText('(Edição Pastoral)');

        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/psa/23,1');
        await expect(page.locator('#bible-select')).toHaveValue('por/ave-maria');
        await expect(result(page).locator('.passage-heading')).toContainText('(Ave-Maria)');
    });

    test('search history and text search create entries', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await reference(page).fill('Rm 8,28');
        await expect(page).toHaveURL('/por/ave-maria/rom/8,28');
        await reference(page).blur();

        await page.locator('#history-button').click();
        await page.locator('#history-modal .history-list-item', { hasText: 'Jo 3,16' }).click();
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');

        await page.locator('#text-search-button').click();
        await page.locator('#text-search-modal .text-search-input').fill('bem-aventurados os mansos');
        await expect(page.locator('#text-search-modal .text-search-count')).toHaveText('1 resultado');
        await page.locator('#text-search-modal .text-search-input').press('ArrowDown');
        await page.locator('#text-search-modal .text-search-input').press('Enter');
        await expect(page).toHaveURL('/por/ave-maria/mat/5,5');

        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
        await page.goBack();
        await expect(page).toHaveURL('/por/ave-maria/rom/8,28');
    });

    test('the root opens the last reading, with the canonical URL', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await reference(page).fill('Rm 8,28');
        await expect(page).toHaveURL('/por/ave-maria/rom/8,28');

        await page.goto('/');
        await expect(page).toHaveURL('/por/ave-maria/rom/8,28');
        await expect(result(page).locator('.resulting-reference')).toHaveText('(Rm 8,28)');
    });

    test('direct links are normalized to the canonical URL', async ({ page }) => {
        await page.goto('/POR/AVE-MARIA/Mateus/5,3-5');
        await expect(page).toHaveURL('/por/ave-maria/mat/5,3-5');
        await expect(reference(page)).toHaveValue('Mt 5,3-5');

        await page.goto('/por/ave-maria/mt');
        await expect(page).toHaveURL('/por/ave-maria/mat/1');
        await expect(reference(page)).toHaveValue('Mt 1');

        // The book is the USFM id; the field keeps the translation's abbreviation
        await page.goto('/por/ave-maria/JHN/3,16');
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
        await expect(reference(page)).toHaveValue('Jo 3,16');
    });

    test('book with an accent in the URL (Jó is not Jo)', async ({ page }) => {
        await page.goto('/por/ave-maria/J%C3%B3/1,1-3');
        await expect(page).toHaveURL('/por/ave-maria/job/1,1-3');
        await expect(reference(page)).toHaveValue('Jó 1,1-3');
        await expect(result(page).locator('.passage-heading')).toHaveText(/^Jó 1/);
        await expect(result(page).locator('sup')).toHaveText(['1', '2', '3']);
    });

    test('language alone in the URL opens its default Bible', async ({ page }) => {
        await page.goto('/por');
        await expect(page).toHaveURL('/por/ave-maria');
        await expect(page.locator('#bible-select')).toHaveValue('por/ave-maria');
    });

    test('unknown language opens the default Bible and warns', async ({ page }) => {
        await serveAveMariaWithOnly(page, 'GEN');
        await page.goto('/xxx');
        await expect(page.locator('.temporary-message')).toHaveText('Tradução não encontrada');
        await expect(page).toHaveURL('/por/ave-maria');
    });

    test('a link outside the expected format redirects to the root', async ({ page }) => {
        await open(page, 'Jo 3,16');
        await page.goto('/ave-maria/Mt/5');
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
        await expect(page.locator('.temporary-message')).toHaveCount(0);

        // The redirect replaces the entry: Back does not return to the invalid URL
        await page.goBack();
        await expect(page).not.toHaveURL(/\/ave-maria\/Mt\/5$/);
    });

    test('unknown translation opens the default Bible and warns', async ({ page }) => {
        await serveAveMariaWithOnly(page, 'JHN');
        await page.goto('/por/nao-existe/jo/3,16');
        await expect(page.locator('.temporary-message')).toHaveText('Tradução não encontrada');
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
        await expect(result(page).locator('.resulting-reference')).toHaveText('(Jo 3,16)');
    });

    test('failure to load the Bible keeps the input reference in the URL', async ({ page }) => {
        await page.route(/\/por_cnbb\.ebf1\.json/, (route) => route.abort());
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
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
        await expect(page.locator('#bible-select')).toHaveValue('por/ave-maria');
        await expect(page.locator('#bible-file')).toBeHidden();

        await page.goForward();
        await page.goForward();
        await expect(page).toHaveURL('/upload/gen/1,1-2');
        await expect(result(page).locator('.passage-heading')).toHaveText('Gen 1 (Bíblia de Teste)');
    });

    test('links from the previous version redirect to the new URL', async ({ page }) => {
        await page.goto('/?bible=Ave-Maria&quote=Jo%203%2C16');
        const length = await historyLength(page);
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
        await expect(result(page).locator('.resulting-reference')).toHaveText('(Jo 3,16)');
        // The redirect replaces the entry: Back does not return to the old link
        expect(await historyLength(page)).toBe(length);

        await page.goto('/?bible=CNBB&quote=Sl%2023%2C1-3');
        await expect(page).toHaveURL('/por/cnbb/psa/23,1-3');
        await expect(result(page).locator('.passage-heading')).toContainText('(CNBB)');
    });

    test('old link with an unknown translation opens the default Bible and warns', async ({ page }) => {
        await serveAveMariaWithOnly(page, 'JHN');
        await page.goto('/?bible=N%C3%A3o%20Existe&quote=Jo%203%2C16');
        await expect(page.locator('.temporary-message')).toHaveText('Tradução não encontrada');
        await expect(page).toHaveURL('/por/ave-maria/jhn/3,16');
    });

    test('the server serves the page on any SPA path', async ({ request }) => {
        for (const path of ['/por/ave-maria', '/por/ave-maria/mt/5,3-12.21-38', '/por/ave-maria/j%C3%B3/1']) {
            const response = await request.get(path);
            expect(response.ok(), path).toBe(true);
            // The page of the app (index.html), whose screens are drawn by the bundle
            expect(await response.text(), path).toMatch(/<script type="module" crossorigin src="\/assets\/index-[^"]+\.js">/);
        }
    });
});

test.describe('interface language', () => {
    const languageButton = (page: Page) => page.locator('#language-button');
    const languageOption = (page: Page, code: string) => page.locator(`#language-option-${code}`);

    test.describe('browser in English', () => {
        test.use({ locale: 'en-US' });

        test('without a saved choice, follows the browser language', async ({ page }) => {
            await open(page);
            await expect(languageButton(page)).toContainText('eng');
            await expect(page.locator('html')).toHaveAttribute('lang', 'en');
            await expect(page.locator('.page-title')).toHaveText('Choose your translation:');
            await expect(page).toHaveTitle('Jo 3,16 (Ave-Maria) - Open Your Bible!');
            await reference(page).fill('Mt');
            await expect(result(page)).toContainText('Type the book, the chapter and, if you like, the verses');
        });

        test('the saved choice wins over the browser language', async ({ page }) => {
            await page.addInitScript(() => {
                localStorage.setItem('uiLanguage', 'ita');
            });
            await open(page);
            await expect(languageButton(page)).toContainText('ita');
            await expect(page.locator('.page-title')).toHaveText('Scegli la tua traduzione:');
        });
    });

    test.describe('browser in a language with no translation', () => {
        test.use({ locale: 'ko-KR' });

        test('uses the default language of settings.json', async ({ page }) => {
            await open(page);
            await expect(languageButton(page)).toContainText('por');
            await expect(page.locator('.page-title')).toHaveText('Escolha sua tradução:');
        });
    });

    test('lists the 18 languages with flag and code, and translates the page when one is chosen', async ({ page }) => {
        await open(page);
        await expect(languageButton(page)).toContainText('por');
        await languageButton(page).click();
        await expect(page.locator('.language-option')).toHaveCount(18);
        await expect(page.locator('.language-option img')).toHaveCount(18);
        await expect(languageOption(page, 'por')).toHaveAttribute('aria-selected', 'true');

        await languageOption(page, 'deu').click();
        await expect(page.locator('#language-listbox')).toBeHidden();
        await expect(languageButton(page)).toContainText('deu');
        await expect(page.locator('html')).toHaveAttribute('lang', 'de');
        await expect(page.locator('.page-title')).toHaveText('Wähle deine Übersetzung:');
        await expect(page.locator('.book-section .expandable-header')).toContainText('Bücher (73)');
        await expect(page.locator('#bible-select optgroup').first()).toHaveAttribute('label', 'Katholische');
        // The reading is not disturbed
        await expect(page.locator('#bible-select')).toHaveValue('por/ave-maria');
        await expect(result(page).locator('.verse-text')).toContainText('Deus amou o mundo');

        await page.reload();
        await expect(languageButton(page)).toContainText('deu');
        await expect(page.locator('.page-title')).toHaveText('Wähle deine Übersetzung:');
    });

    test('the translation list only has the Bibles of the interface language, plus the open one', async ({ page }) => {
        const values = () => page.locator('#bible-select option').evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
        await open(page);
        expect((await values()).filter((value) => !value.startsWith('por/'))).toEqual(['upload']);

        // Changing the language does not disturb the reading: the open Bible stays in the list
        await languageButton(page).click();
        await languageOption(page, 'eng').click();
        const english = await values();
        expect(english.filter((value) => value.startsWith('eng/')).length).toBeGreaterThan(5);
        expect(english.filter((value) => value.startsWith('por/'))).toEqual(['por/ave-maria']);
        await expect(page.locator('#bible-select')).toHaveValue('por/ave-maria');

        // Choosing one of the language's Bibles takes the other language's one out of the list
        await page.locator('#bible-select').selectOption({ label: 'King James Version' });
        await expect(page.locator('#bible-select')).toHaveValue('eng/king-james-version');
        expect((await values()).filter((value) => value.startsWith('por/'))).toEqual([]);
        // The book in the field goes through its USFM id to the new Bible's abbreviation ("Jo" -> JHN -> "John")
        await expect(reference(page)).toHaveValue('John 3,16');
        await expect(result(page).locator('.passage-heading')).toHaveText('John 3 (King James Version)');
        await expect(page).toHaveURL(/\/eng\/king-james-version\/jhn\/3,16$/);
    });

    test('a link to a Bible of another language opens it and lists it', async ({ page }) => {
        await open(page, 'John 3,16', 'eng/king-james-version');
        const values = await page.locator('#bible-select option').evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
        expect(values.filter((value) => !value.startsWith('por/'))).toEqual(['eng/king-james-version', 'upload']);
        await expect(result(page).locator('.passage-heading')).toHaveText('John 3 (King James Version)');
    });

    test('translates modals and messages, also after a change of language', async ({ page }) => {
        await open(page);
        await page.locator('#history-button').click();
        await expect(page.locator('#history-modal .app-modal-title')).toHaveText('Histórico de buscas');
        await page.locator('#history-modal .close-modal').click();

        await languageButton(page).click();
        await languageOption(page, 'eng').click();
        await page.locator('#history-button').click();
        await expect(page.locator('#history-modal .app-modal-title')).toHaveText('Search history');
        await page.locator('#history-modal .close-modal').click();

        await reference(page).fill('Xx 1');
        await expect(result(page)).toContainText('Book "Xx" not found.');
    });

    test('works with the keyboard', async ({ page }) => {
        await open(page);
        await languageButton(page).focus();
        await page.keyboard.press('ArrowDown');
        await expect(languageButton(page)).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.type('fr');
        await page.keyboard.press('Enter');
        await expect(languageButton(page)).toContainText('fra');
        await expect(languageButton(page)).toHaveAttribute('aria-expanded', 'false');

        await page.keyboard.press('Enter');
        await expect(languageButton(page)).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape');
        await expect(languageButton(page)).toHaveAttribute('aria-expanded', 'false');
        await expect(languageButton(page)).toContainText('fra');
    });

    test('Arabic and Urdu mirror the page; the Bible text keeps its own direction', async ({ page }) => {
        await open(page);
        await languageButton(page).click();
        await languageOption(page, 'arb').click();
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
        await expect(result(page).locator('.verse-text')).toContainText('Deus amou o mundo');
        await expect(result(page)).toHaveAttribute('dir', 'auto');

        await languageButton(page).click();
        await languageOption(page, 'eng').click();
        await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    });

    test('the translation row fits on the screen, with the language to the left of the translation', async ({ page }) => {
        await open(page);
        const viewport = page.viewportSize();
        const language = await languageButton(page).boundingBox();
        const select = await page.locator('#bible-select').boundingBox();
        const theme = await page.locator('#theme-button').boundingBox();
        expect(language && select && theme).toBeTruthy();
        if (!language || !select || !theme || !viewport) return;
        expect(language.x + language.width).toBeLessThanOrEqual(select.x);
        expect(select.x + select.width).toBeLessThanOrEqual(theme.x + 1);
        expect(theme.x + theme.width).toBeLessThanOrEqual(viewport.width);
        // Same line
        expect(Math.abs(language.y - select.y)).toBeLessThan(4);

        // The open list is within the screen too
        await languageButton(page).click();
        const list = await page.locator('#language-listbox').boundingBox();
        expect(list && list.x >= 0 && list.x + list.width <= viewport.width).toBe(true);
    });
});
