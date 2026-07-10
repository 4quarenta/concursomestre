# Fase 01 — Arquitetura e auditoria de confirmação

**Data:** 10 de julho de 2026
**Branch/checkpoint:** `4quarenta/auditoria-fase-01-arquitetura`
**Escopo:** confirmar a arquitetura atual e os riscos do pacote privado de auditoria. Esta fase não altera comportamento de produto, banco, endpoints ou produção.

## 1. Resultado executivo

O ConcursoMestre é uma plataforma híbrida: Next.js/React no frontend, API PHP modular, MySQL/MariaDB, um serviço FastAPI/PyMuPDF para extração de provas e aplicativo Expo/React Native. Em produção, Nginx faz o roteamento para o Next.js, PHP-FPM e o extrator Python.

Quatro riscos **P0** do relatório privado permanecem confirmados diretamente no código atual:

1. a API de respostas de questão confia no campo `is_correct` enviado pelo navegador;
2. o DTO público de questão devolve o gabarito;
3. a listagem de transações pode aceitar `user_id` sem autenticação obrigatória;
4. o crawler Gran é uma superfície pública que recebe e reutiliza token informado pelo usuário.

O relato histórico de chave Gemini exposta não pôde ser confirmado em arquivo rastreado neste checkout, mas o desenho atual ainda persiste chaves de provedores em `system_settings`. A rotação preventiva das chaves e a migração para segredo de ambiente/gerenciador de segredos continuam necessárias.

Também há um risco operacional confirmado: a VPS possui Nginx, frontend e extrator ativos, porém não há cron/timer de negócio da aplicação visível nos agendamentos auditados. Isso é especialmente sensível para conciliação Stripe, cobranças recorrentes, reservas de cupom, notificações e sincronizações.

## 2. Evidências e limites

### Confirmado nesta fase

- Checkout local no commit `9f47d78` e branch desta fase.
- Estrutura atual do repositório, contratos e módulos PHP/TypeScript/Python.
- Configuração Nginx de produção em modo somente leitura.
- Serviços ativos na VPS: `concursomestre-frontend.service` e `concursomestre-python-extractor.service`.
- Nginx e PHP-FPM ativos; serviço MariaDB ativo. O PHP-FPM escuta em `127.0.0.1:19000` segundo o vhost.
- Ausência de job de negócio da aplicação no crontab/timers consultados; o único crontab de `root` encontrado é a atualização do CloudPanel.
- Achados P0 abaixo, por leitura de código.

### Não confirmado nesta fase

- Dados reais, saldo, assinaturas ou integridade financeira do banco de produção.
- Conteúdo de segredos, tokens, `.env`, certificados e dumps.
- Estado de permissões de cada endpoint em execução; isso será testado com matriz controlada na Fase 2.
- CVEs atuais de dependências; o relatório privado é uma fotografia e deverá ser refeito na Fase 10.
- Correspondência exata entre a cópia do backend no Git e a cópia em `/var/www/concursomestre/backend`; a instalação de produção não retornou um `HEAD` Git verificável.

## 3. Arquitetura real

```text
Navegador / aplicativo Expo
        |
        | HTTPS
        v
Nginx/CloudPanel (concursomestre.com)
  |-- /                 -> Next.js em 127.0.0.1:3000
  |-- /api/*            -> router.php / PHP-FPM em 127.0.0.1:19000
  |-- /uploads,storage  -> arquivos estáticos do backend
  |-- /import-extractor -> FastAPI/PyMuPDF em 127.0.0.1:8010
        |
        +-- API PHP modular
        |     routes -> services -> repositories -> MySQL/MariaDB
        |
        +-- Integrações: Stripe, Mercado Pago legado, Gemini/OpenAI,
        |    Cloudflare, reCAPTCHA/hCaptcha, e-mail, Google/Facebook/Apple
        |
        +-- Processos esperados: webhooks, conciliação, recorrência,
             reserva/uso de cupom, notificações e jobs editoriais
```

### Código-fonte canônico e cópias

