# Feature Report
Atualizado em: 2026-04-03
## Objetivo
Este documento descreve o que existe hoje na plataforma ConcursoMestre.
Ele funciona como inventario funcional completo do sistema e responde:
- quais paginas existem e para que servem
- quais providers sustentam a aplicacao
- quais servicos oficiais existem no frontend
- como cada funcao principal funciona
- quais modulos oficiais existem hoje no backend PHP
- quais dependencias, legados e gaps ainda restam
---
## Visao geral do produto
ConcursoMestre e uma plataforma de questoes para concursos publicos, com foco em pratica guiada, simulados, estatisticas de desempenho, ranking pos-prova, assinatura premium e marketplace de materiais em PDF.
Os principais dominios funcionais do produto hoje sao:
- autenticacao e sessao
- pratica de questoes
- filtros e taxonomias
- simulados
- desempenho e raio-x de banca
- ranking competitivo
- planos, checkout e assinatura
- perfil do usuario
- notificacoes
- suporte
- marketplace de materiais
- administracao da operacao
---
## Frontend
### Arquitetura ativa
- src/app/*/page.tsx -> entry point oficial das telas
- src/components/shared/* -> componentes realmente compartilhados
- src/providers/* -> comportamento global da app
- src/services/* -> integracao HTTP e fachadas por dominio
- src/router/* -> roteamento oficial
- src/state/* -> estado global real, quando houver
- src/utils/* -> funcoes puras e reutilizaveis
### Rotas e paginas
#### /
- Arquivo: src/app/landing/page.tsx
- Papel: landing principal do produto.
- Como funciona:
  - resolve tema ativo a partir de systemSettings
  - comunica proposta de valor, provas sociais, recursos e planos
  - conduz para autenticacao, planos e exploracao da plataforma
#### /auth
- Arquivo: src/app/auth/page.tsx
- Papel: entrada de autenticacao.
- Como funciona:
  - concentra login, cadastro, recuperacao de senha e 2FA
  - usa uthFlowService
  - pode ser reutilizada por fluxos comerciais como o checkout
#### /plans
- Arquivo: src/app/plans/page.tsx
- Papel: catalogo comercial de planos.
- Como funciona:
  - apresenta beneficios e comparativos
  - usa planService e dados de configuracao global
  - redireciona para checkout do plano selecionado
#### /promo/:slug
- Arquivo: src/app/promo/page.tsx
- Papel: pagina promocional por campanha.
- Como funciona:
  - resolve a oferta via slug
  - reapresenta beneficios e CTA comercial
  - leva o usuario para planos/checkout
#### /faq
- Arquivo: src/app/faq/page.tsx
- Papel: perguntas frequentes.
- Como funciona:
  - organiza respostas institucionais e comerciais
  - reduz demanda operacional de suporte
#### /changelog
- Arquivo: src/app/changelog/page.tsx
- Papel: historico publico de atualizacoes.
- Como funciona:
  - usa changelogService.listVersions()
  - exibe releases, melhorias e correcoes por versao
#### /confirm-email
- Arquivo: src/app/confirm-email/page.tsx
- Papel: confirmacao de e-mail de cadastro.
- Como funciona:
  - consome token da URL
  - usa uthFlowService.confirmEmail()
  - renderiza sucesso, erro e redirecionamento
#### /reset-password
- Arquivo: src/app/reset-password/page.tsx
- Papel: redefinicao final de senha.
- Como funciona:
  - valida token recebido por e-mail
  - usa uthFlowService.resetPassword()
  - encaminha o usuario de volta para a autenticacao
#### /privacy
- Arquivo: src/app/privacy/page.tsx
- Papel: politica de privacidade.
- Como funciona:
  - apresenta regras de coleta, uso e direitos LGPD
#### /terms
- Arquivo: src/app/terms/page.tsx
- Papel: termos de uso.
- Como funciona:
  - documenta regras de uso, assinatura, limites e responsabilidades
#### /dashboard
- Arquivo: src/app/dashboard/page.tsx
- Papel: painel principal do aluno.
- Como funciona:
  - resume progresso, desempenho, atalhos e recomendacoes
  - depende de AuthProvider e DataProvider
#### /practice
- Arquivo: src/app/practice/page.tsx
- Papel: pratica de questoes.
- Como funciona:
  - aplica filtros por banca, orgao, cargo, assunto, ano e dificuldade
  - usa questionService para listar questoes e registrar respostas
  - sustenta favoritos, notas e comentarios
#### /simulation
- Arquivo: src/app/simulation/page.tsx
- Papel: simulados.
- Como funciona:
  - monta blocos de questoes
  - salva sessoes de simulacao e historico
  - usa simulationsService
#### /bank-analysis
- Arquivo: src/app/bank-analysis/page.tsx
- Papel: raio-x de banca.
- Como funciona:
  - usa ankAnalysisService
  - agrega leitura por banca, analytics do usuario e insights de padrao
#### /marketplace
- Arquivo: src/app/marketplace/page.tsx
- Papel: marketplace de materiais.
- Como funciona:
  - lista materiais, ratings, comentarios e compra
  - usa marketplaceService, 	ransactionsService e commentsService
#### /ranking
- Arquivo: src/app/ranking/page.tsx
- Papel: rankings competitivos.
- Como funciona:
  - lista rankings aprovados
  - permite adesao, envio de resultado e acompanhamento de posicao
  - usa ankingsService
#### /profile
- Arquivo: src/app/profile/page.tsx
- Papel: centro da conta do usuario.
- Como funciona:
  - edita dados pessoais e senha
  - mostra referrals, materiais, billing, assinatura e cartoes
  - usa profileService, 	ransactionsService, cardsService e marketplaceService
#### /notifications
- Arquivo: src/app/notifications/page.tsx
- Papel: central de notificacoes.
- Como funciona:
  - usa 
otificationService
  - carrega notificacoes, marca como lidas e limpa historico
#### /partner-dashboard
- Arquivo: src/app/partner-dashboard/page.tsx
- Papel: area do parceiro/autor.
- Como funciona:
  - publica materiais
  - acompanha vendas e desempenho comercial
  - reaproveita o dominio de marketplace
#### /support
- Arquivo: src/app/support/page.tsx
- Papel: suporte autenticado.
- Como funciona:
  - usa supportService
  - lista threads, replies e cria novos chamados
#### /reader/:id
- Arquivo: src/app/reader/page.tsx
- Papel: leitor autenticado de material.
- Como funciona:
  - valida acesso ao arquivo
  - renderiza o PDF
  - ancora interacoes contextuais do material
#### /checkout/:planId
- Arquivo: src/app/checkout/page.tsx
- Papel: checkout de assinatura.
- Como funciona:
  - permite login/cadastro inline
  - valida cupom, calcula parcelas, escolhe gateway e salva cartao
  - usa planService, uthFlowService, cardsService, paymentsService e subscriptionsService
#### /admin
- Arquivo: src/app/admin/page.tsx
- Papel: painel administrativo central.
- Como funciona:
  - agrega dashboard executivo, financeiro, base, configuracoes, suporte e moderacao
  - usa dminService e componentes especializados do dominio admin
---
## Providers globais
### AppProviders
- compoe a arvore oficial de providers
- garante ordem consistente de autenticacao, dados, marketplace, tema, toast e modal
### AuthProvider
- guarda o usuario autenticado
- centraliza login, logout, refresh de sessao e eventos da conta
- exp?e dados de assinatura, progresso e permissao do usuario
### DataProvider
- hidrata taxonomias, questoes, relatorios, configuracoes e caches de dados globais
- organiza parte relevante do bootstrap da aplicacao autenticada
### MarketplaceProvider
- concentra estado global do marketplace que precisa sobreviver entre telas
- coordena atualizacao otimista de compra, transacao e reembolso
### ThemeProvider
- aplica tema global e classes de apresentacao
### ToastProvider
- exibe feedback global de sucesso, alerta e erro
### ModalProvider
- centraliza confirmacoes e overlays globais reutilizaveis
---
## Componentes compartilhados principais
### src/components/shared/ui
- ProgressBar.tsx -> barra de progresso reutilizavel
- RichTextEditor.tsx -> editor rico compartilhado
- AdPlaceholder.tsx -> placeholder visual para espacos institucionais/anuncios
### src/components/shared/feedback
- CommentsSection.tsx -> secao reutilizavel de comentarios
- PromoBanner.tsx -> faixa promocional reutilizavel
### src/components/shared/layout
- Footer.tsx -> rodape compartilhado
- DashboardSidebar.tsx -> navegacao lateral reutilizada em areas autenticadas
### src/components/shared/overlays
- AuthModal.tsx -> autenticacao em modal
- ConfirmModal.tsx -> confirmacao global
- SuccessModal.tsx -> retorno visual de sucesso
- UpgradeModal.tsx -> upsell comercial
- PdfViewer.tsx -> visualizacao compartilhada de PDF
---
## Servicos oficiais do frontend
### src/services/api
#### client.ts
- configura o cliente HTTP base
- aplica base URL, serializacao e integracao com interceptadores
#### interceptors.ts
- intercepta requests/responses
- anexa token quando necessario
- centraliza regras comuns de erro da API
#### esponse.ts
- 
ormalizeApiEnvelope() -> detecta se a resposta veio crua ou envelopada
- eadApiData() -> extrai o payload util sem repetir parsing na UI
- ssertApiSuccess() -> garante sucesso logico e levanta erro coerente
- eadApiErrorMessage() -> extrai a melhor mensagem possivel de falha
- eadApiErrorCode() -> extrai codigo tecnico legado quando ele existir
### src/services/auth/accountService.ts
- updateUserProfile(payload) -> atualiza dados do usuario, normaliza resposta e devolve o perfil atualizado
- ecomePartner() -> promove o usuario ao papel de parceiro/autor conforme regra do backend
### src/services/auth/authFlowService.ts
- egister(payload) -> registra usuario novo, retorna token/sessao e payload de autenticacao
- login(payload) -> autentica usuario existente e devolve payload normalizado
- orgotPassword(payload) -> dispara fluxo de recuperacao de senha por e-mail
- esendConfirmation(email) -> reenvia confirmacao de cadastro
- confirmEmail(token) -> confirma o token do e-mail e informa estado final do cadastro
- esetPassword(payload) -> aplica nova senha a partir do token valido
- erifyTwoFactor(payload) -> confirma 2FA e devolve token/mensagem da verificacao
### src/services/bank-analysis/bankAnalysisService.ts
- getBankIntel(url) -> consulta inteligencia publica para uma banca/url
- getXrayStats(filters) -> carrega estatisticas agregadas do raio-x
- getAnalysis(boardId) -> devolve analise detalhada da banca
- getUserAnalytics() -> devolve analytics pessoais do usuario no modulo
- getPatternInsights(boardId) -> resume padroes recorrentes da banca selecionada
### src/services/billing/cardsService.ts
- listSavedCards(userId?) -> lista cartoes salvos e remove stale cards quando o backend indicar
- emoveSavedCard(cardId, userId?) -> exclui cartao salvo
- setDefaultSavedCard(cardId, userId?) -> define cartao padrao
- saveLegacyCard(payload) -> salva cartao no fluxo legado/local
- createStripeSetupIntent() -> prepara setup intent da Stripe para novo cartao
- syncStripeCard(paymentMethodId) -> sincroniza metodo Stripe salvo com o backend local
### src/services/changelog/changelogService.ts
- listVersions() -> carrega releases publicas e ordena o changelog do produto
### src/services/comments/commentsService.ts
- getComments(targetId, userId?) -> carrega comentarios por alvo (questao/material)
- getUserComments(userId) -> lista comentarios feitos pelo usuario
- ddComment(commentData) -> cria comentario novo e devolve o comentario persistido
- likeComment(commentId, userId?) -> registra curtida do comentario
- eportComment(...) -> envia denuncia de comentario para moderacao
- deleteComment(commentId, userId?) -> exclui comentario do usuario ou moderado
### src/services/filters/index.ts
- list() -> busca o payload bruto de taxonomias
- listTaxonomies() -> converte o payload bruto para o shape usado pela UI
- save(payload) -> cria/edita filtro administrativo
- emove(id) -> remove filtro/taxonomia
- 
ormalizeFiltersToTaxonomies(data) -> mapper central de bancas, orgaos, materias, assuntos, cargos, carreiras e anos
### src/services/marketplace/marketplaceService.ts
- listMaterials(filters?) -> lista materiais publicados no marketplace
- createMaterial(material) -> cria material novo
- updateMaterial(materialId, updates) -> atualiza material existente
- moderateMaterial(...) -> aprova ou rejeita material na moderacao
- deleteMaterial(materialId) -> remove material
- listTransactions(params) -> lista transacoes do marketplace com filtros simples
- getUserMaterialRating(materialId) -> carrega rating dado pelo usuario no material
- ateMaterial(materialId, rating) -> grava avaliacao do material
- getTransactions(userId) -> lista transacoes pelo usuario numerico legado
- getUserTransactions(userId) -> lista transacoes do usuario autenticado
- listUserMaterials(userId) -> lista materiais do proprio parceiro/autor
- equestRefund(transactionId, reason) -> solicita reembolso
- cancelRefundRequest(transactionId) -> cancela a solicitacao de estorno
- processRefund(transactionId, approved) -> decide estorno no fluxo administrativo/comercial
- createMaterialPurchase(materialId) -> inicia compra de material com sessao autenticada
- purchaseMaterial(materialId) -> bridge legado para compra simplificada
- uploadMaterial(material) -> bridge legado para publicacao simples
- uploadFile(...) -> envia arquivo do material e devolve URL/metadata normalizada
- getPartnerTransactions(_partnerId) -> consulta vendas do parceiro
- getMaterials(filters?) -> alias legado para listagem de materiais
### src/services/notifications/notificationService.ts
- getNotifications() -> lista notificacoes do usuario autenticado
- getUserNotifications(_userId) -> bridge legado para o mesmo fluxo
- markAsRead(notificationId) -> marca uma notificacao como lida
- markAllAsRead() -> marca todas como lidas
- deleteNotification(notificationId) -> remove uma notificacao
- clearAll() -> limpa historico de notificacoes
- sendNotification(...) -> envia notificacao administrativa/sistemica quando a UI precisar iniciar esse fluxo
### src/services/payments/paymentsService.ts
- getInstallments({ amount, bin, paymentMethodId }) -> consulta parcelas e retorna lista normalizada para o checkout
- processMaterialPayment(payload) -> processa compra avulsa de material e devolve resultado simples para a UI
### src/services/plans/planService.ts
- getPlans() -> lista planos do catalogo comercial
- createSubscription(planId, userId) -> cria preferencia Mercado Pago para o plano
- processPayment(paymentData) -> delega pagamento Mercado Pago do checkout
- createStripeCheckoutSession(payload) -> inicia checkout hospedado da Stripe
- createStripeSubscription(payload) -> cria assinatura inline da Stripe
- inalizeStripeSubscription(payload) -> conclui assinatura inline apos setup/pagamento inicial
- createStripeSetupIntent() -> prepara setup intent de cartao
- syncStripeCard(paymentMethodId) -> sincroniza cartao salvo na Stripe
- createStripePortalSession() -> abre portal de billing da Stripe
- alidateCoupon(code, amount, planId?) -> valida cupom comercial
- cancelSubscription(...) -> solicita cancelamento da assinatura ativa
- cancelRefundRequest() -> cancela solicitacao de reembolso
- undoCancellationRequest() -> reverte cancelamento solicitado
- updateRenewal(autoRenew) -> altera preferencia de renovacao automatica
### src/services/profile/profileService.ts
- getReferralStats() -> carrega estatisticas de indicacao/referral
- uploadProfilePhoto(file) -> envia avatar do usuario
- changePassword(currentPassword, newPassword) -> troca senha do usuario autenticado
### src/services/progress/userProgressService.ts
- getUserAnswers(userId) -> lista respostas historicas do usuario
- getUserQuestionNotes(userId) -> lista anotacoes/notas do usuario por questao
### src/services/questions/questionService.ts
- getQuestionPage(filters?) -> carrega lote paginado/filtrado de questoes no formato de tela
- getQuestions(filters?) -> devolve apenas a lista de questoes
- submitUserAnswer(userId, answer) -> registra resposta e devolve impacto no progresso
- submitAnswer(answer) -> bridge simplificada para envio de resposta
- createQuestion(questionData) -> cria uma questao nova
- createQuestions(questions) -> cria lote de questoes
- updateQuestion(id, questionData) -> atualiza questao existente
- deleteQuestion(id) -> remove questao
- 	oggleSavedQuestion(userId, questionId) -> alterna favorito/salva da questao
- esetAnswers(userId) -> zera historico de respostas do usuario
### src/services/rankings/rankingsService.ts
- list() -> lista rankings visiveis ao usuario
- create(payload) -> cria ranking novo
- join(rankingId, userId, entry) -> entra em ranking com resultado do usuario
- moderate(rankingId, status) -> aprova/rejeita ranking no admin
- update(payload) -> atualiza ranking existente
- emove(rankingId) -> exclui ranking
### src/services/simulations/simulationsService.ts
- saveSimulation(userId, simulation) -> persiste sessao de simulado do usuario
### src/services/statistics/statisticsService.ts
- getUserStatistics(userId) -> carrega estatisticas consolidadas do usuario
- getQuestionStatistics(questionId) -> carrega estatisticas de uma questao
- getPlatformStatistics() -> carrega indicadores agregados da plataforma
- updateUserStatistics(userId, data) -> atualiza agregados do usuario apos eventos de estudo
### src/services/subscriptions/subscriptionsService.ts
- createMercadoPagoSubscriptionPreference(payload) -> cria preferencia Mercado Pago do plano
- processMercadoPagoPayment(payload) -> processa pagamento/subscricao Mercado Pago
- createStripeCheckoutSession(payload) -> inicia checkout hospedado Stripe
- createStripeSubscription(payload) -> cria assinatura inline Stripe
- inalizeStripeSubscription(payload) -> conclui assinatura inline
- alidateCoupon(code, amount, planId?) -> valida cupom no backend comercial
- createStripePortalSession() -> abre portal de billing
- updateRenewal(autoRenew) -> altera renovacao automatica
- cancelSubscription(reason?, details?, captchaToken?) -> solicita cancelamento da assinatura ativa
- cancelRefundRequest() -> desfaz uma solicitacao de reembolso pendente
- undoCancellationRequest() -> reabre a assinatura apos pedido de cancelamento
### src/services/support/supportService.ts
- listThreads() -> lista chamados/thread do usuario
- listReplies(threadId) -> lista respostas do chamado
- createThread(input) -> abre novo chamado de suporte
### src/services/transactions/transactionsService.ts
- list(params) -> lista transacoes com filtros, pagina ou recortes comerciais
- createMaterialPurchase(materialId) -> inicia compra autenticada de material
- equestRefund(transactionId, reason) -> solicita reembolso
- cancelRefundRequest(transactionId) -> cancela solicitacao pendente
- esolveRefund(...) -> aprova ou rejeita reembolso no fluxo administrativo
---
## Backend PHP
### Estrutura ativa
- modules/<domain>/controllers -> entrada HTTP fina
- modules/<domain>/services -> regra de negocio
- modules/<domain>/repositories -> acesso a banco
- modules/<domain>/validators -> validacao e normalizacao de entrada
- modules/<domain>/routes.php -> mapeamento do dominio
- shared/* -> infraestrutura transversal
- pi/* -> legado em reducao para bridges finos
### Modulos oficiais presentes hoje
#### modules/admin
**Controllers**
- AdminCacheController.handle() -> roteia operacoes de cache do admin
- AdminDatabaseMaintenanceController.listTables() -> lista tabelas resetaveis
- AdminDatabaseMaintenanceController.reset() -> executa reset administrativo da base
- AdminFeedbackController.showThread() -> devolve thread de feedback com replies
- AdminFeedbackController.listThreads() -> lista chamados/feedbacks
- AdminFeedbackController.updateStatus() -> altera status de um feedback
- AdminReportModerationController.moderate() -> decide uma denuncia
- AdminStatsController.index() -> entrega KPIs administrativos
- AdminSystemLogController.showLatestLogs() -> exibe logs do sistema
- AdminUserActionsController.execute() -> executa mutacoes administrativas em usuario
- AdminUserDetailsController.show() -> detalha um usuario no admin
**Services**
- AdminCacheService.handle() -> centraliza stats, limpeza e toggles de cache
- AdminDatabaseMaintenanceService.listResettableTables() -> resolve tabelas elegiveis para reset
- AdminDatabaseMaintenanceService.resetDatabase() -> reseta dados com regras de seguranca
- AdminFeedbackService.getThreadWithReplies() -> monta thread completa de suporte
- AdminFeedbackService.listThreads() -> lista feedbacks com filtros
- AdminFeedbackService.updateFeedbackStatus() -> atualiza status e persistencia
- AdminReportModerationService.moderate() -> aplica decisao e efeitos da moderacao
- AdminStatsService.getStats() -> consolida KPIs por periodo
- AdminSystemLogService.getLatestLogs() -> devolve ultimas linhas de log
- AdminUserActionsService.execute() -> roteia acoes administrativas por tipo
- AdminUserActionsService.handleAddDays() -> adiciona dias de acesso/beneficio
- AdminUserActionsService.handleUpgradePlan() -> promove plano/beneficio
- AdminUserActionsService.handleIssueInvoice() -> cria faturamento manual quando necessario
- AdminUserActionsService.handleRefundTransaction() -> processa estorno administrativo
- AdminUserActionsService.handleUpdateProfile() -> altera perfil via admin
- AdminUserActionsService.handleUpdateUserStatus() -> ativa/bloqueia/ajusta status do usuario
- AdminUserDetailsService.getDetails() -> consolida dados, assinatura, transacoes e sinais do usuario
#### modules/filters
- FiltersController.list() -> entrega taxonomias
- FiltersController.save() -> cria/edita filtro
- FiltersController.delete() -> remove filtro
- FiltersService.list() -> carrega payload bruto de bancas, orgaos, assuntos etc.
- FiltersService.save() -> persiste taxonomia normalizada
- FiltersService.delete() -> remove registro da taxonomia
#### modules/materials
- MaterialsController.list() -> lista materiais visiveis
- MaterialsController.create() -> cria material novo
- MaterialsController.update() -> atualiza material
- MaterialsController.moderate() -> aprova/rejeita material
- MaterialsController.delete() -> remove material
- MaterialsController.getUserRating() -> devolve avaliacao do usuario
- MaterialsController.rate() -> registra rating do material
- MaterialsService.list() -> monta listagem completa do marketplace
- MaterialsService.create() -> valida e persiste novo material
- MaterialsService.update() -> aplica edicao autorizada
- MaterialsService.moderate() -> executa fluxo de moderacao
- MaterialsService.delete() -> remove o material e dependencias necessarias
- MaterialsService.getUserRating() -> consulta rating individual
- MaterialsService.rate() -> grava ou atualiza rating
- MaterialsService.attachCommentsToMaterials() -> agrega comentarios na listagem
- MaterialsService.normalizeMaterialRow() -> padroniza row do banco para contrato do app
#### modules/rankings
- RankingsController.list() -> lista rankings ativos ou pendentes conforme perfil
- RankingsController.create() -> cria ranking novo
- RankingsController.join() -> registra entrada do usuario
- RankingsController.moderate() -> aprova/rejeita ranking
- RankingsController.update() -> edita ranking
- RankingsController.delete() -> remove ranking
- RankingsService.list() -> monta lista de rankings com regra de visibilidade
- RankingsService.create() -> cria ranking com payload normalizado
- RankingsService.join() -> grava participacao/resultado
- RankingsService.moderate() -> altera status e consequencias administrativas
- RankingsService.update() -> persiste edicao do ranking
- RankingsService.delete() -> remove ranking
#### modules/subscriptions
- SubscriptionsController.updateRenewal() -> altera renovacao automatica
- SubscriptionsController.createStripeCheckoutSession() -> inicia checkout hospedado Stripe
- SubscriptionsController.createMercadoPagoSubscriptionPreference() -> inicia preferencia Mercado Pago
- SubscriptionsController.createStripeInlineSubscription() -> inicia assinatura inline da Stripe
- SubscriptionsController.finalizeStripeSubscription() -> finaliza assinatura inline
- SubscriptionsController.processStripeWebhook() -> recebe webhook Stripe
- SubscriptionsController.validateCoupon() -> valida cupom comercial
- SubscriptionsController.createStripePortalSession() -> abre portal Stripe
- SubscriptionsController.cancelSubscription() -> cancela assinatura
- SubscriptionsController.cancelRefundRequest() -> cancela pedido de reembolso
- SubscriptionsController.undoCancellationRequest() -> reverte cancelamento
- SubscriptionsController.processMercadoPagoWebhook() -> recebe webhook Mercado Pago
- SubscriptionsController.runScheduledMercadoPagoPaymentsCron() -> executa cron de pagamentos agendados
- SubscriptionsController.runRecurringMercadoPagoSubscriptionsCron() -> executa cron recorrente MP
- SubscriptionsController.runStripeReconciliationCron() -> reconcilia divergencias Stripe
**Services**
- SubscriptionsService.createStripeCheckoutSession() -> monta contexto comercial e cria checkout Stripe
- SubscriptionsService.createMercadoPagoSubscriptionPreference() -> cria preferencia MP com dados do plano
- SubscriptionsService.createStripeInlineSubscription() -> cria assinatura inline Stripe com PM/cupom
- SubscriptionsService.finalizeStripeSubscription() -> ativa assinatura local apos confirmacao
- SubscriptionsService.processStripeWebhook() -> processa eventos Stripe e sincroniza estado local
- SubscriptionsService.validateCoupon() -> valida regra comercial do cupom
- SubscriptionsService.updateRenewal() -> grava preferencia de auto renovacao
- SubscriptionsService.createStripePortalSession() -> abre portal autenticado
- SubscriptionsService.cancelSubscription() -> orquestra cancelamento e refund quando aplicavel
- SubscriptionsService.cancelRefundRequest() -> desfaz pedido de estorno/cancelamento
- SubscriptionsService.undoCancellationRequest() -> religa assinatura apos cancelamento pendente
- SubscriptionsService.processMercadoPagoWebhook() -> processa eventos do Mercado Pago
- SubscriptionsService.runScheduledMercadoPagoPaymentsCron() -> tenta cobrancas agendadas e atualiza o ciclo
- SubscriptionsService.runRecurringMercadoPagoSubscriptionsCron() -> renova assinaturas recorrentes MP
- SubscriptionsService.runStripeReconciliationCron() -> reconcilia invoices/subscriptions Stripe
- helpers privados importantes:
  - uildStripeCreationContext() -> resolve contexto comercial e de billing
  - upsertPendingStripeSubscriptionRecord() -> garante persistencia local da assinatura pendente
  - handleStripeCheckoutSessionCompleted() -> fecha efeitos do checkout pago
  - handleStripeInvoicePaid() e handleStripeInvoicePaymentFailed() -> sincronizam ciclo de cobranca
  - processMercadoPagoPreapprovalWebhook() e processMercadoPagoPaymentWebhook() -> tratam eventos MP
**Arquivos de apoio do dominio**
- MercadoPagoPaymentBootstrap.php -> monta contexto inicial do pagamento Mercado Pago
- MercadoPagoPaymentPreparation.php -> resolve cartao salvo, pricing, cobranca inicial e ativacao local
#### modules/transactions
- TransactionsController.createMaterialPurchase() -> cria compra de material
- TransactionsController.listTransactions() -> lista transacoes
- TransactionsController.requestRefund() -> solicita reembolso
- TransactionsController.approveRefund() -> aprova estorno
- TransactionsController.rejectRefund() -> rejeita estorno
- TransactionsService.listTransactions() -> devolve listagem paginada e enriquecida
- TransactionsService.createMaterialPurchase() -> persiste compra e efeitos locais
- TransactionsService.requestRefund() -> registra pedido de refund
- TransactionsService.approveRefund() -> executa aprovacao de reembolso
- TransactionsService.rejectRefund() -> executa rejeicao de reembolso
- helpers privados importantes:
  - evokePlanAccessAfterRefund() -> revoga acesso quando o refund exige
  - 
otifyRefundProcessed() -> notifica usuario sobre decisao
  - 
otifyAdminAboutRefundRequest() -> avisa operacao sobre novo pedido
  - hydrateStripeInvoiceMetadata() -> enriquece transacoes vindas da Stripe
---
## Database e persistencia
A arquitetura da base do backend esta documentada em:
- C:\xampp\htdocs\questao-pro-backend\database\architecture.md
Esse documento cobre:
- fontes do schema real
- dominios de tabelas
- relacoes principais
- modulos PHP x tabelas
- fluxos comerciais e academicos criticos
- dividas estruturais ainda abertas
---
## Divergencias e migracoes ainda abertas
### Frontend
- src/features/* ainda existe como zona legada de transicao
- src/core/* ainda tem bridges e residuos tecnicos
- src/types/index.ts ainda reexporta o contrato global vindo da raiz 	ypes.ts
### Backend
- pi/* ainda nao foi reduzido integralmente a bridges finos
- a raiz do backend ainda possui diretorios legados fora do desenho final
- nem todos os dominios esperados pelo blueprint ja migraram para modules/*
- o schema real ainda depende de consolidacao final entre database/schema.sql, database/migrations/, migrations/ e pi/migrations/
---
## Confirmacao funcional
As funcionalidades existentes continuam preservadas durante a migracao:
- autenticacao e sessao
- pratica de questoes
- simulados
- ranking
- marketplace
- leitura de materiais
- checkout e assinatura
- admin
- suporte
- notificacoes
Este arquivo deve continuar sendo atualizado a cada rodada relevante de migracao arquitetural.
## Atualizacao 2026-04-03 - dominio users, reputacao e limpeza da raiz do backend
### src/services/auth/reputationService.ts
- getUserReputation(userId) -> consulta o resumo de reputacao/XP do usuario e devolve o payload normalizado quando a API responde com sucesso.
- calculateXPForLevel(level) -> calcula localmente o XP minimo exigido para um nivel, usando a progressao oficial da plataforma.
- calculateLevelFromXP(xp) -> deriva o nivel atual a partir do XP acumulado, reaproveitando a curva de XP oficial.
- calculateProgress(xp, level) -> calcula o percentual de progresso dentro do nivel atual para barras e indicadores visuais.
- awardXP(userId, xp, reason) -> solicita ao backend a concessao de XP por uma acao especifica e retorna apenas sucesso/erro logico.
- calculateImpact(action, targetRole) -> estima localmente o impacto reputacional de moderacao para autor ou denunciante.
- updateScore(currentReputation, impact) -> aplica impacto respeitando o intervalo valido de score.
- checkAccountStatus(score) -> traduz score em estado de conta local: active, suspended ou banned.

### modules/users
- routes.php -> expoe o handler publico handleUsersReferralStatsRoute(PDO ) para o resumo de indicacoes.
- UsersController::getReferralStats(userId, frontendBaseUrl) -> controller fino que delega ao service e devolve resposta padronizada.
- UsersService::getReferralStats(userId, frontendBaseUrl) -> valida o usuario autenticado, garante referral_code, conta indicacoes, soma recompensas e monta o link final de convite.
- UsersRepository::getReferralCode(userId) -> le o referral_code atual do usuario.
- UsersRepository::saveReferralCode(userId, code) -> persiste um referral_code novo quando o usuario ainda nao possui codigo.
- UsersRepository::countReferrals(userId) -> conta quantas indicacoes foram vinculadas ao usuario.
- UsersRepository::getTotalEarnedReferralRewards(userId) -> soma o total de recompensas com status rewarded.
- UsersValidator::validateAuthenticatedUserId(userId) -> endurece a entrada minima para impedir consultas sem usuario autenticado valido.

### Limpeza estrutural da raiz do backend
- as URLs legadas /plans/list.php, /transactions/*.php e /subscriptions/*.php continuam funcionando por rewrite em .htaccess.
- os diretorios fisicos C:/xampp/htdocs/questao-pro-backend/plans, C:/xampp/htdocs/questao-pro-backend/transactions e C:/xampp/htdocs/questao-pro-backend/subscriptions foram removidos da raiz.
- artefatos tecnicos sem uso em api/plans e api/subscriptions tambem foram removidos para reduzir poluicao operacional.
## Atualizacao 2026-04-03 - migracao de componentes de plans/checkout/profile e AI oficial
### src/app/plans/components/PlanCard.tsx
- renderiza o card comercial de um plano com nome tratado, precificacao mensal equivalente, total, badges de desconto e CTA de assinatura.
- decide destaque visual de plano atual, indisponivel e upgrade com credito proporcional.
- transforma o payload de features em lista visual com fallback para objetos legados.

### src/app/checkout/components/StripeCardElementForm.tsx
- encapsula o formulario seguro de cartao novo da Stripe para o checkout.
- cria payment method, delega o proximo passo para a tela e confirma setup/payment intent quando necessario.
- centraliza validacoes locais de titular, campos do cartao e mensagens de erro do fluxo Stripe.

### src/app/checkout/components/StripeSavedCardCvcForm.tsx
- confirma compras com cartao salvo pedindo apenas o CVV.
- valida presenca do elemento seguro da Stripe e delega a confirmacao final para o checkout.

### src/app/profile/components/StripeSetupCardForm.tsx
- salva um novo cartao no cofre Stripe a partir de um setup intent ja criado.
- confirma os dados com a Stripe e devolve o paymentMethodId para o perfil persistir no backend.

### src/services/questions/aiService.ts
- extractQuestionsFromPage(apiKey, pageBase64, includeTeacherComment) -> usa Gemini para extrair metadados e questoes estruturadas de uma pagina de prova.
- extractAnswerKeyMapping(apiKey, keyImageBase64) -> converte uma imagem de gabarito em mapa numero-da-questao -> alternativa correta.
- generateDetailedAnalysis(apiKey, question) -> cria comentario detalhado em Markdown explicando cada alternativa.
- generateTeacherComment(apiKey, question) -> gera comentario curto e didatico do professor para o gabarito.
- getQuestionExplanation(apiKey, question) -> mantem a fachada de explicacao textual sob demanda para o admin.

## Ferramentas operacionais do backend
### scripts/importers/questions/gran/index.php
- interface operacional para revisar e selecionar questoes coletadas da API da Gran antes da importacao.
- nao faz parte da API publica e por isso foi movida da raiz para scripts/importers.

### scripts/importers/questions/gran/import_worker.php
- recebe o payload do importador, cria taxonomias ausentes, normaliza provas, persiste questoes e baixa imagens localmente em uploads/questions.
- funciona como worker operacional de ingestao, separado da API publica e dos modulos de dominio.
## Atualizacao 2026-04-03 - retirada de src/features e src/core do caminho produtivo
### Limpeza estrutural do frontend
- src/features/ foi removido do caminho produtivo e deixou de existir como area de codigo ativo.
- src/core/ foi removido do caminho produtivo e deixou de existir como area ativa de implementacao.
- o teste de sessao passou a viver em src/services/auth/__tests__/session.test.ts.
- aliases @features e @core foram removidos de 	sconfig.json e ite.config.ts.

### Camadas oficiais consolidadas nesta etapa
- src/services/auth/session.ts agora concentra a sessao autenticada que antes vivia em src/core/auth/session.ts.
- src/utils/helpers/DebugLogger.ts agora concentra o logger de debug que antes vivia em src/core/debug/DebugLogger.ts.
- src/services/plans/planAccess.ts agora concentra as regras de acesso por plano que antes viviam em src/features/subscriptions/utils/planAccess.ts.
- src/services/bank-analysis/types.ts e src/services/statistics/types.ts agora concentram as tipagens oficiais desses dominios.
## Atualizacao 2026-04-03 - perfil do usuario endurecido no modulo users
### modules/users (expansao)
- UsersController::changePassword(userId, payload) -> delega a troca de senha do proprio usuario para o service.
- UsersController::uploadProfilePhoto(userId, file, projectRoot) -> delega o upload autenticado da foto do perfil.
- UsersService::changePassword(userId, payload) -> valida payload, confere a senha atual, recalcula o hash e persiste a nova senha.
- UsersService::uploadProfilePhoto(userId, file, projectRoot) -> valida o arquivo, prepara o diretorio de upload, gera nome seguro, move a imagem e persiste photo_url.
- UsersRepository::getPasswordHashById(userId) -> le o hash atual do usuario autenticado.
- UsersRepository::updatePasswordHash(userId, passwordHash) -> atualiza o hash da senha com updated_at.
- UsersRepository::updatePhotoUrl(userId, photoUrl) -> persiste a nova foto do perfil com updated_at.
- UsersValidator::validatePasswordChangePayload(payload) -> valida senha atual, nova senha e tamanho minimo.
- UsersValidator::validateProfilePhotoUpload(file) -> valida upload, tamanho maximo e MIME real via info.

### src/services/profile/profileService.ts
- uploadProfilePhoto(file) -> usa ENDPOINTS.users.uploadPhoto, envia FormData autenticado e devolve a mensagem final da operacao.
- changePassword(currentPassword, newPassword) -> usa ENDPOINTS.users.changePassword, envia o payload normalizado e devolve a mensagem final da operacao.## Atualizacao 2026-04-03 - perfil autenticado consolidado no modulo users
### modules/users
- UsersController::getAuthenticatedProfile(userId) -> delega para o service a montagem completa do snapshot autenticado consumido por sessao e perfil.
- UsersController::updateAuthenticatedProfile(userId, payload) -> delega a mutacao cadastral do proprio usuario para o service.
- UsersService::getAuthenticatedProfile(userId) -> carrega dados de `users`, `addresses`, `bank_accounts`, comentarios, assinatura e cartao preferencial; normaliza camelCase; garante `referralCode`; e monta `billing`, `subscription`, `hasActivePlan` e `paymentIssue`.
- UsersService::updateAuthenticatedProfile(userId, payload) -> valida whitelist de campos, abre transacao, atualiza `users`, faz upsert de `addresses` e `bank_accounts`, traduz conflito de CPF/email e devolve mensagem padronizada.
- UsersRepository::findProfileRowById(userId) -> le o retrato principal do usuario com joins de endereco e conta bancaria.
- UsersRepository::countCommentsByUserId(userId) -> conta comentarios do proprio usuario para o snapshot.
- UsersRepository::findLatestSubscriptionSnapshot(userId) -> busca a assinatura ativa/trialing/past_due mais recente com dados do plano.
- UsersRepository::findLatestPlanTransactionStatus(userId) -> consulta o ultimo status de transacao de plano para expor `refund_requested`.
- UsersRepository::findPreferredCardExpiry(userId) -> busca o cartao default ou o primeiro cartao disponivel para diagnostico de vencimento.
- UsersRepository::updateUserFields(userId, fields) -> persiste apenas campos permitidos do perfil autenticado.
- UsersRepository::upsertAddress(userId, address) -> cria ou atualiza o endereco do usuario.
- UsersRepository::upsertBankAccount(userId, bankAccount) -> cria ou atualiza a conta bancaria suportada pelo schema atual.
- UsersValidator::validateProfileUpdatePayload(payload) -> separa e normaliza blocos de `userFields`, `address` e `bankAccount`, aplicando regras de obrigatoriedade e formato.

### Bridges legados atualizados
- `api/users/profile.php` -> agora so instancia conexao e delega para `handleUsersAuthenticatedProfileRoute($db)`.
- `api/users/update.php` -> agora so instancia conexao e delega para `handleUsersUpdateProfileRoute($db)`.
- `api/auth/me.php` -> agora virou bridge fino do mesmo handler de perfil autenticado, eliminando duplicacao de regra.

### Frontend alinhado
- `src/services/api/endpoints.ts` -> `ENDPOINTS.users.profile` agora aponta para `users/profile.php` e `ENDPOINTS.users.update` para `users/update.php`.
- `src/services/auth/accountService.ts` -> continua sendo a fachada oficial de atualizacao de perfil, agora sobre o endpoint oficial do modulo `users`.## Atualizacao 2026-04-03 - biblioteca do usuario consolidada em modules/materials
### modules/materials
- MaterialsController::listPurchasedMaterials(authenticatedUserId, requestedUserId, isAdmin) -> delega ao service a leitura da biblioteca comprada.
- MaterialsService::listPurchasedMaterials(authenticatedUserId, requestedUserId, isAdmin) -> valida o contexto autenticado, resolve o usuario alvo e devolve `materials` no contrato esperado pelo perfil.
- MaterialsRepository::fetchPurchasedMaterialsByUser(userId) -> busca materiais comprados via `transactions`, com joins de autor e metadados do material.
- MaterialsValidator::validatePurchasedMaterialsRequest(authenticatedUserId, requestedUserId, isAdmin) -> impede que usuario comum consulte biblioteca de terceiros por query string.
- handleMaterialsPurchasedLibraryRoute(db) -> ponto de entrada oficial do modulo para a biblioteca do usuario.

### Bridge legado
- `api/users/materials.php` -> agora apenas instancia conexao e delega para `handleMaterialsPurchasedLibraryRoute($db)`.## Atualizacao 2026-04-03 - abertura e download protegidos no modulo materials
### modules/materials
- MaterialsController::buildProtectedAccessPdf(authenticatedUserId, materialId) -> delega ao service a abertura inline do PDF protegido.
- MaterialsController::buildProtectedDownloadPdf(authenticatedUserId, materialId) -> delega ao service a geracao do PDF protegido para download.
- MaterialsService::buildProtectedAccessPdf(authenticatedUserId, materialId) -> valida sessao e permissao, resolve o arquivo local e gera o PDF inline com marca d'agua de propriedade.
- MaterialsService::buildProtectedDownloadPdf(authenticatedUserId, materialId) -> valida sessao e permissao, resolve o arquivo local e gera o PDF de download com marca d'agua reforcada e rodape nominal.
- MaterialsService::resolveProtectedMaterialContext(...) -> confere autoria, permissao admin/compra aprovada, status do material e existencia do arquivo fisico.
- MaterialsService::resolveMaterialFilePath(fileUrl) -> garante que apenas arquivos internos da instalacao possam ser servidos.
- handleMaterialsAccessRoute(db) -> ponto de entrada oficial para visualizacao inline do material comprado.
- handleMaterialsDownloadRoute(db) -> ponto de entrada oficial para download protegido do material comprado.

### Limpeza arquitetural
- `api/materials/access.php` e `api/materials/download.php` agora sao apenas bridges HTTP.
- `api/materials/material_access_helper.php` foi removido por nao ser mais necessario.
## Atualizacao 2026-04-03 - leitor de materiais e anotacoes

### Fluxo funcional
- PdfViewer abre PDFs protegidos de materiais, carrega comentarios, notas do usuario e marcadores por material.
- eaderService.getNote(materialId, userId) busca a anotacao livre do usuario autenticado para o material e devolve 
ote_text e updated_at.
- eaderService.saveNote(materialId, noteText, userId) cria ou atualiza a anotacao do material sem duplicar registro em user_notes.
- eaderService.getBookmarks(materialId, userId) lista os marcadores ordenados por pagina para o material atual.
- eaderService.saveBookmark(materialId, pageNum, label, userId) cria um marcador novo do usuario autenticado e devolve o item normalizado para atualizacao otimista da UI.
- eaderService.deleteBookmark(bookmarkId) remove somente marcadores do proprio usuario, evitando exclusao arbitraria por ID solto.
- eaderService.getHighlights(materialId, userId) lista destaques salvos do leitor com ects ja desserializado para a UI.
- eaderService.saveHighlight(materialId, data, userId) persiste destaques com pagina, cor, trechos e coordenadas do PDF.
- eaderService.deleteHighlight(highlightId) remove destaques do usuario autenticado.

### Regras importantes
- os endpoints do leitor agora usam a sessao autenticada como fonte de verdade para user_id;
- o backend valida permissao de leitura do material antes de permitir nota, marcador ou destaque;
- pi/materials/* desse fluxo ficou apenas como bridge, sem SQL ou regra de dominio;
- a base local foi ajustada para IDs VARCHAR(36) em user_bookmarks e user_highlights, alinhando os recursos do leitor ao modelo atual de usuarios e materiais.

## Atualizacao 2026-04-03 - atividade do usuario no modulo users

- commentService.getUserComments(userId) continua sendo a fachada do frontend para carregar comentarios publicados pelo usuario, mas agora o backend responde via modules/users;
- userProgressService.getUserQuestionNotes(userId) continua carregando notas de questoes por users/notes.php, e o endpoint agora passa por sessao/autorizacao padronizadas no modulo users;
- users/comments.php devolve historico de atividade com 	argetId, 	argetType, questionId legado, texto, data e userId;
- users/notes.php devolve notas com contexto resumido de questao ou material, preservando o contrato consumido no progresso/perfil.

## Atualizacao 2026-04-03 - respostas do usuario em modules/users

- userProgressService.getUserAnswers(userId) continua sendo a fachada do frontend para carregar historico de respostas, agora sustentado por modules/users;
- users/answers.php devolve questionId, isCorrect, selectedOptionIndex, 	imestamp, 	imeTaken e simulationId, preservando o contrato da camada de progresso;
- a autorizacao dessa leitura agora segue o mesmo padrao de sessao/autorizacao de users/comments.php e users/notes.php.

## Atualizacao 2026-04-03 - cofre de cartoes do usuario em modules/users

### Billing do perfil
- list_cards: identifica o usuario autenticado, resolve o provedor ativo de cofre, sincroniza o espelho Stripe quando necessario ou valida cartoes Mercado Pago remotos antes de devolver a lista.
- emove_card: bloqueia remocao de cartao travado por recorrencia, desanexa payment method Stripe quando aplicavel, remove o espelho local e promove o proximo cartao a padrao quando necessario.
- set_default_card: define o cartao padrao local do usuario e, no caso Stripe, replica esse default tambem em invoice_settings.default_payment_method do customer remoto.

### Funcoes tecnicas novas
- UsersCardsService::listSavedCards(...): concentra a regra de leitura do cofre do usuario, inclusive limpeza de cartoes remotos obsoletos no Mercado Pago.
- UsersCardsService::removeSavedCard(...): concentra a remocao segura do cartao e a manutencao do estado local do cofre.
- UsersCardsService::setDefaultSavedCard(...): centraliza a troca de cartao padrao com transacao local e sincronizacao opcional com Stripe.
- UsersCardsStripeSupport.php: mantem o suporte Stripe de cartoes dentro do dominio users, sustentando os fluxos legados de setup/sync ate a absorcao completa desses endpoints.
## Atualizacao 2026-04-03 - billing completo do perfil em modules/users

### Funcoes de cartao salvo do perfil
- create_stripe_setup_intent: prepara o SetupIntent usado pelo formulario Stripe para salvar um cartao para uso futuro no modo off_session.
- sync_stripe_card: recebe o payment_method_id confirmado no frontend, anexa ao customer quando necessario, marca o metodo como salvo, espelha localmente em user_cards e devolve a lista consolidada de cartoes.
- save_card: mantem compatibilidade com o cofre legado/local, validando duplicidade por bandeira + finais, definindo padrao no primeiro cartao e sincronizando users.has_saved_card.

### Funcoes tecnicas novas
- UsersCardsService::createStripeSetupIntent(...): concentra a criacao do SetupIntent Stripe para o usuario autenticado.
- UsersCardsService::syncStripeCard(...): concentra a sincronizacao entre Stripe e user_cards apos o setup do cartao.
- UsersCardsService::saveLegacyCard(...): concentra a persistencia do cartao legado/local ainda usada no perfil.
- UsersValidator::validateStripePaymentMethodPayload(...): valida o payload minimo de sincronizacao Stripe.
- UsersValidator::validateLegacySavedCardPayload(...): normaliza e valida o payload legado de salvamento local.
## Atualizacao 2026-04-03 - suporte de assinaturas internalizado no modulo

### Funcoes tecnicas movidas para modules/subscriptions
- SubscriptionsBillingSupport.php: concentra calculos de ciclo, configuracao Stripe recorrente, periodos de acesso, prorata, cupons, labels de cobranca, antifraude operacional e envio de e-mails de assinatura.
- StripePaymentApprovalValidator.php: concentra a validacao antifraude/evidencias do Stripe, incluindo CVC, endereco, risco, review e 3DS antes da aprovacao final.

### Impacto funcional
- O fluxo de assinatura Stripe e reconciliacao continua igual para o app, mas a regra deixou de depender de helpers soltos em pi/subscriptions e pi/users.
- TransactionsService e payment_refund_helper continuam compartilhando a mesma logica de recorrencia e detalhamento financeiro, agora a partir do modulo oficial de subscriptions.## Atualizacao 2026-04-03 - administracao e seguranca de conta em modules/users

### Funcoes administrativas do dominio users
- UsersService::listUsers(...): lista usuarios para o painel admin, junta users, user_subscriptions e plans, e devolve o resumo de billing no mesmo shape historico consumido pelo frontend.
- handleUsersListRoute(...): exige sessao autenticada com papel admin antes de devolver a lista; sem isso, a rota agora falha com autorizacao coerente.

### Funcoes de anotacao do perfil
- UsersService::deleteUserNote(...): resolve o usuario-alvo pela sessao, valida ownership e remove uma anotacao especifica de user_notes.
- UsersValidator::validateDeleteNotePayload(...): normaliza id, user_id e userId legados para evitar parsing manual espalhado.
- handleUsersDeleteNoteRoute(...): virou o ponto HTTP unico para exclusao de notas do usuario, com resposta padronizada e 404 quando a nota nao pertence ao usuario.

### Funcoes de exclusao de conta
- UsersService::requestAccountDeletion(...): nao apaga a conta imediatamente; apenas registra o pedido como pending_deletion, grava motivo e deletion_requested_at.
- UsersValidator::validateAccountDeletionPayload(...): garante que o motivo exista antes de prosseguir.
- handleUsersDeleteAccountRoute(...): aplica sessao oficial + reCAPTCHA e so depois delega a gravacao do pedido ao service.

### Impacto funcional
- o painel admin continua carregando usuarios pelo mesmo service do frontend (dminService.getUsers()), mas o backend agora exige permissao real;
- notas do usuario continuam consumidas pela camada de progresso/perfil sem mudar contrato;
- o fluxo de exclusao de conta fica mais seguro, porque saiu do JWT manual e passou a usar a sessao padronizada da plataforma.## Atualizacao 2026-04-03 - recuperacao e confirmacao de conta em modules/auth

### Funcoes de sessao
- AuthService::logout(): finaliza a sessao autenticada atual usando a infraestrutura oficial de AuthSession, limpa o ciclo de refresh e devolve resposta padronizada.
- AuthService::refreshSession(): renova a sessao atual a partir do refresh token em cookie e devolve 	oken + bloco session no formato esperado pelo frontend.

### Funcoes de recuperacao de senha
- AuthService::requestPasswordReset(...): valida e-mail, garante a tabela password_resets, invalida tokens anteriores, cria um novo token de reset e envia o e-mail de recuperacao.
- AuthService::resetPassword(...): valida token e nova senha, confirma que o reset continua ativo, atualiza users.password_hash e marca o token como usado.
- AuthValidator::validateForgotPasswordPayload(...): valida e-mail e normaliza captchaToken antes da etapa de seguranca.
- AuthValidator::validateResetPasswordPayload(...): garante token + senha minima para o fluxo de redefinicao.

### Funcoes de confirmacao de e-mail
- AuthService::resendConfirmation(...): usa a sessao autenticada como fonte de verdade do usuario, invalida tokens antigos de verificacao e reenvia o e-mail de confirmacao.
- AuthService::confirmEmail(...): valida o token de verificacao, marca o usuario como email_verified, soma +50 XP e registra notificacao de boas-vindas.
- AuthValidator::validateResendConfirmationPayload(...): impede reenvio para um e-mail diferente do que esta autenticado na sessao.
- AuthValidator::validateConfirmationTokenPayload(...): garante a presenca do token no fluxo de confirmacao.

### Impacto funcional
- o frontend continua usando os mesmos endpoints e o mesmo uthFlowService, sem quebrar checkout, confirmacao de e-mail e reset de senha;
- a regra saiu dos scripts procedurais de pi/auth/* e entrou na fatia oficial modules/auth, alinhando autenticacao ao desenho revisado do backend.## Atualizacao 2026-04-03 - autenticacao principal e 2FA em modules/auth

### Funcoes de entrada de conta
- AuthService::login(...): valida email/senha + reCAPTCHA, decide se o admin precisa passar pelo 2FA e, quando o acesso e liberado, emite a sessao oficial e devolve o snapshot completo do usuario.
- AuthService::register(...): cria a conta com defaults de estudante, gera eferral_code, vincula eferred_by_id quando houver indicacao, cria token de verificacao de e-mail, registra notificacao de onboarding e emite a sessao inicial.

### Funcoes de 2FA
- AuthService::setupTwoFactor(...): gera o segredo TOTP e a URL do QR code para o admin autenticado.
- AuthService::enableTwoFactor(...): valida o codigo informado contra o segredo e persiste 	wo_factor_secret + 	wo_factor_enabled.
- AuthService::verifyTwoFactor(...): valida o codigo TOTP pelo email informado e libera o bundle final de sessao com token oficial.

### Funcoes tecnicas novas
- AuthValidator::validateLoginPayload(...): valida o login tradicional e normaliza captchaToken.
- AuthValidator::validateRegisterPayload(...): valida nome, email, senha e referral do cadastro.
- AuthValidator::ensureAdminAuthenticated(...): restringe setup/ativacao de 2FA a administradores autenticados.
- AuthRepository::findUserForLoginByEmail(...): centraliza a leitura minima do usuario para login.
- AuthRepository::insertUser(...): centraliza a criacao do estudante com defaults do produto.
- AuthRepository::enableTwoFactor(...) e AuthRepository::findUserForTwoFactorByEmail(...): concentram a persistencia e leitura do estado de 2FA.

### Impacto funcional
- uthFlowService.register, uthFlowService.login e uthFlowService.verifyTwoFactor continuam com o mesmo contrato esperado pelo frontend;
- dminService.setupTwoFactor e dminService.enableTwoFactor continuam funcionando, mas agora sobre a camada oficial modules/auth.## Atualizacao 2026-04-03 - notifications em modules/notifications

### Funcoes de inbox
- NotificationsService::listNotifications(...): usa a sessao autenticada como fonte de verdade, aceita since opcional e devolve items + count no formato esperado pelo app.
- NotificationsValidator::validateListQuery(...): normaliza o filtro since para sincronizacao incremental sem espalhar parsing pela rota.
- NotificationsRepository::listByUserId(...): concentra o SELECT oficial de notifications com ordenacao recency-first e limite controlado.

### Funcoes de leitura e limpeza
- NotificationsService::markAsRead(...): marca uma notificacao especifica como lida dentro do escopo do usuario autenticado.
- NotificationsService::markAllAsRead(...): resolve o user_id real da operacao em lote e impede que usuario comum gerencie inbox de terceiros.
- NotificationsService::deleteNotification(...): faz soft delete via deleted_at para manter historico e lixeira logica.
- NotificationsService::clearAll(...): aplica a limpeza em lote do inbox usando o mesmo controle de ownership.
- NotificationsValidator::resolveScopedUserId(...): permite operacoes em outro usuario apenas para administradores.

### Funcoes de envio
- NotificationsService::sendNotification(...): valida titulo, mensagem, tipo, categoria, link e evidenceUrl, normaliza report -> moderation no storage e registra a notificacao oficial.
- NotificationsValidator::validateSendPayload(...): centraliza compatibilidade com user_id/userId, action_url/link e categorias legadas.
- NotificationsValidator::resolveSendRecipient(...): endurece permissao de envio; usuario comum pode enviar para si mesmo e para o pseudo-destinatario admin, enquanto admin pode enviar para outros escopos.
- NotificationsRepository::insert(...): concentra o INSERT oficial em notifications.

### Impacto funcional
- notificationService.getNotifications, getUserNotifications, markAsRead, markAllAsRead, deleteNotification, clearAll e sendNotification continuam com o mesmo contrato do frontend.
- os rewrites notificationsMarkAllRead e notificationsClearAll agora existem de forma oficial, eliminando a divergencia que podia quebrar a caixa de notificacoes.## Atualizacao 2026-04-03 - comments em modules/comments

### Funcoes de listagem
- CommentsService::listComments(...): lista comentarios por target_id, resolve autenticacao opcional para isLiked e devolve a arvore aninhada no formato esperado pelo frontend.
- CommentsValidator::validateListQuery(...): normaliza target_id e o fallback user_id das leituras publicas.
- CommentsRepository::listByTargetId(...): concentra o SELECT oficial de comments com autor, plano, avatar, total de likes e estado isLiked.

### Funcoes de mutacao
- CommentsService::addComment(...): valida target/content, usa a sessao como fonte de verdade do autor, aplica a regra de QA para respostas em materiais e persiste o comentario oficial.
- CommentsService::toggleLike(...): centraliza o toggle da curtida do comentario autenticado e dispara notificacao social quando a curtida e nova.
- CommentsService::deleteComment(...): garante ownership do comentario antes da exclusao.
- CommentsValidator::validateAddPayload(...): normaliza question_id, parent_id, targetType e content para o contrato legado commentsHandle.
- CommentsValidator::validateCommentMutationPayload(...): concentra a validacao de commentId para like/delete.

### Funcoes auxiliares e notificacoes
- CommentsRepository::insertComment(...), addLike(...), removeLike(...), deleteComment(...): concentram todo o SQL do dominio.
- CommentsRepository::insertNotification(...): persiste notificacoes derivadas do dominio sem recolocar SQL em controller/service.
- CommentsService::notifyAboutNewComment(...): avisa o autor do comentario pai ou o autor do material quando surge interacao relevante.
- CommentsService::notifyAboutLike(...): registra notificacao social para novas curtidas.

### Impacto funcional
- commentService.getComments, addComment, likeComment e deleteComment continuam com o mesmo contrato usado pelo frontend.
- comments/list_cached.php continua existindo como ponte de compatibilidade, mas a regra real agora mora em modules/comments.## Atualizacao 2026-04-03 - progressao de questoes em modules/questions

### Funcionalidades absorvidas
- submitAnswer: grava resposta do usuario, incrementa estatisticas da questao, atualiza XP/nivel e dispara recompensa de level up quando necessario.
- getQuestionHistory: lista o historico de tentativas por questao; para convidado retorna lista vazia.
- esetAnswers: limpa as respostas persistidas do usuario autenticado.
- 	oggleSavedQuestion: alterna o estado salvo de uma questao para o usuario atual.

### Como funciona
- O modulo usa sessao autenticada como fonte de verdade e so aceita operar em outro usuario quando o contexto e admin.
- O historico preserva o formato esperado pelo frontend (questionId, selectedOptionIndex, isCorrect, 	imestamp).
- O fluxo de recompensa de level up foi internalizado em modules/questions, sem depender de helper de dominio dentro de pi/.## Atualizacao 2026-04-03 - leitura e administracao de questoes em modules/questions

### Funcionalidades absorvidas
- listQuestions: monta a lista principal de questoes para pratica, com filtros, stats, comentarios agregados e resposta mais recente do usuario.
- ilterQuestions: entrega a grade administrativa de questoes com busca por palavra-chave, paginação e filtros serializados.
- getQuestionStats: calcula total de tentativas, acertos, erros e distribuicao por alternativa.

### Como funciona
- A listagem principal usa auth opcional e libera comentarios do professor/analise detalhada conforme beneficio do plano.
- O filtro administrativo usa sessao como fonte de verdade e bloqueia acesso fora de contexto admin.
- O card de questao no frontend agora consome a fachada oficial de questions, em vez de chamar piClient direto para historico e stats.## Atualizacao 2026-04-03 - manutencao administrativa de questoes em modules/questions

### Funcionalidades absorvidas
- saveQuestion: cria ou atualiza questoes, serializa data_json, recalcula o indice da resposta correta e sincroniza taxonomias vinculadas.
- getQuestionForEdit: carrega a questao completa para edicao administrativa com filtros, itens e comentarios ricos.
- deleteQuestion: remove a questao no escopo administrativo oficial.

### Como funciona
- As rotas administrativas de questoes agora exigem sessao autenticada de admin.
- A sincronizacao de filtros foi centralizada no service, enquanto criacao, busca e vinculacao ficaram no repository.
- A UI administrativa passou a consumir a service oficial para listagem de questoes, reduzindo acoplamento HTTP direto na pagina.
---
## Baseline de versao funcional
Adicionado em: 2026-04-04
- Versao funcional atual da plataforma: `v1.0.0`
- Esta passa a ser a baseline oficial para changelog funcional da plataforma.
- A versao tecnica atual do frontend em `package.json` agora esta alinhada com a baseline publica em `1.0.0`.

### Regra de evolucao
- `patch` da feature: correcao ou ajuste funcional pequeno sem alterar o escopo da feature.
- `minor` da feature: ampliacao perceptivel da feature, novo fluxo ou nova capacidade relevante dentro do mesmo dominio.
- `major` da feature: mudanca de comportamento, reposicionamento ou quebra relevante de contrato funcional daquele dominio.
- `patch` da plataforma: consolidacao de varias correcoes pequenas sem nova feature transversal.
- `minor` da plataforma: entrega transversal envolvendo mais de um dominio funcional principal.
- `major` da plataforma: reposicionamento amplo de produto, arquitetura funcional ou modelo operacional.
- Mudancas apenas tecnicas ou arquiteturais, sem impacto funcional visivel, devem entrar no `audit-report`, mas nao precisam subir a versao funcional da feature.

### Snapshot de versao por feature
- institucional-publico: `v1.0.0`
- auth-sessao: `v1.0.0`
- questoes-pratica: `v1.0.0`
- filtros-taxonomias: `v1.0.0`
- simulados: `v1.0.0`
- estatisticas-bank-analysis: `v1.0.0`
- rankings: `v1.0.0`
- planos-checkout-assinaturas: `v1.0.0`
- marketplace-materiais-reader: `v1.0.0`
- perfil-conta-billing: `v1.0.0`
- notificacoes: `v1.0.0`
- suporte-feedback-reports: `v1.0.0`
- partner-dashboard: `v1.0.0`
- admin-operacao: `v1.0.0`
- changelog-publico: `v1.0.0`

---
## Matriz de versao por funcionalidade
Adicionado em: 2026-04-04
- A baseline funcional detalhada da versao `v1.0.0` agora vive em [C:\dev\concursomestre\docs\feature-version-matrix.md](C:\dev\concursomestre\docs\feature-version-matrix.md).
- Esse arquivo responde o que a versao atual entrega em cada funcionalidade, por exemplo `simulados`, `rankings`, `marketplace`, `billing` e `admin`, sem agrupar por pagina.

