# Consolidacao da Plataforma Next

## Objetivo

Consolidar a plataforma web em Next.js na raiz do repositorio, com a versao `1.0.0` pronta para a proxima rodada de auditoria de producao.

## Branch de trabalho

- `4quarenta/next-version`

## Principios

- o Next e a base operacional padrao do web
- a SPA Vite antiga fica preservada no branch `master`, nao na arvore ativa deste branch
- nenhuma etapa de auditoria deve depender de memoria informal
- toda decisao de transicao deve gerar evidencias em `docs/` ou `docs/reports/`
- a versao alvo continua sendo `1.0.0`

## Estado atual em 2026-04-18

- `src/` contem a aplicacao Next principal
- `web-next/` foi promovida para a raiz e removida da arvore ativa
- `npm run dev`, `build`, `start` e `typecheck` representam o Next na raiz
- os aliases `web-next:*` permanecem por compatibilidade com runbooks e relatorios
- os workflows de GitHub Actions instalam somente `package-lock.json` da raiz
- o app mobile Expo permanece isolado em `mobile/`
- nao existe entrypoint ativo chamando `buildLegacyUrl` ou `legacyRedirect`
- a SPA Vite antiga deve ser consultada no branch `master` quando for necessario comparar comportamento historico

## Transicoes concluidas

As entradas abaixo foram absorvidas pelo Next antes da consolidacao fisica:

- `admin/[[...slug]]`
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
- `practice`
- `profile/[[...slug]]`
- `ranking`
- `reset-password`
- `read/[id]`
- `simulation`
- `subscription/[status]`
- `support`
- `x-ray`

## Transicao de practice e simulation

Em `2026-04-18`, `practice` e `simulation` foram retirados da ponte legada e passaram a ter implementacao nativa no Next.

- `practice` carrega questoes pelo endpoint `questionsList`, aceita filtros canonicos da URL antiga, abre questao isolada via `questionId`, registra respostas autenticadas em `questionsAnswer` e alterna salvos por `questionsToggleSave`.
- `simulation` monta sessoes a partir do banco de questoes do Next, aplica recortes locais por materia, assunto, banca, ano e dificuldade, controla cronometro, registra respostas individuais e tenta persistir a sessao completa em `simulationsCreate`.
- comentarios completos, denuncias, notas por questao e overlays premium permanecem como itens de auditoria funcional antes da versao final de producao.

## Transicao do admin

Em `2026-04-18`, `admin/[[...slug]]` deixou de redirecionar para o legado e passou a renderizar um shell administrativo nativo no Next.

- links como `/admin?section=overview` e `/admin/settings/seo` sao resolvidos pela camada `adminNavigation`
- o painel carrega dados autenticados por `admin/stats.php`, `usersList`, `materialsList`, `transactionsList`, `reportsList`, `admin/feedback.php`, `settings.php` e `system/logs.php`
- o admin Next cobre dashboard executivo, usuarios, materiais, receita/transacoes, suporte, landing pages, modulos, configuracoes gerais, SEO e logs
- CRUD profundo de questoes, importador, taxonomias, moderacao granular e testes guiados de pagamento ficam no roteiro da auditoria funcional

## Etapas da consolidacao

### Etapa 1 - Base operacional na raiz

- concluida
- comandos principais da raiz apontam para Next
- CI e Vercel devem usar `npm ci` e `npm run build` na raiz

### Etapa 2 - Isolamento do legado

- concluida
- codigo Vite foi removido da arvore ativa deste branch
- backup historico fica no branch `master`
- a documentacao registra o que foi absorvido e o que precisa de auditoria funcional

### Etapa 3 - Auditoria funcional e estrutural

- proxima etapa operacional
- revisar arquivos mortos, duplicacoes e ownership por dominio
- conferir paridade de fluxos sensiveis: login, checkout, assinaturas, admin, questoes, simulados e materiais

### Etapa 4 - Preparacao para producao

- preparar auditoria de codigo
- preparar auditoria de seguranca
- preparar auditoria de pagamentos
- preparar auditoria de SEO
- preparar auditoria do painel admin
- preparar analytics de receita e indicadores operacionais

## Condicao de saida desta consolidacao

A consolidacao da base Next na raiz fica pronta quando:

- `npm run typecheck` passa na raiz
- `npm run build` passa na raiz
- os workflows nao apontam para `web-next/package-lock.json`
- a documentacao deixa claro que `web-next/` foi promovida e removida
- o servidor local roda Next a partir da raiz

## Status por etapa

- Etapa 1 - Base operacional na raiz: concluida
- Etapa 2 - Isolamento do legado: concluida
- Etapa 3 - Auditoria funcional e estrutural: preparada para iniciar apos validacao de build
- Etapa 4 - Preparacao para producao: documentada, aguardando auditoria da Etapa 3
