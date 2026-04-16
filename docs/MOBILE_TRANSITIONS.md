# Mobile Transitions

Este arquivo registra cada transicao de modulo da plataforma web para o app Expo.

## Regra de transicao

Toda transicao mobile deve registrar:

- modulo migrado
- origem web/plataforma
- destino no app Expo
- endpoints e services envolvidos
- estado de paridade entregue
- validacoes executadas
- commit de referencia
- pendencias conhecidas

## Backlog pos-extracao mobile

- Depois de concluir a paridade mobile, iniciar a migracao web progressiva para Next.
- Escopo recomendado: rotas publicas/indexaveis em SSR/SSG/ISR, metadata por rota, sitemap/robots, canonical, Open Graph, JSON-LD e redirects preservando URLs atuais.
- A area logada/admin pode permanecer em Vite SPA enquanto SEO nao for requisito dessas telas.

## 2026-04-15 - Plan details do painel no catalogo mobile

- commit: `Add mobile plans panel visibility and display-name parity (neste commit)`
- origem web/plataforma:
  - `src/app/plans/page.tsx` (gate de visibilidade via `isPlanEnabledByName` e nome configuravel do plano)
  - `src/services/plans` (uso de `planDetails` para nome exibido)
- destino mobile:
  - `mobile/src/types/system.ts`
  - `mobile/src/services/system/systemSettingsService.ts`
  - `mobile/src/screens/PlansScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - bootstrap mobile passou a normalizar `planDetails` do `settings.php` (incluindo `displayName` e `enabled`)
  - catalogo de planos mobile agora respeita plano desativado no painel admin
  - cards de plano mobile passaram a exibir nome configurado do painel quando existir
  - fallback de ciclo mensal/trimestral/anual passou a considerar apenas planos realmente visiveis no app
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - badges promocionais por ciclo (`% OFF`) e ofertas dinamicas completas da web ainda nao foram portadas para o mobile.

## 2026-04-15 - Seletor de ciclo na tela de planos mobile

- commit: `Add mobile plans billing cycle selector (neste commit)`
- origem web/plataforma:
  - `src/app/plans/page.tsx` (tabs de ciclo de cobranca: mensal, trimestral e anual)
- destino mobile:
  - `mobile/src/screens/PlansScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - tela de planos mobile ganhou seletor de ciclo com opcoes `Mensal`, `Trimestral` e `Anual`
  - planos pagos agora sao filtrados pelo ciclo selecionado, mantendo o plano gratuito visivel em qualquer ciclo
  - quando o ciclo atual nao possui planos pagos disponiveis, a tela escolhe automaticamente o primeiro ciclo com oferta ativa
  - estado vazio passou a orientar troca de ciclo quando nao houver plano no recorte selecionado
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - badges de desconto por ciclo e exibicao dinamica de oferta promocional (como no web) ainda nao foram portadas para o mobile.

## 2026-04-15 - Elegibilidade de assinatura na tela de planos mobile

- commit: `Add mobile plans eligibility guards (neste commit)`
- origem web/plataforma:
  - `src/app/plans/page.tsx` (bloqueios para plano atual, downgrade e troca de ciclo no mesmo tier via `sameTierCycleChangeEnabled`)
- destino mobile:
  - `mobile/src/screens/PlansScreen.tsx`
  - `mobile/src/types/system.ts`
  - `mobile/src/services/system/systemSettingsService.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - tela de planos mobile passou a bloquear checkout quando o usuario seleciona o plano ja ativo
  - downgrade para plano inferior ativo segue bloqueado com alerta explicito na propria tela
  - troca de ciclo no mesmo tier agora respeita a flag administrativa `sameTierCycleChangeEnabled`
  - catalogo mobile passou a exibir CTA e badge contextual para estado bloqueado (`Plano atual`, `Downgrade indisponivel`, `Troca de ciclo indisponivel`)
  - bootstrap de configuracoes mobile passou a normalizar `sameTierCycleChangeEnabled` do endpoint `settings.php`
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - fluxo de confirmacao de downgrade com modal dedicado (como no web) ainda nao foi portado; no mobile o bloqueio permanece por alerta.

## 2026-04-15 - Copiar referencia de transacao no mobile

- commit: `34f460a Add mobile transaction reference copy action`
- origem web/plataforma:
  - `src/app/profile/page.tsx` (acao `Copiar` para referencia de gateway nas transacoes)
- destino mobile:
  - `mobile/src/screens/ProfileScreen.tsx`
  - `mobile/package.json`
  - `mobile/package-lock.json`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - card de transacao mobile ganhou botao `Copiar` ao lado da referencia do gateway
  - quando copiado, o botao mostra feedback temporario `Copiado` no proprio card
  - payload de referencia invalida (`--`) nao dispara acao de copia
  - app passou a usar `expo-clipboard` para escrita segura na area de transferencia no iOS/Android
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - telemetria de clique/copia da referencia ainda nao foi instrumentada no mobile.

## 2026-04-15 - Badges de assinatura e CTA de plano no mobile

- commit: `b407065 Add mobile subscription badges and plans CTA`
- origem web/plataforma:
  - `src/app/profile/page.tsx` (badges de assinatura/ciclo e botao `Upgrade`/`Gerenciar plano`)
- destino mobile:
  - `mobile/src/screens/ProfileScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - card de assinatura mobile ganhou badges de estado (ativa/inativa) e ciclo (mensal/trimestral/anual)
  - perfil passou a oferecer CTA direto para a aba de planos (`Upgrade` ou `Gerenciar plano`)
  - navegacao foi conectada ao stack principal para abrir `MainTabs -> Planos` sem sair do fluxo de perfil
  - heuristica do CTA segue plano atual (`Elite` exibe gerenciar; demais exibem upgrade)
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - badge complementar de nível de plano (Essencial/Pro/Elite) ainda pode ser enriquecida depois via taxonomia canonica.

## 2026-04-15 - Referencia de gateway nas transacoes mobile

- commit: `2521cdd Expand mobile transaction cards with gateway reference details`
- origem web/plataforma:
  - `src/app/profile/page.tsx` (tabela de transacoes com referencia do gateway, parcela e agendamento)
- destino mobile:
  - `mobile/src/screens/ProfileScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - card de transacao mobile agora exibe referencia principal do gateway (`providerTransactionId`/`referenceId`)
  - rotulo de referencia foi alinhado ao payload (`providerTransactionLabel` com fallback `ID Stripe`)
  - transacoes parceladas agora mostram indicador de parcela (`x/y`) quando os campos vierem do backend
  - timestamp passou a priorizar `dateTimeFormatted` para manter consistencia com a formatacao web
  - campo de agendamento (`scheduleLabel`) passou a aparecer no card quando informado
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - acao explicita de copiar referencia da transacao (botao "Copiar") ainda permanece apenas no web.

## 2026-04-15 - Cards de resumo de assinatura no mobile

- commit: `f766dc8 Add mobile subscription summary cards in profile`
- origem web/plataforma:
  - `src/app/profile/page.tsx` (cards de resumo: status, ciclo/vigencia e valor)
  - `src/types/global.ts` (`UserSubscription.plan.price`)
- destino mobile:
  - `mobile/src/screens/ProfileScreen.tsx`
  - `mobile/src/types/auth.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - perfil mobile ganhou bloco de resumo com 3 cards de assinatura (status, ciclo/vigencia e valor)
  - mensagens de status e ciclo passaram a refletir cenarios ativos, inativos e reembolso pendente
  - valor exibido agora prioriza `subscription.recurring_amount` e cai para `subscription.plan.price` quando necessario
  - contrato mobile de `UserPlan` foi ampliado com `price` para alinhar o payload real do backend
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - composicao visual do resumo ainda esta em layout vertical no mobile, enquanto o web usa grid com maior densidade.

