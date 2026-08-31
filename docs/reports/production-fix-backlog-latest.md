# Backlog de Correcoes para Producao

Data: `2026-05-05`

## Atualizacao incremental (`2026-05-30`)

- Etapa "Suite operacional de readiness": **Pronta localmente; pendente execucao em VPS/staging**.
- Concluido agora:
  - Criados workflows de CI:
    - Frontend `.github/workflows/frontend-ci.yml`, executando `npm ci` e `npm run check:production-local -- --skip-backend --with-build`.
    - Backend `.github/workflows/backend-ci.yml`, executando Composer e `scripts/tasks/ci_wiring_checks.php`.
  - Criado `scripts/tasks/ci_wiring_checks.php` no backend para lint PHP e 19 testes criticos de wiring em um unico comando reaproveitavel pela CI.
  - Criados templates em `config/deploy/` para preparar a futura VPS sem hardcodar segredos: Nginx + PHP-FPM, systemd do frontend, cron operacional e logrotate.
  - `docs/PRODUCTION_RELEASE_RUNBOOK.md` passou a referenciar os templates de deploy como base para reverse proxy, servico Next.js, crons e logs.
  - Criado `scripts/checks/release-repositories-status.mjs` e o script `npm run check:release-repos` para auditar frontend/backend como repositorios separados, com `origin`, sem `.env` real, logs ou dumps operacionais rastreados.
  - `npm run check:release-local` agora grava duas evidencias locais: `.tmp/release-repos-status-latest.json` e `.tmp/backend-readiness-suite-latest.json`.
  - Criado `scripts/tasks/production_readiness_suite.php` no backend para orquestrar `production_preflight.php`, `production_smoke.php`, `production_log_audit.php` e `backup_restore_rehearsal.php` em um unico JSON de evidencia.
  - O perfil `local` pula preflight de producao por padrao, nao exige login/admin e usa auditoria de logs sem bloqueio, permitindo rodar a suite sem VPS.
  - Os perfis `staging` e `production` tornam auth/admin, preflight, logs recentes e ensaio de restore bloqueantes quando configurados, evitando release manual com checks esquecidos.
  - Criado `ProductionReadinessSuiteWiringTest.php` para travar a presenca da orquestracao e dos modos `auth-required`, `admin-required` e `backup_restore_rehearsal`.
  - Backend `.gitignore` passou a ignorar `storage/backups/`, evitando que dumps reais gerados por `backup_mysql.php` sejam candidatos a commit.
  - `npm run check:production-local` agora inclui o teste de wiring da suite operacional quando o backend existe e aceita `--with-backend-readiness` para rodar smoke/logs/backup no mesmo fluxo local.
  - Criado o atalho `npm run check:release-local`, equivalente ao readiness local completo com build de producao e suite operacional backend em perfil local.
  - O atalho local de release grava, por padrao, a evidencia `.tmp/backend-readiness-suite-latest.json` para facilitar anexar o resultado da homologacao sem versionar artefatos.
  - `production_readiness_suite.php` passou a aceitar `READINESS_REPORT_FILE`/`--report-file=...`, gravando o payload JSON em arquivo privado para evidencia de homologacao.
  - `npm run check:production-local` aceita `--backend-readiness-report=...` para repassar esse caminho ao backend quando a suite operacional estiver ativa.
- Validacoes:
  - `php -l scripts/tasks/production_readiness_suite.php`: passou.
  - `ProductionReadinessSuiteWiringTest.php`: passou.
  - `production_readiness_suite.php --profile=local --web-base-url= --api-base-url=http://localhost/questao-pro-backend/api --db-connections=1 --timeout=12 --with-backup-rehearsal=true`: passou com `0` falhas obrigatorias.
  - `node --check scripts/checks/production-readiness-local.mjs`: passou.
  - `npm run check:release-repos -- --report-file=.tmp/release-repos-status-latest.json`: passou; gerou aviso esperado de worktree local com alteracoes pendentes nos dois repositorios.
  - `C:\xampp\php\php.exe scripts/tasks/ci_wiring_checks.php --report-file=C:/dev/concursomestre/.tmp/backend-ci-wiring-latest.json`: passou com lint PHP em 549 arquivos e 19 testes criticos.
  - `npm run check:production-local -- --skip-backend`: passou para simular a parte principal do workflow frontend sem depender do backend local.
  - `npm run check:production-local -- --with-backend-readiness --api-base-url=http://localhost/questao-pro-backend/api --web-base-url= --db-connections=1 --timeout=12`: passou, incluindo typecheck, suites criticas frontend/PHP e a suite operacional backend em perfil local.
  - `npm run check:production-local -- --with-build --with-backend-readiness --api-base-url=http://localhost/questao-pro-backend/api --web-base-url= --db-connections=1 --timeout=12`: passou, incluindo build Next/Turbopack de producao.
  - `production_readiness_suite.php --profile=local --web-base-url= --api-base-url=http://localhost/questao-pro-backend/api --db-connections=1 --timeout=12 --report-file=C:/dev/concursomestre/.tmp/backend-readiness-suite-test.json`: passou e gravou o relatorio JSON.
  - `npm run check:production-local -- --with-backend-readiness --api-base-url=http://localhost/questao-pro-backend/api --web-base-url= --db-connections=1 --timeout=12 --backend-readiness-report=.tmp/backend-readiness-suite-latest.json`: passou e gravou `.tmp/backend-readiness-suite-latest.json`.
- Status: **pronto localmente**. Falta rodar a mesma suite em VPS/staging com `--profile=staging` ou `--profile=production`.

## Atualizacao incremental (`2026-05-29`)

- Etapa "P0.1 Homologacao/staging": **Pronta localmente; pendente execucao em ambiente real**.
- Concluido agora:
  - Matriz local de release reexecutada com `npm run check:production-local`: passou.
  - Smoke publico local reexecutado com `production_smoke.php`: passou para API/Web/DB, incluindo Lei Comentada publica e outline.
  - Preflight local reexecutado com `production_preflight.php`: falhou apenas nos bloqueios esperados de ambiente (`APP_ENV`, `APP_URL`, CORS, `APP_DEBUG`, `DB_PASSWORD`, usuario DB `root`).
  - Auditoria de logs reexecutada com `production_log_audit.php`: default corrigido para ler `storage/logs/subscriptions/subscription_cron.log`, sem depender do log legado em `api/subscriptions`; modo bloqueante ainda falha por historico local do Apache/XAMPP, e modo `--fail-on=none` gera analise para inspecao sem arquivos ausentes.
  - Validacoes da correcao: `php -l scripts/tasks/production_log_audit.php`, `ProductionLogAuditWiringTest.php` e `SubscriptionsCronWiringTest.php` passaram.
  - Ruido local de PHP CLI corrigido: `php.ini` do XAMPP nao carrega mais `openssl` em duplicidade, evitando aviso antes do JSON dos scripts.
  - Criticos recentes de IA corrigidos: o gateway de IA ganhou timeout por requisicao (`requestTimeoutSeconds`), `CURLOPT_TIMEOUT` dinamico e `set_time_limit` por tentativa; analise detalhada de capitulo usa timeout explicito de 240s.
  - Validacoes de IA: `php -l` em `AiService.php`, `AiValidator.php` e `LegalCommentaryAiGenerationService.php`, alem de `AiModuleWiringTest.php` e `LegalCommentaryAdminWiringTest.php`, passaram.
  - Erro falso em settings corrigido: `AdminSettingsService` nao quebra mais o salvamento quando a transacao ja foi encerrada apos escritas bem-sucedidas; `AdminSettingsWiringTest.php` passou e o smoke local continuou verde.
- Status: **codigo local pronto para homologacao; go-live continua bloqueado ate validar VPS/staging**.
- Proximos criterios de aceite:
  - `production_preflight.php` retornar `success=true` no servidor.
  - `production_smoke.php --api-base-url=https://api... --web-base-url=https://app...` retornar `success=true`.
  - `production_log_audit.php` sem criticos apos rotacao/limpeza de logs do ambiente novo.
  - Heartbeat recente do cron Stripe e do webhook Stripe.
  - SMTP real e modelos essenciais ativos.

- Etapa "Smoke publico de Lei Comentada": **Pronta localmente**.
- Concluido agora:
  - `production_smoke.php` ganhou o check `legal_commentary_list`, chamando `/api/legal-commentary/list.php`.
  - A validacao falha se `totals` indicar leis/artigos publicados, mas a resposta nao trouxer leis navegaveis em `lawsByArea` ou contadores de artigos nos resumos.
  - O smoke tambem pega a primeira lei publica da listagem e valida o outline em `/legal-commentary/detail.php?outline=1`, exigindo secoes e artigos. Isso cobre diretamente o bug de spinner infinito em secoes/artigos da pagina do aluno.
  - Isso transforma o bug recorrente de "Carregando secoes/artigos..." em falha automatica de release, em vez de depender apenas de teste manual.
- Validacao local: `php -l production_smoke.php` e smoke completo API/Web/DB passaram.
- Status: **pronto localmente**. Falta repetir o smoke na VPS/staging com dominio real, HTTPS e base de homologacao populada.

## Atualizacao incremental (`2026-05-28`)

- Etapa "Lei Comentada/admin e editor de questoes": **Pronta local no recorte corrigido**.
- Concluido agora:
  - Editor admin de Lei Comentada corrigido para compilar novamente apos adicionar `publishedAt/published_at` ao contrato TypeScript.
  - Publicacao/agendamento de Lei Comentada passou a usar `DATETIME` no backend, com migracao local de `laws.published_at` de `DATE` para `DATETIME` quando necessario.
  - Leis com status `scheduled` so entram na listagem publica quando a data/hora agendada ja passou; rascunhos ficam fora da camada publica.
  - Box `Publicar` concentra status, data/hora, rascunho, visualizar, excluir e publicar/agendar.
  - Geracao de IA em Lei Comentada nao salva automaticamente: frontend envia `previewOnly`, e backend bloqueia persistencia quando esse modo estiver ativo, mesmo se algum payload antigo mandar `persist`.
  - Botao secundario de atualizacoes oficiais deixou de disparar a mesma sincronizacao duas vezes e agora abre detalhes das alteracoes encontradas.
  - Editor admin de questoes deixou de ficar em loop quando o endpoint falha e passou a diferenciar carregamento real de preparacao do modal interno.
- Validacao local: `npm run typecheck`, `npm run check:text-encoding`, ESLint direcionado, `LegalCommentaryAdminWiringTest.php` e `QuestionsModuleWiringTest.php` passaram.
- Status: **pronto localmente**. Falta smoke logado com admin real e reimportacao/salvamento de lei em staging/VPS.

## Atualizacao incremental (`2026-05-23`)

