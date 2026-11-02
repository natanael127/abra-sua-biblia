# Abra sua Bíblia!

Site para ler a Bíblia na tradução de sua preferência: https://www.abrasuabiblia.com.br

Feito em TypeScript com [Vite](https://vite.dev), publicado na [Vercel](https://vercel.com).

## Desenvolvimento

Requer Node.js 24.

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção em dist/
npm run preview    # serve o build de produção (necessário para testar o service worker)
```

Para reproduzir o ambiente da Vercel localmente (usa o `vercel.json`):

```bash
npm i -g vercel
vercel dev         # desenvolvimento
vercel build       # build idêntico ao de produção, em .vercel/output
```

## Testes

```bash
npm run check      # typecheck + lint + testes unitários
npm run test:e2e   # testes de ponta a ponta (Playwright) sobre o build de produção
```

Na primeira execução dos testes E2E, instale o navegador com `npx playwright install chromium`.

## Dependências e `npm audit`

Nenhuma dependência de produção tem vulnerabilidade conhecida (`npm audit --omit=dev`). O que
o `npm audit` ainda lista está só nas ferramentas de build e não vai para o site.

O `package.json` força duas versões (`overrides`) por causa de dependências transitivas:

- `glob` ^14.0.3: o `workbox-build` 7.4.1 (a última 7.x) usa o `glob` 11, deprecado e vulnerável;
- `minimatch` ^11.0.4: corrige o DoS por padrões de glob (GHSA-g3hv-75wg-m249) em `eslint`,
  `typescript-eslint` e no `workbox-build`.

Se uma atualização do `eslint`, do `typescript-eslint` ou do `workbox-build` passar a exigir
outra versão deles, remova o override e rode `npm run check` e `npm run build`.

Risco aceito: `deepmerge` 4.3.1 (poluição de protótipo em `mergeObject()`, severidade baixa,
GHSA-gcqx-w48m-w2h4), usado pelo `@rollup/plugin-node-resolve` dentro do `workbox-build` e do
`vite-plugin-pwa`. Não há versão corrigida (a 4.3.1 é a última), e ele só mescla as opções do
build, que são nossas. É por isso que o `npm audit` ainda mostra 4 vulnerabilidades baixas
(`deepmerge` e os três pacotes que dependem dele). Reavalie quando o `workbox-build` trocar de
dependência.

## Estrutura

```
index.html              página (ponto de entrada do Vite)
settings.json           configuração do site (Bíblia padrão)
src/
  core/                 lógica pura: formato EBF1, referências, renderização, busca, XML
  data/                 carregamento do índice e das Bíblias
  router/               roteador da SPA (History API), independente das telas
  screens/              telas; reader/ é a de leitura (/{bíblia}/{livro}/{trecho})
  ui/                   tema, modais, mensagens, preferências
  sw/                   service worker (Workbox)
  app.ts                registro das telas e das rotas
public/                 copiado sem alteração para o build
  assets/data/          Bíblias (*.ebf1.json) e o index.json gerado no build
  assets/icons/
  manifest.json
scripts/                build-index.ts (gera o index.json) e check-dist.mjs
tests/                  testes unitários (Vitest)
e2e/                    testes de ponta a ponta (Playwright)
```

## Bíblias

As Bíblias ficam em `public/assets/data/bibles` no formato
[Easy Bible Format (EBF1)](https://github.com/natanael127/easy-bible-format) e são publicadas
exatamente como estão no repositório, para que possam ser baixadas e usadas em outros projetos:

- os testes validam todas elas contra o schema oficial (`ebf1-schema.json`), que vem do
  repositório do formato como dependência npm fixada num commit (`easy-bible-format` no
  `package.json`). Para atualizar o schema, troque o hash do commit e rode `npm install`;
- `scripts/check-dist.mjs` roda ao fim de cada build e falha se algum arquivo publicado diferir
  da origem.

Para adicionar uma Bíblia, basta colocar o arquivo `.ebf1.json` em `public/assets/data/bibles`.
O índice (`public/assets/data/index.json`, fora do git) é gerado por `scripts/build-index.ts` a
cada `npm run build` e `npm run dev`: nome, tipo (católica/evangélica pela quantidade de livros)
o idioma (ISO 639-3) e o slug da URL, tirados do nome do arquivo (`por_ave_maria.ebf1.json` →
`/por/ave-maria`, que abre em `/por/ave-maria/jo/3,16`). O nome do arquivo precisa começar pelo
idioma. O build falha se houver nome repetido ou slug repetido no mesmo idioma.

A Bíblia aberta na primeira visita fica no `settings.json`, por idioma e slug:

```json
{
    "defaultBible": "por/ave-maria"
}
```
