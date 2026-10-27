import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

const FIXTURES = 'tests/fixtures/xml';

/** Abre a página com a Bíblia e a referência informadas e espera a Bíblia carregar. */
async function open(page: Page, quote = 'Jo 3,16', bible = 'Ave-Maria') {
    await page.goto(`/?bible=${encodeURIComponent(bible)}&quote=${encodeURIComponent(quote)}`);
    await expect(page.locator('#bible-select')).toHaveValue(bible);
    await waitForBible(page);
}

/** A lista de livros só é preenchida depois que a Bíblia termina de carregar. */
async function waitForBible(page: Page) {
    await expect(page.locator('.book-item').first()).toBeAttached();
}

const result = (page: Page) => page.locator('#result');
const reference = (page: Page) => page.locator('#reference');

test.beforeEach(async ({ context }) => {
    // Sem Google Analytics nos testes
    await context.route(/googletagmanager|google-analytics/, (route) => route.abort());
});

test('exibe a referência do link compartilhado', async ({ page }) => {
    await open(page, 'Jo 3,16');
    await expect(result(page).locator('.reference')).toHaveText('João 3 (Ave-Maria)');
    await expect(result(page).locator('.verse-text')).toContainText('Deus amou o mundo');
    await expect(result(page).locator('.verse-reference')).toHaveText('(Jo 3,16)');
});

test('primeira visita sem parâmetros abre a Bíblia padrão do índice', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#bible-select')).toHaveValue('Ave-Maria');
    await waitForBible(page);
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

    // Sem parâmetros na URL, vale a preferência salva
    await page.goto('/');
    await expect(page.locator('#bible-select')).toHaveValue('Edição Pastoral');
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

test('busca textual ignora acentos e destaca o texto original', async ({ page }) => {
    await open(page);
    await page.locator('#text-search-button').click();
    const modal = page.locator('#text-search-modal');
    await modal.locator('.text-search-input').fill('puros de coracao');
    await expect(modal.locator('.text-search-result-citation')).toHaveText(['Mateus 5,8']);
    await expect(modal.locator('mark')).toHaveText('puros de coração');
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

    test('compartilha um link que reabre a mesma referência', async ({ page, baseURL }) => {
        await open(page, 'Jo 3,16');
        await page.locator('#share-button').click();
        await expect(page.locator('.temporary-message')).toHaveText('Link copiado');
        const link = await page.evaluate(() => navigator.clipboard.readText());
        expect(link).toBe(`${baseURL}/?bible=Ave-Maria&quote=Jo%203%2C16`);
    });
});

test.describe('upload de Bíblia', () => {
    async function chooseUpload(page: Page) {
        await open(page, 'Gen 1,1-2');
        await page.locator('#bible-select').selectOption('upload');
        await expect(page.locator('#bible-file')).toBeVisible();
    }

    test('converte OSIS e permite baixar o EBF1', async ({ page }) => {
        await chooseUpload(page);
        await page.locator('#bible-file').setInputFiles(`${FIXTURES}/sample.osis.xml`);
        await expect(result(page).locator('.reference')).toHaveText('Gen 1 (Bíblia de Teste)');
        await expect(page.locator('.book-section .expandable-header')).toContainText('Livros (3)');

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

test('seção Sobre termina com a versão do build (git describe)', async ({ page }) => {
    await open(page);
    await page.locator('#about-footer .expandable-header').click();
    const version = page.locator('#about-footer .expandable-content > :last-child');
    await expect(version).toHaveId('build-version');
    await expect(version).toHaveText(/^(v\d+\.\d+\.\d+(-\d+-g[0-9a-f]+)?|[0-9a-f]{7,})(-dirty)?$/);
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
});
