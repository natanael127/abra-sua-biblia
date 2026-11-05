<!-- About page (/about): who made the site and the translations, contact and version of the page. -->
<script lang="ts">
    import { t } from '../../i18n/reactive.svelte';
    import MenuButton from '../../ui/components/MenuButton.svelte';

    /** The screen's root element, which the router shows and hides. */
    let { root = $bindable() }: { root?: HTMLElement } = $props();

    const credits = $derived([
        { role: t('about.developedBy'), name: 'Natanael de Souza Figueiredo', href: 'https://github.com/natanael127' },
        { role: t('about.translationsAveMariaCnbb'), name: 'Gustavo Monteiro Gonçalves', href: 'https://yourmenial.blogspot.com/' },
        { role: t('about.translationsAaAcfNvi'), name: 'Thiago Bodruk', href: 'https://github.com/thiagobodruk/bible' },
        { role: t('about.translationPadreMatosSoares'), name: 'Hans Mateus Boron', href: 'https://catolicoabencoai.app.br/' },
    ]);
</script>

<div id="about" class="main-content" hidden bind:this={root}>
    <div class="container">
        <div class="page-header">
            <MenuButton />
            <h2 class="screen-title"><span aria-hidden="true">ℹ️</span> {t('menu.about')}</h2>
        </div>

        <p class="about-intro">{t('app.description')}</p>

        <section class="about-section">
            <h3>{t('about.credits')}</h3>
            <ul class="credits">
                {#each credits as credit (credit.href)}
                    <li>
                        <span class="credit-role">{credit.role}</span>
                        <a href={credit.href} target="_blank" rel="noopener noreferrer">{credit.name}</a>
                    </li>
                {/each}
            </ul>
        </section>

        <section class="about-section">
            <h3>{t('about.contact')}</h3>
            <p>
                <a href="mailto:contato@abrasuabiblia.com.br" target="_blank" rel="noopener noreferrer">contato@abrasuabiblia.com.br</a>
            </p>
        </section>

        <!-- Commit hash and date of the build (scripts/build-version.ts) -->
        <p id="build-version" class="build-version"><span>{t('about.version')}</span> {__PAGE_VERSION__}</p>
    </div>
</div>

<style>
    .about-intro {
        margin: 0;
        font-size: 18px;
        color: var(--text-secondary);
    }

    .about-section {
        padding: 15px 20px;
        border: 1px solid var(--border-light);
        border-radius: 8px;
        background-color: var(--bg-secondary);
    }

    .about-section h3 {
        margin: 0 0 10px;
        font-size: 17px;
        color: var(--link-color);
    }

    .about-section p {
        margin: 0;
    }

    .credits {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 12px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .credits li {
        display: flex;
        flex-direction: column;
    }

    .credit-role {
        font-size: 14px;
        color: var(--text-secondary);
    }

    .build-version {
        margin: 0;
        text-align: center;
        color: var(--text-secondary);
    }
</style>