- Etapa "Ajustes de dashboard, billing e indicadores admin": **Pronta local parcial**.
- Concluido agora:
  - `DashboardPage` reorganizou os cards superiores: `Motivacao Diaria` + `Sequencia de Estudos` ficam na coluna principal com `2/3` da largura disponivel, e `Tempo de Estudos` fica na coluna lateral com `1/3`, mantendo leitura, questoes, media/dia e total sem numeros espremidos.
  - `ProfilePage` passou a tratar `auto_renew` local como fonte explicita quando o usuario desativa renovacao automatica; a conciliacao Stripe nao deve mais reativar a renovacao sozinha em contratos anuais/trimestrais com parcelas pre-aprovadas.
  - A janela de reembolso voltou a considerar apenas os 7 primeiros dias da primeira assinatura paga, usando a primeira transacao paga real em vez do ciclo/parcela atual.
  - Planos com parcelas pre-aprovadas exibem o valor contratado da parcela enquanto ainda houver installments pendentes; preco vigente da plataforma fica reservado para renovacoes sem faturas/pre-aprovacoes pendentes.
  - A contagem visual de ciclo em planos anuais/trimestrais parcelados passou a considerar a janela da parcela atual, evitando leituras como `2 de 365 dias` quando o usuario esta no segundo mes de um termo parcelado.
  - A projecao financeira admin agora inclui assinaturas ativas com renovacao automatica, respeita unidade/intervalo (`dia`, `semana`, `mes`, `ano`) e remove acumulacao de parcelas futuras quando a assinatura Stripe esta `past_due`.
  - O dashboard admin passou a separar `Receita bruta`, `Receita disponivel`, `Comissao da plataforma` e `MRR estimado`, evitando misturar receita total com comissao/saldo disponivel.
  - `CheckoutPage` passou a exigir CPF no cadastro feito pelo checkout e envia o CPF normalizado ao backend.
  - Sombras centrais da plataforma/admin foram padronizadas com sombra leve unica (`shadow-sm` calibrado), reduzindo diferenca visual entre boxes.
  - **Observacao 7 (Next middleware deprecated): Pronta local.** O projeto usa `src/proxy.ts` com `export function proxy` e nao possui `middleware.ts`; a nova trava `npm run check:next-proxy` foi integrada ao `check:production-local` para impedir regressao para a convencao antiga.
  - **Observacao 10 (acoes em Lei Comentada/admin): Pronta local.** A listagem de Lei Comentada ganhou selecao por checkbox, selecionar todos os itens visiveis e acao em massa para mover para lixeira, mantendo acoes inline no padrao WordPress (`Ver | Editar | Sincronizar | Atualizacoes | Lixeira`).
  - **Observacao 4 (total real de questoes em `/practice`): Pronta local.** A pratica deixou de usar apenas o tamanho do lote carregado como total; filtros principais agora sao enviados ao backend, `questionsList` calcula `COUNT(*)` com o mesmo filtro e a UI usa esse total real no badge e no modo foco, mantendo `100` apenas como tamanho de pagina/lote.
  - **Observacao 5 (Historico de Resolucoes exibindo `?`): Pronta local.** O historico de questoes agora normaliza respostas atuais e legadas (`selectedOptionIndex`, `selected_option_index`, id da alternativa, rotulo e indice antigo base-1), evitando `?` quando a alternativa marcada existe. O timestamp do historico tambem e normalizado de segundos para milissegundos no cliente.
  - **Observacao 11 (spinner no Reenviar E-mail): Pronta local.** O botao de reenviar confirmacao no checkout agora exibe `Loader2` animado durante o envio, mantem o estado desabilitado e usa icone de e-mail no estado parado, evitando clique duplicado sem feedback visual.
  - **Observacao 3 (dashboard admin em `Hoje`): Pronta local.** O endpoint `admin/stats.php` agora tambem assume `today` como periodo padrao quando chamado sem query, alinhando backend e UI. O periodo `all` continua disponivel apenas quando solicitado explicitamente.
  - **Observacao 9 (botoes sociais so quando configurados): Pronta local.** A pagina de auth agora so carrega/renderiza Google, Facebook e Apple quando o provider tem identificador publico valido e flag de integracao configurada pelo painel/env. Sem configuracao completa, o botao nao aparece e o SDK nao e carregado.
  - **Observacao 2 (stop automatico do tempo de estudo): Pronta local.** O rastreador ja pausava por inatividade e avisava no fechamento da aba; agora tambem salva automaticamente a sessao quando o usuario sai de uma rota rastreada (`/practice` ou Lei Comentada interna) para uma area comum, evitando tempo pendurado.
  - **Observacao 8 (CPF obrigatorio no cadastro): Pronta local.** Cadastro comum, cadastro social pendente e checkout coletam/validam CPF antes de criar conta ou assinar; o backend rejeita `register` sem `cpf` e `phone`, valida CPF e bloqueia duplicidade.
  - **Observacao 6 (falha de pagamento acumulando pre-aprovadas): Pronta local.** A projecao local de parcelas Stripe agora ignora assinaturas `past_due/incomplete` e, quando existe uma fatura futura/rejeitada no historico, avanca a data projetada pelo numero real de slots financeiros ja ocupados. Isso evita que parcelas pre-aprovadas futuras aparecam acumuladas na mesma data apos falha de cobranca.
  - Validacao local: `npm run check:next-proxy`, `npm run typecheck` e `php -l` nos arquivos alterados dos modulos `questions`, `admin`, `auth` e `transactions` passaram.
- Status desta etapa: **pronto localmente no recorte alterado; pendente smoke visual e financeiro em staging/VPS**.

## Atualizacao incremental (`2026-05-22`)

- Etapa "Prova macro local de release": **Pronta localmente**.
- Concluido agora:
  - `npm run check:production-local -- --with-build` passou, incluindo encoding, typecheck, trava de artefatos gerados, budget de hard refresh, suites criticas de frontend e build Next/Turbopack de producao.
  - Suite PHP critica passou para preflight, auth social, modelos de e-mail, campanhas, checkout/cron/notificacoes/sync de assinaturas e politica de lembrete de renovacao.
  - `production_smoke.php` foi reforcado para staging/VPS: valida HTTPS em hosts publicos, headers minimos de seguranca, API publica, rotas web e MySQL; teste de wiring, sintaxe PHP e smoke API/DB local passaram.
  - `git diff --check` passou sem erros de whitespace; restaram apenas avisos LF/CRLF normais do ambiente Windows.
- Status da etapa: **pronta localmente para homologacao controlada**.
- Falta para go-live:
  - Repetir a matriz em VPS/staging com dominio HTTPS real.
  - Rodar preflight no servidor final com `.env` real.
  - Provar SMTP real, OAuth Google/Facebook/Apple, webhook Stripe publico, cron Stripe a cada 15 minutos, backup/restore e smoke externo das rotas criticas.
  - Corrigir o warning operacional do PHP local `Module "openssl" is already loaded` na configuracao do servidor final, se aparecer na VPS.

## Atualizacao incremental (`2026-05-16`)

- Etapa "Superficie publica backend": **Pronta localmente** no recorte auditado.
- Concluido agora:
  - `backend.zip` (`177 MB`) saiu de `C:/xampp/htdocs/questao-pro-backend` e foi preservado em `C:/xampp/private-backups/questao-pro-backend/backend.zip`, fora da raiz publica do Apache.
  - `.htaccess` do backend passou a negar download direto de backups/dumps/compactados e acesso direto a `config`, `database`, `modules`, `runtime`, `shared`, `storage`, `tests`, `vendor` e quase toda a pasta `scripts/`.
  - `.env` e variantes como `.env.example` passaram a ser bloqueados pelo mesmo hardening de raiz.
  - A unica excecao de `scripts/` ficou documentada em allowlist: `scripts/importers/questions/gran/index.php` e `scripts/importers/questions/gran/import_worker.php`, pois o painel admin ainda usa essa ferramenta operacional.
  - `production_preflight.php` agora inclui `BACKEND_ROOT_ARTIFACTS_CLEAN`, impedindo release se backup/log/dump voltar para a raiz publica.
  - Testes locais: `BackendRootCleanupWiringTest.php`, `ProductionPreflightWiringTest.php`, `ProductionPreflightBehaviorTest.php` e `ApiResidualSurfaceWiringTest.php` passaram; smoke HTTP confirmou `403` para `scripts/debug/debug_db.php` e `storage/logs/settings.log`, mantendo `200` para o crawler Gran.
- Etapa "Uploads publicos": **Pronta localmente** no recorte auditado.
- Concluido agora:
  - `uploads/.htaccess` passou a desativar includes, desligar engine PHP quando `mod_php` estiver presente, negar dotfiles e retirar `Authorization` dos headers CORS de assets estaticos.
  - `UploadSecurityWiringTest.php` passou e smoke HTTP confirmou `403` para upload temporario `.php`, `.svg` e dotfile.
- Etapa "Auth/CSRF/CORS": **Pronta localmente** no recorte auditado.
- Concluido agora:
  - `SharedAuthInfrastructureWiringTest.php` agora trava cookies de auth `Secure` em producao/HTTPS, refresh `HttpOnly`, CSRF legivel para double-submit, `SameSite` configurado e revogacao de familia de sessao em `csrf_mismatch`.
  - Smoke HTTP confirmou que origem externa nao recebe `Access-Control-Allow-Origin`, enquanto origem local permitida recebe CORS com credenciais.
- Etapa "Artefatos de desenvolvimento no backend": **Pronta localmente** no recorte auditado.
- Concluido agora:
  - `scripts/debug`, `scripts/manual-tests`, `scripts/setup`, `scripts/maintenance`, `scripts/seed`, `scripts/seeds`, `scripts/checks/temp_check_plans.php` e `scripts/checks/temp_check_transactions.php` sairam de `C:/xampp/htdocs/questao-pro-backend`.
  - Os arquivos foram preservados fora da raiz publica em `C:/xampp/private-backups/questao-pro-backend/dev-scripts-archive/2026-05-18`.
  - `production_preflight.php` ganhou `BACKEND_DEV_SCRIPT_ARTIFACTS_CLEAN`, bloqueando o retorno de instaladores/debug/manual-tests/setup/maintenance/seed/seeds e checks temporarios para a arvore publica.
  - `scripts/migrations` tambem foi fechado: apenas `migrate_marketplace_schema_compatibility.php` permanece allowlisted para CLI; migracoes PHP legadas foram arquivadas em `C:/xampp/private-backups/questao-pro-backend/dev-scripts-archive/2026-05-18/scripts/migrations-legacy`.
  - Docs internos do backend foram atualizados para orientar diagnosticos futuros como tarefas CLI revisadas em `scripts/tasks/` ou testes em `tests/`, nunca como endpoints web.
  - Testes locais: `BackendRootCleanupWiringTest.php`, `ProductionPreflightWiringTest.php`, `ProductionPreflightBehaviorTest.php`, `MarketplaceSchemaCompatibilityWiringTest.php` e `MarketplaceGamificationWiringTest.php` passaram; smoke HTTP manteve `403` para caminhos removidos/bloqueados e `200` para o crawler Gran permitido.
- Etapa "Tarefas operacionais de billing": **Pronta localmente** no recorte auditado.
- Concluido agora:
  - `check_subscription_card_expiry.php` foi movido de `scripts/checks/` para `scripts/tasks/`, porque e rotina operacional/cron e nao diagnostico manual.
  - A tarefa ganhou guarda `PHP_SAPI !== 'cli'` para nao executar via HTTP caso o servidor web seja configurado incorretamente.
  - `docs/BILLING_E_VALIDACAO.md` e `docs/PRODUCTION_RELEASE_RUNBOOK.md` foram atualizados com o novo caminho e cron diario.
  - Validacao: `php -l` passou e smoke HTTP retornou `403` para `scripts/tasks/check_subscription_card_expiry.php`.