## 2026-04-15 - Alerta de falha de pagamento no perfil mobile

- commit: `2c328e5 Add mobile payment issue alert in profile`
- origem web/plataforma:
  - `src/app/profile/page.tsx` (banner de `paymentIssue` com CTA para billing portal)
  - endpoint de perfil autenticado (`auth/me.php`)
- destino mobile:
  - `mobile/src/screens/ProfileScreen.tsx`
  - `mobile/src/types/auth.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - perfil mobile agora renderiza alerta quando o backend sinaliza `paymentIssue`
  - alerta diferencia visual de risco para cartao expirando/falha generica e orienta acao imediata
  - CTA do alerta abre diretamente o portal Stripe para resolucao de cobranca
  - tipagem mobile de perfil/subscription foi ampliada para suportar `paymentIssue`, `subscription.id`, status adicionais e `recurring_amount`
  - leitura de renovacao automatica passou a priorizar `cancel_at_period_end` quando esse flag existir (alinhamento com logica web)
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - instrumentacao analitica detalhada de eventos de billing (banner view/click) ainda esta fora do escopo no mobile.

## 2026-04-15 - Timeline de ciclo da assinatura no mobile

- commit: `5987e6b Add mobile subscription cycle progress summary`
- origem web/plataforma:
  - `src/app/profile/page.tsx` (bloco de timeline de assinatura/ciclo)
  - utilitarios de datas de assinatura no perfil
- destino mobile:
  - `mobile/src/screens/ProfileScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - perfil mobile ganhou resumo de ciclo com progresso da assinatura (dias usados x dias totais)
  - card mostra barra de progresso do ciclo atual com percentual calculado no app
  - bloco exibe inicio/fim do ciclo, dias restantes e proxima cobranca
  - headline de assinatura passou a refletir contexto de renovacao ligada/desligada e termo parcelado
  - descricao de valor do ciclo passou a diferenciar assinatura por parcela vs ciclo recorrente
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - visual premium completo do web (cards animados e layout expandido) ainda esta simplificado no app mobile.

## 2026-04-15 - Regras de renovacao no billing mobile

- commit: `b05d149 Align mobile renewal rules with web billing flow`
- origem web/plataforma:
  - `src/app/profile/page.tsx` (logica de toggle de renovacao e mensagens de termo parcelado)
  - `src/services/subscriptions/subscriptionsService.ts`
  - endpoint `subscriptions/update_renewal.php`
- destino mobile:
  - `mobile/src/screens/ProfileScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - ativacao de renovacao automatica no mobile agora exige cartao salvo no cofre Stripe
  - quando faltar cartao salvo, o app mostra bloqueio explicito e oferece atalho para abrir o portal Stripe
  - mensagens de sucesso ao desativar renovacao passaram a diferenciar fim de ciclo comum vs fim de termo parcelado
  - card de assinatura ganhou contexto de parcelas (`parcela atual de total`) quando houver compromisso em andamento
  - status de cancelamento passou a sinalizar solicitacao de reembolso pendente dentro da secao de assinatura
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - confirmacao anti-automacao (reCAPTCHA) para mutacoes sensiveis de billing continua apenas no web.

## 2026-04-15 - Motivo de cancelamento no perfil mobile

- commit: `8d3ff45 Add mobile cancellation reason flow in profile`
- origem web/plataforma:
  - `src/app/profile/page.tsx` (modal de cancelamento com motivo/detalhes)
  - `src/services/subscriptions/subscriptionsService.ts`
  - endpoint `subscriptions/cancel.php`
- destino mobile:
  - `mobile/src/screens/ProfileScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - perfil mobile passou a exibir fluxo de cancelamento com etapa de detalhes antes da confirmacao final
  - usuario agora pode escolher motivo opcional de cancelamento (valor, uso, tecnico, conteudo ou outros)
  - usuario pode informar detalhes adicionais opcionais em texto livre
  - payload enviado ao backend passou a usar `reason` e `details` dinamicos, com fallback seguro para `arrependimento` ou `user_request`
  - apos cancelar ou reverter cancelamento, o formulario local e resetado para evitar estado residual
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - reCAPTCHA no cancelamento ainda permanece apenas no fluxo web.

## 2026-04-15 - Requisitos de perfil no checkout mobile

- commit: `1a6f20a Add mobile checkout requirements and profile sync`
- origem web/plataforma:
  - `src/app/checkout/page.tsx`
  - `src/providers/AuthProvider.tsx`
  - `src/services/auth/accountService.ts`
  - `src/services/auth/authFlowService.ts`
  - endpoints `users/update.php` e `auth/resend-confirmation.php`
- destino mobile:
  - `mobile/src/screens/CheckoutScreen.tsx`
  - `mobile/src/providers/AuthProvider.tsx`
  - `mobile/src/services/auth/accountService.ts`
  - `mobile/src/services/auth/authFlowService.ts`
  - `mobile/src/types/auth.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - checkout mobile agora bloqueia a conclusao do pagamento quando faltarem requisitos basicos de perfil
  - app passou a validar nome, CPF, CEP/logradouro/numero/bairro/cidade/UF e confirmacao de e-mail antes da compra
  - checkout ganhou formulario inline para salvar dados obrigatorios de perfil sem sair da tela
  - contexto de autenticacao mobile ganhou acao `updateUser` com persistencia no endpoint oficial `users/update.php` e rollback otimista em caso de erro
  - fluxo mobile passou a suportar reenvio de confirmacao de e-mail via endpoint oficial `auth/resend-confirmation.php`
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - o modal rico de requisitos do checkout web (com estado dedicado em camada separada) ainda nao foi replicado 1:1 no mobile; o app usa card inline na propria tela de checkout.

## 2026-04-15 - Parcelamento Stripe no checkout mobile

- commit: `587a95d Add mobile checkout installment billing parity`
- origem web/plataforma:
  - `src/app/checkout/page.tsx`
  - `src/services/plans/planService.ts`
  - endpoints `subscriptions/create_stripe_checkout.php`, `subscriptions/create_stripe_subscription.php` e `subscriptions/finalize_stripe_subscription.php`
- destino mobile:
  - `mobile/src/screens/CheckoutScreen.tsx`
  - `mobile/src/services/plans/planService.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - checkout mobile passou a suportar escolha de parcelamento por ciclo para planos elegiveis (1x, 3x ou 12x sem juros)
  - modo de cobranca Stripe (`single_installment` vs `term_recurring`) agora e resolvido no app a partir da quantidade de parcelas selecionada
  - payloads mobile de checkout hospedado e cobranca com cartao salvo passaram a enviar `billing_mode` e `installment_count`
  - fluxo de finalizacao da assinatura com cartao salvo passou a enviar `billing_mode` para manter consistencia com o contrato web
  - resumo de compra mobile passou a exibir o formato de cobranca ativo (ex.: `12x de ... sem juros`)
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - o modal rico de requisitos de checkout (CPF/endereco/confirmacao de e-mail) ainda permanece exclusivo da experiencia web.

## 2026-04-15 - Cancelamento de assinatura no mobile

- commit: `f302280 Add mobile subscription cancel and undo-cancel actions`
- origem web/plataforma:
  - `src/app/profile/page.tsx`
  - `src/services/subscriptions/subscriptionsService.ts`
  - endpoints `subscriptions/cancel.php` e `subscriptions/undo_cancel.php`
