# Rebuild Total do Painel Admin

Data: `2026-04-19`

## Estado

Macrofase iniciada em modo de congelamento de inventario.

A consolidacao tecnica local da base Next ja permite preparar o rebuild total do admin. A implementacao visual nova deve comecar somente depois do fechamento da arquitetura de informacao e do design system administrativo, para evitar recriar remendos com outra aparencia.

## Diretriz principal

O painel admin sera recriado do zero em Next, sem remendos, sem pontes temporarias e sem reaproveitar a arquitetura atual como base estrutural. A nova implementacao deve:

- preservar todas as funcoes administrativas existentes hoje
- manter compatibilidade funcional com a operacao atual da plataforma
- adotar arquitetura propria, limpa e coerente para o admin
- permitir expansao futura sem voltar ao modelo atual de acoplamentos grandes

## Diretriz de UI

A reformulacao do painel admin tambem inclui a interface visual inteira.

O admin atual deve ser tratado apenas como referencia funcional e de inventario. Ele nao deve ser tratado como referencia obrigatoria de layout, componentes, navegacao, densidade visual ou experiencia de uso.

A nova UI deve nascer como um produto administrativo proprio:

- desktop-first, responsivo e utilizavel em telas menores sem virar uma versao mobile simplificada
- orientado a operacao real da plataforma, com visao executiva, filas, alertas e acoes rapidas
- com nova navegacao por dominios: operacao, financeiro, suporte, marketing, seguranca, configuracoes e analytics
- com novo shell administrativo, nova hierarquia visual, novas tabelas, formularios, filtros, modais e estados vazios
- com dashboards de receita, saude operacional, billing, conteudo e suporte
- com linguagem visual profissional de SaaS administrativo, clara, densa quando necessario e sem reaproveitar a casca antiga
- com design system proprio do admin, mantendo consistencia com a marca da plataforma sem ficar preso a UI legada

Regra de migracao para o rebuild:

- a UI antiga so serve para garantir que nenhuma funcao desapareca
- a nova UI pode reorganizar e redesenhar tudo
- codigo visual antigo nao deve ser carregado como dependencia estrutural do novo painel
- servicos, contratos e regras de dominio podem ser reaproveitados quando estiverem limpos e fizerem sentido
- componentes visuais antigos so podem ser reaproveitados se passarem por revisao e se encaixarem no novo design system

## Inventario funcional atual

### 1. Painel

Secoes atuais:

- `dashboard`
- `alerts`
- `billing-health`

Capacidades mapeadas:

- dashboard executivo com indicadores operacionais
- alertas de denuncias abertas
- fila de reembolsos pendentes
- falhas recentes de transacao
- inbox de suporte
- materiais pendentes de moderacao
- saude do billing
- conferencias de Stripe key, webhook, cron e recorrencia
- score de SEO e cobertura de sitemap
- atalhos de navegacao para financeiro, suporte e operacao

### 2. Operacao

Secoes atuais:

- `questions`
- `exams`
- `import`
- `filters`
- `users`
- `materials`
- `rankings`

Capacidades mapeadas:

- cadastro, edicao, exclusao, paginacao e revisao de questoes
- editor manual de questoes
- banco de provas com criacao, edicao, exclusao e vinculos
- importador com extracao assistida, revisao e publicacao em massa
- filtros e taxonomias da base
- gestao de usuarios e abertura de perfil administrativo
- moderacao de materiais do marketplace
- exclusao e reanalise de materiais
- gestao e ajustes de rankings

### 3. Financeiro

Secoes atuais:

- `subscriptions`
- `transactions`
- `refunds`
- `plans-coupons`
- `automation`

Capacidades mapeadas:

- visao de assinaturas
- historico e filtros de transacoes
- fila de reembolsos e decisoes operacionais
- configuracao de planos, pricing, cupons e beneficios
- configuracao de limites de uso por plano
- controle de promocao ativa e tema comercial ativo
- metricas de sellers e payout disponivel
- helper de automacao oficial
- matriz de testes Stripe
- historico de execucao guiada dos testes Stripe
- evidencias operacionais
- comandos e instrucoes para cron em Windows e Linux

### 4. Marketing

Secao atual:

- `landing-pages`

Capacidades mapeadas:

- gestao de landing pages comerciais
- apoio a campanhas e paginas de aquisicao
- configuracao de conteudo comercial associado

### 5. Suporte

Secoes atuais:

- `feedback`
- `reports`
- `threads`