- Etapa "Renovacao e lembretes Stripe": **Pronta localmente**.
- Concluido agora:
  - Criada a tarefa CLI `scripts/tasks/reconcile_stripe_subscriptions.php`, com lock exclusivo, para executar a reconciliacao Stripe sem depender de usuario logado, browser ou chamada HTTP.
  - O cron recomendado no runbook passou para execucao CLI a cada 15 minutos.
  - A politica de lembretes virou funcao centralizada: aviso de 5 dias somente para ciclos maiores que 5 dias; aviso de amanha para qualquer ciclo que renove no dia seguinte.
  - Criado o template editavel `subscription_renewal_tomorrow` no catalogo backend/frontend de modelos de email.
  - A reconciliacao Stripe agora grava heartbeat privado (`storage/logs/subscriptions/subscription_cron_health.json`) e o admin consome `cron_health` em `Painel > Saude do billing`, com alerta `stale` quando a rotina nao roda ha mais de 30 minutos.
  - O preflight de producao ganhou o check `SUBSCRIPTIONS_STRIPE_CRON_HEALTH_RECENT`, bloqueando go-live quando o heartbeat do cron estiver ausente, invalido, antigo ou em estado `stale/error/unknown`.
  - O webhook Stripe agora grava heartbeat privado (`storage/logs/subscriptions/stripe_webhook_health.json`) em evento valido processado/ignorado/duplicado; o admin consome `webhook_health` e o preflight ganhou `STRIPE_WEBHOOK_HEALTH_RECENT`.
  - Modelos de e-mail: campanhas automaticas agora usam o modelo editavel `marketing_campaign_message`; `EmailTemplatesCatalogParityTest.php` trava paridade entre catalogo frontend/backend e impede envio novo fora da pagina "Modelos de email".
  - Validacao: `SubscriptionsRenewalReminderPolicyTest.php`, `SubscriptionsCronWiringTest.php`, `SubscriptionsCheckoutWiringTest.php`, `ProductionPreflightWiringTest.php`, `ProductionPreflightBehaviorTest.php`, `npx eslint src/app/admin/components/panel/AdminPanelSection.tsx --max-warnings=0` e `npx tsc --noEmit --pretty false` passaram.
- Etapa "Billing/Stripe": **Pronta localmente**.
- Concluido agora:
  - `npm run check:billing-e2e` fechou `GO` com `7 OK`: renovacao Stripe ponta a ponta, auto-renew off/on, upgrade com credito proporcional local, refund concorrente, webhook duplicado, webhook fora de ordem e webhook atrasado com reconciliacao.
  - `billing-renewal-check.mjs` fechou `GO` com `22 OK`, sem `RISCO`, `CRITICO` ou `NAO_COMPROVADO`.
  - Renovacoes deixam de reaplicar cupom/desconto de checkout automaticamente e passam a usar o preco vigente do plano na plataforma.
  - Finalizacao/sincronizacao de assinatura passou a carregar `price` do plano no contexto local, corrigindo o risco de item Stripe ficar em `R$ 0,00` e nao cobrar a renovacao.
  - Cron e webhook Stripe foram travados por testes para nao exigirem usuario logado, access token ou sessao admin; renovacao passa a ser uma responsabilidade de servidor/Stripe, nao da tela do usuario.
  - Renovacao paga agora gera notificacao in-app especifica de `Assinatura renovada`; a aba de assinatura aguarda sincronizacao Stripe antes de renderizar dados e recarrega notificacoes quando a sync materializa invoice.
  - Novo script `npm run check:billing-e2e` foi adicionado ao `package.json` para pre-deploy.
  - Fluxos globais de console (`interceptors`, `AuthProvider`, `NotificationsProvider`) passaram para `clientLog`, que registra no DebugLogger e so imprime no DevTools em modo verbose. Isso reduz ruido operacional sem apagar evidencias de erro.
  - A limpeza de console avancou para `MarketplaceProvider` e stores globais (`admin-data`, `question-bank`, `user-progress`, `app-config`), reduzindo logs diretos em areas que rodam em varias telas.
  - A limpeza de console avancou tambem para `subscriptionsService`, `planService`, `notificationService`, `auth/session`, `reputationService`, `analyticsTrackingService`, `/checkout`, `/practice`, `QuestionCard`, moderacao de comentarios, suporte admin, provas, taxonomias, rankings, logs admin, analytics financeiro, perfil detalhado admin, suporte, marketplace, perfil, PDF reader, cronograma, raio-x de banca, parceiro, simulados e leitor. Contagem runtime atual: `2` ocorrencias restantes de `console.error/warn/log/debug`, ambas intencionais no wrapper `src/services/monitoring/clientLog.ts`.
  - `planService`, `auth/session` e editor admin de provas tiveram `any` exposto removido no recorte alterado; os contratos minimos usados por checkout Stripe/cupom/cancelamento e taxonomias de prova ficaram tipados sem voltar ao `any`.
  - `src/types/global.ts` ficou sem `any` explicito e passou a representar payloads flexiveis de taxonomia/nivel/firebase por tipos nomeados; o importador admin normaliza o nivel antes de renderizar, evitando objeto cru no JSX.
  - Servicos pequenos de perfil/comentarios/changelog/cronograma/denuncias/suporte/SEO/publicacao e flags de questoes/insights do dashboard/simulado/Raio-X da banca tambem sairam de `any` explicito; depois, Lei Comentada, ranking, checkout Stripe/cartao salvo, perfil Stripe, marketplace payment modal, landing de planos, `DebugLogger`, tipos de Lei Comentada, `SuccessModal`, privacidade, comentarios, telas publicas secundarias, layout global e mocks de testes de servicos tambem foram saneados. A fila runtime auditada em `src` esta em `0` ocorrencias de `any` explicito, com `typecheck`, `lint`, `check:production-local` e `build` verdes; snapshot agregado atual do ESLint esta em `0` erros e `0` warnings.
  - `/plans` corrigiu export nomeado invalido para o App Router e eliminou warnings direcionados de hooks nesse recorte.
  - Artefatos temporarios locais ignorados pelo Git foram removidos; os dois logs webpack restantes ficaram documentados como bloqueados por processo ativo.
  - **Observacao 22 (add/edit admin lento): Pronta local.** As telas standalone de adicionar/editar usam leituras de detalhe, coalescencia e cache curto em vez de carregar bases amplas no mount; a etapa foi fechada com `npm run check:hard-refresh-budget` e `npm run check:production-local` verdes.
  - **Observacao 39 (limpeza de codigo morto/artefatos): Pronta local.** `tsconfig.tsbuildinfo` saiu da raiz e o cache incremental passou para `.next/tsconfig.tsbuildinfo`; `npm run check:generated-artifacts` foi criado e integrado ao `check:production-local`, bloqueando o retorno de caches/logs/baselines gerados na raiz do frontend.
- Falta para fechar a etapa em producao:
  - Repetir a suite operacional com webhook publico/tunel na VPS/staging, usando chaves corretas do ambiente final.

## Atualizacao incremental (`2026-05-08`)