- destino mobile:
  - `mobile/src/screens/ProfileScreen.tsx`
  - `mobile/src/services/subscriptions/subscriptionsService.ts`
  - `mobile/src/services/api/endpoints.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - perfil mobile ganhou acao de cancelamento de assinatura com confirmacao
  - quando houver cancelamento pendente (`cancel_at_period_end`), o app oferece acao de desfazer cancelamento
  - fluxo mobile diferencia mensagem de cancelamento durante janela de garantia (ate 7 dias) versus fim de ciclo
  - estado da assinatura e historico sao recarregados apos cada acao para manter consistencia com backend
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - captura detalhada de motivo (formulario rico com campos adicionais/recaptcha) ainda permanece apenas no fluxo web.

## 2026-04-15 - Billing mobile com renovacao e reembolso

- commit: `49994ff Expand mobile billing with renewal and refund actions`
- origem web/plataforma:
  - `src/app/profile/page.tsx` (abas de assinatura e historico de transacoes)
  - `src/services/subscriptions/subscriptionsService.ts`
  - `src/services/transactions/transactionsService.ts`
  - endpoints `subscriptions/update_renewal.php`, `subscriptions/cancel_refund.php` e `transactions/refund.php`
- destino mobile:
  - `mobile/src/screens/ProfileScreen.tsx`
  - `mobile/src/services/subscriptions/subscriptionsService.ts`
  - `mobile/src/services/transactions/transactionsService.ts`
  - `mobile/src/services/api/endpoints.ts`
  - `mobile/src/types/transactions.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - perfil mobile ganhou acao para ativar/desativar renovacao automatica da assinatura
  - transacoes passaram a suportar abertura de fatura quando a URL vier no payload
  - historico mobile agora permite solicitar reembolso para transacoes aprovadas/concluidas
  - quando houver solicitacao pendente, o app permite cancelar o pedido de reembolso na mesma tela
  - contrato mobile de transacao foi ampliado para campos de fatura e metadados de reembolso/gateway
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - cancelamento completo da assinatura com captura de motivo/fluxo detalhado ainda nao foi portado para UX dedicada no mobile.

## 2026-04-15 - Leitor de material no mobile

- commit: `6b475d6 Add mobile material reader flow with deep-link support`
- origem web/plataforma:
  - `src/app/read/page.tsx`
  - `src/app/material/page.tsx`
  - `src/services/marketplace/marketplaceService.ts`
  - fluxo `/read/:id` com gate por compra/autor/admin
- destino mobile:
  - `mobile/src/screens/MaterialReaderScreen.tsx`
  - `mobile/src/screens/MaterialDetailScreen.tsx`
  - `mobile/src/navigation/types.ts`
  - `mobile/src/navigation/AppNavigator.tsx`
  - `mobile/src/screens/NotificationsScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - app mobile passou a ter rota de leitor `read/:materialId` com validacao de acesso por transacao aprovada, autor ou admin
  - detalhe de material agora direciona para o leitor mobile quando o acesso estiver liberado
  - deep link interno `concursomestre://read/:materialId` foi registrado no app
  - notificacoes com destino para `read/:id` ou `material/:id` agora abrem as telas nativas correspondentes
  - leitor preserva fallback de abertura externa do arquivo para manter compatibilidade entre dispositivos
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - render PDF embutido com senha no app ainda depende de viewer nativo dedicado; fluxo atual abre o arquivo no leitor externo do dispositivo.

## 2026-04-15 - Modulo concursos no mobile

- commit: `7c76488 Extract mobile concursos module from system taxonomies`
- origem web/plataforma:
  - `src/app/concursos/page.tsx`
  - `src/router/privateRoutes.tsx` (rota privada `/concursos`)
  - endpoint `settings.php` (taxonomias globais)
- destino mobile:
  - `mobile/src/screens/ConcursosScreen.tsx`
  - `mobile/src/types/system.ts`
  - `mobile/src/services/system/systemSettingsService.ts`
  - `mobile/src/navigation/types.ts`
  - `mobile/src/navigation/AppNavigator.tsx`
  - `mobile/src/screens/DashboardScreen.tsx`
  - `mobile/src/screens/NotificationsScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - app mobile passou a ter tela dedicada de concursos com catalogo inicial por banca/cargo/ano
  - tela usa taxonomias oficiais carregadas do `settings.php` no bootstrap de sistema
  - bootstrap mobile passou a normalizar `taxonomies.agencies`, `taxonomies.roles` e `taxonomies.years`
  - busca local por banca/orgao/cargo e filtro por ano foram portados para o fluxo mobile
  - navegacao stack e deep link `concursomestre://concursos` foram adicionados
  - dashboard ganhou atalho direto para concursos e notificacoes agora abrem essa tela quando o destino aponta para concurso/edital
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - o modulo mobile ainda opera com catalogo inicial por taxonomias; integracoes futuras com editais detalhados e materiais vinculados seguem em backlog.

## 2026-04-15 - Doacao na central de suporte mobile

- commit: `2f4205d Add mobile donation support tab with PIX settings`
- origem web/plataforma:
  - `src/app/support/page.tsx`
  - `src/types/global.ts` (`pixKey`)
  - endpoint `settings.php`
- destino mobile:
  - `mobile/src/screens/SupportScreen.tsx`
  - `mobile/src/types/system.ts`
  - `mobile/src/services/system/systemSettingsService.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - central de suporte mobile ganhou a 4a aba `Doacao`, alinhada ao fluxo da plataforma web
  - aba de doacao mostra bloco de apoio com chave PIX oficial
  - `pixKey` passou a ser lido do bootstrap de configuracoes (com compatibilidade `pixKey` e `pix_key`)
  - quando a chave nao vier do backend, o app usa fallback seguro `pix@concursomestre.com.br`
  - abertura de chamados, historico e respostas em thread permaneceram inalterados nas abas de suporte
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - a experiencia de pagamento por cartao segue fora do escopo mobile, como no fluxo web atual.

## 2026-04-15 - Central de suporte no mobile

- commit: `1a9501e Extract mobile support center with feedback threads`
- origem web/plataforma:
  - `src/app/support/page.tsx`
  - `src/services/support/supportService.ts`
  - endpoints `feedback/list.php` e `feedback/create.php`
- destino mobile:
  - `mobile/src/types/support.ts`
  - `mobile/src/services/support/supportService.ts`
  - `mobile/src/screens/SupportScreen.tsx`
  - `mobile/src/services/api/endpoints.ts`
  - `mobile/src/navigation/types.ts`
  - `mobile/src/navigation/AppNavigator.tsx`
  - `mobile/src/screens/NotificationsScreen.tsx`
  - `mobile/src/screens/DashboardScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - modulo de suporte/feedback passou a existir no app mobile com categorias de abertura (problema, sugestao e ajuda)
  - usuario pode abrir solicitacao com assunto + descricao usando endpoint oficial de criacao
  - historico de conversas passou a listar threads do usuario por categoria com status de atendimento
  - cada thread pode abrir respostas em timeline e aceitar nova resposta do usuario no mesmo fluxo
  - deep link interno `concursomestre://suporte` foi registrado e notificacoes podem abrir a tela de suporte diretamente
  - dashboard ganhou atalho rapido para a central de suporte
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - a experiencia de doacao da tela web de suporte ainda nao foi portada para o mobile.

## 2026-04-15 - Feature flags dos modulos core no mobile

- commit: `73f4578 Gate core mobile modules with system feature flags`
- origem web/plataforma:
  - `src/components/shared/layout/Layout.tsx`
  - `src/router/privateRoutes.tsx`
  - feature flags `practiceEnabled`, `simulationsEnabled`, `rankingsEnabled`, `marketplaceEnabled`
  - endpoint `settings.php`