Capacidades mapeadas:

- triagem de feedbacks
- fila oficial de denuncias
- resolucao rapida de denuncias
- roteamento do alvo denunciado para a area operacional correta
- historico de threads e atendimento

### 6. Configuracoes

Secoes atuais:

- `general`
- `modules`
- `security`
- `integrations`
- `email`
- `ads`
- `seo`
- `performance`
- `logs`

Capacidades mapeadas:

- configuracoes gerais do ambiente
- nome do site, WhatsApp, taxa e modo da aplicacao
- markdown de motivacao diaria
- conteudo da landing principal
- feature flags de modulos
- 2FA para admin
- reset geral com tabelas selecionaveis
- configuracoes de integracao
- checkout, Stripe, reCAPTCHA, analytics, pixel e Gemini
- teste de integracoes
- configuracoes SMTP e teste de envio
- configuracoes de anuncios
- configuracoes de SEO
- performance e cache management
- visualizacao de logs operacionais

## Expansoes sugeridas para o rebuild

Estas funcoes nao devem substituir o que existe hoje; elas entram como ampliacao planejada:

- trilha de auditoria administrativa por entidade e por acao
- RBAC granular por permissao, nao apenas por perfil admin unico
- central unica de filas operacionais com views por SLA
- analytics executivos de receita no admin: MRR, churn, LTV, cohort, conversao e inadimplencia
- centro de incidentes para billing, webhooks, cron e integracoes externas
- versionamento de configuracoes com diff, publicacao e rollback
- busca global do admin com atalhos e command palette
- painel de aprovacoes e revisoes para conteudo sensivel antes de publicar

## Principios obrigatorios da nova arquitetura

- admin como produto separado dentro do monorepo web, nao como acumulo de seções grandes
- roteamento, dados e permissao por dominio
- contratos tipados para leitura e escrita
- shells e layouts dedicados ao admin
- componentes menores e ownership claro por modulo
- sem reaproveitar a composicao atual como "casca" do novo painel
- testes por dominio critico e smoke end-to-end para fluxos administrativos
- design system administrativo proprio, com componentes de operacao, metricas, tabelas densas, filtros avancados e estados de decisao

## Etapas propostas para a macrofase do rebuild

### Etapa A - Congelamento do inventario

- confirmar com o codigo final migrado todas as funcoes ativas
- marcar legados desativados ou escondidos
- fechar checklist funcional obrigatoria

Status: iniciado.

Evidencia:

- `docs/reports/admin-rebuild-functional-map-latest.md`

### Etapa B - Arquitetura e UX do novo admin

- definir mapa de informacao do novo painel
- desenhar IA de navegacao e agrupamento por dominio
- definir a nova direcao visual do admin
- criar tokens, padroes de layout, tabelas, formularios, filtros, cards operacionais e dashboards
- definir contratos de dados e permissoes

Status: primeira versao concluida.

Evidencias:

- `docs/reports/admin-information-architecture-latest.md`
- `docs/reports/admin-design-system-blueprint-latest.md`
- `src/app/admin/_rebuild/architecture/adminInformationArchitecture.ts`
- `src/app/admin/_rebuild/design-system/`
- `src/app/admin/_rebuild/AdminRebuildPreview.tsx`

Observacao:

- a base `_rebuild` e privada e ainda nao substitui a rota `/admin`
- a UI atual continua ativa ate a Etapa C portar os dominios com paridade funcional
- a troca final da rota so deve acontecer quando overview, operacao, revenue, growth, suporte, seguranca e configuracoes tiverem cobertura minima

### Etapa C - Implementacao do zero

- criar novo shell admin
- criar a nova UI base e o design system administrativo
- reconstruir dominios por modulos
- portar fluxos existentes um a um
- validar parity funcional

Status: iniciada.

Primeiro corte:

- modelos reais de `Overview` e `Revenue` criados em `_rebuild`
- preview privado passou a consumir o modelo de Overview
- telas privadas conectadas de `Overview` e `Revenue` criadas com providers atuais
- dominio `Operation` iniciado com modelo, blueprint e screen privada conectada
- rota ativa `/admin` preservada ate existir paridade minima

### Etapa D - Expansao

- adicionar funcoes novas aprovadas
- reforcar observabilidade, auditoria e analytics

### Etapa E - Auditoria final

- auditoria de seguranca
- auditoria de operacao financeira
- auditoria de performance
- auditoria de UX administrativa
