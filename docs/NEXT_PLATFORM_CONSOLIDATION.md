# Consolidacao da Plataforma Next

## Objetivo

Transformar o `web-next` na base principal do web da plataforma, mantendo a SPA Vite atual apenas como legado controlado durante a transicao.

## Branch de trabalho

- `4quarenta/next-version`

## Principios

- o Next passa a ser a base operacional padrao do web
- a SPA antiga deixa de ser a experiencia principal e passa a ser tratada como legado
- nenhuma etapa de auditoria deve depender de memoria informal
- toda decisao de transicao deve gerar evidencias em `docs/` ou `docs/reports/`
- a versao alvo continua sendo `1.0.0`

## Estado atual em 2026-04-18

- branch ativa da consolidacao: `4quarenta/next-version`
- `npm run dev`, `build`, `start` e `typecheck` na raiz agora representam o `web-next`
- `npm run build`: `ok`
- `npm run typecheck`: `ok`
- `npm run web-next:hybrid-local-check`: `ok`
- `npm run web-next:legacy-bridge-check`: `ok`
- a validacao do legado foi isolada em `tsconfig.legacy.json`
- `npm install` na raiz agora bootstrapa o `web-next` via `postinstall`, evitando falha de CI/Vercel em ambientes limpos
- `npm run legacy-web:typecheck` agora ignora `docs/`, `mobile/` e `web-next/`, expondo apenas a divida real da SPA Vite
- `npm run legacy-web:inventory` passa a gerar evidencias reproduziveis do legado em `docs/reports/`
- `npm run legacy-web:debt-report` passa a agrupar a divida de typecheck por dominio e arquivo
- o inventario inicial do legado ativo foi aberto em `docs/LEGACY_WEB_INVENTORY.md`
- em modo hibrido local validado, o legado respondeu em `http://localhost:3000` e o Next respondeu em `http://localhost:3001`
- o inventario atual registra `26` roots em overlap exato, `8` roots apenas no legado e `8` roots apenas no Next
- o debt report atual registra `70` erros de typecheck em `29` arquivos e `15` dominios do legado
- um alinhamento estrutural de aliases em `tsconfig.json` e `vite.config.ts` ja removeu parte da divida inicial do legado
- os fluxos `auth`, `confirm-email`, `reset-password`, `support`, `notifications`, `dashboard`, `subscription/[status]`, `ranking`, `concursos`, `flashcards`, `lei-comentada`, `performance/subjects`, `x-ray`, `read/[id]`, `checkout/[planId]`, `marketplace`, `partner-dashboard` e `profile/[[...slug]]` ja nao dependem mais de `buildLegacyUrl`
- ainda restam `3` entrypoints em `web-next/src/app` que encaminham para a SPA legada

## Leitura atual do legado

Os erros reais ainda ativos na SPA antiga estao concentrados principalmente em:

- admin database, taxonomias, exams, finance, marketing, panel, settings e support
- profile, router, subscriptions, providers e questions
- checkout, simulation, layout compartilhado e overlays
- contratos divergentes entre tipos de dominio e componentes
- pontos de assinaturas de callback e retorno que deixaram de bater com as tipagens atuais

Isso confirma duas coisas:

- a raiz ja pode operar o web principal em Next com seguranca
- ainda nao e hora de remover o legado Vite, porque ele permanece como fonte ativa de modulos administrativos, autenticados e de leitura/checkout avancado

## Pontes ainda ativas

As rotas abaixo ainda sao bridges explicitas para o legado:

- `admin/[[...slug]]`
- `practice`
- `simulation`

As entradas abaixo ja foram absorvidas pelo Next nesta fase:

- `auth`
- `checkout/[planId]`
- `concursos`
- `confirm-email`
- `dashboard`
- `flashcards`
- `lei-comentada`
- `marketplace`
- `notifications`
- `partner-dashboard`
- `performance/subjects`
- `profile/[[...slug]]`
- `ranking`
- `reset-password`
- `read/[id]`
- `subscription/[status]`
- `support`
- `x-ray`

## Etapas da consolidacao

### Etapa 1 - Base operacional na raiz

- tornar os comandos principais da raiz orientados ao Next
- manter a SPA anterior acessivel por comandos `legacy-web:*`
- documentar o estado de transicao

### Etapa 2 - Isolamento do legado

- mapear o que ainda depende da SPA Vite
- decidir o que fica temporariamente legado e o que sera absorvido
- preparar a futura limpeza de arquivos nao utilizados

### Etapa 3 - Auditoria funcional e estrutural

- inventariar modulos ativos
- identificar arquivos mortos, bridges temporarios e duplicacoes
- revisar padrao de diretorios e ownership por dominio

### Etapa 4 - Preparacao para producao

- auditoria de codigo
- auditoria de seguranca
- auditoria de pagamentos
- auditoria de SEO
- auditoria do painel admin
- auditoria de analytics de receita e indicadores operacionais

## Condicao de saida da consolidacao

A consolidacao da base Next na raiz e considerada pronta quando:

- `npm run dev` passa a subir o Next por padrao
- `npm run build` e `npm run start` passam a representar a base Next
- a SPA anterior fica claramente rotulada como legado
- o programa de auditoria fica documentado por etapas

## Status por etapa

- Etapa 1 - Base operacional na raiz: concluida
- Etapa 2 - Isolamento do legado: em andamento
- Etapa 3 - Auditoria funcional e estrutural: preparada para iniciar a partir do inventario do legado
- Etapa 4 - Preparacao para producao: documentada, aguardando a consolidacao estrutural anterior