- destino mobile:
  - `mobile/src/types/system.ts`
  - `mobile/src/services/system/systemSettingsService.ts`
  - `mobile/src/navigation/MainTabs.tsx`
  - `mobile/src/screens/DashboardScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - bootstrap mobile passou a normalizar tambem as flags dos modulos core da navegacao principal
  - abas de Questoes, Simulados, Ranking e Marketplace agora respeitam gate por feature flag
  - quando um modulo core estiver desativado, a aba deixa de aparecer para o usuario e o destino passa a renderizar fallback explicito de modulo indisponivel
  - atalhos do dashboard para Questoes e Simulados passaram a seguir as mesmas flags da navegacao
  - bypass de admin foi preservado via `isFeatureEnabled`
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - ainda faltam ajustes finos de paridade visual para alguns modulos core quando comparados ao layout web completo.

## 2026-04-15 - Raio-X da banca no mobile

- commit: `938d312 Extract mobile bank analysis module with feature-flag gate`
- origem web/plataforma:
  - `src/app/bank-analysis/page.tsx`
  - `src/services/bank-analysis/bankAnalysisService.ts`
  - endpoint `statistics/xray.php`
  - feature flag `xRayEnabled`
- destino mobile:
  - `mobile/src/types/bankAnalysis.ts`
  - `mobile/src/services/bank-analysis/bankAnalysisService.ts`
  - `mobile/src/screens/BankAnalysisScreen.tsx`
  - `mobile/src/navigation/types.ts`
  - `mobile/src/navigation/AppNavigator.tsx`
  - `mobile/src/screens/DashboardScreen.tsx`
  - `mobile/src/screens/NotificationsScreen.tsx`
  - `mobile/src/services/api/endpoints.ts`
  - `mobile/src/types/system.ts`
  - `mobile/src/services/system/systemSettingsService.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - modulo Raio-X passou a existir no app com leitura real do endpoint oficial de xray por banca/cargo/periodo
  - rota stack e deep link interno `concursomestre://x-ray` foram adicionados no mobile
  - dashboard ganhou atalho direto para o Raio-X
  - notificacoes passaram a abrir o modulo quando o destino aponta para `x-ray`/`raio-x`
  - gate por feature flag `xRayEnabled` foi conectado ao bootstrap de `settings.php` com fallback seguro
  - quando o modulo estiver desativado, a navegacao exibe fallback explicito de indisponibilidade
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - visualizacoes graficas avancadas da tela web de Raio-X (charts dedicados e blocos enriquecidos) ainda nao foram totalmente replicadas no mobile.

## 2026-04-14 - Feature flags beta no bootstrap mobile

- commit: `1e04da0 Wire mobile beta modules to system feature flags`
- origem web/plataforma:
  - `src/services/system/moduleFlags.ts`
  - `src/router/privateRoutes.tsx`
  - `src/components/shared/layout/Layout.tsx`
  - endpoint `settings.php`
  - feature flags `annotatedLawsEnabled` e `flashcardsEnabled`
- destino mobile:
  - `mobile/src/services/api/endpoints.ts`
  - `mobile/src/types/system.ts`
  - `mobile/src/services/system/systemSettingsService.ts`
  - `mobile/src/providers/AuthProvider.tsx`
  - `mobile/src/navigation/AppNavigator.tsx`
  - `mobile/src/screens/DashboardScreen.tsx`
  - `mobile/src/screens/ModulePlaceholderScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - bootstrap mobile autenticado passou a carregar `settings.php` e normalizar flags de modulo beta
  - `AuthProvider` agora expoe estado de settings e helper `isFeatureEnabled` com bypass para admin
  - atalhos do dashboard para Lei comentada e Flashcards respeitam as flags oficiais
  - rotas/deep links de Lei comentada e Flashcards passaram a renderizar fallback de modulo indisponivel quando desativados
  - placeholder de modulo ganhou `cardTitle` configuravel para diferenciar migracao em andamento de modulo bloqueado
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - conteudo real de lei comentada, flashcards, repeticao espacada e trilhas depende de implementacao futura dos modulos.

## 2026-04-14 - Dashboard evolucao em colunas (questoes/acertos)

- commit: `77af668 Add column timeline chart to mobile dashboard`
- origem web/plataforma:
  - `src/app/dashboard/page.tsx`
  - grafico de evolucao com serie de questoes e acertos
- destino mobile:
  - `mobile/src/screens/DashboardScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - bloco de evolucao ganhou visual de grafico em colunas com scroll horizontal
  - cada ponto passa a exibir barra de questoes e, quando habilitado, sobreposicao de acertos
  - legenda e toggle de acertos foram mantidos, agora conectados ao grafico em colunas
  - lista textual por linha continua no card para leitura numerica rapida
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - area chart nativo equivalente ao web ainda nao foi introduzido no mobile.

## 2026-04-14 - Dashboard KPIs sensiveis ao recorte temporal

- commit: `2614626 Align mobile dashboard KPIs with selected range`
- origem web/plataforma:
  - `src/app/dashboard/page.tsx`
  - cards principais refletem recorte ativo de analise no dashboard
- destino mobile:
  - `mobile/src/screens/DashboardScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - KPIs de questoes/acuracia no mobile passaram a usar o recorte de periodo quando a timeline estiver disponivel
  - card de acuracia agora mostra acertos e erros do recorte selecionado
  - quando timeline nao existe no payload, os KPIs mantem fallback para agregados globais sem quebrar a leitura
  - o mesmo seletor de periodo da evolucao passou a orientar os numeros resumidos de topo
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - grafico avancado do dashboard web (estilo area chart) ainda nao foi migrado para o mobile.

## 2026-04-14 - Dashboard progresso de nivel (XP)

- commit: `529245f Add level progress card to mobile dashboard`
- origem web/plataforma:
  - `src/app/dashboard/page.tsx`
  - bloco de nivel com XP acumulado, progresso percentual e XP restante
- destino mobile:
  - `mobile/src/screens/DashboardScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - dashboard mobile passou a exibir card de nivel do usuario com leitura de `level` e `xp`
  - barra de progresso mostra percentual de XP dentro do nivel atual
  - card tambem destaca XP acumulado e quanto falta para avancar ao proximo nivel
  - implementacao usa fallback seguro quando `level`/`xp` nao vierem no perfil
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - grafico avancado do dashboard web (estilo area chart) ainda nao foi migrado para o mobile.

## 2026-04-14 - Dashboard evolucao com toggle de acertos

- commit: `82f0b29 Add correct-answer toggle to mobile dashboard timeline`
- origem web/plataforma:
  - `src/app/dashboard/page.tsx`
  - controle para mostrar/ocultar serie de acertos no bloco de evolucao
- destino mobile:
  - `mobile/src/screens/DashboardScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - bloco de evolucao ganhou toggle para mostrar ou ocultar destaque de acertos
  - visual por ponto agora diferencia volume total de questoes e faixa de acertos no mesmo trilho
  - legenda da serie e valor lateral por ponto foram adaptados para leitura `acertos/questoes` quando o destaque esta ativo
  - comportamento de recorte por periodo foi preservado junto com o novo toggle
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - grafico avancado do dashboard web (estilo area chart) ainda nao foi migrado para o mobile.

## 2026-04-14 - Dashboard evolucao com recorte de periodo

- commit: `b2aaed7 Add dashboard timeline range filters on mobile`
- origem web/plataforma:
  - `src/app/dashboard/page.tsx`
  - toggles de periodo para leitura temporal de desempenho
- destino mobile:
  - `mobile/src/screens/DashboardScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - bloco de evolucao recente ganhou recorte por periodo (`Hoje`, `Semana`, `Mes`, `Tudo`)
  - resumo do recorte agora mostra questoes, acertos, erros e precisao antes das barras
  - quando a timeline nao traz `timestamp`, o app aplica fallback por quantidade de pontos para manter leitura util
  - arquitetura do bloco ficou pronta para absorver periodos mais ricos sem alterar o layout principal
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - grafico avancado do dashboard web (estilo area chart) ainda nao foi migrado para o mobile.

