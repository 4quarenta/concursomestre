# Plano de Auditoria e Preparacao para Producao

Data: `2026-04-19`

## Objetivo

Organizar a passagem da plataforma web em Next na raiz para um estado pronto para producao, sem perder paridade com a plataforma historica e sem misturar essa frente com o rebuild futuro do painel admin.

## Pre-condicao

Esta trilha parte destas premissas:

- a plataforma Next na raiz e a base oficial do web neste branch
- a paridade com `master` segue sendo o criterio para a UI e a funcionalidade da plataforma publica e logada
- `mobile/` continua como frente separada
- o rebuild total do painel admin e uma macrofase posterior, nao o fechamento desta auditoria

## Macroetapas

### Etapa 4.1 - Fechamento da consolidacao Next

Objetivo:

- encerrar a etapa 3 com evidencias suficientes de paridade estrutural e funcional

Entregas:

- rotas canonicas do App Router estabilizadas
- auditoria textual contra `master`
- validacao de autenticacao local
- smoke HTTP das rotas criticas
- documentacao de transicao atualizada

Status atual:

- em andamento, com base tecnica bem avancada

### Etapa 4.2 - Limpeza e organizacao da arvore

Objetivo:

- remover arquivos mortos, duplicados, residuos de migracao e estruturas que nao pertencem mais ao fluxo principal

Entregas:

- inventario de arquivos candidatos a remocao
- classificacao por dominio e ownership
- eliminacao de codigo que so existia para tentativas descartadas
- alinhamento final de diretorios para a base Next consolidada

Estado inicial registrado em:

- `docs/reports/root-cleanup-inventory-latest.md`
- `docs/reports/documentation-audit-latest.md`

### Etapa 4.3 - Auditoria de codigo

Objetivo:

- identificar riscos de manutencao, acoplamento, fluxos duplicados e pontos sem cobertura minima

Entregas:

- mapa de dominios centrais
- hotspots por complexidade
- lista de ajustes obrigatorios antes de producao
- plano de cobertura de testes proporcional ao risco

Primeira evidência desta frente:

- `docs/reports/code-cleanup-audit-latest.md`

### Etapa 4.4 - Auditoria de seguranca

Objetivo:

- revisar sessao, autenticacao, autorizacao, entrada de dados, segredos e superficie administrativa

Entregas:

- checklist de autenticacao e sessao
- checklist de autorizacao por dominio
- revisao de chaves, variaveis e integracoes sensiveis
- inventario de riscos de exposicao administrativa e operacional

Status atual:

- em andamento
- risco prioritario de exposicao do Gemini no frontend e de segredos sensiveis no admin ja tratado nesta rodada

Evidencia atual:

- `docs/reports/security-payments-audit-latest.md`

### Etapa 4.5 - Auditoria de pagamentos

Objetivo:

- validar fluxos de assinatura, checkout, renovacao, cartao salvo, reembolso e webhooks

Entregas:

- matriz funcional de billing
- cenarios de teste por ciclo de assinatura
- validacao de falha, retry, `past_due`, cancelamento e reembolso
- evidencias operacionais para Stripe e rotinas recorrentes

Status atual:

- concluida localmente
- trilha de segredos do Stripe e webhook consolidada no modelo write-only durante a auditoria de seguranca
- matriz funcional inicial de pagamentos registrada
- cobertura de fachada ampliada para cupom, cartao salvo, renovacao, cancelamento, reembolso, reversao e matriz Stripe
- backend de assinaturas auditado para autenticacao, idempotencia, estados Stripe, cron e refund
- retry de webhook preso em `processing` endurecido no backend local para evitar bloqueio permanente apos queda do processo PHP
- prova operacional real com Stripe permanece pendente ate existir URL publica/dominio ou tunel controlado para entrega de webhook

Evidencia atual:

- `docs/reports/security-payments-audit-latest.md`
- `docs/reports/payments-audit-matrix-latest.md`

### Etapa 4.6 - Auditoria de SEO e descoberta no Google

Objetivo:

- preparar a plataforma Next para indexacao profissional e descobrir gaps tecnicos de SEO

Entregas:

- mapa de rotas publicas indexaveis
- definicao de metadados por pagina e por template
- auditoria de canonicals, sitemap, robots e conteudo renderizado
- backlog tecnico para posicionamento organico

Observacao:

- esta etapa considera a arquitetura Next como base correta para SEO profissional no web

Status atual:

- concluida tecnicamente em localhost
- sitemap, robots, status interno, metadata por rota publica e noindex de areas privadas implementados
- prova externa no Google permanece pendente ate existir dominio, DNS, deploy publico e Search Console

Evidencia atual:

- `docs/reports/seo-google-readiness-audit-latest.md`

### Etapa 4.7 - Painel admin e analytics operacionais

Objetivo:

- preparar o terreno para a macrofase posterior do rebuild total do admin, incluindo a recriacao completa da UI, e definir o escopo de analytics de receita

Entregas:

- inventario funcional consolidado do admin atual
- regras para o changelog `1.0.0`: incluir tudo que existe, exceto o que estiver marcado como desativado no admin
- mapa de indicadores executivos desejados no admin
- diretriz de redesign visual completo do admin, usando a interface atual apenas como referencia funcional
- backlog oficial do rebuild total do painel

Status atual:

