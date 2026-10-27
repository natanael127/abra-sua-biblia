# Abra sua Bíblia!

Site para ler a Bíblia na tradução de sua preferência: https://www.abrasuabiblia.com.br

Feito em TypeScript com [Vite](https://vite.dev), publicado na [Vercel](https://vercel.com).

## Desenvolvimento

Requer Node.js 22.12 ou superior.

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

## Estrutura

```
index.html              página (ponto de entrada do Vite)
src/
  core/                 lógica pura: formato EBF1, referências, renderização, busca, XML
  data/                 carregamento do índice e das Bíblias
  ui/                   tema, modais, mensagens, preferências
  sw/                   service worker (Workbox)
  app.ts                ligação entre a página e os módulos
public/                 copiado sem alteração para o build
  assets/data/          index.json e as Bíblias (*.ebf1.json)
  assets/icons/
  manifest.json
scripts/                build_index.py e check-dist.mjs
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

Ao adicionar uma Bíblia, coloque o arquivo `.ebf1.json` em `public/assets/data/bibles` e
regenere o índice:

```bash
python3 scripts/build_index.py
```