- Etapa "Coordenar bootstrap e leituras quentes": **Pronta local parcial** (staging/VPS ainda pendente).
- Concluido agora:
  - `AppConfigProvider` adiou o bootstrap de `admin/settings.php` em `/admin/panel/*` para uma janela posterior (`8s`), eliminando esse fetch no hard refresh imediato do painel.
  - `AdminCommentsModerationSection` foi migrado para `React Query` com chave estavel, cache curto e invalidação por mutacao, substituindo o loader manual sujeito a rajadas.
  - `scripts/checks/hard-refresh-budget.mjs` e `npm run check:hard-refresh-budget` foram adicionados para tornar o baseline uma trava automatica contra duplicatas, falhas e excesso de `xhr/fetch`/`load`.
  - Higiene de producao aplicada em `QuestionCard`, `ReaderPage`, `PdfViewer` e `AdBanner`, removendo logs de diagnostico e confirmando ausencia de `quick-login`/`debugger` em `src`.
  - Etapa Zustand/TanStack: **Pronta local**; dependencias instaladas, `QueryProvider` ativo, stores por dominio presentes e teste de arquitetura bloqueando retorno de `DataProvider/useData`.
  - Etapa Sanitizacao HTML/Markdown/IA: **Pronta local** no recorte atual; landings publicas continuam textuais, removem markup executavel, bloqueiam canonical sensivel/protocolo relativo por teste, JSON-LD escapa caracteres perigosos e arquitetura bloqueia novo `dangerouslySetInnerHTML` sem sanitizer conhecido.
  - Etapa Hydration/graficos: **Pronta local parcial**; arquitetura agora bloqueia import direto de `ResponsiveContainer` fora do wrapper estavel, mantendo a protecao contra warning `width(-1)/height(-1)`.
  - Etapa SEO publico/privado: **Pronta local parcial**; sitemap/robots ganharam teste de alinhamento e landings com slugs reservados/prefixos sensiveis deixam de ser indexadas.
  - Etapa Preflight local: **Pronta local**; `npm run check:production-local` executa encoding, typecheck, hard-refresh budget e suites criticas de arquitetura/SEO/XSS/charts/Headers-CSP, com `--with-build` opcional para release.
  - Etapa Headers/CSP: **Pronta local parcial**; CSP do frontend remove `unsafe-eval` em producao, preserva Google/reCAPTCHA/Stripe e o runbook passou a exigir `npm run check:production-local -- --with-build` antes do deploy.
  - Etapa UX/Runtime nativo: **Pronta local**; `ProfilePage` e `QuestionCard` deixaram de usar `window.confirm`/`alert`, e a arquitetura agora bloqueia retorno desses dialogos nativos no runtime.
  - Etapa Banners customizados/XSS: **Pronta local**; `AdBanner` nao executa mais scripts vindos do banco, renderiza conteudo customizado saneado e a arquitetura bloqueia retorno dessa execucao arbitraria.
  - Etapa Editor rico/XSS: **Pronta local**; `RichTextEditor` saneia entrada/saida, bloqueia colagem HTML e arquitetura impede retorno de editor rico emitindo HTML cru.
  - Etapa Superficie publica API/CORS: **Pronta local parcial**; preflight bloqueia artefatos operacionais ampliados em `api/` e CORS agora ramifica producao explicitamente para nao aceitar origens locais.
  - `/dashboard` passou a adiar o fetch de `users/answers.php` para pos-primeiro-paint (janela de `4s` + idle), mantendo o painel leve no hard refresh inicial.
  - `/practice` passou a adiar o fetch de `users/answers.php` para pos-primeiro-paint (janela de `3.2s`), mantendo carga imediata apenas para o caso de `Excluir Respondidas`.
  - `/practice` removeu `users/notes.php` do primeiro paint e passou a carregar notas sob demanda no clique em `Anotar`.
  - `QuestionCard` recebeu pre-load assíncrono de notas com mini-loading no botão para feedback de clique.
  - Baseline consolidado atualizado (`docs/reports/artifacts/hard-refresh-baseline-latest.json`):
    - `/dashboard`: `DCL=323ms`, `load=587ms`, `xhr/fetch=3`
    - `/practice`: `DCL=285ms`, `load=512ms`, `xhr/fetch=4`
    - `/admin/panel/dashboard`: `DCL=348ms`, `load=689ms`, `xhr/fetch=3`
    - `/admin/support/comments`: `DCL=338ms`, `load=816ms`, `xhr/fetch=4` (`comments_moderation` 1x)
  - `shared/auth/AuthLogger.php` ganhou deduplicacao curta de eventos ruidosos (`access_token_rejected`, `refresh_reuse_detected`, `refresh_reuse_recovered`) com configuracao por env.
  - Prova local: 5 requests inválidas seguidas para `api/auth/me.php` geraram 1 linha `access_token_rejected` no `error.log`.
  - `support/comments` recebeu estabilizacao adicional: `AdminCommentsModerationSection` usa chave de query primitiva + cache curto e `AdminSupportSection` separa contagem de pendentes em query dedicada (desligada quando a secao de comentarios esta ativa), reduzindo risco de rajada de `comments_moderation.php` em navegacao interna.
  - `Layout` passou a respeitar `currentUser.photoUrl` nos avatares globais (sidebar mobile e menu de perfil desktop), corrigindo o efeito de "foto atualizada com sucesso" sem refletir fora da pagina de perfil.
  - `QuestionCard` e `QuestionPublicPage` receberam ajuste de badge `Inedita/Anulada/Desatualizada` com alinhamento central consistente (`inline-flex`, `min-height`, `leading-none`) e raio reduzido para manter o padrao visual.
  - `SimulationPage` removeu o botao flutuante fixo de sair da tela cheia; a acao agora fica integrada aos blocos de comando da tela (resultado/revisao e barra principal), alinhando UX ao fluxo pedido.
  - `RankingPage` removeu o `confirm()` nativo na exclusao e migrou para `useConfirm` (modal padrao), reduzindo inconsistencias de UX em acao destrutiva.
  - `PerformanceSubjectsPage` passou a usar fallback oficial por `statistics.subjectBreakdown` (mesmo contrato do dashboard), evitando falso "sem dados por materia" quando respostas locais ainda nao foram hidratadas.
  - `ProfilePage` removeu o bloco legado/oculto da aba de depoimentos (`false && activeTab === 'testimonial'`), mantendo apenas o fluxo oficial por modal para "Avaliar plataforma".
  - `CommentsSection` passou a abrir modal de denuncia com `motivo + detalhes` antes de enviar report de comentario, alinhando o fluxo ao padrao de report de questoes.
  - `src/app/page.tsx` agora redireciona no servidor links canonicos de auth com token (`reset-password`/`confirm-email`) recebidos na raiz, evitando flash de home/landing antes de abrir a tela correta.
  - `normalizeCareerSelectorLabel` foi simplificado para exibir apenas o foco pai (`Controle e Gestao`), removendo o destrinchamento com subgrupos no seletor de foco de estudo.
  - `DashboardPage` passou a exibir `Media/dia` no card de Tempo de Estudos, calculada a partir do total acumulado e janela de dias de estudo efetivos.
  - `notificationService` deixou de converter o alias `admin` para `u-admin`; agora preserva os aliases oficiais (`admin`/`all`) para o backend resolver destinatarios, evitando violacao de FK e `401` em `notificationsSend`.
  - `CommentsService` backend passou a classificar comentario automaticamente (`approved`/`pending`/`spam`) com heuristica anti-spam e envia itens suspeitos para moderacao, em vez de aprovar tudo por padrao.
  - `src/app/page.tsx` ampliou compatibilidade de tokens legados de auth (`verificationToken`, `confirmation_token`, `passwordResetToken`, etc.) para redirecionar corretamente para `/confirm-email` ou `/reset-password` sem cair na home.
  - `npm run check:production-local` foi reexecutado com sucesso apos os ajustes desta rodada (encoding, typecheck, budget de hard refresh e suites criticas).
  - **Observacao 42 (Modelos de e-mail): Pronta local.** Nova secao `Modelos de e-mail` no painel admin (com acao em massa + modal de edicao), catalogo central de templates (`auth`, suporte, denuncias, transacoes, assinatura e campanhas automaticas), validacao backend dedicada e consumo dinamico dos templates nos principais envios de auth/suporte/transacoes/assinaturas/campanhas. O modal de edicao envia teste do modelo especifico, com rascunho atual e placeholders de exemplo, via endpoint admin `test_email_template`; `EmailTemplatesCatalogParityTest.php` trava paridade do catalogo frontend/backend.
  - **Observacao 19 (feedback admin no padrao WordPress): Pronta local.** `AdminFeedback` foi reformulado para list table com filtros horizontais, contadores de fila e expansao de conversa por linha, preservando status/replies sem cards pesados.
  - **Observacao 40 (logs completos): Pronta local.** `LogViewer` manteve destaque de repeticoes e agora explicita modo de exibicao (`Todas as linhas` vs `So repetidos`) para evitar leitura parcial da fila.
  - **Observacao 32 (Google sem conta precisa dados pessoais): Pronta local.** Login com Google agora tenta autenticacao sem auto-criar conta; quando a conta nao existe, a UI abre etapa dedicada de Dados Pessoais, sem senha/formulario tradicional, exige `nome + telefone` para concluir cadastro e o backend exige/salva esses dados na criacao social. Validado por `SocialAuthProfileCompletionWiringTest.php`, `GoogleAuthWiringTest.php` e ESLint direcionado em `Auth.tsx`.
  - **Observacao 34 (Facebook login/cadastro): Pronta local.** Fluxo social completo foi adicionado no frontend (`Auth.tsx`) e backend (`api/auth/facebook.php`, `modules/auth/*`), incluindo configuracao no admin (`facebookAuthAppId`/`facebookAuthAppSecret`), suporte de CSP, validacao de token por `debug_token`, rejeicao de `app_id` divergente, etapa obrigatoria de Dados Pessoais antes de criar usuario e exemplos de env.
  - **Observacao 35 (Apple login/cadastro): Pronta local.** Fluxo social completo foi adicionado no frontend (`Auth.tsx`) e backend (`api/auth/apple.php`, `modules/auth/*`), incluindo configuracao no admin (`appleAuthClientId`/`appleAuthRedirectUri`), suporte de CSP, validacao de assinatura/claims (`aud`, `iss`, expiracao e e-mail verificado), etapa obrigatoria de Dados Pessoais antes de criar usuario e exemplos de env.
  - **Observacao 2 (ativacao por e-mail): Pronta local.** A normalizacao de auth/reset foi centralizada em `canonicalAuthRedirect`, aplicada em middleware + rota raiz + aliases server-side (`/activate`, `/activation`, `/verify-email`, `/confirm`, `/recover`, `/forgot-password`, `/reset`), com teste dedicado (`canonicalAuthRedirect.test.ts`) para garantir compatibilidade legado/canonico.
  - **Observacao 26 (badge de materiais pendentes): Pronta local.** `AdminStats` agora expoe `pending_materials_count`, e o menu lateral do admin mostra badge em `Marketplace > Materiais` quando houver itens aguardando aprovacao.
  - **Observacao 29 (CRON_SECRET): Pronta local parcial.** `.env` local recebeu segredo forte e o `production_preflight` passou nos checks de segredo; faltam apenas os ajustes de ambiente publico (APP_ENV production, APP_URL HTTPS, CORS sem localhost e usuario DB dedicado).
  - **Financeiro/planos (configuracao admin): Pronta local parcial.** A aba `Configuracao de Planos` deixou de exibir o catalogo bruto de todos os registros da tabela `plans`; voltou ao padrao dos 4 planos oficiais e adicionou um quinto card operacional somente para o plano teste, com valor, ativo/desativado e duracao em dias. O backend administrativo agora garante a existencia do plano teste padrao quando a tabela de planos esta disponivel. A API publica de planos e o checkout passaram a respeitar `active/is_active`, e `StripeSubscriptionBillingTermTest` cobre explicitamente o ciclo de 2 dias para impedir fallback mensal.
  - **Financeiro/reembolso imediato: Pronta local parcial.** Reembolso de assinatura agora encerra o acesso local como cancelamento imediato (`cancel_at_period_end=0`, periodo atual/provedor fechado em `NOW()` e snapshot de proxima renovacao limpo), incluindo fluxo administrativo, fluxo de transacoes, webhook `charge.refunded` e limpeza de assinaturas Stripe incompletas. Teste `TransactionsRefundImmediateCancellationWiringTest` trava a semantica para evitar regressao.
  - **Financeiro/renovacao vigente: Pronta local parcial.** Alteracoes no catalogo operacional de planos agora disparam `syncStripeRenewalProjectionsAfterPricingChange`, garantindo que preco/duracao atualizados tambem atualizem as proximas renovacoes Stripe. A tela de assinatura do perfil passou a exibir data e hora em renovacao, fim de ciclo e modal de cancelamento. Teste `AdminPlanCatalogRenewalSyncWiringTest` cobre o wiring.
- Falta para fechar a etapa:
  - Repetir baseline em staging/VPS com latência real.
  - Validar monitoramento/alerta com novo nível de verbosidade de auth no ambiente final.

## Atualizacao incremental (`2026-05-07`)