| Camada | Fonte canônica no Git | Produção observada | Observação |
| --- | --- | --- | --- |
| Web | `src/` | `/home/concursomestre/htdocs/concursomestre.com/frontend` | Next.js iniciado por systemd em `:3000`. |
| API | `backend/` | Nginx aponta para `/var/www/concursomestre/backend` | O site também contém uma cópia em `htdocs/.../backend`; a duplicidade precisa ser eliminada/explicada na Fase 10. |
| Banco | `backend/database/` e migrations | MySQL/MariaDB externo ao Git | Há DDL em tempo de execução; migrations ainda não são a única fonte de verdade. |
| Extrator | `python-extractor/` | `services/python-extractor` em `:8010` | FastAPI/PyMuPDF com worker único. |
| Mobile | `mobile/` | distribuição Expo | Consome a API central; não deve duplicar regra financeira/editorial. |

### Roteamento em produção

- A URL canônica de API é `/api/`, compatível com `src/services/api/baseUrl.ts`.
- O vhost mantém uma rota legada `/questao-pro-backend/` para o mesmo backend. Isso é dívida técnica e amplia a superfície pública.
- `/.htaccess` do repositório não governa o Nginx/CloudPanel; regras equivalentes precisam viver em vhost/infra versionada.
- `/setup`, `/setup/*` e `/api/setup/install.php` são explicitamente bloqueados por Nginx na VPS, o que é correto. O endpoint continua presente no código e deve ser retirado/isolado na Fase 2.

## 4. Inventário funcional e dependências

| Domínio | Frontend principal | API PHP | Serviço/repositório | Dados principais |
| --- | --- | --- | --- | --- |
| Autenticação | `src/app/auth`, `src/services/auth` | `/api/auth/*` | `modules/auth` | users, sessões, tokens, OAuth, 2FA |
| Questões | `src/app/questions`, `src/app/practice` | `/api/questions/*` | `modules/questions` | questions, answers, `data_json`, filtros e grupos |
| Banco de provas/importação | admin/import e admin/exams | `/api/exams/*`, `/api/questions/exam_*` | `modules/exams`, Python extractor | provas, arquivos, extrações, taxonomias e rascunhos |
| Lei Comentada | `src/app/lei-comentada` | `/api/legal-commentary/*` | `modules/legal_commentary` | laws, artigos, comentários, favoritos, progresso |
| Assinaturas/checkout | checkout, profile/billing | `/api/subscriptions/*`, `/api/payments/*` | `modules/subscriptions`, `modules/transactions` | `user_subscriptions`, invoices, transações, cupons, reservas |
| Financeiro admin | admin/finance | `/api/transactions/*`, `/api/admin/analytics_finance.php` | transactions/subscriptions/admin | transações, reembolsos, projeções e Stripe |
| Suporte/moderação | profile/support, admin/support | feedback, reports, comments, notifications | feedback/comments/reports/notifications | tickets, denúncias, respostas, notificações |
| Marketplace | marketplace, materiais | `/api/materials/*` | `modules/materials` | materiais, avaliações, downloads e moderação |
| Estudo/estatísticas | dashboard, cronograma | statistics, study-schedule, rankings | statistics/study_schedule/rankings | sessões, respostas, XP, rankings |
| IA | geradores e administração | `/api/ai/generate.php` e fluxos específicos | `modules/ai`, settings | configurações de provedor, logs e conteúdo gerado |

## 5. Inventário de entradas HTTP públicas

O inventário mecânico atual encontrou **231 arquivos PHP** sob `backend/api/`. Nem todos são endpoints: `middleware/` e `utils/` são bibliotecas, e `tasks/ProcessRewards.php` precisa ser tratado como job interno. Todo arquivo PHP roteável em `api/` deve ser considerado público até que a configuração Nginx e uma matriz de autorização provem o contrário.

### Catálogo por família de rota