## 2026-04-14 - Dashboard timeline pronto para API

- commit: `a849a3c Add dashboard timeline support for mobile`
- origem web/plataforma:
  - `src/app/dashboard/page.tsx`
  - bloco de evolucao temporal de questoes/acertos por periodo
- destino mobile:
  - `mobile/src/types/statistics.ts`
  - `mobile/src/services/statistics/statisticsService.ts`
  - `mobile/src/screens/DashboardScreen.tsx`
  - `mobile/src/screens/PerformanceSubjectsScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - contrato mobile de estatisticas passou a aceitar `timeline` opcional com pontos de evolucao
  - service mobile agora normaliza timeline vindo de `timeline`, `timelineData` ou `questionTimeline`
  - dashboard ganhou bloco "Evolucao recente" com barras quando os pontos existem
  - quando a API ainda nao envia timeline, o app mostra fallback explicito sem quebrar a tela
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - filtros de periodo e grafico completo do dashboard web ainda dependem de contrato temporal consolidado no backend.

## 2026-04-14 - Dashboard motivacao diaria no mobile

- commit: `b66b040 Add daily motivation card to mobile dashboard`
- origem web/plataforma:
  - `src/app/dashboard/page.tsx`
  - bloco de motivacao diaria baseado na data atual
- destino mobile:
  - `mobile/src/screens/DashboardScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - dashboard mobile ganhou card dedicado de motivacao diaria com frase rotativa por dia do ano
  - data amigavel em pt-BR passou a aparecer junto da mensagem para reforcar o contexto do dia
  - selecao da frase usa fallback local deterministico, sem depender de contrato novo de backend
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - filtros de periodo e grafico historico completo do dashboard web ainda nao estao no mobile.

## 2026-04-14 - Simulados detalhe de historico no mobile

- commit: `649030e Add mobile simulation history detail screen`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - historico com revisao detalhada de questoes apos conclusao de tentativas
- destino mobile:
  - `mobile/src/screens/SimulationDetailScreen.tsx`
  - `mobile/src/screens/SimulationsScreen.tsx`
  - `mobile/src/services/simulations/simulationsService.ts`
  - `mobile/src/types/simulations.ts`
  - `mobile/src/navigation/types.ts`
  - `mobile/src/navigation/AppNavigator.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - lista de simulados agora abre tela dedicada de detalhe por tentativa
  - detalhe mostra score, aproveitamento, data/tempo e revisao por questao com filtro e alternativas expandidas
  - cache local de historico passou a guardar snapshot completo (config, questoes e respostas) para revisao offline
  - service mobile ganhou `getDetail(id)` para recuperar tentativa local e fallback remoto quando disponivel
  - deep link interno para detalhe de historico foi registrado em `simulados/historico/:simulationId`
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - sincronizacao de historico local com endpoint oficial de detalhe ainda depende de contrato backend dedicado.

## 2026-04-14 - Simulados revisao em foco com comunidade e anotacoes

- commit: `1389155 Add community and notes to simulation focus review`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - `QuestionCard` com comentarios da comunidade e anotacoes no contexto de revisao
- destino mobile:
  - `mobile/src/screens/SimulationRunScreen.tsx`
  - `mobile/src/components/questions/QuestionCommentsPanel.tsx` (reuso)
  - `mobile/src/components/questions/QuestionNotePanel.tsx` (reuso)
  - `mobile/src/services/comments/commentsService.ts` (reuso)
  - `mobile/src/services/questions/questionNotesService.ts` (reuso)
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - revisao em foco do simulado agora abre comentarios da comunidade por questao, com publicacao, resposta e curtida
  - modo foco tambem permite criar/editar/limpar anotacoes da questao usando persistencia local ja existente
  - hidratacao de notas remotas+locais passou a ser reaproveitada dentro do fluxo de revisao de simulado
  - quando a questao nao possui id valido, a UI sinaliza indisponibilidade dos recursos em vez de quebrar o fluxo
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - sincronizacao de historico local com endpoint oficial de detalhe ainda depende de contrato backend dedicado.

## 2026-04-14 - Simulados revisao em foco com insights

- commit: `3e6397f Add simulation focus insights on mobile`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - experiencia de revisao com apoio de comentarios/analises no `QuestionCard`
- destino mobile:
  - `mobile/src/screens/SimulationRunScreen.tsx`
  - `mobile/src/components/questions/QuestionInsightPanel.tsx` (reuso)
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - revisao em foco do simulado ganhou acoes para abrir comentario do professor e analise detalhada
  - render dos insights reaproveita o mesmo painel mobile ja usado no modulo Questoes
  - ao navegar entre questoes na revisao em foco, o painel de insight e resetado para evitar contexto antigo
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - comentarios da comunidade e anotacoes pessoais ainda nao foram acoplados ao modo foco da revisao.
  - sincronizacao de historico local com endpoint oficial de detalhe ainda depende de contrato backend dedicado.

## 2026-04-14 - Simulados revisao em foco por questao

- commit: `c71bc80 Add focused review mode for mobile simulations`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - passo `review` com navegacao dedicada entre questoes do resultado
- destino mobile:
  - `mobile/src/screens/SimulationRunScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - resultado mobile ganhou modo de revisao em foco por questao dentro do fluxo de simulado
  - usuario pode abrir revisao dedicada a partir da lista de resultado e navegar com anterior/proxima
  - revisao em foco mostra status da questao, enunciado completo, resposta marcada, gabarito e alternativas destacadas
  - revisao em lista foi mantida com acao rapida para abrir o modo focado sem perder os filtros ativos
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - comentarios/notas da questao ainda nao foram acoplados ao modo focado da revisao de simulado.
  - sincronizacao de historico local com endpoint oficial de detalhe ainda depende de contrato backend dedicado.

## 2026-04-14 - Simulados historico local com merge remoto

- commit: `c274764 Add local fallback for mobile simulations history`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - fluxo web persiste simulados e exibe historico consolidado para o usuario
- destino mobile:
  - `mobile/src/services/simulations/simulationsService.ts`
  - `mobile/src/screens/SimulationsScreen.tsx`
  - `mobile/src/types/simulations.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - simulados finalizados no app passam a entrar em cache local persistente (AsyncStorage)
  - listagem mobile agora combina dados remotos com historico local sem duplicar ids
  - quando `simulationsList` responde vazio/404/instavel, o app usa fallback local e evita tela vazia apos novas provas
  - historico passou a exibir badge de origem local e total de questoes quando disponivel
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - revisao detalhada ainda nao abre tela dedicada por questao com comentarios e notas.
  - sincronizacao de historico local com endpoint oficial de detalhe ainda depende de contrato backend dedicado.

## 2026-04-14 - Simulados navegacao por paleta e finalizacao antecipada

- commit: `8eb9773 Add mobile simulation navigation palette`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - etapa ativa do simulado com grade de navegacao por questao e opcao de entrega antecipada
- destino mobile:
  - `mobile/src/screens/SimulationRunScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - runner mobile passou a mostrar contador de questoes respondidas durante a prova
  - etapa ativa agora oferece paleta de navegacao para salto direto entre questoes
  - paleta indica questao atual e questoes ja respondidas para leitura rapida de progresso
  - fluxo ganhou opcao de finalizar o simulado antes da ultima questao com confirmacao explicita
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - revisao detalhada ainda nao abre tela dedicada por questao com comentarios e notas.
  - historico/listagem persistida de simulados ainda depende de endpoint oficial de listagem no backend.

## 2026-04-14 - Simulados revisao final filtravel e expandida

