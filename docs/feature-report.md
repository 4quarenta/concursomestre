# Feature Report
Atualizado em: 2026-04-03
## Aviso operacional
Este arquivo preserva snapshots historicos.
Qualquer mencao a Mercado Pago abaixo deve ser tratada como legado descontinuado.
O fluxo ativo de billing e assinaturas agora e Stripe-only.
## Objetivo
Este documento descreve o que existe hoje na plataforma ConcursoMestre.
Ele funciona como inventario funcional completo do sistema e responde:
- quais paginas existem e para que servem
- quais providers sustentam a aplicação
- quais serviços oficiais existem no frontend
- como cada funcao principal funciona
- quais modulos oficiais existem hoje no backend PHP
- quais dependencias, legados e gaps ainda restam
---
## Visao geral do produto
ConcursoMestre e uma plataforma de questões para concursos publicos, com foco em pratica guiada, simulados, estatisticas de desempenho, ranking pos-prova, assinatura premium e marketplace de materiais em PDF.
Os principais dominios funcionais do produto hoje sao:
- autenticação e sessão
- pratica de questões
- filtros e taxonomias
- simulados
- desempenho e raio-x de banca
- ranking competitivo
- planos, checkout e assinatura
- perfil do usuário
- notificações
- suporte
- marketplace de materiais
- administracao da operação
---
## Frontend
### Arquitetura ativa
- src/app/*/page.tsx -> entry point oficial das telas
- src/components/shared/* -> componentes realmente compartilhados
- src/providers/* -> comportamento global da app
- src/services/* -> integração HTTP e fachadas por dominio
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
  - conduz para autenticação, planos e exploracao da plataforma
#### /auth
- Arquivo: src/app/auth/page.tsx
- Papel: entrada de autenticação.
- Como funciona:
  - concentra login, cadastro, recuperacao de senha e 2FA
  - usa uthFlowService
  - pode ser reutilizada por fluxos comerciais como o checkout
#### /plans
- Arquivo: src/app/plans/page.tsx
- Papel: catalogo comercial de planos.
- Como funciona:
  - apresenta benefícios e comparativos
  - usa planService e dados de configuração global
  - redireciona para checkout do plano selecionado
#### /promo/:slug
- Arquivo: src/app/promo/page.tsx
- Papel: pagina promocional por campanha.
- Como funciona:
  - resolve a oferta via slug
  - reapresenta benefícios e CTA comercial
  - leva o usuário para planos/checkout
#### /faq
- Arquivo: src/app/faq/page.tsx
- Papel: perguntas frequentes.
- Como funciona:
  - organiza respostas institucionais e comerciais
  - reduz demanda operacional de suporte
#### /changelog
- Arquivo: src/app/changelog/page.tsx
- Papel: histórico público de atualizacoes.
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
- Papel: redefinição final de senha.
- Como funciona:
  - valida token recebido por e-mail
  - usa uthFlowService.resetPassword()
  - encaminha o usuário de volta para a autenticação
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
- Papel: pratica de questões.
- Como funciona:
  - aplica filtros por banca, orgao, cargo, assunto, ano e dificuldade
  - usa questionService para listar questões e registrar respostas
  - sustenta favoritos, notas e comentários
#### /simulation
- Arquivo: src/app/simulation/page.tsx
- Papel: simulados.
- Como funciona:
  - monta blocos de questões
  - salva sessoes de simulacao e histórico
  - usa simulationsService
#### /bank-analysis
- Arquivo: src/app/bank-analysis/page.tsx
- Papel: raio-x de banca.
- Como funciona:
  - usa ankAnalysisService
  - agrega leitura por banca, analytics do usuário e insights de padrao
#### /marketplace
- Arquivo: src/app/marketplace/page.tsx
- Papel: marketplace de materiais.
- Como funciona:
  - lista materiais, ratings, comentários e compra
  - usa marketplaceService, 	ransactionsService e commentsService
#### /ranking
- Arquivo: src/app/ranking/page.tsx
- Papel: rankings competitivos.
- Como funciona:
  - lista rankings aprovados
  - permite adesao, envio de resultado e acompanhamento de posicao
  - usa 
ankingsService
#### /profile
- Arquivo: src/app/profile/page.tsx
- Papel: centro da conta do usuário.
- Como funciona:
  - edita dados pessoais e senha
  - mostra referrals, materiais, billing, assinatura e cartoes
  - usa profileService, 	ransactionsService, cardsService e marketplaceService
#### /notifications
- Arquivo: src/app/notifications/page.tsx
- Papel: central de notificações.
- Como funciona:
  - usa 
otificationService
  - carrega notificações, marca como lidas e limpa histórico
#### /partner-dashboard
- Arquivo: src/app/partner-dashboard/page.tsx
- Papel: area do parceiro/autor.
- Como funciona:
  - pública materiais
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
  - valida cupom, calcula parcelas, escolhe gateway e salva cartão
  - usa planService, uthFlowService, cardsService, paymentsService e subscriptionsService
#### /admin
- Arquivo: src/app/admin/page.tsx
- Papel: painel administrativo central.
- Como funciona:
  - agrega dashboard executivo, financeiro, base, configurações, suporte e moderação
  - usa dminService e componentes especializados do dominio admin
---
## Providers globais
### AppProviders
- compoe a arvore oficial de providers
- garante ordem consistente de autenticação, dados, marketplace, tema, toast e modal
### AuthProvider
- guarda o usuário autenticado
- centraliza login, logout, refresh de sessão e eventos da conta
- exp?e dados de assinatura, progresso e permissao do usuário
### DataProvider
- hidrata taxonomias, questões, relatórios, configurações e caches de dados globais
- organiza parte relevante do bootstrap da aplicação autenticada
### MarketplaceProvider
- concentra estado global do marketplace que precisa sobreviver entre telas
- coordena atualizacao otimista de compra, transação e reembolso
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
- CommentsSection.tsx -> secao reutilizavel de comentários
- PromoBanner.tsx -> faixa promocional reutilizavel
### src/components/shared/layout
- Footer.tsx -> rodape compartilhado
- DashboardSidebar.tsx -> navegacao lateral reutilizada em areas autenticadas
### src/components/shared/overlays
- AuthModal.tsx -> autenticação em modal
- ConfirmModal.tsx -> confirmacao global
- SuccessModal.tsx -> retorno visual de sucesso
- UpgradeModal.tsx -> upsell comercial
- PdfViewer.tsx -> visualizacao compartilhada de PDF
---
## Serviços oficiais do frontend
### src/services/api
#### client.ts
- configura o cliente HTTP base
- aplica base URL, serializacao e integração com interceptadores
#### interceptors.ts
- intercepta requests/responses
- anexa token quando necessario
- centraliza regras comuns de erro da API
#### 
esponse.ts
- 
ormalizeApiEnvelope() -> detecta se a resposta veio crua ou envelopada
- 
eadApiData() -> extrai o payload util sem repetir parsing na UI
- ssertApiSuccess() -> garante sucesso logico e levanta erro coerente
- 
eadApiErrorMessage() -> extrai a melhor mensagem possível de falha
- 
eadApiErrorCode() -> extrai código técnico legado quando ele existir
### src/services/auth/accountService.ts
- updateUserProfile(payload) -> atualiza dados do usuário, normaliza resposta e devolve o perfil atualizado
- ecomePartner() -> promove o usuário ao papel de parceiro/autor conforme regra do backend
### src/services/auth/authFlowService.ts
- 
egister(payload) -> registra usuário novo, retorna token/sessão e payload de autenticação
- login(payload) -> autentica usuário existente e devolve payload normalizado
- orgotPassword(payload) -> dispara fluxo de recuperacao de senha por e-mail
- 
esendConfirmation(email) -> reenvia confirmacao de cadastro
- confirmEmail(token) -> confirma o token do e-mail e informa estado final do cadastro
- 
esetPassword(payload) -> aplica nova senha a partir do token valido
- erifyTwoFactor(payload) -> confirma 2FA e devolve token/mensagem da verificacao
### src/services/bank-analysis/bankAnalysisService.ts
- getBankIntel(url) -> consulta inteligencia pública para uma banca/url
- getXrayStats(filters) -> carrega estatisticas agregadas do raio-x
- getAnalysis(boardId) -> devolve análise detalhada da banca
- getUserAnalytics() -> devolve analytics pessoais do usuário no modulo
- getPatternInsights(boardId) -> resume padroes recorrentes da banca selecionada
### src/services/billing/cardsService.ts
- listSavedCards(userId?) -> lista cartoes salvos e remove stale cards quando o backend indicar
- 
emoveSavedCard(cardId, userId?) -> exclui cartão salvo
- setDefaultSavedCard(cardId, userId?) -> define cartão padrao
- saveLegacyCard(payload) -> salva cartão no fluxo legado/local
- createStripeSetupIntent() -> prepara setup intent da Stripe para novo cartão
- syncStripeCard(paymentMethodId) -> sincroniza metodo Stripe salvo com o backend local
### src/services/changelog/changelogService.ts
- listVersions() -> carrega releases públicas e ordena o changelog do produto
### src/services/comments/commentsService.ts
- getComments(targetId, userId?) -> carrega comentários por alvo (questão/material)
- getUserComments(userId) -> lista comentários feitos pelo usuário
- ddComment(commentData) -> cria comentário novo e devolve o comentário persistido
- likeComment(commentId, userId?) -> registra curtida do comentário
- 
eportComment(...) -> envia denúncia de comentário para moderação
- deleteComment(commentId, userId?) -> exclui comentário do usuário ou moderado
### src/services/filters/index.ts
- list() -> busca o payload bruto de taxonomias
- listTaxonomies() -> converte o payload bruto para o shape usado pela UI
- save(payload) -> cria/edita filtro administrativo
- 
emove(id) -> remove filtro/taxonomia
- 
ormalizeFiltersToTaxonomies(data) -> mapper central de bancas, orgaos, materias, assuntos, cargos, carreiras e anos
### src/services/marketplace/marketplaceService.ts
- listMaterials(filters?) -> lista materiais publicados no marketplace
- createMaterial(material) -> cria material novo
- updateMaterial(materialId, updates) -> atualiza material existente
- moderateMaterial(...) -> aprova ou rejeita material na moderação
- deleteMaterial(materialId) -> remove material
- listTransactions(params) -> lista transações do marketplace com filtros simples
- getUserMaterialRating(materialId) -> carrega rating dado pelo usuário no material
- 
ateMaterial(materialId, rating) -> grava avaliação do material
- getTransactions(userId) -> lista transações pelo usuário numerico legado
- getUserTransactions(userId) -> lista transações do usuário autenticado
- listUserMaterials(userId) -> lista materiais do proprio parceiro/autor
- 
equestRefund(transactionId, reason) -> solicita reembolso
- cancelRefundRequest(transactionId) -> cancela a solicitacao de estorno
- processRefund(transactionId, approved) -> decide estorno no fluxo administrativo/comercial
- createMaterialPurchase(materialId) -> inicia compra de material com sessão autenticada
- purchaseMaterial(materialId) -> bridge legado para compra simplificada
- uploadMaterial(material) -> bridge legado para pública??o simples
- uploadFile(...) -> envia arquivo do material e devolve URL/metadata normalizada
- getPartnerTransactions(_partnerId) -> consulta vendas do parceiro
- getMaterials(filters?) -> alias legado para listagem de materiais
### src/services/notifications/notificationService.ts
- getNotifications() -> lista notificações do usuário autenticado
- getUserNotifications(_userId) -> bridge legado para o mesmo fluxo
- markAsRead(notificationId) -> marca uma notificação como lida
- markAllAsRead() -> marca todas como lidas
- deleteNotification(notificationId) -> remove uma notificação
- clearAll() -> limpa histórico de notificações
- sendNotification(...) -> envia notificação administrativa/sistemica quando a UI precisar iniciar esse fluxo
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
- createStripeSetupIntent() -> prepara setup intent de cartão
- syncStripeCard(paymentMethodId) -> sincroniza cartão salvo na Stripe
- createStripePortalSession() -> abre portal de billing da Stripe
- alidateCoupon(code, amount, planId?) -> valida cupom comercial
- cancelSubscription(...) -> solicita cancelamento da assinatura ativa
- cancelRefundRequest() -> cancela solicitacao de reembolso
- undoCancellationRequest() -> reverte cancelamento solicitado
- updateRenewal(autoRenew) -> altera preferencia de renovação automática
### src/services/profile/profileService.ts
- getReferralStats() -> carrega estatisticas de indicacao/referral
- uploadProfilePhoto(file) -> envia avatar do usuário
- changePassword(currentPassword, newPassword) -> troca senha do usuário autenticado
### src/services/progress/userProgressService.ts
- getUserAnswers(userId) -> lista respostas historicas do usuário
- getUserQuestionNotes(userId) -> lista anotacoes/notas do usuário por questão
### src/services/questions/questionService.ts
- getQuestionPage(filters?) -> carrega lote paginado/filtrado de questões no formato de tela
- getQuestions(filters?) -> devolve apenas a lista de questões
- submitUserAnswer(userId, answer) -> registra resposta e devolve impacto no progresso
- submitAnswer(answer) -> bridge simplificada para envio de resposta
- createQuestion(questionData) -> cria uma questão nova
- createQuestions(questions) -> cria lote de questões
- updateQuestion(id, questionData) -> atualiza questão existente
- deleteQuestion(id) -> remove questão
- 	oggleSavedQuestion(userId, questionId) -> alterna favorito/salva da questão
- 
esetAnswers(userId) -> zera histórico de respostas do usuário
### src/services/rankings/rankingsService.ts
- list() -> lista rankings visiveis ao usuário
- create(payload) -> cria ranking novo
- join(rankingId, userId, entry) -> entra em ranking com resultado do usuário
- moderate(rankingId, status) -> aprova/rejeita ranking no admin
- update(payload) -> atualiza ranking existente
- 
emove(rankingId) -> exclui ranking
### src/services/simulations/simulationsService.ts
- saveSimulation(userId, simulation) -> persiste sessão de simulado do usuário
### src/services/statistics/statisticsService.ts
- getUserStatistics(userId) -> carrega estatisticas consolidadas do usuário
- getQuestionStatistics(questionId) -> carrega estatisticas de uma questão
- getPlatformStatistics() -> carrega indicadores agregados da plataforma
- updateUserStatistics(userId, data) -> atualiza agregados do usuário apos eventos de estudo
### src/services/subscriptions/subscriptionsService.ts
- createMercadoPagoSubscriptionPreference(payload) -> cria preferencia Mercado Pago do plano
- processMercadoPagoPayment(payload) -> processa pagamento/subscricao Mercado Pago
- createStripeCheckoutSession(payload) -> inicia checkout hospedado Stripe
- createStripeSubscription(payload) -> cria assinatura inline Stripe
- inalizeStripeSubscription(payload) -> conclui assinatura inline
- alidateCoupon(code, amount, planId?) -> valida cupom no backend comercial
- createStripePortalSession() -> abre portal de billing
- updateRenewal(autoRenew) -> altera renovação automática
- cancelSubscription(reason?, details?, captchaToken?) -> solicita cancelamento da assinatura ativa
- cancelRefundRequest() -> desfaz uma solicitacao de reembolso pendente
- undoCancellationRequest() -> reabre a assinatura apos pedido de cancelamento
### src/services/support/supportService.ts
- listThreads() -> lista chamados/thread do usuário
- listReplies(threadId) -> lista respostas do chamado
- createThread(input) -> abre novo chamado de suporte
### src/services/transactions/transactionsService.ts
- list(params) -> lista transações com filtros, pagina ou recortes comerciais
- createMaterialPurchase(materialId) -> inicia compra autenticada de material
- 
equestRefund(transactionId, reason) -> solicita reembolso
- cancelRefundRequest(transactionId) -> cancela solicitacao pendente
- 
esolveRefund(...) -> aprova ou rejeita reembolso no fluxo administrativo
---
## Backend PHP
### Estrutura ativa
- modules/<domain>/controllers -> entrada HTTP fina
- modules/<domain>/services -> regra de negocio
- modules/<domain>/repositories -> acesso a banco
- modules/<domain>/validators -> validação e normalizacao de entrada
- modules/<domain>/routes.php -> mapeamento do dominio
- shared/* -> infraestrutura transversal
- pi/* -> legado em reducao para bridges finos
### Modulos oficiais presentes hoje
#### modules/admin
**Controllers**
- AdminCacheController.handle() -> roteia operações de cache do admin
- AdminDatabaseMaintenanceController.listTables() -> lista tabelas resetaveis
- AdminDatabaseMaintenanceController.reset() -> executa reset administrativo da base
- AdminFeedbackController.showThread() -> devolve thread de feedback com replies
- AdminFeedbackController.listThreads() -> lista chamados/feedbacks
- AdminFeedbackController.updateStatus() -> altera status de um feedback
- AdminReportModerationController.moderate() -> decide uma denúncia
- AdminStatsController.index() -> entrega KPIs administrativos
- AdminSystemLogController.showLatestLogs() -> exibe logs do sistema
- AdminUserActionsController.execute() -> executa mutacoes administrativas em usuário
- AdminUserDetailsController.show() -> detalha um usuário no admin
**Services**
- AdminCacheService.handle() -> centraliza stats, limpeza e toggles de cache
- AdminDatabaseMaintenanceService.listResettableTables() -> resolve tabelas elegiveis para reset
- AdminDatabaseMaintenanceService.resetDatabase() -> reseta dados com regras de segurança
- AdminFeedbackService.getThreadWithReplies() -> monta thread completa de suporte
- AdminFeedbackService.listThreads() -> lista feedbacks com filtros
- AdminFeedbackService.updateFeedbackStatus() -> atualiza status e persistencia
- AdminReportModerationService.moderate() -> aplica decisao e efeitos da moderação
- AdminStatsService.getStats() -> consolida KPIs por período
- AdminSystemLogService.getLatestLogs() -> devolve ultimas linhas de log
- AdminUserActionsService.execute() -> roteia ações administrativas por tipo
- AdminUserActionsService.handleAddDays() -> adiciona dias de acesso/benefício
- AdminUserActionsService.handleUpgradePlan() -> promove plano/benefício
- AdminUserActionsService.handleIssueInvoice() -> cria faturamento manual quando necessario
- AdminUserActionsService.handleRefundTransaction() -> processa estorno administrativo
- AdminUserActionsService.handleUpdateProfile() -> altera perfil via admin
- AdminUserActionsService.handleUpdateUserStatus() -> ativa/bloqueia/ajusta status do usuário
- AdminUserDetailsService.getDetails() -> consolida dados, assinatura, transações e sinais do usuário
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
- MaterialsController.getUserRating() -> devolve avaliação do usuário
- MaterialsController.rate() -> registra rating do material
- MaterialsService.list() -> monta listagem completa do marketplace
- MaterialsService.create() -> valida e persiste novo material
- MaterialsService.update() -> aplica edicao autorizada
- MaterialsService.moderate() -> executa fluxo de moderação
- MaterialsService.delete() -> remove o material e dependencias necessarias
- MaterialsService.getUserRating() -> consulta rating individual
- MaterialsService.rate() -> grava ou atualiza rating
- MaterialsService.attachCommentsToMaterials() -> agrega comentários na listagem
- MaterialsService.normalizeMaterialRow() -> padroniza row do banco para contrato do app
#### modules/rankings
- RankingsController.list() -> lista rankings ativos ou pendentes conforme perfil
- RankingsController.create() -> cria ranking novo
- RankingsController.join() -> registra entrada do usuário
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
- SubscriptionsController.updateRenewal() -> altera renovação automática
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
- SubscriptionsService.updateRenewal() -> grava preferencia de auto renovação
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
  - handleStripeInvoicePaid() e handleStripeInvoicePaymentFailed() -> sincronizam ciclo de cobrança
  - processMercadoPagoPreapprovalWebhook() e processMercadoPagoPaymentWebhook() -> tratam eventos MP
**Arquivos de apoio do dominio**
- MercadoPagoPaymentBootstrap.php -> monta contexto inicial do pagamento Mercado Pago
- MercadoPagoPaymentPreparation.php -> resolve cartão salvo, pricing, cobrança inicial e ativacao local
#### modules/transactions
- TransactionsController.createMaterialPurchase() -> cria compra de material
- TransactionsController.listTransactions() -> lista transações
- TransactionsController.requestRefund() -> solicita reembolso
- TransactionsController.approveRefund() -> aprova estorno
- TransactionsController.rejectRefund() -> rejeita estorno
- TransactionsService.listTransactions() -> devolve listagem paginada e enriquecida
- TransactionsService.createMaterialPurchase() -> persiste compra e efeitos locais
- TransactionsService.requestRefund() -> registra pedido de refund
- TransactionsService.approveRefund() -> executa aprovação de reembolso
- TransactionsService.rejectRefund() -> executa rejeicao de reembolso
- helpers privados importantes:
  - 
evokePlanAccessAfterRefund() -> revoga acesso quando o refund exige
  - 
otifyRefundProcessed() -> notifica usuário sobre decisao
  - 
otifyAdminAboutRefundRequest() -> avisa operação sobre novo pedido
  - hydrateStripeInvoiceMetadata() -> enriquece transações vindas da Stripe
---
## Database e persistencia
A arquitetura da base do backend esta documentada em:
- C:\xampp\htdocs\questão-pro-backend\database\architecture.md
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
- src/core/* ainda tem bridges e residuos técnicos
- src/types/index.ts ainda reexporta o contrato global vindo da raiz 	ypes.ts
### Backend
- pi/* ainda não foi reduzido integralmente a bridges finos
- a raiz do backend ainda possui diretorios legados fora do desenho final
- nem todos os dominios esperados pelo blueprint já migraram para modules/*
- o schema real ainda depende de consolidacao final entre database/schema.sql, database/migrations/, migrations/ e pi/migrations/
---
## Confirmacao funcional
As funcionalidades existentes continuam preservadas durante a migracao:
- autenticação e sessão
- pratica de questões
- simulados
- ranking
- marketplace
- leitura de materiais
- checkout e assinatura
- admin
- suporte
- notificações
Este arquivo deve continuar sendo atualizado a cada rodada relevante de migracao arquitetural.
## Atualizacao 2026-04-03 - dominio users, reputação e limpeza da raiz do backend
### src/services/auth/reputationService.ts
- getUserReputation(userId) -> consulta o resumo de reputação/XP do usuário e devolve o payload normalizado quando a API responde com sucesso.
- calculateXPForLevel(level) -> calcula localmente o XP mínimo exigido para um nivel, usando a progressao oficial da plataforma.
- calculateLevelFromXP(xp) -> deriva o nivel atual a partir do XP acumulado, reaproveitando a curva de XP oficial.
- calculateProgress(xp, level) -> calcula o percentual de progresso dentro do nivel atual para barras e indicadores visuais.
- awardXP(userId, xp, reason) -> solicita ao backend a concessao de XP por uma ação especifica e retorna apenas sucesso/erro logico.
- calculateImpact(action, targetRole) -> estima localmente o impacto reputacional de moderação para autor ou denunciante.
- updateScore(currentReputation, impact) -> aplica impacto respeitando o intervalo valido de score.
- checkAccountStatus(score) -> traduz score em estado de conta local: active, suspended ou banned.

### modules/users
- routes.php -> expoe o handler público handleUsersReferralStatsRoute(PDO ) para o resumo de indicacoes.
- UsersController::getReferralStats(userId, frontendBaseUrl) -> controller fino que delega ao service e devolve resposta padronizada.
- UsersService::getReferralStats(userId, frontendBaseUrl) -> valida o usuário autenticado, garante referral_code, conta indicacoes, soma recompensas e monta o link final de convite.
- UsersRepository::getReferralCode(userId) -> le o referral_code atual do usuário.
- UsersRepository::saveReferralCode(userId, code) -> persiste um referral_code novo quando o usuário ainda não possui código.
- UsersRepository::countReferrals(userId) -> conta quantas indicacoes foram vinculadas ao usuário.
- UsersRepository::getTotalEarnedReferralRewards(userId) -> soma o total de recompensas com status rewarded.
- UsersValidator::validateAuthenticatedUserId(userId) -> endurece a entrada minima para impedir consultas sem usuário autenticado valido.

### Limpeza estrutural da raiz do backend
- as URLs legadas /plans/list.php, /transactions/*.php e /subscriptions/*.php continuam funcionando por rewrite em .htaccess.
- os diretorios fisicos C:/xampp/htdocs/questão-pro-backend/plans, C:/xampp/htdocs/questão-pro-backend/transactions e C:/xampp/htdocs/questão-pro-backend/subscriptions foram removidos da raiz.
- artefatos técnicos sem uso em api/plans e api/subscriptions também foram removidos para reduzir poluicao operacional.
## Atualizacao 2026-04-03 - migracao de componentes de plans/checkout/profile e AI oficial
### src/app/plans/components/PlanCard.tsx
- renderiza o card comercial de um plano com nome tratado, precificacao mensal equivalente, total, badges de desconto e CTA de assinatura.
- decide destaque visual de plano atual, indisponivel e upgrade com credito proporcional.
- transforma o payload de features em lista visual com fallback para objetos legados.

### src/app/checkout/components/StripeCardElementForm.tsx
- encapsula o formulário seguro de cartão novo da Stripe para o checkout.
- cria payment method, delega o proximo passo para a tela e confirma setup/payment intent quando necessario.
- centraliza validacoes locais de titular, campos do cartão e mensagens de erro do fluxo Stripe.

### src/app/checkout/components/StripeSavedCardCvcForm.tsx
- confirma compras com cartão salvo pedindo apenas o CVV.
- valida presenca do elemento seguro da Stripe e delega a confirmacao final para o checkout.

### src/app/profile/components/StripeSetupCardForm.tsx
- salva um novo cartão no cofre Stripe a partir de um setup intent já criado.
- confirma os dados com a Stripe e devolve o paymentMethodId para o perfil persistir no backend.

### src/services/questions/aiService.ts
- extractQuestionsFromPage(apiKey, pageBase64, includeTeacherComment) -> usa Gemini para extrair metadados e questões estruturadas de uma pagina de prova.
- extractAnswerKeyMapping(apiKey, keyImageBase64) -> converte uma imagem de gabarito em mapa numero-da-questão -> alternativa correta.
- generateDetailedAnalysis(apiKey, question) -> cria comentário detalhado em Markdown explicando cada alternativa.
- generateTeacherComment(apiKey, question) -> gera comentário curto e didatico do professor para o gabarito.
- getQuestionExplanation(apiKey, question) -> mantem a fachada de explicacao textual sob demanda para o admin.

## Ferramentas operacionais do backend
### scripts/importers/questions/gran/index.php
- interface operacional para revisar e selecionar questões coletadas da API da Gran antes da importacao.
- não faz parte da API pública e por isso foi movida da raiz para scripts/importers.

### scripts/importers/questions/gran/import_worker.php
- recebe o payload do importador, cria taxonomias ausentes, normaliza provas, persiste questões e baixa imagens localmente em uploads/questions.
- funciona como worker operacional de ingestao, separado da API pública e dos modulos de dominio.
## Atualizacao 2026-04-03 - retirada de src/features e src/core do caminho produtivo
### Limpeza estrutural do frontend
- src/features/ foi removido do caminho produtivo e deixou de existir como area de código ativo.
- src/core/ foi removido do caminho produtivo e deixou de existir como area ativa de implementacao.
- o teste de sessão passou a viver em src/services/auth/__tests__/session.test.ts.
- aliases @features e @core foram removidos de 	sconfig.json e 
ite.config.ts.

### Camadas oficiais consolidadas nesta etapa
- src/services/auth/session.ts agora concentra a sessão autenticada que antes vivia em src/core/auth/session.ts.
- src/utils/helpers/DebugLogger.ts agora concentra o logger de debug que antes vivia em src/core/debug/DebugLogger.ts.
- src/services/plans/planAccess.ts agora concentra as regras de acesso por plano que antes viviam em src/features/subscriptions/utils/planAccess.ts.
- src/services/bank-analysis/types.ts e src/services/statistics/types.ts agora concentram as tipagens oficiais desses dominios.
## Atualizacao 2026-04-03 - perfil do usuário endurecido no modulo users
### modules/users (expansao)
- UsersController::changePassword(userId, payload) -> delega a troca de senha do proprio usuário para o service.
- UsersController::uploadProfilePhoto(userId, file, projectRoot) -> delega o upload autenticado da foto do perfil.
- UsersService::changePassword(userId, payload) -> valida payload, confere a senha atual, recalcula o hash e persiste a nova senha.
- UsersService::uploadProfilePhoto(userId, file, projectRoot) -> valida o arquivo, prepara o diretorio de upload, gera nome seguro, move a imagem e persiste photo_url.
- UsersRepository::getPasswordHashById(userId) -> le o hash atual do usuário autenticado.
- UsersRepository::updatePasswordHash(userId, passwordHash) -> atualiza o hash da senha com updated_at.
- UsersRepository::updatePhotoUrl(userId, photoUrl) -> persiste a nova foto do perfil com updated_at.
- UsersValidator::validatePasswordChangePayload(payload) -> valida senha atual, nova senha e tamanho mínimo.
- UsersValidator::validateProfilePhotoUpload(file) -> valida upload, tamanho máximo e MIME real via 
info.

### src/services/profile/profileService.ts
- uploadProfilePhoto(file) -> usa ENDPOINTS.users.uploadPhoto, envia FormData autenticado e devolve a mensagem final da operação.
- changePassword(currentPassword, newPassword) -> usa ENDPOINTS.users.changePassword, envia o payload normalizado e devolve a mensagem final da operação.## Atualizacao 2026-04-03 - perfil autenticado consolidado no modulo users
### modules/users
- UsersController::getAuthenticatedProfile(userId) -> delega para o service a montagem completa do snapshot autenticado consumido por sessão e perfil.
- UsersController::updateAuthenticatedProfile(userId, payload) -> delega a mutação cadastral do proprio usuário para o service.
- UsersService::getAuthenticatedProfile(userId) -> carrega dados de `users`, `addresses`, `bank_accounts`, comentários, assinatura e cartão preferencial; normaliza camelCase; garante `referralCode`; e monta `billing`, `subscription`, `hasActivePlan` e `paymentIssue`.
- UsersService::updateAuthenticatedProfile(userId, payload) -> valida whitelist de campos, abre transação, atualiza `users`, faz upsert de `addresses` e `bank_accounts`, traduz conflito de CPF/email e devolve mensagem padronizada.
- UsersRepository::findProfileRowById(userId) -> le o retrato principal do usuário com joins de endereco e conta bancaria.
- UsersRepository::countCommentsByUserId(userId) -> conta comentários do proprio usuário para o snapshot.
- UsersRepository::findLatestSubscriptionSnapshot(userId) -> busca a assinatura ativa/trialing/past_due mais recente com dados do plano.
- UsersRepository::findLatestPlanTransactionStatus(userId) -> consulta o último status de transação de plano para expor `refund_requested`.
- UsersRepository::findPreferredCardExpiry(userId) -> busca o cartão default ou o primeiro cartão disponível para diagnostico de vencimento.
- UsersRepository::updateUserFields(userId, fields) -> persiste apenas campos permitidos do perfil autenticado.
- UsersRepository::upsertAddress(userId, address) -> cria ou atualiza o endereco do usuário.
- UsersRepository::upsertBankAccount(userId, bankAccount) -> cria ou atualiza a conta bancaria suportada pelo schema atual.
- UsersValidator::validateProfileUpdatePayload(payload) -> separa e normaliza blocos de `userFields`, `address` e `bankAccount`, aplicando regras de obrigatoriedade e formato.

### Bridges legados atualizados
- `api/users/profile.php` -> agora so instancia conexão e delega para `handleUsersAuthenticatedProfileRoute($db)`.
- `api/users/update.php` -> agora so instancia conexão e delega para `handleUsersUpdateProfileRoute($db)`.
- `api/auth/me.php` -> agora virou bridge fino do mesmo handler de perfil autenticado, eliminando duplicacao de regra.

### Frontend alinhado
- `src/services/api/endpoints.ts` -> `ENDPOINTS.users.profile` agora aponta para `users/profile.php` e `ENDPOINTS.users.update` para `users/update.php`.
- `src/services/auth/accountService.ts` -> continua sendo a fachada oficial de atualizacao de perfil, agora sobre o endpoint oficial do modulo `users`.## Atualizacao 2026-04-03 - biblioteca do usuário consolidada em modules/materials
### modules/materials
- MaterialsController::listPurchasedMaterials(authenticatedUserId, requestedUserId, isAdmin) -> delega ao service a leitura da biblioteca comprada.
- MaterialsService::listPurchasedMaterials(authenticatedUserId, requestedUserId, isAdmin) -> valida o contexto autenticado, resolve o usuário alvo e devolve `materials` no contrato esperado pelo perfil.
- MaterialsRepository::fetchPurchasedMaterialsByUser(userId) -> busca materiais comprados via `transactions`, com joins de autor e metadados do material.
- MaterialsValidator::validatePurchasedMaterialsRequest(authenticatedUserId, requestedUserId, isAdmin) -> impede que usuário comum consulte biblioteca de terceiros por query string.
- handleMaterialsPurchasedLibraryRoute(db) -> ponto de entrada oficial do modulo para a biblioteca do usuário.

### Bridge legado
- `api/users/materials.php` -> agora apenas instancia conexão e delega para `handleMaterialsPurchasedLibraryRoute($db)`.## Atualizacao 2026-04-03 - abertura e download protegidos no modulo materials
### modules/materials
- MaterialsController::buildProtectedAccessPdf(authenticatedUserId, materialId) -> delega ao service a abertura inline do PDF protegido.
- MaterialsController::buildProtectedDownloadPdf(authenticatedUserId, materialId) -> delega ao service a geracao do PDF protegido para download.
- MaterialsService::buildProtectedAccessPdf(authenticatedUserId, materialId) -> valida sessão e permissao, resolve o arquivo local e gera o PDF inline com marca d'agua de propriedade.
- MaterialsService::buildProtectedDownloadPdf(authenticatedUserId, materialId) -> valida sessão e permissao, resolve o arquivo local e gera o PDF de download com marca d'agua reforcada e rodape nominal.
- MaterialsService::resolveProtectedMaterialContext(...) -> confere autoria, permissao admin/compra aprovada, status do material e existencia do arquivo fisico.
- MaterialsService::resolveMaterialFilePath(fileUrl) -> garante que apenas arquivos internos da instalacao possam ser servidos.
- handleMaterialsAccessRoute(db) -> ponto de entrada oficial para visualizacao inline do material comprado.
- handleMaterialsDownloadRoute(db) -> ponto de entrada oficial para download protegido do material comprado.

### Limpeza arquitetural
- `api/materials/access.php` e `api/materials/download.php` agora sao apenas bridges HTTP.
- `api/materials/material_access_helper.php` foi removido por não ser mais necessario.
## Atualizacao 2026-04-03 - leitor de materiais e anotacoes

### Fluxo funcional
- PdfViewer abre PDFs protegidos de materiais, carrega comentários, notas do usuário e marcadores por material.
- 
eaderService.getNote(materialId, userId) busca a anotacao livre do usuário autenticado para o material e devolve 
ote_text e updated_at.
- 
eaderService.saveNote(materialId, noteText, userId) cria ou atualiza a anotacao do material sem duplicar registro em user_notes.
- 
eaderService.getBookmarks(materialId, userId) lista os marcadores ordenados por pagina para o material atual.
- 
eaderService.saveBookmark(materialId, pageNum, label, userId) cria um marcador novo do usuário autenticado e devolve o item normalizado para atualizacao otimista da UI.
- 
eaderService.deleteBookmark(bookmarkId) remove somente marcadores do proprio usuário, evitando exclusao arbitraria por ID solto.
- 
eaderService.getHighlights(materialId, userId) lista destaques salvos do leitor com 
ects já desserializado para a UI.
- 
eaderService.saveHighlight(materialId, data, userId) persiste destaques com pagina, cor, trechos e coordenadas do PDF.
- 
eaderService.deleteHighlight(highlightId) remove destaques do usuário autenticado.

### Regras importantes
- os endpoints do leitor agora usam a sessão autenticada como fonte de verdade para user_id;
- o backend valida permissao de leitura do material antes de permitir nota, marcador ou destaque;
- pi/materials/* desse fluxo ficou apenas como bridge, sem SQL ou regra de dominio;
- a base local foi ajustada para IDs VARCHAR(36) em user_bookmarks e user_highlights, alinhando os recursos do leitor ao modelo atual de usuários e materiais.

## Atualizacao 2026-04-03 - atividade do usuário no modulo users

- commentService.getUserComments(userId) continua sendo a fachada do frontend para carregar comentários publicados pelo usuário, mas agora o backend responde via modules/users;
- userProgressService.getUserQuestionNotes(userId) continua carregando notas de questões por users/notes.php, e o endpoint agora passa por sessão/autorizacao padronizadas no modulo users;
- users/comments.php devolve histórico de atividade com 	argetId, 	argetType, questionId legado, texto, data e userId;
- users/notes.php devolve notas com contexto resumido de questão ou material, preservando o contrato consumido no progresso/perfil.

## Atualizacao 2026-04-03 - respostas do usuário em modules/users

- userProgressService.getUserAnswers(userId) continua sendo a fachada do frontend para carregar histórico de respostas, agora sustentado por modules/users;
- users/answers.php devolve questionId, isCorrect, selectedOptionIndex, 	imestamp, 	imeTaken e simulationId, preservando o contrato da camada de progresso;
- a autorizacao dessa leitura agora segue o mesmo padrao de sessão/autorizacao de users/comments.php e users/notes.php.

## Atualizacao 2026-04-03 - cofre de cartoes do usuário em modules/users

### Billing do perfil
- list_cards: identifica o usuário autenticado, resolve o provedor ativo de cofre, sincroniza o espelho Stripe quando necessario ou valida cartoes Mercado Pago remotos antes de devolver a lista.
- 
emove_card: bloqueia remocao de cartão travado por recorrencia, desanexa payment method Stripe quando aplicavel, remove o espelho local e promove o proximo cartão a padrao quando necessario.
- set_default_card: define o cartão padrao local do usuário e, no caso Stripe, replica esse default também em invoice_settings.default_payment_method do customer remoto.

### Funcoes tecnicas novas
- UsersCardsService::listSavedCards(...): concentra a regra de leitura do cofre do usuário, inclusive limpeza de cartoes remotos obsoletos no Mercado Pago.
- UsersCardsService::removeSavedCard(...): concentra a remocao segura do cartão e a manutencao do estado local do cofre.
- UsersCardsService::setDefaultSavedCard(...): centraliza a troca de cartão padrao com transação local e sincronizacao opcional com Stripe.
- UsersCardsStripeSupport.php: mantem o suporte Stripe de cartoes dentro do dominio users, sustentando os fluxos legados de setup/sync ate a absorcao completa desses endpoints.
## Atualizacao 2026-04-03 - billing completo do perfil em modules/users

### Funcoes de cartão salvo do perfil
- create_stripe_setup_intent: prepara o SetupIntent usado pelo formulário Stripe para salvar um cartão para uso futuro no modo off_session.
- sync_stripe_card: recebe o payment_method_id confirmado no frontend, anexa ao customer quando necessario, marca o metodo como salvo, espelha localmente em user_cards e devolve a lista consolidada de cartoes.
- save_card: mantem compatibilidade com o cofre legado/local, validando duplicidade por bandeira + finais, definindo padrao no primeiro cartão e sincronizando users.has_saved_card.

### Funcoes tecnicas novas
- UsersCardsService::createStripeSetupIntent(...): concentra a criacao do SetupIntent Stripe para o usuário autenticado.
- UsersCardsService::syncStripeCard(...): concentra a sincronizacao entre Stripe e user_cards apos o setup do cartão.
- UsersCardsService::saveLegacyCard(...): concentra a persistencia do cartão legado/local ainda usada no perfil.
- UsersValidator::validateStripePaymentMethodPayload(...): valida o payload mínimo de sincronizacao Stripe.
- UsersValidator::validateLegacySavedCardPayload(...): normaliza e valida o payload legado de salvamento local.
## Atualizacao 2026-04-03 - suporte de assinaturas internalizado no modulo

### Funcoes tecnicas movidas para modules/subscriptions
- SubscriptionsBillingSupport.php: concentra calculos de ciclo, configuração Stripe recorrente, períodos de acesso, prorata, cupons, labels de cobrança, antifraude operacional e envio de e-mails de assinatura.
- StripePaymentApprovalValidator.php: concentra a validação antifraude/evidencias do Stripe, incluindo CVC, endereco, risco, review e 3DS antes da aprovação final.

### Impacto funcional
- O fluxo de assinatura Stripe e reconciliacao continua igual para o app, mas a regra deixou de depender de helpers soltos em pi/subscriptions e pi/users.
- TransactionsService e payment_refund_helper continuam compartilhando a mesma logica de recorrencia e detalhamento financeiro, agora a partir do modulo oficial de subscriptions.## Atualizacao 2026-04-03 - administracao e segurança de conta em modules/users

### Funcoes administrativas do dominio users
- UsersService::listUsers(...): lista usuários para o painel admin, junta users, user_subscriptions e plans, e devolve o resumo de billing no mesmo shape histórico consumido pelo frontend.
- handleUsersListRoute(...): exige sessão autenticada com papel admin antes de devolver a lista; sem isso, a rota agora falha com autorizacao coerente.

### Funcoes de anotacao do perfil
- UsersService::deleteUserNote(...): resolve o usuário-alvo pela sessão, valida ownership e remove uma anotacao especifica de user_notes.
- UsersValidator::validateDeleteNotePayload(...): normaliza id, user_id e userId legados para evitar parsing manual espalhado.
- handleUsersDeleteNoteRoute(...): virou o ponto HTTP unico para exclusao de notas do usuário, com resposta padronizada e 404 quando a nota não pertence ao usuário.

### Funcoes de exclusao de conta
- UsersService::requestAccountDeletion(...): não apaga a conta imediatamente; apenas registra o pedido como pending_deletion, grava motivo e deletion_requested_at.
- UsersValidator::validateAccountDeletionPayload(...): garante que o motivo exista antes de prosseguir.
- handleUsersDeleteAccountRoute(...): aplica sessão oficial + reCAPTCHA e so depois delega a gravacao do pedido ao service.

### Impacto funcional
- o painel admin continua carregando usuários pelo mesmo service do frontend (dminService.getUsers()), mas o backend agora exige permissao real;
- notas do usuário continuam consumidas pela camada de progresso/perfil sem mudar contrato;
- o fluxo de exclusao de conta fica mais seguro, porque saiu do JWT manual e passou a usar a sessão padronizada da plataforma.## Atualizacao 2026-04-03 - recuperacao e confirmacao de conta em modules/auth

### Funcoes de sessão
- AuthService::logout(): finaliza a sessão autenticada atual usando a infraestrutura oficial de AuthSession, limpa o ciclo de refresh e devolve resposta padronizada.
- AuthService::refreshSession(): renova a sessão atual a partir do refresh token em cookie e devolve 	oken + bloco session no formato esperado pelo frontend.

### Funcoes de recuperacao de senha
- AuthService::requestPasswordReset(...): valida e-mail, garante a tabela password_resets, invalida tokens anteriores, cria um novo token de reset e envia o e-mail de recuperacao.
- AuthService::resetPassword(...): valida token e nova senha, confirma que o reset continua ativo, atualiza users.password_hash e marca o token como usado.
- AuthValidator::validateForgotPasswordPayload(...): valida e-mail e normaliza captchaToken antes da etapa de segurança.
- AuthValidator::validateResetPasswordPayload(...): garante token + senha minima para o fluxo de redefinição.

### Funcoes de confirmacao de e-mail
- AuthService::resendConfirmation(...): usa a sessão autenticada como fonte de verdade do usuário, invalida tokens antigos de verificacao e reenvia o e-mail de confirmacao.
- AuthService::confirmEmail(...): valida o token de verificacao, marca o usuário como email_verified, soma +50 XP e registra notificação de boas-vindas.
- AuthValidator::validateResendConfirmationPayload(...): impede reenvio para um e-mail diferente do que esta autenticado na sessão.
- AuthValidator::validateConfirmationTokenPayload(...): garante a presenca do token no fluxo de confirmacao.

### Impacto funcional
- o frontend continua usando os mesmos endpoints e o mesmo uthFlowService, sem quebrar checkout, confirmacao de e-mail e reset de senha;
- a regra saiu dos scripts procedurais de pi/auth/* e entrou na fatia oficial modules/auth, alinhando autenticação ao desenho revisado do backend.## Atualizacao 2026-04-03 - autenticação principal e 2FA em modules/auth

### Funcoes de entrada de conta
- AuthService::login(...): valida email/senha + reCAPTCHA, decide se o admin precisa passar pelo 2FA e, quando o acesso e liberado, emite a sessão oficial e devolve o snapshot completo do usuário.
- AuthService::register(...): cria a conta com defaults de estudante, gera 
eferral_code, vincula 
eferred_by_id quando houver indicacao, cria token de verificacao de e-mail, registra notificação de onboarding e emite a sessão inicial.

### Funcoes de 2FA
- AuthService::setupTwoFactor(...): gera o segredo TOTP e a URL do QR code para o admin autenticado.
- AuthService::enableTwoFactor(...): valida o código informado contra o segredo e persiste 	wo_factor_secret + 	wo_factor_enabled.
- AuthService::verifyTwoFactor(...): valida o código TOTP pelo email informado e libera o bundle final de sessão com token oficial.

### Funcoes tecnicas novas
- AuthValidator::validateLoginPayload(...): valida o login tradicional e normaliza captchaToken.
- AuthValidator::validateRegisterPayload(...): valida nome, email, senha e referral do cadastro.
- AuthValidator::ensureAdminAuthenticated(...): restringe setup/ativacao de 2FA a administradores autenticados.
- AuthRepository::findUserForLoginByEmail(...): centraliza a leitura minima do usuário para login.
- AuthRepository::insertUser(...): centraliza a criacao do estudante com defaults do produto.
- AuthRepository::enableTwoFactor(...) e AuthRepository::findUserForTwoFactorByEmail(...): concentram a persistencia e leitura do estado de 2FA.

### Impacto funcional
- uthFlowService.register, uthFlowService.login e uthFlowService.verifyTwoFactor continuam com o mesmo contrato esperado pelo frontend;
- dminService.setupTwoFactor e dminService.enableTwoFactor continuam funcionando, mas agora sobre a camada oficial modules/auth.## Atualizacao 2026-04-03 - notifications em modules/notifications

### Funcoes de inbox
- NotificationsService::listNotifications(...): usa a sessão autenticada como fonte de verdade, aceita since opcional e devolve items + count no formato esperado pelo app.
- NotificationsValidator::validateListQuery(...): normaliza o filtro since para sincronizacao incremental sem espalhar parsing pela rota.
- NotificationsRepository::listByUserId(...): concentra o SELECT oficial de notifications com ordenacao recency-first e limite controlado.

### Funcoes de leitura e limpeza
- NotificationsService::markAsRead(...): marca uma notificação especifica como lida dentro do escopo do usuário autenticado.
- NotificationsService::markAllAsRead(...): resolve o user_id real da operação em lote e impede que usuário comum gerencie inbox de terceiros.
- NotificationsService::deleteNotification(...): faz soft delete via deleted_at para manter histórico e lixeira logica.
- NotificationsService::clearAll(...): aplica a limpeza em lote do inbox usando o mesmo controle de ownership.
- NotificationsValidator::resolveScopedUserId(...): permite operações em outro usuário apenas para administradores.

### Funcoes de envio
- NotificationsService::sendNotification(...): valida título, mensagem, tipo, categoria, link e evidenceUrl, normaliza report -> moderation no storage e registra a notificação oficial.
- NotificationsValidator::validateSendPayload(...): centraliza compatibilidade com user_id/userId, action_url/link e categorias legadas.
- NotificationsValidator::resolveSendRecipient(...): endurece permissao de envio; usuário comum pode enviar para si mesmo e para o pseudo-destinatario admin, enquanto admin pode enviar para outros escopos.
- NotificationsRepository::insert(...): concentra o INSERT oficial em notifications.

### Impacto funcional
- notificationService.getNotifications, getUserNotifications, markAsRead, markAllAsRead, deleteNotification, clearAll e sendNotification continuam com o mesmo contrato do frontend.
- os rewrites notificationsMarkAllRead e notificationsClearAll agora existem de forma oficial, eliminando a divergencia que podia quebrar a caixa de notificações.## Atualizacao 2026-04-03 - comments em modules/comments

### Funcoes de listagem
- CommentsService::listComments(...): lista comentários por target_id, resolve autenticação opcional para isLiked e devolve a arvore aninhada no formato esperado pelo frontend.
- CommentsValidator::validateListQuery(...): normaliza target_id e o fallback user_id das leituras públicas.
- CommentsRepository::listByTargetId(...): concentra o SELECT oficial de comments com autor, plano, avatar, total de likes e estado isLiked.

### Funcoes de mutação
- CommentsService::addComment(...): valida target/content, usa a sessão como fonte de verdade do autor, aplica a regra de QA para respostas em materiais e persiste o comentário oficial.
- CommentsService::toggleLike(...): centraliza o toggle da curtida do comentário autenticado e dispara notificação social quando a curtida e nova.
- CommentsService::deleteComment(...): garante ownership do comentário antes da exclusao.
- CommentsValidator::validateAddPayload(...): normaliza question_id, parent_id, targetType e content para o contrato legado commentsHandle.
- CommentsValidator::validateCommentMutationPayload(...): concentra a validação de commentId para like/delete.

### Funcoes auxiliares e notificações
- CommentsRepository::insertComment(...), addLike(...), removeLike(...), deleteComment(...): concentram todo o SQL do dominio.
- CommentsRepository::insertNotification(...): persiste notificações derivadas do dominio sem recolocar SQL em controller/service.
- CommentsService::notifyAboutNewComment(...): avisa o autor do comentário pai ou o autor do material quando surge interacao relevante.
- CommentsService::notifyAboutLike(...): registra notificação social para novas curtidas.

### Impacto funcional
- commentService.getComments, addComment, likeComment e deleteComment continuam com o mesmo contrato usado pelo frontend.
- comments/list_cached.php continua existindo como ponte de compatibilidade, mas a regra real agora mora em modules/comments.## Atualizacao 2026-04-03 - progressao de questões em modules/questions

### Funcionalidades absorvidas
- submitAnswer: grava resposta do usuário, incrementa estatisticas da questão, atualiza XP/nivel e dispara recompensa de level up quando necessario.
- getQuestionHistory: lista o histórico de tentativas por questão; para convidado retorna lista vazia.
- 
esetAnswers: limpa as respostas persistidas do usuário autenticado.
- 	oggleSavedQuestion: alterna o estado salvo de uma questão para o usuário atual.

### Como funciona
- O modulo usa sessão autenticada como fonte de verdade e so aceita operar em outro usuário quando o contexto e admin.
- O histórico preserva o formato esperado pelo frontend (questionId, selectedOptionIndex, isCorrect, 	imestamp).
- O fluxo de recompensa de level up foi internalizado em modules/questions, sem depender de helper de dominio dentro de pi/.## Atualizacao 2026-04-03 - leitura e administracao de questões em modules/questions

### Funcionalidades absorvidas
- listQuestions: monta a lista principal de questões para pratica, com filtros, stats, comentários agregados e resposta mais recente do usuário.
- 
ilterQuestions: entrega a grade administrativa de questões com busca por palavra-chave, paginação e filtros serializados.
- getQuestionStats: calcula total de tentativas, acertos, erros e distribuicao por alternativa.

### Como funciona
- A listagem principal usa auth opcional e libera comentários do professor/análise detalhada conforme benefício do plano.
- O filtro administrativo usa sessão como fonte de verdade e bloqueia acesso fora de contexto admin.
- O card de questão no frontend agora consome a fachada oficial de questions, em vez de chamar piClient direto para histórico e stats.## Atualizacao 2026-04-03 - manutencao administrativa de questões em modules/questions

### Funcionalidades absorvidas
- saveQuestion: cria ou atualiza questões, serializa data_json, recalcula o indice da resposta correta e sincroniza taxonomias vinculadas.
- getQuestionForEdit: carrega a questão completa para edicao administrativa com filtros, itens e comentários ricos.
- deleteQuestion: remove a questão no escopo administrativo oficial.

### Como funciona
- As rotas administrativas de questões agora exigem sessão autenticada de admin.
- A sincronizacao de filtros foi centralizada no service, enquanto criacao, busca e vinculacao ficaram no repository.
- A UI administrativa passou a consumir a service oficial para listagem de questões, reduzindo acoplamento HTTP direto na pagina.
---
## Baseline de versao funcional
Adicionado em: 2026-04-04
- Versao funcional atual da plataforma: `v1.0.0`
- Esta passa a ser a baseline oficial para changelog funcional da plataforma.
- A versao tecnica atual do frontend em `package.json` agora esta alinhada com a baseline pública em `1.0.0`.

### Regra de evolução
- `patch` da feature: correcao ou ajuste funcional pequeno sem alterar o escopo da feature.
- `minor` da feature: ampliacao perceptivel da feature, novo fluxo ou nova capacidade relevante dentro do mesmo dominio.
- `major` da feature: mudanca de comportamento, reposicionamento ou quebra relevante de contrato funcional daquele dominio.
- `patch` da plataforma: consolidacao de varias correcoes pequenas sem nova feature transversal.
- `minor` da plataforma: entrega transversal envolvendo mais de um dominio funcional principal.
- `major` da plataforma: reposicionamento amplo de produto, arquitetura funcional ou modelo operacional.
- Mudancas apenas tecnicas ou arquiteturais, sem impacto funcional visivel, devem entrar no `audit-report`, mas não precisam subir a versao funcional da feature.

### Snapshot de versao por feature
- institucional-público: `v1.0.0`
- auth-sessão: `v1.0.0`
- questões-pratica: `v1.0.0`
- filtros-taxonomias: `v1.0.0`
- simulados: `v1.0.0`
- estatisticas-bank-analysis: `v1.0.0`
- rankings: `v1.0.0`
- planos-checkout-assinaturas: `v1.0.0`
- marketplace-materiais-reader: `v1.0.0`
- perfil-conta-billing: `v1.0.0`
- notificações: `v1.0.0`
- suporte-feedback-reports: `v1.0.0`
- partner-dashboard: `v1.0.0`
- admin-operação: `v1.0.0`
- changelog-público: `v1.0.0`

---
## Matriz de versao por funcionalidade
Adicionado em: 2026-04-04
- A baseline funcional detalhada da versao `v1.0.0` agora vive em [C:\dev\concursomestre\docs\feature-version-matrix.md](C:\dev\concursomestre\docs\feature-version-matrix.md).
- Esse arquivo responde o que a versao atual entrega em cada funcionalidade, por exemplo `simulados`, `rankings`, `marketplace`, `billing` e `admin`, sem agrupar por pagina.