| Família | Entradas roteáveis identificadas |
| --- | --- |
| Administração | `admin/analytics_*`, `cache.php`, `comments_moderation*`, `feedback.php`, `list_tables.php`, `logs.php`, `plans.php`, `report_*`, `reset_db.php`, `security_ips.php`, `settings.php`, `stats.php`, `user_*` |
| Autenticação | `auth/apple.php`, `confirm-email.php`, `enable_2fa.php`, `facebook.php`, `forgot-password.php`, `google.php`, `login.php`, `logout.php`, `me.php`, `refresh.php`, `register.php`, `resend-confirmation.php`, `reset-password.php`, `setup_2fa.php`, `verify_2fa.php` |
| Questões e provas | `questions/{answer,bulk_import,create,delete,edit,editorial-feedback,exam_import,exam-files,filter,get_stats,groups,history,list,reset_answers,save,show,toggle_save,update}.php`; `exams/{delete,extraction_*,file_*,files,list,save,show}.php` |
| Lei Comentada | `legal-commentary/{comment,cron_sync_updates,detail,favorite,list,progress}.php` e `legal-commentary/admin/{batch-*,catalog,delete,detail,generate,import,list,save,sync,sync-all,updates}.php` |
| Pagamentos e assinaturas | `payments/{config,create-connect-account,create-preference,get-installments,process-payment,verify-payment,webhook}.php`; `subscriptions/{automation_helper,cancel,cancel_refund,create,create_stripe_*,cron_*,finalize_stripe_subscription,process_payment,stripe_*,sync_*,undo_cancel,update_renewal,validate_coupon,webhook*}.php` |
| Financeiro | `transactions/{approve_refund,create,list,refund,reject_refund}.php` |
| Usuários | `users/{answers,change_password,comments,create_stripe_setup_intent,delete,delete_note,level_leaderboard,list,list_cards,materials,notes,profile,remove_card,remove_photo,save_card,set_default_card,sync_stripe_card,update,upload_photo}.php` |
| Conteúdo/social | `comments/{handle,list,list_cached}.php`, `feedback/{create,list,testimonials,vote}.php`, `reports/{handle,list}.php`, `notifications/*`, `materials/*`, `rankings/*`, `simulations/*` |
| Filtros e estatísticas | `filters/{delete,list,save}.php`, `statistics/{banca_info,install,platform,question,study-session,user,xray}.php`, `study-schedule/*` |
| Sistema/legado | `analytics/track.php`, `cache/manage.php`, `changelog/list.php`, `plans/list.php`, `settings.php`, `system/logs.php`, `upload.php`, `setup/{install,status}.php`, `rankings/install.php`, `rankings/migrate.php`, `statistics/install.php` |

### Entradas que exigem prioridade na Fase 2

- Endpoints administrativos, instalação/migração/reset, cron HTTP e ferramentas de teste não devem depender de mera ocultação no frontend.
- `subscriptions/cron_*`, `legal-commentary/cron_sync_updates.php` e webhooks precisam de autenticação própria de job/assinatura, idempotência e rota não navegável por usuários.
- As entradas de crawler em `backend/scripts/importers/questions/gran/` também precisam entrar no inventário de exposição; não estão dentro de `api/`, mas são liberadas pela configuração legada do Apache.

## 6. Fluxos críticos confirmados

### Autenticação e autorização

1. Frontend usa cliente API central e mecanismo de refresh.
2. Ainda existem chamadas diretas a `fetch`/`apiClient` fora da camada de serviço, inclusive em layout, detalhes de questão, importador e integrações. Isso fragmenta tratamento de 401, telemetria e contratos.
3. A proteção visual de `/admin` não substitui verificação de papel no servidor. `src/app/admin/layout.tsx` não faz guarda de servidor; toda rota administrativa deve ser protegida pela API na Fase 2.

### Resposta de questão

1. O navegador envia uma resposta para `/api/questions/answer.php`.
2. `QuestionsValidator::validateAnswerPayload` aceita `is_correct`/`isCorrect` no payload.
3. `QuestionsService::submitAnswer` usa esse mesmo valor para `is_correct` e XP.

**Conclusão:** P0 confirmado. A correção deve buscar gabarito no servidor por `question_id`, validar modalidade/resposta e só então calcular resultado/XP.

### Exposição de gabarito

`QuestionsService::normalizeQuestionRow` inclui `resposta`, `correctOptionIndex` e conteúdo de `data_json` na serialização de questão. Sem DTO de aluno separado do DTO editorial, o usuário pode receber a resposta antes de resolver.

**Conclusão:** P0 confirmado. A Fase 4 deverá estabelecer DTO público, DTO pós-resposta e DTO admin.

### Transações e reembolsos

`/api/transactions/list.php` chama `verifyAuthenticatedUserPayload(false)`. Na ausência de usuário autenticado, a rota aceita `user_id` de query string.

**Conclusão:** P0 confirmado. A consulta deve exigir identidade autenticada, ignorar `user_id` para aluno e liberar escopo amplo só após RBAC explícito.

### Crawler Gran

`AdminGranCrawlerSection.tsx` expõe fluxo que entrega URL do worker e pede token Bearer. `backend/scripts/importers/questions/gran/import_worker.php` recebe e reutiliza esse token em chamadas externas, com redirecionamentos habilitados.

**Conclusão:** P0 confirmado. O fluxo deve ser desligado/colocado atrás de RBAC forte na Fase 4, sem armazenamento ou transporte de token de usuário pelo worker.