- Etapa "Coordenar bootstrap e leituras quentes": **Pronta local parcial** nesta rodada (staging/VPS ainda pendente).
- Concluido agora:
  - `scripts/checks/hard-refresh-baseline.mjs` passou a registrar, por rota, `failedRequests` e `xhrFetchSummary` (top endpoints XHR/fetch), alem de diagnosticar melhor o resultado da chamada de login.
  - Baseline local revalidado em hard refresh autenticado com **zero duplicatas** e **zero falhas** nas rotas:
    - `/dashboard` (`DCL=291ms`, `load=507ms`, `xhr/fetch=6`)
    - `/practice` (`DCL=296ms`, `load=497ms`, `xhr/fetch=10`)
    - `/admin/panel/dashboard` (`DCL=346ms`, `load=584ms`, `xhr/fetch=7`)
    - `/admin/support/comments` (`DCL=297ms`, `load=556ms`, `xhr/fetch=6`)
  - Rodada mais recente apos reduzir leituras de progresso na pratica:
    - `/dashboard` (`DCL=230ms`, `load=455ms`, `xhr/fetch=6`)
    - `/practice` (`DCL=247ms`, `load=456ms`, `xhr/fetch=8`)
    - `/admin/panel/dashboard` (`DCL=317ms`, `load=645ms`, `xhr/fetch=7`)
    - `/admin/support/comments` (`DCL=303ms`, `load=627ms`, `xhr/fetch=6`)
  - Bootstrap de auth passou a resolver usuario no proprio `refresh.php` (sob demanda no bootstrap), removendo `auth/me.php` do hard refresh autenticado.
  - Rodada apos otimizar bootstrap de auth:
    - `/dashboard` (`DCL=144ms`, `load=310ms`, `xhr/fetch=5`)
    - `/practice` (`DCL=140ms`, `load=283ms`, `xhr/fetch=7`)
    - `/admin/panel/dashboard` (`DCL=176ms`, `load=399ms`, `xhr/fetch=6`)
    - `/admin/support/comments` (`DCL=177ms`, `load=374ms`, `xhr/fetch=5`)
  - `NotificationsProvider` passou a adiar o primeiro fetch de notificacoes para pos-primeiro-paint; o polling e o refresh por foco continuam ativos.
  - `AdminDashboard` passou a adiar o carregamento de "Feedback recente"; `admin/feedback.php` saiu do primeiro paint do `panel/dashboard`.
  - Normalizacao de encoding aplicada nos fluxos de importacao/edicao de questoes e em `/practice`; `npm run check:text-encoding` ficou verde novamente.
  - `production_preflight.php` reexecutado (ambiente local): falhas esperadas de producao permaneceram para `APP_ENV`, `APP_URL`, CORS publico, segredos fortes e usuario DB dedicado.
  - `production_log_audit.php` reexecutado: sem bloqueio critico nesta rodada, mas com repeticao alta de logs informativos de auth.
  - `production_smoke.php` reexecutado com sucesso apos as mudancas de bootstrap/encoding.
  - Rodada apos defer de notificacoes no bootstrap:
    - `/dashboard` (`DCL=135ms`, `load=296ms`, `xhr/fetch=4`)
    - `/practice` (`DCL=174ms`, `load=302ms`, `xhr/fetch=6`)
    - `/admin/panel/dashboard` (`DCL=175ms`, `load=395ms`, `xhr/fetch=5`)
    - `/admin/support/comments` (`DCL=167ms`, `load=371ms`, `xhr/fetch=4`)
  - Validacao consolidada da rodada (mesma execucao em 4 rotas):
    - `/dashboard` (`DCL=127ms`, `load=297ms`, `xhr/fetch=4`)
    - `/practice` (`DCL=126ms`, `load=272ms`, `xhr/fetch=6`)
    - `/admin/panel/dashboard` (`DCL=184ms`, `load=436ms`, `xhr/fetch=4`)
    - `/admin/support/comments` (`DCL=232ms`, `load=465ms`, `xhr/fetch=4`)
  - Evidencia local: `docs/reports/artifacts/hard-refresh-baseline-latest.json`.
  - `panel/dashboard` deixou de disparar `reportsList` no primeiro paint (contador de denuncias abertas vem de `dashboardAnalytics.counts.reports_count`), reduzindo uma chamada XHR/fetch no baseline admin.
  - `useAdminPageController` agora inicia a aba/secao diretamente pela rota atual; isso remove montagem transitória de `panel/dashboard` em outras rotas do admin e evita chamadas extras como `analytics_dashboard` fora de contexto.
- Falta para fechar a etapa:
  - Repetir a mesma medicao em staging/VPS (build de producao + proxy real) e comparar com latencia/rede fora do ambiente local.

## Atualizacao incremental (`2026-05-05`)

- Etapa "Coordenar bootstrap e leituras quentes": **Parcialmente pronta** nesta rodada.
- Concluido agora:
  - Guarda anti-loop na moderacao de comentarios (mesmo filtro/pagina nao dispara reload repetido).
  - Prefetch de contagem pendente em suporte desacoplado de callback instavel.
  - Link hash-legado de login em comentarios trocado para rota real (`/auth`).
  - Coalescencia curta para `materialsList` e `transactions/list` no dominio de marketplace.
  - Polling de notificacoes ajustado para focar apenas quando a aba estiver visivel.
  - Bootstrap de settings bloqueia leitura publica transitoria quando a sessao autenticada ainda esta se resolvendo.
  - `question-bank` e `user-progress` aguardam `authIsLoading=false` antes de buscar dados, evitando fetch cedo em contexto indefinido.
  - `StudyTrackerBridge` passou a deduplicar sincronizacao de `statistics/user` por usuario/escopo.
  - Notificacoes best-effort nao tentam envio com token ausente/vencido, reduzindo 401 no console/log.
  - Recaptcha backend aceita apenas em localhost o par oficial de chaves de teste do Google, evitando bloqueio indevido no desenvolvimento.
  - `AppConfigProvider` carrega configuracoes admin somente em rotas `/admin`, reduzindo payload inicial fora do painel quando o usuario logado e admin.
  - `StudyTrackerBridge` aplicou TTL de sincronizacao de estatisticas persistidas, amortecendo refetch entre dashboard e estudo.
  - `MarketplaceProvider` passou a recalcular transacoes por `userId`/privilegio estavel em vez de depender do objeto completo de usuario.
  - `MarketplaceProvider` deixou de fazer preload de materiais/transacoes em toda rota `/admin`; agora carrega apenas em `/admin/marketplace` e `/admin/finance`.
  - `useAdminPageController` passou a preload condicional por dominio (users/taxonomias/rankings), em vez de carregar todos os datasets do admin no bootstrap de qualquer aba.
  - `useAdminPageController` consolidou contadores de suporte (`feedback`, `pending_comments`, `refund_requests`) em uma unica chamada `adminService.getStats`, removendo chamadas paralelas de `getFeedbackThreads` e `getModerationComments` no bootstrap.
  - `useAdminPageController` passou a buscar `reports` apenas quando a aba inicial exige (`panel`/`support`), reduzindo carga em acessos diretos a `operation`, `finance` e `marketing`.
  - `adminService.getReports` ganhou coalescencia curta para amortecer remounts/strict mode no painel.
  - Confirmacoes destrutivas no admin migraram para o modal oficial (`useConfirm`) em Lei Comentada, Logs e exclusao de Prova, removendo `window.confirm` nesses fluxos.
  - Suite `adminArchitecture.test.ts` foi alinhada ao roteamento atual (Next providers) e voltou a passar com a regra de bloquear `window.confirm` no admin preservada.
- Falta para fechar a etapa:
  - Revalidar em staging/VPS o baseline de requests em hard refresh (`/dashboard`, `/practice`, `/admin`) e registrar metricas finais do ambiente real.

## Atualizacao incremental (`2026-05-09`)

- Etapa "Operacao financeira e consistencia de UI administrativa": **Parcialmente pronta** nesta rodada.
- Concluido agora:
  - Painel financeiro passou a detalhar `cobranca em risco` com lista nominal (usuario, email, sinal e ultimo evento), incluindo segmentos de `payment_failed` e `subscriber_at_risk`, fechando o gap operacional de investigacao.
  - Grade de questões, página pública da questão, prática, dashboard, suporte e edição admin receberam revisão de copy (acentuação/rótulos/estados vazios), reduzindo inconsistências de escrita em `questão/questões/publicação`, `Inédita`, `Órgão`, `Múltipla escolha`, `denúncia`, `comentário` e `histórico`.
  - Border-radius global foi consolidado: `PLATFORM_SURFACE_CARD_CLASS` passou a `rounded-2xl` e os tokens grandes `rounded-3xl`, `rounded-[2rem]` e `rounded-[2.5rem]` foram removidos de `src/app` e `src/components/shared`, deixando as telas no padrão visual mais contido adotado em questões/simulados.
  - Limpeza objetiva de arquivos removíveis foi fechada: os logs webpack locais ainda bloqueados (`.tmp-dev3000-webpack-err.log` e `.tmp-dev3000-webpack-out.log`) foram removidos, o dev server foi religado na porta `3000` e o relatório de candidatos passou a registrar que não há candidato imediato pendente.
  - Confirmacoes da lixeira de notificacoes permanecem no modal padrao da plataforma (`useConfirm`) para limpar/excluir permanente, mantendo consistencia do fluxo.
  - Validacao de regra do upgrade manual: o backend administrativo ja cria assinaturas com `payment_provider='manual_admin'`, `auto_renew=0` e `cancel_at_period_end=1`, evitando cobranca automatica direta.
  - Links legados de autenticacao passaram a ter redirecionamento canonico no servidor (`src/proxy.ts`) para `reset-password`/`confirm-email`, reduzindo o flash de home em links antigos.
  - Perfil detalhado do usuario no admin recebeu aba `Relacionamento` com feedback/sugestoes/avaliacoes e denuncias (backend + frontend), com atalhos para as filas de suporte e moderacao.
  - Fallback de cupom default foi removido e o merge de settings passou a preservar o estado salvo pelo admin quando o backend responde parcialmente (`src/state/app-config/systemSettings.ts` + `src/state/app-config/__tests__/systemSettings.test.ts`), evitando reaparecimento de cupom removido e perda silenciosa de cupons existentes.
  - Operacao ganhou secao `Crawler Gran` com entrada oficial no admin para o script legado de importacao (`src/app/admin/components/import/AdminGranCrawlerSection.tsx`), incluindo URL de worker e checklist operacional.
  - Configuracoes gerais removeram o bloco duplicado de homepage e o componente legado foi excluido (`src/app/admin/components/settings/AdminLandingContentSection.tsx`), reduzindo ruido na aba `Geral`.
  - Criado relatorio de descarte seguro (`docs/reports/production-removal-candidates-latest.md`) com candidatos imediatos e itens que exigem validacao antes de exclusao.
  - Checkout passou a consumir os metodos de pagamento ativos do painel em tempo real (`enabled + checkoutSupported`) e selecionar fluxo por metodo:
  - Upgrade manual admin deixou de ser apenas uma assinatura local marcada como manual: `manual_admin` agora e provider nao cobravel oficial, a assinatura Stripe anterior e cancelada remotamente antes da concessao gratuita e o perfil deixa de rotular essa concessao como Stripe.
  - Dias acrescidos pelo admin tambem seguem a mesma regra gratuita: quando havia assinatura Stripe ativa, o remoto e cancelado, a linha local vira `manual_admin`, `auto_renew` fica desligado, `provider_subscription_id` e projecoes de renovacao sao limpas, e o periodo concedido passa a ser o unico acesso futuro sem nova cobranca.
  - O calculo de duracao manual passou a respeitar `day` e `week`, alem de `month` e `year`, fechando o risco de plano teste de 2 dias virar ciclo mensal por upgrade/concessao administrativa.
  - Painel de vendedores do marketplace passou a usar a mesma normalizacao da consolidacao em tabela e modal (`authorId`, `author_id`, `sellerId`, `seller_id`), evitando vendedor com contador correto e produtos ausentes nos detalhes; `adminMarketplaceMetrics.test.ts` cobre o fluxo e entrou no preflight local.
  - Preflight de producao passou a bloquear DB persistente e timeout de banco fora da janela 1-10s, alem dos checks ja existentes para `CRON_SECRET`, `APP_ENV`, `APP_URL`, CORS e usuario MySQL nao-root. Tambem foi adicionado `.env.production.example` para guiar a VPS sem valores de XAMPP/localhost.
    - `cartao`: fluxo interno Stripe (Elements) quando configurado.
    - `pix/boleto/wallets`: fluxo hospedado da Stripe com `payment_method_id` explicito.
  - Backend de assinatura Stripe (`SubscriptionsService`) agora valida compatibilidade por metodo (checkout ativo + recorrencia) e monta `payment_method_types` de forma coerente por metodo selecionado.
  - Painel admin de metodos Stripe ganhou controles operacionais para `checkoutSupported` e `recurringSupported`, fechando o gap de configuracao que impedia exibicao real de metodos no checkout.
  - **Observacao 31 (seguranca/admin): Pronta local.** Nova operacao de IPs suspeitos no admin (`admin/security_ips.php`) com score/sinais de risco, ban/unban manual, persistencia em `security_ip_bans` e enforcement real de bloqueio por IP no auth/middleware (`IpBanGuard`).
