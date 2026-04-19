# Mapa Funcional para Rebuild Total do Admin

Data: `2026-04-19`

## Escopo

Este documento congela o inventario funcional que o novo painel admin precisa preservar antes de qualquer reescrita visual/arquitetural.

A regra desta macrofase e direta: o admin atual serve como fonte de inventario, nao como base de UI nem como casca a ser remendada.

## Fontes verificadas

- `src/app/admin/config/adminPageNavigationConfig.ts`
- `src/app/admin/components/shared/AdminPageContent.tsx`
- `src/app/admin/components/shared/useAdminPageController.tsx`
- `docs/ADMIN_PANEL_REBUILD_BLUEPRINT.md`

## Dominios atuais

| Dominio atual | Secoes | Componente principal atual | Observacao para rebuild |
| --- | --- | --- | --- |
| Painel | dashboard, alerts, billing-health | `AdminPanelSection` | deve virar cockpit executivo com filas, saude operacional e atalhos reais |
| Operacao | questions, exams, import, filters, users, materials, rankings | `AdminDatabaseManager` | precisa ser quebrado por dominios independentes, sem mega componente |
| Financeiro | subscriptions, transactions, refunds, plans-coupons, automation | `AdminFinance` | deve ganhar analytics de receita e centro de incidentes de billing |
| Marketing | landing-pages | `AdminMarketingSection` | deve evoluir para campanhas, aquisicao, SEO e ativos comerciais |
| Suporte | feedback, threads, reports | `AdminSupportSection` | deve virar fila operacional por SLA e tipo de caso |
| Configuracoes | general, modules, security, integrations, email, ads, seo, performance, logs | `AdminSettings` | deve virar centro de configuracao versionado, com segredos write-only |

## Funcoes obrigatorias preservadas

Painel:

- indicadores executivos
- alertas de denuncias abertas
- fila de reembolsos pendentes
- falhas recentes de transacao
- inbox de suporte
- materiais pendentes de moderacao
- saude do billing
- Stripe key, webhook, cron e recorrencia
- SEO e cobertura de sitemap

Operacao:

- CRUD de questoes
- editor manual de questoes
- banco de provas
- importador assistido
- filtros e taxonomias
- gestao de usuarios
- moderacao de materiais
- rankings

Financeiro:

- assinaturas
- transacoes
- reembolsos
- planos, pricing, cupons e beneficios
- limites por plano
- promocao ativa
- metricas de sellers e payout
- helper de automacao
- matriz de testes Stripe
- historico de execucao da matriz
- evidencias operacionais
- instrucoes de cron Windows/Linux

Marketing:

- landing pages comerciais
- campanhas de aquisicao
- conteudo comercial associado

Suporte:

- feedbacks
- denuncias
- resolucao de denuncias
- roteamento de alvo denunciado
- threads e atendimento

Configuracoes:

- nome do site, WhatsApp, taxa e modo da aplicacao
- motivacao diaria em markdown
- conteudo da landing principal
- feature flags
- 2FA admin
- reset de tabelas
- integracoes
- checkout, Stripe, reCAPTCHA, analytics, pixel e Gemini
- SMTP write-only e teste de envio
- anuncios
- SEO
- performance e cache
- logs operacionais

## Arquitetura alvo

O novo admin deve ser reconstruido por dominios, com ownership claro:

- `admin/shell`: shell, navegacao, topbar, command palette e layout base
- `admin/design-system`: tokens, botoes, inputs, tabelas, filtros, modais, empty states, metric cards e status chips
- `admin/domains/overview`: cockpit executivo e filas criticas
- `admin/domains/operation`: questoes, provas, importacao, usuarios, materiais e rankings
- `admin/domains/revenue`: assinaturas, transacoes, reembolsos, planos, cupons, sellers e payout
- `admin/domains/growth`: landing pages, campanhas, SEO e ativos comerciais
- `admin/domains/support`: feedback, denuncias, threads e SLA
- `admin/domains/security`: permissoes, 2FA, auditoria, segredos, integracoes e logs
- `admin/domains/settings`: configuracoes versionadas e publicacao/rollback

## UI alvo

Direcao visual: produto SaaS administrativo desktop-first, denso quando necessario, com informacao operacional clara.

Principios:

- sidebar por dominio e subnavegacao contextual
- cockpit inicial orientado a decisao, nao apenas lista de cards
- tabelas com filtros salvos, colunas configuraveis e acoes em lote
- paineis laterais para detalhe rapido sem perder contexto
- modais apenas para decisoes pontuais
- estados vazios acionaveis
- alertas por severidade
- metricas de receita com variacao, periodo, cohort e origem
- separacao visual clara entre leitura, decisao e configuracao

## Expansoes a entrar no rebuild

- RBAC granular
- trilha de auditoria por entidade e acao
- analytics de receita: MRR, ARR, churn, LTV, ARPU, conversao, inadimplencia e cohorts
- centro de incidentes para Stripe/webhook/cron/integracoes
- command palette
- busca global administrativa
- versionamento de configuracoes com diff e rollback
- fila unica por SLA
- painel de aprovacoes para conteudo sensivel

## Proxima acao

Iniciar a Etapa B: desenhar a arquitetura de informacao e o design system administrativo antes de tocar na implementacao visual.

Nao iniciar o rebuild copiando componentes atuais. O codigo atual deve ser usado apenas para validar paridade funcional.