- commit: `7d116db Improve mobile simulation final review UX`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - fluxo final de revisao com leitura por status e alternativas
- destino mobile:
  - `mobile/src/screens/SimulationRunScreen.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - resultado final ganhou resumo visual de acertos, erros e questoes em branco
  - revisao agora permite filtro por status (todas, acertos, erros, em branco)
  - cada questao da revisao exibe materia/topico e pode ser expandida
  - alternativas da questao passam a destacar gabarito correto e resposta incorreta selecionada
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - revisao detalhada ainda nao abre tela dedicada por questao com comentarios e notas.
  - historico/listagem persistida de simulados ainda depende de endpoint oficial de listagem no backend.

## 2026-04-14 - Questoes modo foco/lista

- commit: `7f0e33c Add mobile questions focus mode`
- origem web/plataforma:
  - `src/app/practice/page.tsx`
  - `src/services/questions/questionService.ts`
  - endpoint `questionsList`
  - endpoint de envio de resposta de questoes
- destino mobile:
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/services/questions/questionService.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - pratica mobile passou a ter modo foco com uma questao por vez
  - modo lista foi preservado para revisao/varredura rapida
  - navegacao anterior/proxima controla o indice atual sem perder respostas ja enviadas
  - proxima questao carrega a pagina seguinte quando o usuario chega ao fim do lote atual
  - filtros continuam reiniciando a pratica no primeiro item do novo resultado
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - filtros completos de banca, ano, orgao, cargo e carreira ainda precisam ser mapeados no mobile.
  - comentarios, notas e favoritos da pratica ainda precisam de transicao propria.

## 2026-04-14 - Dashboard desempenho por materia

- commit: `41705df Add mobile subject performance detail`
- origem web/plataforma:
  - `src/app/dashboard/page.tsx`
  - `src/app/performance-subjects/page.tsx`
  - `src/services/dashboard/dashboardInsightsService.ts`
  - `src/services/statistics/studyTimeFormatting.ts`
- destino mobile:
  - `mobile/src/screens/DashboardScreen.tsx`
  - `mobile/src/screens/PerformanceSubjectsScreen.tsx`
  - `mobile/src/services/statistics/statisticsService.ts`
  - rota stack `PerformanceSubjects`
  - deep link `concursomestre://desempenho/materias`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - dashboard mobile ganhou acesso ao detalhamento completo de materias
  - tela detalhada lista todas as materias consolidadas por volume de questoes
  - cada materia exibe questoes respondidas, acertos, erros, precisao e leitura de revisao
  - pull-to-refresh recarrega as estatisticas oficiais do usuario
  - deep link interno para desempenho por materias foi registrado
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - dashboard mobile ainda nao replica graficos historicos, motivacao diaria e filtros de periodo da web.
  - a tela mobile usa o agregado oficial de `statistics/user`; nao reprocessa localmente o historico completo de respostas.

## 2026-04-14 - Marketplace detalhe de material

- commit: `24fef91 Add mobile material detail screen`
- origem web/plataforma:
  - `src/app/marketplace/page.tsx`
  - `src/app/material/page.tsx`
  - `src/app/reader/page.tsx`
  - `src/services/marketplace/marketplaceService.ts`
  - `src/services/transactions/transactionsService.ts`
- destino mobile:
  - `mobile/src/screens/MarketplaceScreen.tsx`
  - `mobile/src/screens/MaterialDetailScreen.tsx`
  - `mobile/src/services/marketplace/marketplaceService.ts`
  - `mobile/src/services/api/client.ts`
  - rota stack `MaterialDetail`
  - deep link `concursomestre://material/:materialId`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - vitrine mobile abre detalhe publico de material
  - detalhe exibe capa, preco, descricao, materia, topico, autor, avaliacao, vendas e status do arquivo
  - compra tambem pode ser iniciada pelo detalhe
  - acesso de leitura considera transacao aprovada/concluida, autor do material ou admin
  - arquivo do material pode ser aberto em visualizador externo quando houver URL disponivel
  - caminhos relativos do backend passaram a ser normalizados para URL absoluta no mobile
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - leitor PDF embutido no app ainda nao foi migrado; por enquanto o arquivo abre fora do app.
  - detalhe ainda usa a listagem oficial como fonte porque nao ha endpoint mobile dedicado por id.

## 2026-04-14 - Modulos beta Lei comentada e Flashcards

- commit: `9722c90 Add mobile beta module shells`
- origem web/plataforma:
  - `src/app/lei-comentada/page.tsx`
  - `src/app/flashcards/page.tsx`
  - `src/components/shared/feedback/BetaFeaturePage`
  - feature flags `annotatedLawsEnabled` e `flashcardsEnabled`
- destino mobile:
  - `mobile/src/screens/AnnotatedLawsScreen.tsx`
  - `mobile/src/screens/FlashcardsScreen.tsx`
  - `mobile/src/screens/ModulePlaceholderScreen.tsx`
  - rotas stack `AnnotatedLaws` e `Flashcards`
  - deep links `concursomestre://lei-comentada` e `concursomestre://flashcards`
  - atalhos no dashboard mobile
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - superficies beta da web passaram a existir tambem no mobile
  - dashboard mobile expoe atalhos para Lei comentada e Flashcards
  - telas comunicam migracao em andamento sem prometer fluxo inexistente
  - deep links internos foram registrados para os dois modulos
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - a regra de feature flag ainda nao esta exposta no bootstrap mobile.
  - conteudo real de lei comentada, flashcards, repeticao espacada e trilhas depende de implementacao futura dos modulos.

## 2026-04-14 - Marketplace

- commit: `931e8ef Add mobile marketplace parity screen`
- origem web/plataforma:
  - `src/app/marketplace/page.tsx`
  - `src/services/marketplace/marketplaceService.ts`
  - endpoint `materialsList`
  - endpoint `transactions/create.php`
- destino mobile:
  - `mobile/src/screens/MarketplaceScreen.tsx`
  - `mobile/src/services/marketplace/marketplaceService.ts`
  - aba `Marketplace` exposta como `Materiais`
- paridade entregue:
  - vitrine de materiais
  - filtro por materia
  - busca local por titulo, autor, tipo, materia e descricao
  - compra de material via service mobile e endpoint oficial de transacoes
  - placeholders visuais para materiais sem capa remota
- validacoes:
  - `npm --prefix mobile run typecheck`
  - bundle no Expo Go via Metro na porta `8081`
  - verificacao visual no emulador Android
- pendencias conhecidas:
  - detalhamento/leitor de material ainda precisa ser migrado.
  - fluxo de upload/publicacao de material do parceiro ainda segue web/admin.

## 2026-04-14 - Notificacoes e deep links

- commit: `a82d97d Add mobile notifications flow`
- origem web/plataforma:
  - `src/app/notifications/page.tsx`
  - `src/services/notifications/notificationService.ts`
  - endpoints `notificationsList`, `notificationsMarkRead`, `notificationsMarkAllRead`, `notificationsDelete`, `notificationsClearAll`
- destino mobile:
  - `mobile/src/screens/NotificationsScreen.tsx`
  - `mobile/src/services/notifications/notificationService.ts`
  - `mobile/src/types/notifications.ts`
  - rota stack `Notifications`
  - deep link `concursomestre://notificacoes`
- paridade entregue:
  - listagem de notificacoes do usuario autenticado
  - marcar uma notificacao como lida
  - marcar todas como lidas
  - remover notificacao individual
  - limpar todas as notificacoes
  - roteamento de links para abas principais quando o destino e reconhecido
  - fallback para abertura externa quando o destino e URL HTTP/HTTPS
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - bundle no Expo Go via Metro na porta `8081`
  - verificacao visual no emulador Android