### Financeiro, Stripe e renovação

O desenho já tem rotas específicas para Checkout Stripe, portal, webhooks e conciliação. Há também cron HTTP para recorrência, pagamentos programados e reconciliação. O vhost expõe essas rotas, mas o agendamento oficial não está materializado nos crontabs/timers verificados.

**Conclusão:** risco operacional P1 confirmado. A Fase 6 deve criar execução autenticada, observável e idempotente antes de qualquer campanha paga.

## 7. Banco de dados e fonte de verdade

O relatório privado inventariou 85 tabelas, 291 índices e 55 chaves estrangeiras, com grande volume de relações lógicas e JSON textual. O código atual confirma uso de:

- `CREATE TABLE`, `ALTER TABLE`, `SHOW COLUMNS` e `information_schema` em repositórios e serviços;
- `ensurePaymentProviderSchema` no caminho de controllers de transação/assinatura;
- campos JSON/`data_json` convivendo com tabelas relacionais;
- identificadores e colações que merecem auditoria específica.

**Conclusão:** migrations não são a única fonte de verdade e alterações de schema podem ocorrer em requisições HTTP. A Fase 3 deve congelar esse comportamento com migrations versionadas, compatíveis e rollback não destrutivo. Nenhuma migração será executada antes dessa fase.

## 8. Riscos confirmados, descartados e a investigar

| Prioridade | Situação | Risco | Próxima fase |
| --- | --- | --- | --- |
| P0 | Confirmado | Navegador declara resposta correta/XP | 2 e 4 |
| P0 | Confirmado | DTO de questão expõe gabarito | 2 e 4 |
| P0 | Confirmado | IDOR na listagem de transações | 2 e 6 |
| P0 | Confirmado | Crawler aceita/repassa Bearer do usuário | 2 e 4 |
| P0 | Parcialmente confirmado | Segredos persistidos em configurações; vazamento histórico não reproduzido no checkout | 2 |
| P1 | Confirmado | DDL executado durante requisição | 3 |
| P1 | Confirmado | Cron de negócio não materializado/observável na VPS | 6 e 10 |
| P1 | Confirmado | Proteção admin não está centralizada em layout/servidor | 2 |
| P1 | Confirmado | Rota legada `/questao-pro-backend/` ainda exposta | 2 e 10 |
| P1 | A investigar | Divergência entre backend Git, `/var/www` e cópia em `htdocs` | 10 |
| P1 | A investigar | CVEs atuais de npm/composer/pip | 2 e 10 |
| P2 | Confirmado | Grandes módulos concentram regra de domínio e UI | 4, 5, 6, 8 |
| P2 | Confirmado | Requisições diretas fora da camada API | 8 |

## 9. Arquivos grandes e candidatos a divisão

Não são remoções nesta fase. São candidatos para planos de refatoração delimitados, com teste de regressão antes de qualquer alteração:

- `src/app/admin/components/import/useAdminImportWorkflow.ts` — 13.598 linhas;
- `src/app/lei-comentada/[slug]/page.tsx` — 4.778 linhas;
- `src/app/profile/ProfilePage.tsx` — 5.444 linhas;
- `src/app/admin/operation/lei-comentada/[lawId]/edit/page.tsx` — 4.912 linhas;
- `src/app/admin/components/finance/AdminFinance.tsx` — 4.222 linhas;
- `src/app/admin/components/import/AdminImportSection.tsx` — 3.688 linhas;
- `src/app/admin/components/exams/AdminExamEditorPage.tsx` — 3.321 linhas;
- `backend/modules/legal_commentary/repositories/LegalCommentaryRepository.php` — 4.286 linhas;
- `backend/modules/legal_commentary/services/LegalCommentaryAiGenerationService.php` — 3.998 linhas;
- `backend/modules/subscriptions/services/SubscriptionsService.php` — 6.455 linhas;
- `backend/modules/questions/services/QuestionsService.php` — 2.056 linhas;
- `backend/modules/questions/repositories/QuestionsRepository.php` — 2.177 linhas.

Prioridade de divisão: importar/provas (Fase 4), assinaturas (Fase 6), Lei Comentada (Fase 5), depois superfícies frontend (Fase 8). Não fazer “limpeza ampla” antes de contratos e testes estarem estabilizados.

## 10. Baseline de testes

