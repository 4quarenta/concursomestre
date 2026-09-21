# Consolidacao da Plataforma Next

## Objetivo

Consolidar a plataforma web em Next.js na raiz do repositorio, mantendo a UI e a funcionalidade da plataforma web original e preparando a versao `1.0.0` para auditoria de producao.

## Branch oficial

- `1.0.0`

## Principios

- o Next e a base operacional padrao do web neste branch
- a SPA anterior fica preservada no historico Git, nao na arvore ativa
- o historico consolidado do antigo `master` e a referencia para paridade visual e funcional
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
- cache `.next/dev` limpo e servidor dev reiniciado na raiz em `2026-04-19` para eliminar manifests antigos
- smoke HTTP em dev: `/`, `/auth`, `/practice`, `/profile`, `/profile/personal`, `/admin`, `/admin/operation/questions`, `/marketplace`, `/planos`, `/plans`, `/checkout/1`, `/checkout/termos-de-adesao`, `/ranking`, `/notifications`, `/support`, `/question/1`, `/ranking/1`, `/material/1`, `/promo/teste`, `/elite`, `/faq`, `/terms`, `/privacy`, `/simulation`, `/x-ray`, `/performance/subjects`, `/read/1`, `/l/teste` e `/partner-dashboard` responderam `200`
- `npm run typecheck`: ok na raiz apos realinhar os tipos da plataforma restaurada
- `npm run check:text-encoding`: ok apos a rodada de limpeza
- `npx vitest run` nas suites web criticas: `55` testes passaram em `2026-04-19`
- `npm run build`: nao executado nesta retomada por instrucao explicita
- `docs/reports/next-root-parity-audit-latest.md`: auditoria textual inicial de paridade contra `master`
- `docs/ADMIN_PANEL_REBUILD_BLUEPRINT.md`: inventario atual do admin e diretrizes da futura recriacao total do painel apos a migracao Next
- `docs/PRODUCTION_READINESS_AUDIT_PLAN.md`: trilha formal da etapa 4 para limpeza, auditorias e preparacao de producao
- `docs/reports/root-cleanup-inventory-latest.md`: primeira rodada documentada de limpeza da raiz apos a consolidacao do Next
- `docs/reports/documentation-audit-latest.md`: classificacao da documentacao entre material operacional atual e historico preservado
- `docs/reports/code-cleanup-audit-latest.md`: primeira rodada de limpeza de residuos tecnicos no codigo ativo
- typegen do Next confirma que rotas acidentais como `/dashboard`, `/bank-analysis`, `/landing`, `/landing-campaign`, `/performance-subjects`, `/reader` e `/ranking-detail` nao fazem parte do mapa ativo
- autenticacao HTTP no backend local validada em `2026-04-19` com resposta `Login successful`; erros antigos de `auth_sessions` no log do dev deixaram de ser a referencia operacional atual

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
- regras especificas do roteador antigo preservadas no Next: admin sem sessao salva `redirectAfterLogin` e vai para `/auth`; admin sem permissao volta para `/`; `partner-dashboard` sem sessao volta para `/`
- compatibilidade com rotas antigas em hash e persistencia de rota restaurada na casca Next
- `page.tsx` reservado para rotas canonicas do `master`; componentes internos de dashboard, landing, checkout, materiais, questoes, promo, leitor, raio-x e desempenho foram renomeados para nao criar URLs extras
- wrappers canonicos do App Router voltaram a montar com `PageTransition` nas rotas equivalentes ao roteador antigo: `/`, `/checkout/[planId]`, `/checkout/termos-de-adesao`, `/l/[slug]`, `/material/[id]/[[...slug]]`, `/promo/[slug]`, `/question/[id]/[[...slug]]`, `/ranking/[id]/[[...slug]]`, `/read/[id]`, `/x-ray` e `/performance/subjects`
- parametros catch-all do Next normalizados em paginas publicas de SEO e no admin para preservar slugs e subsecoes
- cache `.next` da raiz foi limpo integralmente em `2026-04-19` para remover manifests stale que faziam o App Router responder apenas `/_not-found`
- worker do PDF.js ajustado para o build `legacy` e carregamento sob demanda no leitor de materiais e nos fluxos administrativos, eliminando os avisos novos nas requisicoes recentes do dev server
- `PageTransition` voltou a ser aplicado na casca global de rotas do Next, preservando o comportamento do roteador antigo sem espalhar wrappers locais
- `src/app/layout.tsx` voltou a carregar a fonte `Inter` no `head`, como o frontend original carregava em `index.html`
- `src/app/globals.css` voltou a declarar `dark` por classe no Tailwind v4 e `src/app/layout.tsx` aplica `font-sans` no `body`, espelhando o comportamento visual do frontend original
- o frame global do Next voltou a respeitar as telas que no roteador antigo ficavam fora do shell principal: `/auth`, `/reset-password`, `/confirm-email`, `/terms`, `/privacy`, `/changelog`, `/planos`, `/elite`, `/checkout`, `/read`, `/subscription`, `/l/[slug]`, `/partner-dashboard` e o redirecionamento puro de `/profile`
- a amostra critica de paridade em `plans`, `marketplace`, `practice`, `simulation` e `checkout` confirmou que o delta restante e tecnico: App Router, `next/link`, `next/navigation`, `use client` e adaptacoes de SSR
- a rodada complementar em `dashboard`, `landing`, `profile`, `checkout` e `reader` confirmou o mesmo padrao: componentes renomeados para evitar URLs acidentais no App Router preservam a implementacao do `master`, com delta concentrado em `use client`, navegacao do Next, `Link`, tipos e protecoes SSR
- `typecheck`, `check:text-encoding` e smoke HTTP das rotas criticas seguiram verdes apos essa rodada
- `npm run build` continua fora desta rodada ate nova autorizacao

### Etapa 4 - Preparacao para producao

- pendente
- primeira rodada de limpeza estrutural ja iniciada e registrada em `docs/reports/root-cleanup-inventory-latest.md`
- auditoria documental inicial concluida; dossies historicos de arquitetura/admin foram movidos para `docs/history/`
- limpeza inicial de residuos tecnicos concluida em scripts locais e no admin financeiro, registrada em `docs/reports/code-cleanup-audit-latest.md`
- preparar auditoria de codigo
- preparar auditoria de seguranca
- preparar auditoria de pagamentos
- preparar auditoria de SEO
- preparar auditoria do painel admin
- preparar analytics de receita e indicadores operacionais
- preparar changelog `1.0.0`, excluindo funcionalidades marcadas como desativadas no painel admin

## Proxima macrofase planejada

Depois do fechamento da migracao Next da plataforma web, a proxima macrofase prevista e a recriacao total do painel admin. O inventario funcional atual e as diretrizes dessa etapa estao registrados em `docs/ADMIN_PANEL_REBUILD_BLUEPRINT.md`.

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