- Falta para fechar a etapa:
  - Validacao visual/E2E em staging para confirmar textos revisados em todas as telas do admin (nao apenas questoes).
  - Homologar com dados reais de producao sandbox que o bloco de risco financeiro cobre todos os casos de falha reportados pelo time.

## P0 - Antes de qualquer producao publica

| Item | Impacto | Arquivos provaveis | Criterio de aceite | Testes |
| --- | --- | --- | --- | --- |
| Homologar checkout e webhook Stripe na VPS/staging | Sem isso pode vender sem liberar acesso ou perder cobranca/reembolso no dominio final | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/*`, `C:/xampp/htdocs/questao-pro-backend/modules/payments/*`, `C:/xampp/htdocs/questao-pro-backend/modules/transactions/*`, `C:/xampp/htdocs/questao-pro-backend/config/stripe.php`, `C:/xampp/htdocs/questao-pro-backend/config/gamification_helper.php`, `C:/xampp/htdocs/questao-pro-backend/api/subscriptions/stripe_webhook.php`, `src/app/checkout/CheckoutPage.tsx` | Local pronto: suite E2E Stripe em modo teste `GO` (`7 OK`) e checklist de renovacao `GO` (`22 OK`); runtime/admin/preflight rejeitam chaves Stripe invalidas, mistura test/live e SDK/autoload legado de Mercado Pago; endpoint canonico/alias, config publica, verify-payment autenticado, redirects Stripe Connect seguros, material_id textual, notificacoes e gamificacao de compra/reembolso estao cobertos. Webhook valido grava heartbeat privado e o preflight reprova go-live sem `STRIPE_WEBHOOK_HEALTH_RECENT`. Staging/producao: repetir checkout, webhook `invoice.paid`, `past_due`, renovacao, cancelamento e reembolso no dominio final | `npm run check:billing-e2e`, Matriz Stripe sandbox + logs, `StripeConfigurationWiringTest.php`, `AdminSettingsValidatorStripeTest.php`, `SubscriptionsCheckoutWiringTest.php`, `ProductionPreflightWiringTest.php`, `ProductionPreflightBehaviorTest.php`, `PaymentsModuleWiringTest.php`, `MarketplaceNotificationsWiringTest.php`, `MarketplaceGamificationWiringTest.php`, `PaymentsReturnUrlValidatorTest.php` |
| Controlar conexoes MySQL e concorrencia de cron | Evita `Too many connections` e queda geral | `config/database.php`, `config/cron_lock.php`, `config/production_preflight.php`, `scripts/tasks/production_smoke.php`, `scripts/tasks/reconcile_stripe_subscriptions.php`, endpoints de cron, crontab/VPS | Local pronto: cron critico valida segredo, usa lock antes do banco, tarefa CLI da reconciliacao Stripe roda sem usuario logado, acao admin `run_now` reutiliza o mesmo lock, endpoints Mercado Pago descontinuados respondem `410` sem abrir MySQL, grava log/heartbeat privado em `storage/logs/subscriptions`, preflight reprova heartbeat ausente/velho e smoke abriu 3 conexoes com uso baixo. Producao: sem pico de conexoes em 30 min de carga moderada e `Painel > Saude do billing`/preflight sem `stale` | `SubscriptionsCronWiringTest.php`, `SubscriptionsCheckoutWiringTest.php`, `SubscriptionsPlanSyncWiringTest.php`, `PaymentsModuleWiringTest.php`, `ProductionPreflightWiringTest.php`, `ProductionPreflightBehaviorTest.php`, `ProductionSmokeWiringTest.php`, smoke VPS e carga com log MySQL |
| Validar schema marketplace em staging | Evita compra/material/rating/gamificacao quebrados em banco criado do zero ou legado | `database/schema.sql`, `config/payment_provider.php`, `config/gamification_helper.php`, `modules/materials/repositories/MaterialsRepository.php`, `scripts/migrations/migrate_marketplace_schema_compatibility.php` | Local pronto: bootstrap usa `transactions.id` auto_increment, `transactions.user_id`, `material_id` textual, ratings/notas compativeis e ledger `user_gamification_events`; script CLI verificou o banco local. Producao: rodar migration e conferir `DESCRIBE transactions`, `material_ratings`, `user_notes`, `user_gamification_events` | `MarketplaceSchemaCompatibilityWiringTest.php`, `MarketplaceGamificationWiringTest.php`, script `migrate_marketplace_schema_compatibility.php`, smoke compra/rating/reputacao |
| Validar segredos e CORS de producao | Evita exposicao de API/admin, cookie/header incorreto e login quebrado | `.env`, `.env.example`, `.htaccess`, `config/cors.php`, `config/env.php`, `scripts/tasks/production_preflight.php`, `scripts/tasks/production_smoke.php`, `scripts/tasks/production_readiness_suite.php`, VPS | Local pronto parcial: preflight reprova `APP_ENV` diferente de `production`, `APP_URL` local, CORS invalido/HTTP/wildcard, reset DB habilitado, segredos fracos, Stripe/Google malformados, SDK/autoload legado de Mercado Pago, `BACKUP_DIR` dentro da raiz publica, `storage/backups/legacy-code`, artefatos operacionais em `api/` e backups/logs/dumps na raiz do backend; `.htaccess` bloqueia acesso direto a diretorios internos e downloads de backups/dumps. Smoke externo ganhou modo autenticado/admin obrigatorio por `SMOKE_AUTH_*` e `SMOKE_ADMIN_REQUIRED`, validando `/auth/login.php`, `/auth/me.php`, `/notifications/list.php`, `/admin/stats.php?period=today`, `/admin/settings.php` e `/admin/comments_moderation.php`. A nova suite `production_readiness_suite.php` consolida preflight, smoke, logs recentes e restore rehearsal em um JSON unico para staging/producao. Producao: rodar a suite na VPS com dominio real | `BackendRootCleanupWiringTest.php`, `ProductionPreflightWiringTest.php`, `ProductionPreflightBehaviorTest.php`, `ProductionSmokeWiringTest.php`, `ProductionReadinessSuiteWiringTest.php`, `ApiResidualSurfaceWiringTest.php`, preflight de producao + smoke externo autenticado/admin |
| Backup/restore de banco | Sem restore testado nao ha plano real de rollback | `C:/xampp/htdocs/questao-pro-backend/scripts/tasks/backup_mysql.php`, `C:/xampp/htdocs/questao-pro-backend/scripts/tasks/verify_mysql_backup.php`, `C:/xampp/htdocs/questao-pro-backend/scripts/tasks/restore_mysql_backup.php`, `C:/xampp/htdocs/questao-pro-backend/scripts/tasks/backup_restore_rehearsal.php`, `C:/xampp/htdocs/questao-pro-backend/config/production_preflight.php`, VPS, MySQL | Local pronto: dump com checksum, verificador, retencao, heartbeat operacional e restore dry-run seguro; ensaio `backup_restore_rehearsal.php` valida o ultimo backup pelo heartbeat/diretorio e roda o restore oficial em dry-run; script bloqueia banco atual e dumps destrutivos; preflight exige `BACKUP_DIR` existente/gravavel fora de `htdocs`, `MYSQLDUMP_PATH` e `MYSQL_PATH` disponiveis, `MYSQL_BACKUP_HEALTH_RECENT` com dump/checksum presentes, e bloqueia backups historicos de codigo em `storage/backups/legacy-code`. Producao: restore em banco temporario e smoke documentados | `BackupMysqlWiringTest.php`, `ProductionPreflightWiringTest.php`, `ProductionPreflightBehaviorTest.php`, `backup_restore_rehearsal.php`, ensaio de restore real em staging/VPS |
| Validar headers de seguranca no proxy | Evita clickjacking, MIME sniffing e relaxamento acidental de CSP/HSTS | `next.config.ts`, `src/config/securityHeaders.ts`, `config/security_headers.php`, `config/production_preflight.php`, Nginx/Apache VPS | Local pronto parcial: frontend/API aplicam headers, CSP do frontend remove `unsafe-eval` em producao e preflight exige deploy em `production` com dominio publico e CORS HTTPS. Producao: proxy HTTPS preserva/nao duplica headers e HSTS ativo | `SecurityHeadersWiringTest.php`, `src/config/__tests__/securityHeaders.test.ts`, `ProductionPreflightBehaviorTest.php` + smoke externo de headers |
| Validar uploads no servidor final | Evita webshell, HTML/JS publico e arquivos corrompidos servidos como confiaveis | `shared/security/UploadSecurity.php`, validators de materials/questions/users, `uploads/.htaccess`, Nginx/Apache VPS | Local pronto: MIME/tamanho/extensao/conteudo validados e Apache bloqueia scripts em `/uploads`. Producao: regra equivalente no servidor final | `UploadSecurityWiringTest.php` + tentativa controlada de upload proibido |
| Manter reset administrativo de banco bloqueado | Evita perda total de dados por acao acidental ou painel comprometido | `modules/admin/services/AdminDatabaseMaintenanceService.php`, `config/production_preflight.php`, `.env` | Local pronto: `APP_ENV=production` forca guarda de producao, reset fica desativado por padrao e preflight falha se estiver habilitado. Producao: usar apenas em janela fechada com backup validado e confirmacao forte | `AdminDatabaseResetProductionGuardTest.php`, `ProductionPreflightBehaviorTest.php` |

## P1 - Necessario para release controlado

Nota de progresso (`2026-05-16`): alem dos dominios ja listados na linha de lint, ranking publico, checkout, comentarios compartilhados, privacidade, Lei Comentada publica, landing de planos, rotas publicas secundarias, layout global e testes de servicos passaram em ESLint direcionado com `--max-warnings=0`. Snapshot agregado atual: `npm run lint` e `npx eslint src --format json` com `0` errors e `0` warnings; `npm run check:production-local -- --with-build` passou com build Next 16/Turbopack.

| Item | Impacto | Arquivos provaveis | Criterio de aceite | Testes |
| --- | --- | --- | --- | --- |
| Reduzir avisos de lint por dominio | Reduz risco de regressao sem bloquear o release web por divida herdada | `src/app/*`, `src/services/*`, `mobile/src/*` em trilha separada | Pronto local no frontend: dominios de admin, pratica, questoes, checkout, perfil, marketplace, notificacoes, simulados, Lei Comentada, marketing, servicos e testes de `src/services` foram saneados, e `src/app/admin/components --max-warnings=0` passou inteiro. O lint raiz agora passa com `0` errors e `0` warnings; falta apenas repetir em staging/build e tratar a trilha mobile separadamente, caso ela entre no release | `npm run lint`, `npm run typecheck`, `npm run check:production-local` |
| Motor de notificacoes e gamificacao | Evita eventos sem aviso/XP/badge | `modules/notifications/*`, `modules/questions/*`, `modules/comments/*`, `modules/users/*`, `modules/subscriptions/*`, `modules/transactions/*`, `modules/payments/*`, `modules/rankings/*`, `modules/marketing_automation/*`, `config/gamification_helper.php`, `src/providers/NotificationsProvider.tsx` | Parcial pronto: comentarios moderados, curtidas sociais, feedback/suporte, denuncia resolvida com recompensa quando aceita, rankings com participacao/resultado oficial, campanhas automaticas, compra/reembolso de materiais com XP/reputacao/badges, streaks, badges, `past_due` Stripe e reembolso pendente. Auth agora faz pre-refresh antes de requests autenticadas e o backend tolera rotacao concorrente muito proxima do refresh token, reduzindo `token_expired`/`refresh_reuse_detected` recorrentes. Falta motor geral de outbox e provar webhooks/rankings reais | `FeedbackModuleWiringTest.php`, `ReportsModuleWiringTest.php`, `SocialGamificationWiringTest.php`, `RankingsModuleWiringTest.php`, `MarketingAutomationWiringTest.php`, `SubscriptionsNotificationsWiringTest.php`, `MarketplaceNotificationsWiringTest.php`, `MarketplaceGamificationWiringTest.php`, testes PHP por evento + smoke UI |
| Coordenar bootstrap e leituras quentes | Evita rajada de hard refresh e sobrecarga desnecessaria na VPS | `src/providers/NotificationsProvider.tsx`, `src/providers/MarketplaceProvider.tsx`, `src/providers/StudyTrackerProvider.tsx`, `src/providers/NextRouteFrame.tsx`, `src/providers/QueryProvider.tsx`, `src/state/query/queryClient.ts`, `src/services/api/requestCoalescer.ts`, `src/services/admin/adminService.ts`, `src/services/plans/planService.ts`, `src/services/marketing/homeTestimonials.ts`, `src/services/progress/userProgressService.ts`, `src/services/comments/commentsService.ts`, `src/services/questions/questionService.ts`, `src/services/statistics/statisticsService.ts`, `src/services/dashboard/dailyMotivationContentService.ts`, `src/app/dashboard/DashboardPage.tsx`, `src/app/admin/components/dashboard/AdminDashboard.tsx`, `src/app/admin/components/shared/useAdminPageController.tsx`, `src/components/shared/layout/Layout.tsx`, `src/components/shared/layout/DashboardSidebar.tsx`, `src/components/shared/layout/PublicBrandLink.tsx`, `src/app/profile/ProfilePage.tsx`, `src/services/billing/cardsService.ts`, `scripts/checks/hard-refresh-baseline.mjs` | Pronto local parcial: bootstrap legado foi removido, notificacoes ganharam provider dedicado com cache/polling controlado, o Query Client passou a singleton no browser (evita refetch duplicado em remount de desenvolvimento), o fluxo de restauracao forcada de rota via `sessionStorage` saiu do `NextRouteFrame` para evitar flash da landing em hard refresh, e settings/planos deixaram de gerar URLs unicas com `?_=${Date.now()}`. O bootstrap de questoes saiu do modo global para modo por rota/necessidade, `MarketplaceProvider` so carrega materials/transacoes nas areas que usam marketplace, `statistics/user`/`answers.php`/comentarios usam coalescencia mais longa, e o dashboard nao puxa mais `questionsList` no hard refresh; `subjectBreakdown` substitui o banco inteiro de questoes, `motivacoes-diarias.md` foi cacheado tambem em `localStorage` (TTL) e respostas/motivacao diaria foram movidas para carga em baixa prioridade. No admin, `panel/dashboard` deixou de prefetchar `reportsList` no primeiro paint e passou a usar `reports_count` do analytics, `admin/settings.php` saiu do bootstrap imediato em `/admin/panel/*`, e `support/comments` migrou para query estavel com cache/invalidacao. O primeiro fetch de notificacoes foi adiado para pos-primeiro-paint (sem quebrar polling/foco), reduzindo mais uma chamada no bootstrap. Baseline local (`docs/reports/artifacts/hard-refresh-baseline-latest.json`) registrou zero duplicatas e zero falhas em `/dashboard`, `/practice`, `/admin/panel/dashboard` e `/admin/support/comments`, com `xhr/fetch` em `3/4/3/4`. Falta repetir a medicao em staging/VPS | `npm run build`, `npx tsc --noEmit`, `node scripts/checks/hard-refresh-baseline.mjs`, inspecao de Network em browser, smoke de `/`, `/dashboard`, `/practice`, `/profile` e `/question/[id]` |
| Migrar state global para stores especializados | Reduz acoplamento, rerender desnecessario e complexidade operacional do legado | `package.json`, `src/providers/AppProviders.tsx`, `src/providers/QueryProvider.tsx`, `src/providers/AppConfigProvider.tsx`, `src/providers/NotificationsProvider.tsx`, `src/state/query/*`, `src/state/app-config/*`, `src/state/user-progress/*`, `src/state/notifications/*`, `src/state/question-bank/*`, `src/state/admin-data/*` | Pronto local: fundacao com `zustand` + `@tanstack/react-query` criada, dominios `systemSettings`, `userProgress`, `notifications`, `questionBank` e `admin-data` migrados, `useData()` removido de runtime (0 consumidores) e `src/providers/DataProvider.tsx` excluido. Fluxos principais de admin/practice/profile/marketplace foram religados aos stores e `typecheck` + `build` seguem verdes | `npm run build`, `npx tsc --noEmit`, smoke de settings/admin/perfil/practice/notificacoes |
| Sanitizar HTML/Markdown/IA | Evita XSS em landing pages, analises e comentarios | `src/services/questions/questionHtmlSanitizer.ts`, `src/services/marketing/landingPages.ts`, `src/app/question/QuestionPublicPage.tsx`, `src/components/shared/math/MathRichText.tsx`, renderizadores de markdown/HTML, `AdminLandingPagesManager`, questoes/lei comentada | Pronto local: questoes/comentarios bloqueiam scripts/handlers/URLs perigosas; landings limpam markup textual e canonical inseguro, incluindo protocolo relativo e rotas sensiveis; JSON-LD publico escapa caracteres perigosos; arquitetura bloqueia novo `dangerouslySetInnerHTML` sem sanitizer conhecido. HTML bruto futuro deve nascer como feature separada com sandbox/review server-side | `questionHtmlSanitizer.test.ts`, `landingPages.test.ts`, `adminArchitecture.test.ts`, smoke visual |
| Provar Google login | Login social esta no produto e precisa funcionar | `src/config/googleAuth.ts`, `src/app/auth/components/Auth.tsx`, `modules/auth/services/AuthService.php`, env Google, Google Cloud Console | Local pronto: frontend valida Client ID, evita script invalido, trata falha de carregamento do script Google, login/cadastro/reset usam reCAPTCHA v3 invisivel com validacao backend por `action`/`score`, o backend rejeita Client ID malformado/audiencia divergente e conta Google inexistente so cria usuario depois de etapa dedicada com nome + telefone. Settings publicas agora zeram `recaptchaSiteKey` quando o captcha estiver desligado/incompleto, evitando reativacao acidental do fluxo. Producao: Client ID real autorizado, backend com o mesmo `GOOGLE_CLIENT_ID`, cadastro e login funcionando em staging | `src/config/__tests__/googleAuth.test.ts`, `GoogleAuthWiringTest.php`, `SocialAuthProfileCompletionWiringTest.php`, `npm run typecheck`, smoke OAuth Google |
| Smoke de settings publicas/admin | Evita vazamento de configuracao sensivel e garante que o admin continue vendo status de integracoes | `modules/settings/routes.php`, `modules/admin/routes.php`, `modules/admin/services/AdminSettingsService.php`, `scripts/tasks/production_smoke.php`, `src/services/admin/adminService.ts`, `src/providers/AppConfigProvider.tsx` | Local pronto: rota publica usa sempre projecao saneada; rota admin exige admin/staff; frontend escolhe endpoint por role; smoke falha se `api/settings.php` expuser chaves sensiveis e agora cobre tambem as rotas web publicas principais. Producao: `api/settings.php` anonimo/logado nao retorna segredos/flags privadas e `api/admin/settings.php` bloqueia usuario comum | `AdminSettingsWiringTest.php`, `SettingsModuleWiringTest.php`, `ProductionSmokeWiringTest.php`, `src/services/admin/__tests__/adminService.test.ts`, smoke HTTP |
| Fechar suporte e badges de pendencia | Admin e aluno precisam cair exatamente onde ha acao | `src/app/admin/config/adminPageNavigationConfig.ts`, `src/app/admin/components/shared/useAdminPageController.tsx`, `src/app/support/page.tsx`, admin support | Local pronto parcial: clique no menu principal Suporte abre a primeira fila acionavel com pendencia (`comments`, `reports`, `feedback`, `refunds`); resposta admin cria notificacao para o aluno e `/support?threadId=...` abre a conversa correta. Producao: validar no painel real que cada notificacao/badge abre o item certo | `src/services/admin/__tests__/adminRouting.test.ts`, `FeedbackModuleWiringTest.php`, `ReportsModuleWiringTest.php`, `npx eslint src/app/support/page.tsx`, smoke feedback/denuncia/comentario/reembolso |
| Smoke de depoimentos aprovados na home | Evita publicar depoimento incompleto e garante prova social real sem perder fallback comercial | `modules/feedback/*`, `modules/admin/repositories/AdminFeedbackRepository.php`, `api/feedback/testimonials.php`, `src/services/marketing/homeTestimonials.ts`, `src/app/landing/components/LandingCommercialPage.tsx`, `src/app/profile/ProfilePage.tsx` | Local pronto parcial: avaliacao exige nome publico/contexto, admin publica somente com `resolved` + dados completos e home usa mocks quando nao ha aprovados. Producao: enviar avaliacao real, aprovar no painel e validar home/cache; ao voltar status, depoimento sai da home | `FeedbackValidatorTest.php`, `FeedbackTestimonialsWiringTest.php`, `src/services/marketing/__tests__/homeTestimonials.test.ts`, `src/services/profile/__tests__/profileService.test.ts`, smoke admin/home |
| Observabilidade de logs | Diagnostico de incidentes | `modules/admin/services/AdminSystemLogAnalyzer.php`, `scripts/tasks/production_log_audit.php`, `modules/subscriptions/services/SubscriptionsService.php`, `src/app/admin/components/panel/AdminPanelSection.tsx`, `LogViewer`, Apache/PHP/MySQL, runbook | Local pronto: logs categorizados, repeticoes calculadas, scanner CLI com janela recente (`LOG_AUDIT_SINCE_MINUTES`/`--since-minutes`), cron de assinaturas fora de `api/`, heartbeat privado de reconciliacao Stripe e heartbeat privado de webhook Stripe visiveis no admin. Producao: rotacao, retencao, alerta real, cron sem `stale` e webhook recente configurados | `ProductionLogAuditWiringTest.php`, `SubscriptionsCronWiringTest.php`, `ProductionPreflightWiringTest.php`, `ProductionPreflightBehaviorTest.php`, teste de download/limpeza, webhook e cron na VPS |
| Calibrar rate limiting de endpoints sensiveis | Evita brute force, spam, abuso de upload e flooding de analytics sem bloquear usuarios legitimos | `shared/middleware/RateLimiter.php`, `.env`, `modules/auth/routes.php`, `modules/comments/routes.php`, `modules/feedback/routes.php`, `modules/reports/routes.php`, `modules/analytics/routes.php`, `modules/*/routes.php` de upload, proxy/VPS | Local pronto: perfis aplicados em auth, suporte, comentarios, denuncias, uploads e analytics. Producao: limites calibrados em staging, `RATE_LIMIT_DIR` gravavel e proxy headers confiaveis somente por opt-in | `RateLimiterHardeningWiringTest.php`, `ProductionPreflightWiringTest.php`, smoke de 429 e fluxo normal |
| Blindar analytics first-party | Evita que visitante/aluno forje eventos de outro usuario ou envie payload grande demais | `modules/analytics/routes.php`, `modules/analytics/services/AnalyticsTrackingService.php`, `modules/analytics/validators/AnalyticsTrackingValidator.php` | Local pronto: evento autenticado usa usuario da sessao, evento anonimo ignora `userId` do cliente, `metadata`/`externalHooks` tem limite e endpoint tem rate limit 120/min. Producao: comparar funil real com logs e ajustar limites | `AnalyticsTrackingSecurityTest.php`, `RateLimiterHardeningWiringTest.php`, smoke de campanha/landing |
| Modelos de e-mail editaveis (Observacao 42) | Permite ajustar copy/assunto sem deploy e padroniza comunicacao transacional | `src/app/admin/components/settings/AdminEmailTemplatesSection.tsx`, `src/constants/email/defaultEmailTemplates.ts`, `src/state/app-config/systemSettings.ts`, `modules/admin/controllers/AdminSettingsController.php`, `modules/admin/routes.php`, `modules/admin/validators/AdminSettingsValidator.php`, `modules/admin/services/AdminSettingsService.php`, `shared/utils/EmailTemplateResolver.php`, `shared/utils/MailConfiguration.php`, `shared/utils/Mailer.php`, `config/production_preflight.php`, `modules/auth/services/AuthService.php`, `modules/admin/services/AdminUserCommunicationService.php`, `modules/transactions/services/TransactionsService.php`, `modules/subscriptions/services/SubscriptionsBillingSupport.php`, `modules/subscriptions/services/SubscriptionsService.php`, `modules/marketing_automation/services/MarketingAutomationService.php` | Local pronto: admin consegue editar/salvar templates com validacao de chave/corpo, usar placeholders e enviar teste de um modelo especifico pelo modal usando o rascunho atual; envios de auth/suporte/transacoes/assinaturas/campanhas respeitam configuracao do painel com fallback seguro; envio real usa resolvedor unico de SMTP do painel + `.env`; preflight reprova producao sem SMTP, remetente valido ou templates essenciais ativos; catalogo frontend/backend fica travado por paridade. Producao: validar alteracao real no painel e confirmar recebimento em SMTP real para cada familia | `php -l` nos modulos alterados, `AdminSettingsWiringTest.php`, `EmailTemplatesCatalogParityTest.php`, `MarketingAutomationWiringTest.php`, `ProductionPreflightWiringTest.php`, `ProductionPreflightBehaviorTest.php`, `npm run typecheck`, `npx eslint src/app/admin/components/settings/AdminEmailTemplatesSection.tsx src/app/admin/components/settings/AdminSettings.tsx src/services/admin/adminService.ts --max-warnings=0`, smoke manual de envio real |
| Smoke do cronograma Elite em staging | Recurso elite ja nao depende so de localStorage, mas precisa prova real com auth e modulo | `modules/study_schedule/*`, `api/study-schedule/*`, `src/app/cronograma/page.tsx`, `src/services/study-schedule/*` | Local pronto: backend persiste por usuario, UI migra localStorage e bloqueia no servidor. Producao: usuario Elite cria, salva, recarrega em outro navegador e apaga o plano | `StudyScheduleModuleWiringTest.php`, typecheck, smoke usuario Elite |
| Testar questao anulada e inedita | Evita resposta indevida e erro de exibicao | `src/services/questions/questionFlags.ts`, `question/[id]`, `practice/page.tsx`, question service | Local pronto: flags `"0"`/`"false"` nao geram falso bloqueio, anulada bloqueia resposta e inedita exibe badge nas superficies principais. Staging: validar fixture real anulada/inedita | `src/services/questions/__tests__/questionFlags.test.ts` + smoke com fixtures |

## Contagem atual de etapas restantes (`2026-05-30`)

- **0 P0 de codigo local conhecido** neste recorte. O codigo local esta pronto para iniciar homologacao controlada.
- **12 macroetapas restantes para go-live publico**, todas dependentes de VPS/staging, dominios reais ou servicos externos:
  1. VPS/staging com `.env` real e `production_preflight.php` verde.
  2. HTTPS/proxy/CORS/headers finais validados fora do localhost.
  3. Smoke externo anonimo, autenticado e admin com `SMOKE_AUTH_REQUIRED=true` e `SMOKE_ADMIN_REQUIRED=true`.
  4. SMTP real e envio de modelos essenciais de e-mail.
  5. OAuth Google/Facebook/Apple e reCAPTCHA reais.
  6. Stripe checkout, webhook publico, renovacao, `past_due`, cancelamento e reembolso no dominio final.
  7. Cron Stripe/reconciliacao rodando sem depender de usuario logado e com heartbeat recente.
  8. Backup real, ensaio `backup_restore_rehearsal.php`, restore em banco temporario e smoke apontado ao banco restaurado.
  9. Logs/retencao/logrotate/alerta real com `production_log_audit.php --since-minutes`.
  10. Teste de carga moderada, conexoes MySQL e calibragem de rate limiting.
  11. Smoke browser do build real: dashboard, practice, perfil, admin, Lei Comentada, checkout e console sem erros criticos.
  12. SEO externo: sitemap/robots/canonicals/OG no dominio final e Search Console.

## P2 - Pos-lancamento ou antes de escalar marketing

| Item | Impacto | Arquivos provaveis | Criterio de aceite | Testes |
| --- | --- | --- | --- | --- |
| Search Console e SEO externo | Melhora descoberta organica | `src/config/siteUrl.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/services/seo/sitemapData.ts`, `src/services/marketing/landingPageSeo.ts`, metadados | Local pronto: `NEXT_PUBLIC_CANONICAL_URL` alimenta canonical/sitemap/robots, cronograma Elite esta em `noindex`, sitemap dinamico filtra conteudo nao publico/pendente, landings publicadas tem metadata server-side e landings customizadas publicadas entram no sitemap somente quando o slug nao e reservado/sensivel. Producao: sitemap aceito, paginas indexaveis sem erro, OG/canonicals no dominio final | `src/config/__tests__/siteUrl.test.ts`, `src/services/seo/__tests__/privateSeo.test.ts`, `src/services/marketing/__tests__/landingPageSeo.test.ts`, GSC + Lighthouse |
| Campanhas automaticas por segmento | Marketing operacional | `AdminMarketing`, `modules/marketing_automation/*`, `scripts/tasks/process_marketing_automations.php`, `analytics_lifecycle_events`, `notifications`, SMTP | Local pronto parcial: regras salvas no painel agora podem ser executadas por cron CLI com dry-run, lock, log idempotente e CTA absoluto somente HTTPS. Producao: validar campanha ativa com usuarios elegiveis, SMTP real, notificacao in-app, duplicidade bloqueada e links seguros | `MarketingAutomationWiringTest.php`, dry-run CLI, smoke com campanha controlada |
| Avaliar migracao Stripe Connect Accounts v2 para vendedores | Evita limitar marketplace futuro quando vendedor tambem precisar pagar/receber pela plataforma | `C:/xampp/htdocs/questao-pro-backend/modules/payments/services/PaymentsService.php`, `C:/xampp/htdocs/questao-pro-backend/modules/payments/repositories/PaymentsRepository.php`, `users.stripe_account_id`, painel de vendedores, webhooks Connect, Stripe Dashboard | Billing de aluno permanece em `Customer/Subscription`. A migracao so deve cobrir vendedores/marketplace se a decisao de produto exigir conta conectada configuravel como comerciante/beneficiario/cliente. Producao: documentar decisao, criar sandbox v2, mapear KYC/payouts/webhooks e provar onboarding + compra + reembolso | Spike tecnico com Stripe sandbox, smoke Connect, testes de retorno seguro, compra/reembolso marketplace |
| Smoke de promocao publica por slug | Evita indexacao de campanha errada e links antigos mostrando oferta ativa | `src/services/marketing/promotionCampaign.ts`, `src/services/marketing/promotionSeo.ts`, `src/app/promo/[slug]/page.tsx`, `src/app/promo/PromoPage.tsx` | Local pronto: slug invalido/inativo/modulo desligado nao indexa e nao exibe campanha. Producao: campanha real publicada abre somente no slug correto com canonical esperado | `src/services/marketing/__tests__/promotionCampaign.test.ts`, `src/services/marketing/__tests__/promotionSeo.test.ts`, smoke browser |
| Smoke de URLs configuraveis de campanha | Evita CTA quebrado ou link perigoso em banners/notificacoes | `src/services/marketing/promotionCampaign.ts`, `src/providers/AppConfigProvider.tsx`, `src/app/admin/components/finance/AdminMarketing.tsx`, `src/components/shared/feedback/PromoBanner.tsx` | Local pronto: URLs perigosas caem em fallback seguro e `/pricing` legado foi removido. Producao: admin cria banner/notificacao e usuario abre destino correto | `src/services/marketing/__tests__/promotionCampaign.test.ts`, smoke admin |
| Relatorios executivos | Operacao diaria | Admin dashboard/analytics | Vendas, suporte, moderacao e funil em visao unica | Smoke admin |
| Testes E2E Playwright | Previne regressao visual/fluxo | `tests/e2e` futuro | Login, responder questao, checkout sandbox e admin basico cobertos | CI E2E |
| Preflight local consolidado | Evita release manual sem checklist tecnico minimo | `scripts/checks/production-readiness-local.mjs`, `package.json` | Pronto local: comando `npm run check:production-local` passou fora do sandbox, cobrindo encoding, typecheck, budget e suites criticas. `--with-build` inclui build completo | Rodar antes de cada deploy e no CI |
| Smoke de hydration e graficos no build real | Evita warnings, remontagens e graficos sem dimensao em rotas criticas | `src/components/PageTransition.tsx`, `src/providers/NextRouteFrame.tsx`, `src/providers/ThemeProvider.tsx`, `src/components/shared/charts/StableResponsiveContainer.tsx`, `src/app/landing/components/ThemeOrnaments.tsx`, `src/app/practice/page.tsx`, `src/services/offers/useLimitedOfferCountdown.ts`, rotas `/`, `/auth`, `/question/[id]`, `/dashboard`, `/profile`, `/bank-analysis`, `/practice` | Local parcial: testes SSR do `PageTransition`, dos ornamentos sazonais e do wrapper de graficos passam; `PageTransition` agora entrega shell estavel no SSR, `ThemeProvider` deixou de derivar tema do navegador na primeira renderizacao, `ThemeOrnaments` deixou de usar `Math.random()` no render e pratica nao usa `Date.now()` no estado inicial. Arquitetura bloqueia import direto de `ResponsiveContainer` do Recharts fora do wrapper estavel. Producao/staging: confirmar console do browser limpo apos restart do servidor e sem warning Recharts `width(-1)`/`height(-1)` em desktop/mobile | Build + smoke browser com console limpo |
| Limpeza de textos mojibake no backend legado | Qualidade de manutencao | `C:/xampp/htdocs/questao-pro-backend/**/*.php` | Comentarios/mensagens normalizados em UTF-8 | Script de encoding no backend |