- iniciada em modo de congelamento funcional
- mapa funcional do admin atual registrado para orientar o rebuild total
- arquitetura de informacao e design system administrativo novo definidos em primeira versao
- base privada `src/app/admin/_rebuild` criada para construir o admin novo sem substituir a rota ativa prematuramente
- implementacao real por dominio iniciada com modelos de Overview e Revenue
- telas privadas conectadas de Overview e Revenue criadas no limite da nova arquitetura
- dominio Operation iniciado com modelo, blueprint e screen privada conectada
- dominio Growth iniciado com modelo, blueprint e screen privada conectada para SEO, sitemap, landing pages e campanhas
- dominio Security iniciado com modelo, blueprint e screen privada conectada para acesso admin, segredos write-only, logs e reset controlado
- dominio Settings iniciado com modelo, blueprint e screen privada conectada para ambiente, modulos, integracoes e readiness de release
- dominio Support iniciado com modelo, blueprint e screen privada conectada
- os 7 dominios-base privados do rebuild agora existem
- navegacao privada real do rebuild criada sob `/admin/rebuild`
- atalhos reais entre filas e areas-alvo conectados com foco visual por URL
- primeiros drilldowns operacionais detalhados entregues em `Revenue` e `Support`, ja com paineis de trabalho por foco
- segunda rodada de drilldowns entregue em `Operation` e `Growth`, com ancoras de foco coerentes para scroll e leitura operacional
- terceira rodada entregue em `Security` e `Settings`, fechando os seis dominios-base com drilldowns operacionais reais
- quarta rodada entregue em `Support` e `Operation`, com filtros locais, contadores por recorte e triagem navegavel
- quinta rodada entregue em `Revenue` e `Growth`, levando a triagem interativa para financeiro e aquisicao
- reorganizacao de UX aplicada para paginas por funcionalidade: dominio como indice, rotina como subrota propria
- primeira camada de tabelas administrativas entregue em subpaginas criticas de `Support`, `Revenue` e `Operation`
- tabelas administrativas expandidas para `Growth`, `Security` e `Settings`
- primeira camada de acoes reais entregue em `Support`: moderacao de denuncias, resposta de feedback e atualizacao de status usando `adminService`
- segunda camada de acoes reais entregue em `Revenue` e `Operation`: reembolsos, moderacao de materiais/rankings e status de usuarios
- terceira camada de acoes reais entregue em `Settings`: salvamento geral e testes oficiais de SMTP/integracoes
- quarta camada de acoes reais entregue em `Security`: setup e ativacao de 2FA, mantendo reset de base apenas como inventario nao destrutivo
- gate de paridade e readiness de troca implementado em `/admin/rebuild/overview/parity`
- relatorio tecnico de troca registrado em `docs/reports/admin-rebuild-route-switch-readiness-latest.md`
- primeiro gap de `Operation` reduzido com edicao real de questoes em backlog usando `updateQuestion`
- `Operation` evoluiu para CRUD basico de questoes usando `addQuestion`, `updateQuestion` e `deleteQuestion`
- `Operation` separou `taxonomies` e `exams`, com cadastro basico real de taxonomias via `saveSystemSettingsNow` e inventario proprio de provas
- `Operation` adicionou edicao/remocao basica de taxonomias em `systemSettings.taxonomies`, com confirmacao textual para remocao
- `Operation` adicionou CRUD basico de banco de provas em `systemSettings.examBank`, com confirmacao textual para remocao
- `Operation` adicionou importador assistido em `/admin/rebuild/operation/import`, com extracao via PDF, revisao por questao e publicacao em massa
- o shell e o design system do rebuild passaram por simplificacao para reduzir densidade visual e melhorar usabilidade
- proxima frente: continuar os gaps de `Operation` com editor profundo, vinculos avancados de provas e governanca avancada de taxonomias, ou avancar para `Revenue` em subscriptions/pricing

Evidencia atual:

- `docs/ADMIN_PANEL_REBUILD_BLUEPRINT.md`
- `docs/reports/admin-rebuild-functional-map-latest.md`
- `docs/reports/admin-information-architecture-latest.md`
- `docs/reports/admin-design-system-blueprint-latest.md`
- `docs/reports/admin-rebuild-stage-c-models-latest.md`

Observacao:

- a recriacao total do painel admin fica fora desta etapa operacional e sera executada como macrofase dedicada
- quando essa macrofase iniciar, a UI antiga nao sera preservada como layout; ela sera usada apenas para garantir paridade funcional
- apos o reset da iteracao anterior, a nova fundacao do rebuild passou a explicitar dois escopos administrativos: governanca de database e governanca da plataforma

### Etapa 4.8 - Fechamento para producao

Objetivo:

- deixar o projeto pronto para receber VPS, dominio, deploy e operacao da versao `1.0.0`

Entregas:

- checklist final de deploy
- checklist de ambiente
- baseline de observabilidade
- changelog `1.0.0` validado
- pacote de auditoria consolidado

## Ordem recomendada

1. fechar a consolidacao Next
2. limpar a arvore e consolidar ownership
3. auditar codigo e seguranca
4. auditar pagamentos
5. auditar SEO
6. fechar inventario admin e analytics
7. preparar changelog e checklist de deploy

## Regras de execucao

- nao usar remendos ou pontes temporarias como solucao definitiva
- sempre preferir consolidacao estrutural a adaptadores de transicao
- toda decisao com impacto de arquitetura deve deixar evidencia em `docs/`
- toda auditoria deve produzir itens acionaveis, nao apenas diagnostico abstrato
- a versao `1.0.0` deve refletir o que realmente existe hoje, excluindo apenas o que estiver explicitamente marcado como desativado no admin

## Relacao com a macrofase do admin

O rebuild total do painel admin foi registrado separadamente em `docs/ADMIN_PANEL_REBUILD_BLUEPRINT.md`.

Sequencia correta:

1. fechar a consolidacao Next do web
2. concluir a preparacao de producao
3. iniciar a macrofase de recriacao total do admin