- pendencias conhecidas:
  - notificacoes push nativas ainda nao foram ativadas.
  - destinos especificos de detalhe ainda precisam de telas dedicadas antes de mapear deep links granulares.

## 2026-04-14 - Roadmap mobile

- commit: `6655a14 Update mobile parity roadmap`
- transicao registrada:
  - Marketplace saiu da lista de proxima fase depois de entrar na Fase 2.
  - Notificacoes e deep links sairam da lista de proxima fase depois de entrar na Fase 2.
- validacoes:
  - `git diff --check`

## 2026-04-14 - Ranking detalhe publico

- commit: `80164e8 Add mobile ranking detail screen`
- origem web/plataforma:
  - `src/app/ranking/page.tsx`
  - `src/app/ranking-detail/page.tsx`
  - `src/services/rankings/rankingsService.ts`
  - endpoint `rankingsList`
- destino mobile:
  - `mobile/src/screens/RankingsScreen.tsx`
  - `mobile/src/screens/RankingDetailScreen.tsx`
  - `mobile/src/services/rankings/rankingsService.ts`
  - rota stack `RankingDetail`
  - deep link `concursomestre://ranking/:rankingId`
- paridade entregue:
  - abertura de detalhe a partir da listagem mobile
  - resumo publico do ranking
  - leitura de status de gabarito, discursiva, datas e vagas
  - exibicao de tipos de prova
  - top colocacoes ordenadas por score
  - atalho para abrir PDF de gabarito quando houver URL publica
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - bundle no Expo Go via Metro na porta `8081`
  - verificacao visual no emulador Android apos reiniciar o Metro com `--clear`
- pendencias conhecidas:
  - participacao/envio de gabarito do candidato ainda precisa de transicao propria.
  - ranking detail usa a listagem oficial como fonte porque ainda nao ha endpoint mobile dedicado para detalhe por id.

## 2026-04-14 - Ranking participacao e envio de gabarito

- commit: `450a9f0 Add mobile ranking answer submission`
- origem web/plataforma:
  - `src/app/ranking/page.tsx`
  - `src/services/rankings/rankingsService.ts`
  - endpoint `rankingsJoin`
- destino mobile:
  - `mobile/src/screens/RankingDetailScreen.tsx`
  - `mobile/src/services/rankings/rankingsService.ts`
  - `mobile/src/services/api/endpoints.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - formulario mobile de participacao no detalhe do ranking
  - preenchimento de inscricao, caderno/tipo de prova, categoria e nota discursiva
  - sanitizacao do cartao-resposta com alternativas A-E e limite de questoes
  - reaproveitamento de participacao anterior do usuario autenticado
  - calculo local da nota objetiva por gabarito oficial ou consenso colaborativo
  - envio da participacao para o backend via `rankingsJoin`
  - atualizacao otimista da lista local de colocacoes apos envio bem-sucedido
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - ranking detail ainda usa a listagem oficial como fonte porque nao ha endpoint mobile dedicado para detalhe por id.
  - status de aprovacao/classificacao por vaga ainda segue apenas como exibicao simples de colocacoes.

## 2026-04-14 - Simulados resultado e revisao

- commit: `04dcfc1 Add mobile simulation result review`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - tipo `SimulationSession`
  - fluxo de resultado/revisao apos `handleFinish`
- destino mobile:
  - `mobile/src/screens/SimulationRunScreen.tsx`
  - `mobile/src/types/simulation.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - resultado mobile mantem o resumo de score, aproveitamento e tempo total
  - resultado passa a carregar os resultados por questao
  - revisao por questao exibe enunciado resumido, status correta/incorreta/em branco, resposta do usuario e gabarito
  - roadmap mobile passou a tratar `Simulados com filtros avancados/taxonomias` como pendencia especifica
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - configuracao mobile ainda nao replica os filtros avancados/taxonomias da web.
  - revisao detalhada ainda nao abre uma tela dedicada por questao com comentarios e notas.

## 2026-04-14 - Simulados compatibilidade de listagem

- commit: `8d7cfbb Handle missing mobile simulations list`
- origem web/plataforma:
  - `src/services/simulations/simulationsService.ts`
  - fluxo web persiste simulados via `simulationsCreate`, sem depender de uma listagem publica equivalente
- destino mobile:
  - `mobile/src/services/simulations/simulationsService.ts`
- paridade/compatibilidade entregue:
  - a listagem mobile aceita `simulationsList` quando o backend expuser o contrato
  - quando o backend local responde 404 para a listagem, o app exibe estado vazio em vez de alerta bloqueante
  - o fluxo de criar novo simulado permanece disponivel
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - verificacao no emulador Android apos o alerta 404 observado
- pendencias conhecidas:
  - ainda falta definir um endpoint oficial de historico/detalhe de simulados se a plataforma quiser listar tentativas persistidas no mobile.

## 2026-04-14 - Simulados filtros iniciais

- commit: `31e03d8 Add mobile simulation setup filters`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - `src/app/practice/page.tsx`
  - endpoint `questionsList`
  - filtros web de palavra-chave, materia e dificuldade usados na pratica/simulado
