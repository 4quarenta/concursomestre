# Consolidacao da Plataforma Next

## Objetivo

Consolidar a plataforma web em Next.js na raiz do repositorio, mantendo a UI e a funcionalidade da plataforma web original e preparando a versao `1.0.0` para auditoria de producao.

## Branch de trabalho

- `4quarenta/next-version`

## Principios

- o Next e a base operacional padrao do web neste branch
- a SPA anterior fica preservada no branch `master`, nao na arvore ativa
- o branch `master` e a referencia historica para paridade visual e funcional
- nenhuma etapa de auditoria deve depender de memoria informal
- toda decisao de transicao deve gerar evidencia em `docs/`
- a versao alvo continua sendo `1.0.0`

## Estado atual em 2026-04-19

- `src/` contem a aplicacao Next principal
- os comandos `npm run dev`, `npm run start` e `npm run typecheck` operam a raiz
- `npm run build` existe para CI/deploy, mas nao foi executado nesta rodada por instrucao explicita
- o app mobile Expo permanece isolado em `mobile/`
- nao existe app web separado dentro deste branch
- a tentativa anterior separada foi removida dos scripts, workflows, templates e relatorios ativos
- o projeto do Vercel deve usar a raiz do repositorio como `Root Directory`

## Reinicio frio da migracao

Em `2026-04-18`, a tentativa visual anterior foi descartada porque alterava a experiencia logada. A base ativa passou a seguir esta regra:

- restaurar a plataforma web a partir do branch `master`
- converter para Next sem redesenhar UI
- manter fluxos reais de login, cadastro, checkout, admin, questoes, simulados e materiais
- aceitar apenas ajustes tecnicos necessarios para App Router, SSR e providers globais

## Evidencias recentes

- `npm run dev`: ativo na raiz pela porta `3000`
- smoke HTTP em dev: `/`, `/auth`, `/practice`, `/profile/personal`, `/admin`, `/admin/operation/questions`, `/marketplace`, `/planos`, `/plans`, `/checkout/1`, `/ranking`, `/notifications`, `/support`, `/question/1`, `/ranking/1`, `/material/1`, `/promo/teste`, `/elite`, `/faq`, `/terms`, `/privacy` e `/simulation` responderam `200`
- `npm run typecheck`: ok na raiz apos realinhar os tipos da plataforma restaurada
- `npm run check:text-encoding`: ok apos a rodada de limpeza
- `npm run build`: nao executado nesta retomada por instrucao explicita
- `docs/reports/next-root-parity-audit-latest.md`: auditoria textual inicial de paridade contra `master`

## Etapas da consolidacao

### Etapa 1 - Base operacional na raiz

- concluida
- comandos principais da raiz apontam para Next
- CI e Vercel devem usar a raiz do repositorio

### Etapa 2 - Isolamento do backup historico

- concluida
- o backup historico fica no branch `master`
- a arvore ativa deste branch nao deve carregar a SPA anterior como codigo produtivo
- a documentacao registra que comparacoes devem ser feitas contra `master`
- snapshots antigos de codigo dentro de `docs/legacy/workspace-backups` foram removidos da arvore ativa

### Etapa 3 - Auditoria funcional e estrutural

- em andamento
- validar paridade visual 1:1 contra o branch `master`
- revisar arquivos mortos, duplicacoes e ownership por dominio
- conferir fluxos sensiveis: login, cadastro, checkout, assinaturas, admin, questoes, simulados e materiais
- manter somente scripts e documentos que representem a plataforma Next consolidada na raiz
- limpeza de scripts, workflows, templates e relatorios da tentativa separada concluida em `2026-04-19`
- guardas globais do roteador antigo realinhados no Next: admin, manutencao, problema de pagamento, `loginRequired`, feature flags, loader, debug e rastreador de estudo
- compatibilidade com rotas antigas em hash e persistencia de rota restaurada na casca Next
- `npm run build` continua fora desta rodada ate nova autorizacao

### Etapa 4 - Preparacao para producao

- pendente
- preparar auditoria de codigo
- preparar auditoria de seguranca
- preparar auditoria de pagamentos
- preparar auditoria de SEO
- preparar auditoria do painel admin
- preparar analytics de receita e indicadores operacionais
- preparar changelog `1.0.0`, excluindo funcionalidades marcadas como desativadas no painel admin

## Condicao de saida da consolidacao

A consolidacao da base Next na raiz fica pronta quando:

- `npm run typecheck` passa na raiz
- a paridade visual e funcional contra `master` esta auditada
- os workflows e scripts ativos nao apontam para a tentativa separada descartada
- a documentacao deixa claro que o deploy oficial do web parte da raiz do repositorio
- o servidor local roda Next a partir da raiz
- `npm run build` e liberado e validado antes do deploy real

## Status por etapa

- Etapa 1 - Base operacional na raiz: concluida
- Etapa 2 - Isolamento do backup historico: concluida
- Etapa 3 - Auditoria funcional e estrutural: em andamento
- Etapa 4 - Preparacao para producao: pendente