| Comando | Resultado | Classificação |
| --- | --- | --- |
| `npx tsc --noEmit --pretty false` | Passou | Baseline TypeScript verde. |
| `npm run typecheck` | Não concluiu dentro da janela do executor durante `next typegen` | Inconclusivo de ambiente/tempo; repetir em CI ou com timeout maior. |
| `npx vitest run --reporter=dot` | 382 passaram, 7 falharam, 54 arquivos verdes e 4 vermelhos | Há mistura de regressões reais e testes obsoletos. |

Falhas classificadas inicialmente:

- `adminArchitecture.test.ts`: controlador admin acima do limite e `console.log` em `useAdminImportWorkflow.ts` são regressões estruturais reais; a expectativa de texto em `Layout.tsx` precisa ser reconciliada com o contrato de UX atual.
- `landingPageSeo.test.ts`: fallback de campanha diverge de `Plano Elite`; tratar como possível regressão SEO/comercial na Fase 9.
- `questionService.test.ts`: espera contrato legado, enquanto o projeto passou a adotar contrato de questão v2; atualizar somente depois de validar frontend + backend na Fase 8.
- `planAutoCoupon.test.ts`: valores esperados divergem; tratar como risco financeiro real até reconciliação com preço/Stripe na Fase 6.

PHP/composer não estavam disponíveis neste desktop para lint e testes PHP. A Fase 2 deverá executar a suíte PHP no ambiente com `vendor` e extensões compatíveis, sem mascarar falhas por ambiente.

## 11. Plano das próximas fases e checkpoints

| Fase | Objetivo | Dependências |
| --- | --- | --- |
| 02 | Segurança, autenticação e autorização | Fase 1; corrige P0 antes de novas features. |
| 03 | Banco, schema e migrations | Fase 2 para proteger rotas de manutenção. |
| 04 | Questões, provas, importação e crawler | Fases 2 e 3; contratos/DTOs e importação segura. |
| 05 | Lei Comentada | Fases 2 e 3; permissões, dados e geração editorial. |
| 06 | Financeiro, assinaturas e webhooks | Fases 2 e 3; cron, conciliação e valores. |
| 07 | Marketplace e conteúdo de usuários | Fase 2; moderação/ownership. |
| 08 | Frontend, contratos e requisições | Fases 2–7; consolidar contratos estabilizados. |
| 09 | Performance, SEO, sitemap, notificações e integrações | Fase 8; não otimizar contrato instável. |
| 10 | QA, limpeza, documentação e deploy | Todas as anteriores; remover legado e validar release. |

Cada fase terá branch/checkpoint próprio, relatório em `docs/auditoria/`, testes antes/depois, plano de rollback e revisão de segredos. Não haverá migration destrutiva, reset de banco ou deploy automático sem solicitação explícita.

## 12. Critérios de aceite do programa completo

1. Nenhuma operação sensível confia em identidade, preço, gabarito ou privilégio vindos do cliente.
2. DTOs públicos não expõem resposta editorial antes do momento permitido.
3. O schema é modificado apenas por migrations revisadas, idempotentes e com rollback.
4. Webhooks, cron e conciliação são autenticados, idempotentes, monitorados e executados independentemente do login do aluno.
5. Contratos frontend/API, importador, questão e contexto têm testes de integração.
6. Conteúdo de usuário respeita ownership, moderação e deleção consistente.
7. Não há segredo no Git, dump, bundle ou configuração exposta.
8. A arquitetura de deploy tem uma única fonte de publicação, jobs documentados e rollback testado.
9. Typecheck, build e suítes relevantes passam em ambiente reproduzível.

## 13. Arquivos/áreas que não devem ser alterados sem revisão manual

- `backend/config/`, credenciais de provedores e certificados;
- rota e verificadores de webhook Stripe/Mercado Pago;
- handlers de reembolso, cancelamento, upgrade, cupom e renovação;
- migrations e qualquer DDL;
- `router.php`, regras Nginx/CloudPanel e aliases `/api`, `/uploads`, `/storage`;
- `QuestionsService`/`QuestionsRepository` enquanto o DTO v2 não tiver testes de contrato;
- fluxo de deleção de usuário e dados relacionados;
- serviços systemd e paths de produção.

## 14. Rollback e deploy desta fase

Não houve deploy, alteração de configuração ou mudança de comportamento. O único artefato é este relatório. O rollback consiste em reverter o commit documental ou retornar à branch anterior. A próxima fase só começa após revisão/aceite deste checkpoint.