- destino mobile:
  - `mobile/src/screens/SimulationConfigScreen.tsx`
  - `mobile/src/screens/SimulationRunScreen.tsx`
  - `mobile/src/types/simulation.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - configuracao mobile de simulado passou a aceitar palavra-chave, dificuldade e materia
  - amostra de questoes carrega com debounce e exibe total disponivel para os filtros
  - materias sao derivadas da taxonomia `assuntos` retornada pelo payload de questoes
  - inicio do simulado usa os filtros selecionados para montar a prova
  - execucao persiste o contexto de filtros na seed/config salva
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - filtros completos de banca, ano, orgao e cargo ainda dependem de mapear taxonomias adicionais no mobile.
  - ainda falta uma tela dedicada para escolher taxonomias longas com busca.

## 2026-04-14 - Questoes pool local e filtros avancados

- commit: `86b3dc0 Add mobile questions local filter pool`
- origem web/plataforma:
  - `src/app/practice/page.tsx`
  - `src/services/questions/questionService.ts`
  - endpoint `questionsList`
  - payload de questoes com taxonomias de banca, orgao, cargo, ano e comentarios
- destino mobile:
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/services/questions/questionService.ts`
  - `mobile/src/types/questions.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - pratica mobile passou a carregar o pool oficial completo de questoes via paginacao do backend
  - filtros agora rodam localmente por keyword, dificuldade, materia, banca, orgao, cargo e ano
  - pratica ganhou filtros para questoes com comentario de professor, analise detalhada e opcao de ocultar respondidas
  - modo foco e modo lista passaram a navegar sobre o mesmo conjunto filtrado localmente
  - cada questao exibe metadados resumidos e badges de comentario/respondida para aproximar a leitura da web
- compatibilidade observada:
  - backend local atualmente ignora filtros em `questionsList` e aceita apenas paginacao, entao o mobile consolidou a filtragem no cliente para manter a experiencia coerente
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - comentarios completos, notas e favoritos ainda nao foram migrados para a experiencia de pratica mobile.

## 2026-04-14 - Questoes salvas no mobile

- commit: `d6c0d29 Add mobile saved questions parity`
- origem web/plataforma:
  - `src/app/practice/page.tsx`
  - `src/app/questions/components/QuestionCard.tsx`
  - `src/providers/AuthProvider.tsx`
  - `src/services/questions/questionService.ts`
  - endpoint `questionsToggleSave`
- destino mobile:
  - `mobile/src/providers/AuthProvider.tsx`
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/services/questions/questionService.ts`
  - `mobile/src/services/api/endpoints.ts`
  - `mobile/src/types/auth.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - sessao mobile passou a normalizar e persistir `savedQuestionIds`
  - pratica mobile ganhou toggle otimista para salvar/remover questoes favoritas
  - card de questao agora indica o estado salvo e permite favoritar direto na pratica
  - filtros de recursos agora incluem recorte por questoes salvas
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - comentarios da comunidade e anotacoes de questao ainda nao foram migrados para o fluxo mobile.

## 2026-04-14 - Questoes comentarios da comunidade

- commit: `672415b Add mobile question comments flow`
- origem web/plataforma:
  - `src/app/practice/page.tsx`
  - `src/app/questions/components/QuestionCard.tsx`
  - `src/services/comments/commentsService.ts`
  - endpoints `commentsList`, `commentsHandle` e `commentsLike`
- destino mobile:
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/components/questions/QuestionCommentsPanel.tsx`
  - `mobile/src/services/comments/commentsService.ts`
  - `mobile/src/services/api/endpoints.ts`
  - `mobile/src/types/comments.ts`
  - `mobile/src/types/questions.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - pratica mobile passou a abrir comentarios sob demanda por questao
  - painel mobile permite criar novo topico, responder comentarios e curtir respostas
  - contagem de comentarios aproveita o payload oficial e se atualiza localmente apos novas publicacoes
  - thread aninhada foi adaptada para leitura mobile sem depender do `QuestionCard` web completo
- compatibilidade observada:
  - backend local pode responder `commentsList` sem `data` quando nao ha comentarios, entao o mobile trata isso como estado vazio valido
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - anotacoes de questao ainda nao foram migradas para o fluxo mobile.

## 2026-04-14 - Questoes anotacoes locais no app

- commit: `196d2b8 Add mobile question notes flow`
- origem web/plataforma:
  - `src/app/practice/page.tsx`
  - `src/app/questions/components/QuestionCard.tsx`
  - `src/providers/DataProvider.tsx`
  - `src/services/progress/userProgressService.ts`
  - endpoint `users/notes.php`
  - endpoint legado `users/delete_note.php`
- destino mobile:
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/components/questions/QuestionNotePanel.tsx`
  - `mobile/src/services/questions/questionNotesService.ts`
  - `mobile/src/services/api/endpoints.ts`
  - `mobile/src/types/notes.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - pratica mobile passou a hidratar anotacoes remotas existentes do usuario autenticado
  - anotacoes novas e edicoes passam a persistir localmente no app via `AsyncStorage`
  - notas remotas antigas podem ser removidas usando o endpoint oficial de exclusao
  - questao ganha badge de anotacao e painel dedicado para editar/limpar a nota
- compatibilidade observada:
  - o backend atual nao expoe rota oficial para gravar anotacao de questao, entao a escrita mobile segue local por enquanto, espelhando a limitacao pratica do fluxo web atual
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - ainda falta uma rota oficial de escrita para sincronizar anotacoes de questao entre dispositivos.

## 2026-04-14 - Questoes estatisticas e historico de resolucoes

- commit: `cf021b4 Add mobile question stats and history`
- origem web/plataforma:
  - `src/app/questions/components/QuestionCard.tsx`
  - `src/services/questions/questionService.ts`
  - endpoints `questionsStats` e `questionsHistory`
- destino mobile:
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/components/questions/QuestionStatsPanel.tsx`
  - `mobile/src/components/questions/QuestionHistoryPanel.tsx`
  - `mobile/src/services/questions/questionService.ts`
  - `mobile/src/services/api/endpoints.ts`
  - `mobile/src/types/questions.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - pratica mobile passou a abrir estatisticas sob demanda por questao
  - painel mostra totais, acertos, erros, taxa de acerto e distribuicao por alternativa
  - pratica mobile ganhou historico de resolucoes por questao usando a API oficial
  - respostas recem enviadas atualizam o fallback local de historico e estatisticas para manter a UI coerente
- compatibilidade observada:
  - `questionsHistory` depende de sessao autenticada valida no backend; quando o endpoint nao devolve linhas, o mobile reaproveita a ultima resposta conhecida da questao como fallback local
  - a distribuicao por alternativa aceita payload legado que pode vir por indice ou por id da opcao
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - ainda falta expor no card mobile o conteudo completo de comentario de professor e analise detalhada da questao.

## 2026-04-14 - Questoes comentario do professor e analise detalhada

- commit: `acac048 Add mobile question insight panels`
- origem web/plataforma:
  - `src/app/questions/components/QuestionCard.tsx`
  - campos `teacherComment` e `detailedComment` no payload oficial de questoes
- destino mobile:
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/components/questions/QuestionInsightPanel.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - pratica mobile ganhou toggles dedicados para abrir comentario do professor e analise detalhada
  - os dois paineis agora leem o conteudo oficial da questao direto no card mobile
  - o render mobile normaliza HTML/markdown simples para leitura confortavel sem depender de biblioteca extra
  - abrir uma dessas visoes fecha a outra para evitar empilhar dois blocos longos no mesmo card
- compatibilidade observada:
  - quando o backend sinaliza disponibilidade via flag mas ainda nao envia texto, o painel mobile mostra estado vazio explicito em vez de parecer quebrado
  - a analise detalhada ainda usa uma normalizacao leve de rich text; renderizacao markdown completa continua opcional para uma fatia futura, se necessario
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - ainda faltam refinamentos finais de paridade no fluxo de pratica, sobretudo acabamento fino de interacoes e alguns estados ricos do card web.

## 2026-04-14 - Simulados taxonomias completas no configurador

- commit: `ec33795 Add mobile simulation taxonomy filters`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - contrato `SimulationConfig` em `src/types/global.ts`
  - payload oficial de questoes com materia, banca, ano, orgao e cargo
- destino mobile:
  - `mobile/src/screens/SimulationConfigScreen.tsx`
  - `mobile/src/screens/SimulationRunScreen.tsx`
  - `mobile/src/types/simulation.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - configurador mobile passou a carregar o pool oficial completo de questoes e filtrar localmente
  - simulados agora aceitam taxonomias de materia, banca, ano, orgao e cargo alem de palavra-chave e dificuldade
  - a amostra exibida no configurador reflete o total elegivel local antes do inicio do simulado
  - o `seed` mobile e a persistencia final do simulado passaram a registrar essas taxonomias para manter o contexto da configuracao
- compatibilidade observada:
  - como `questionsList` local ainda ignora filtros ricos no backend, o mobile aplica os recortes no cliente para entregar configuracao coerente
  - quando o conjunto filtrado fica menor que a quantidade pedida, o configurador avisa e inicia com o total disponivel
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - ainda faltam outros refinamentos de paridade do modulo Simulados, como taxonomias adicionais mais profundas e acabamento fino da experiencia de configuracao/revisao.

## 2026-04-14 - Simulados topicos e feedback imediato

- commit: `726e2ac Add mobile simulation feedback and topic filters`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - seletor de `feedbackMode` e filtro `topics` no contrato web de simulados
- destino mobile:
  - `mobile/src/screens/SimulationConfigScreen.tsx`
  - `mobile/src/screens/SimulationRunScreen.tsx`
  - `mobile/src/types/simulation.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - configurador mobile agora permite filtrar questoes por topicos alem de materia, banca, ano, orgao e cargo
  - topicos ficam escopados pelas materias selecionadas para evitar combinacoes incoerentes
  - seed do simulado passou a carregar `feedbackMode` e `topics`
  - execucao mobile ganhou modo de feedback imediato, com travamento da questao atual apos responder e exibicao de acerto/gabarito na hora
- compatibilidade observada:
  - o feedback imediato foi implementado localmente no runner mobile, sem depender do `QuestionCard` web
  - no modo `after_all`, o comportamento anterior do mobile foi preservado
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - ainda faltam refinamentos de revisao mais rica no resultado final do simulado e outras taxonomias profundas do configurador.
