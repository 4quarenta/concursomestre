# Admin Consolidado

- Consolida auditoria do admin, reorganizacao de navegacao, UX e formalizacao de settings/admin.
- A navegacao oficial continua agrupada em `Painel`, `Operacao`, `Financeiro`, `Suporte` e `Configuracoes`.

## Arquivos absorvidos

- `C:\dev\concursomestre\ADMIN_NAVEGACAO_SIMPLIFICADA.md`
- `C:\dev\concursomestre\ADMIN_REORGANIZADO.md`
- `C:\dev\concursomestre\MAPA_ADMIN_UI.md`
- `C:\dev\concursomestre\docs\admin-audit-report.md`
- `C:\dev\concursomestre\docs\admin-cache-endpoint-formalization.md`
- `C:\dev\concursomestre\docs\admin-legacy-bridge-hardening.md`
- `C:\dev\concursomestre\docs\feedback-reports-email-automation.md`
- `C:\dev\concursomestre\docs\settings-cleanup.md`
- `C:\dev\concursomestre\docs\settings-endpoint-formalization.md`

---

## Fonte absorvida: `C:\dev\concursomestre\ADMIN_NAVEGACAO_SIMPLIFICADA.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Admin Navegacao Simplificada

## Arquitetura final

### Nivel 1

1. Painel
2. Operacao
3. Financeiro
4. Suporte
5. Configuracoes

### Nivel 2

#### Painel

- Dashboard
- Alertas
- Saude do billing

#### Operacao

- Questoes
- Importador
- Filtros
- Usuarios
- Materiais
- Rankings
- Denuncias

#### Financeiro

- Transacoes
- Assinaturas
- Reembolsos
- Planos e cupons
- Automacao

#### Suporte

- Feedback
- Threads

#### Configuracoes

- Geral
- Modulos
- Seguranca
- Integracoes
- Email
- Ads
- Performance
- Logs

## Componentes alterados

- `C:/dev/concursomestre/src/app/admin/components/shared/useAdminPageController.tsx`
- `C:/dev/concursomestre/src/app/admin/components/shared/AdminPageContent.tsx`
- `C:/dev/concursomestre/src/app/admin/components/shared/AdminShellLayout.tsx`
- `C:/dev/concursomestre/src/app/admin/components/shared/AdminPageHeader.tsx`
- `C:/dev/concursomestre/src/app/admin/components/finance/AdminFinance.tsx`
- `C:/dev/concursomestre/src/app/admin/components/settings/LogViewer.tsx`

## Ganhos de UX

- menos tabs concorrentes.
- header por dominio.
- confirmacoes destrutivas centralizadas.
- feedback visual so apos persistencia.
- health do billing concentrado no Painel.
- logs com blur corrigido.

## Compatibilidade preservada

- `page.tsx` continua shell fino.
- deep links por `tab` e `section` continuam.
- services oficiais continuam como camada de acesso.

## Pendencias restantes

- segunda passada visual extra em Financeiro ainda pode melhorar a densidade.
- alguns labels antigos ainda precisam limpeza fina.
- saude do billing em producao real depende do runner E2E continuar sendo executado.

---

## Fonte absorvida: `C:\dev\concursomestre\ADMIN_REORGANIZADO.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

# ADMIN_REORGANIZADO

## Nova arquitetura de tabs e secoes

### Visao Geral

- Dashboard
- KPIs
- alertas operacionais

### Operacao

- Questoes
- Filtros
- Usuarios
- Materiais

### Moderacao

- Rankings
- Denuncias

### Financeiro

- Balance
- Transactions
- Refunds
- Prices
- Marketing
- Automation

### Suporte

- Feedback

### Configuracoes

- General
- Modules
- Security
- Integrations
- Email
- Ads
- Performance

## Componentes criados ou ajustados

- `C:\dev\concursomestre\src\app\admin\components\shared\useAdminPageController.tsx`
- `C:\dev\concursomestre\src\app\admin\components\shared\AdminPageContent.tsx`
- `C:\dev\concursomestre\src\components\shared\layout\DashboardSidebar.tsx`
- `C:\dev\concursomestre\src\app\admin\components\shared\AdminConfirmDialog.tsx`
- `C:\dev\concursomestre\src\app\admin\components\finance\AdminFinance.tsx`
- `C:\dev\concursomestre\src\app\admin\components\settings\AdminSettings.tsx`
- `C:\dev\concursomestre\src\app\admin\page.tsx`

## Areas quebradas em subcomponentes

- shell da pagina separado do controller
- conteudo separado por dominio
- finance e settings passaram a operar por subsecao
- confirmacoes destrutivas centralizadas

## Melhorias de UX

- navegacao agrupada por dominio real
- badges por dominio critico
- confirmacao modal padronizada
- save explicito nas configuracoes
- feedback so apos persistencia
- finance sem CTA visual fake

## Contratos preservados

- `page.tsx` continua shell fino
- telas continuam consumindo services oficiais
- providers globais continuam alimentando datasets compartilhados
- rotas/admin query params continuam funcionando

## Pendencias restantes

- extracao adicional de subcomponentes em `AdminFinance.tsx`: desejavel
- extracao adicional de subcomponentes em `AdminSettings.tsx`: desejavel
- trilha de auditoria admin por acao ainda precisa crescer em alguns dominios fora do financeiro

---

## Fonte absorvida: `C:\dev\concursomestre\MAPA_ADMIN_UI.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

# MAPA ADMIN UI

## Arquitetura proposta

### 1. Visao executiva

- Dashboard
- KPIs
- alertas de billing
- filas de moderacao
- health de webhook / cron

### 2. Operacao

- Questoes
- Importador
- Filtros / taxonomias
- Usuarios
- Materiais

### 3. Moderacao

- Denuncias
- Rankings
- Materiais bloqueados

### 4. Financeiro

- Saldo / repasses
- Transacoes
- Reembolsos
- Planos
- Cupons
- Automacao

### 5. Suporte

- Feedback
- Threads
- SLA interno

### 6. Configuracoes

- Geral
- Modulos
- Seguranca
- Integracoes
- Email
- Ads
- Performance

## Secoes e subareas

- `dashboard`
- `questions`
- `filters`
- `users`
- `materials`
- `rankings`
- `reports`
- `finance`
- `feedback`
- `settings`

## Componentes reutilizaveis

- `AdminShellLayout`
- `AdminPageHeader`
- `AdminConfirmDialog`
- `LogViewer`
- `SortableHeader`
- modais de detalhe
- tabelas com filtros

## Padroes visuais e comportamentais

- dominio claro na sidebar
- confirmacao modal para acao destrutiva
- loading por item
- save explicito para configuracao critica
- badge de fila critica
- texto de erro padronizado

## Problemas atuais

- Finance ainda muito grande
- Settings ainda muito grande
- providers globais ainda entram em fluxos criticos
- parte do admin ainda depende de estados locais derivados
- alguns dominios ficam escondidos dentro de secoes amplas

## Proposta de reorganizacao

1. Sidebar por dominio
2. Header curto com contexto do dominio
3. Subnavegacao interna por secoes locais
4. Tabelas padronizadas
5. Drawer/modal unico para confirmacoes e detalhe

## Plano de migracao

1. Preservar contratos atuais
2. Mover navegacao primeiro
3. Dividir finance em componentes menores
4. Dividir settings em componentes menores
5. Consolidar services por dominio
6. Remover stubs e fluxos locais residuais

---

## Fonte absorvida: `C:\dev\concursomestre\docs\admin-audit-report.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Auditoria do Painel Admin

## Stack auditado
- Frontend: React 19 + Vite + TypeScript
- Backend: PHP procedural com endpoints sob `api/`
- Autenticação: sessão/JWT centralizada + middleware/admin helpers
- Integrações principais do admin: usuários, denúncias, rankings, materiais, transações, configurações e feedback

## Inventario funcional do admin

### 1. Dashboard
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Funcoes:
  - cards de receita, assinaturas, marketplace, usuários, feedback
  - filtros por período
  - navegacao rapida para subareas
- Status antes:
  - funcionando parcialmente
  - dependia de endpoint de stats sem padronizacao forte
- Prioridade:
  - media

### 2. Base de dados / Questões
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Funcoes:
  - listar questões
  - paginar questões
  - criar questão manual
  - editar questão
  - excluir questão
  - importador
- Status antes:
  - funcional, mas com integrações e erros pouco padronizados
- Prioridade:
  - media

### 3. Taxonomias / Filtros
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Funcoes:
  - listar filtros
  - criar filtro
  - editar filtro
  - excluir filtro
- Status antes:
  - salvar funcionava
  - exclusao tinha feedback incorreto na UI e sem trava contra duplicidade
- Prioridade:
  - alta

### 4. Usuários
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Backend:
  - [C:\xampp\htdocs\questão-pro-backend\api\admin\user_details.php](C:\xampp\htdocs\questão-pro-backend\api\admin\user_details.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\admin\user_actions.php](C:\xampp\htdocs\questão-pro-backend\api\admin\user_actions.php)
- Funcoes:
  - listar usuários
  - abrir perfil detalhado
  - atualizar perfil/status/plano
  - ação administrativa sobre usuário
- Status antes:
  - sensivel do ponto de vista de permissao
  - payloads e persistencia inconsistentes
- Prioridade:
  - critica

### 5. Denúncias
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Backend:
  - [C:\xampp\htdocs\questão-pro-backend\api\reports\list.php](C:\xampp\htdocs\questão-pro-backend\api\reports\list.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\admin\report_actions.php](C:\xampp\htdocs\questão-pro-backend\api\admin\report_actions.php)
- Funcoes:
  - listar denúncias
  - abrir moderação contextual
  - resolver/ignorar denúncia
  - notificar usuário afetado
- Status antes:
  - backend incompleto para a ação administrativa
  - resolucao na UI sem trilha auditavel
- Prioridade:
  - critica

### 6. Materiais
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Backend:
  - [C:\xampp\htdocs\questão-pro-backend\api\materials\moderate.php](C:\xampp\htdocs\questão-pro-backend\api\materials\moderate.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\materials\delete.php](C:\xampp\htdocs\questão-pro-backend\api\materials\delete.php)
- Funcoes:
  - listar materiais
  - moderar/aprovar/rejeitar
  - excluir administrativamente
  - abrir visualizacao autenticada
- Status antes:
  - moderação sem trava de submit
  - exclusao sem endpoint administrativo real
  - notificações parcialmente duplicadas entre frontend e backend
- Prioridade:
  - critica

### 7. Rankings
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Backend:
  - [C:\xampp\htdocs\questão-pro-backend\api\rankings\moderate.php](C:\xampp\htdocs\questão-pro-backend\api\rankings\moderate.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\rankings\update.php](C:\xampp\htdocs\questão-pro-backend\api\rankings\update.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\rankings\delete.php](C:\xampp\htdocs\questão-pro-backend\api\rankings\delete.php)
- Funcoes:
  - listar rankings
  - editar ranking
  - excluir ranking
  - moderar status
- Status antes:
  - UI editava localmente
  - endpoints de update/delete não existiam de forma funcional
- Prioridade:
  - alta

### 8. Financeiro
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Funcoes:
  - visao de vendedores
  - transações
  - reembolsos
  - configuração de planos/cupons
  - automacao/cron
- Status antes:
  - tabela de transações tinha ações diretas com stub `loadTransactions`
  - risco de clique repetido em aprovar/rejeitar reembolso
  - alguns estados so refletiam localmente
- Prioridade:
  - critica

### 9. Configurações do sistema
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Backend:
  - [C:\xampp\htdocs\questão-pro-backend\api\settings.php](C:\xampp\htdocs\questão-pro-backend\api\settings.php)
- Funcoes:
  - gateway de pagamento
  - checkout
  - temas/promocoes
  - features flags
  - reCAPTCHA
  - performance/cache
- Status antes:
  - alteracoes eram otimistas e nem sempre persistiam
  - cache usava `fetch` cru, sem auth client e sem feedback consistente
- Prioridade:
  - critica

### 10. Feedback e suporte
- Local:
  - [C:\dev\concursomestre\src\features\admin\components\AdminFeedback.tsx](C:\dev\concursomestre\src\features\admin\components\AdminFeedback.tsx)
- Backend:
  - [C:\xampp\htdocs\questão-pro-backend\api\admin\feedback.php](C:\xampp\htdocs\questão-pro-backend\api\admin\feedback.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\feedback\create.php](C:\xampp\htdocs\questão-pro-backend\api\feedback\create.php)
- Funcoes:
  - listar threads
  - abrir conversa
  - mudar status
  - responder no sistema
  - responder por email
- Status antes:
  - componente antigo, com `alert`, estado compartilhado de reply e comentários TODO
  - endpoint de criacao usava auth legada e permitia reply sem controle de ownership robusto
- Prioridade:
  - critica

## Diagnostico resumido

### Problemas estruturais encontrados
- Endpoints administrativos sem middleware/admin helper unificado.
- Varias ações do admin dependiam de estado local e não persistiam no backend.
- Ausencia de trilha de auditoria em operações criticas.
- Ações destrutivas sem idempotencia/trava de clique.
- Integrações duplicadas entre frontend e backend para notificações.
- Componentes com UX incompleta: erro silencioso, `alert`, sem loading granular, sem drafts por item.

### Causas raiz
- Crescimento organico do admin sem service layer unica.
- Endpoints novos e antigos convivendo com contratos diferentes.
- Logica critica concentrada no frontend em vez do servidor.
- Falta de centralizacao em validação, auth e auditoria.

## Correcoes implementadas

### Backend
- Criado helper administrativo central:
  - [C:\xampp\htdocs\questão-pro-backend\api\utils\AdminSecurity.php](C:\xampp\htdocs\questão-pro-backend\api\utils\AdminSecurity.php)
- Endpoints protegidos/refatorados:
  - [C:\xampp\htdocs\questão-pro-backend\api\settings.php](C:\xampp\htdocs\questão-pro-backend\api\settings.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\cache\manage.php](C:\xampp\htdocs\questão-pro-backend\api\cache\manage.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\admin\stats.php](C:\xampp\htdocs\questão-pro-backend\api\admin\stats.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\admin\list_tables.php](C:\xampp\htdocs\questão-pro-backend\api\admin\list_tables.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\admin\reset_db.php](C:\xampp\htdocs\questão-pro-backend\api\admin\reset_db.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\admin\user_details.php](C:\xampp\htdocs\questão-pro-backend\api\admin\user_details.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\admin\user_actions.php](C:\xampp\htdocs\questão-pro-backend\api\admin\user_actions.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\reports\list.php](C:\xampp\htdocs\questão-pro-backend\api\reports\list.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\filters\save.php](C:\xampp\htdocs\questão-pro-backend\api\filters\save.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\filters\delete.php](C:\xampp\htdocs\questão-pro-backend\api\filters\delete.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\admin\report_actions.php](C:\xampp\htdocs\questão-pro-backend\api\admin\report_actions.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\admin\feedback.php](C:\xampp\htdocs\questão-pro-backend\api\admin\feedback.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\rankings\moderate.php](C:\xampp\htdocs\questão-pro-backend\api\rankings\moderate.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\rankings\update.php](C:\xampp\htdocs\questão-pro-backend\api\rankings\update.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\rankings\delete.php](C:\xampp\htdocs\questão-pro-backend\api\rankings\delete.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\transactions\reject_refund.php](C:\xampp\htdocs\questão-pro-backend\api\transactions\reject_refund.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\materials\moderate.php](C:\xampp\htdocs\questão-pro-backend\api\materials\moderate.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\materials\delete.php](C:\xampp\htdocs\questão-pro-backend\api\materials\delete.php)
  - [C:\xampp\htdocs\questão-pro-backend\api\feedback\create.php](C:\xampp\htdocs\questão-pro-backend\api\feedback\create.php)
- Router ajustado:
  - [C:\xampp\htdocs\questão-pro-backend\router.php](C:\xampp\htdocs\questão-pro-backend\router.php)

### Frontend
- Service layer administrativa criada:
  - [C:\dev\concursomestre\src\features\admin\services\adminService.ts](C:\dev\concursomestre\src\features\admin\services\adminService.ts)
- Persistencia debounced e confiavel das configurações:
  - [C:\dev\concursomestre\context\DataContext.tsx](C:\dev\concursomestre\context\DataContext.tsx)
- Fluxos de moderação e reembolso com trava de clique:
  - [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Feedback admin refeito:
  - [C:\dev\concursomestre\src\features\admin\components\AdminFeedback.tsx](C:\dev\concursomestre\src\features\admin\components\AdminFeedback.tsx)
- Marketplace/admin alinhado para evitar duplicacao de notificações:
  - [C:\dev\concursomestre\context\MarketplaceContext.tsx](C:\dev\concursomestre\context\MarketplaceContext.tsx)

## Segurança

### Vulnerabilidades corrigidas
- Endpoints admin sem verificacao administrativa consistente.
- Ação administrativa de feedback respondendo por endpoint legado.
- Risco de exclusao/moderação sem trilha auditavel.
- Risco de IDOR em replies de feedback.
- Ações destrutivas/financeiras suscetiveis a multiplos cliques.

### Protecoes adicionadas
- `requireAdminSessionContext(...)` nos endpoints criticos do admin.
- `AuthMiddleware::requireAuth()` no endpoint de feedback/reply.
- Audit log para mudancas criticas.
- Notificação server-side em moderação/reembolso.
- Travas de submit e estados de carregamento por ação.

## Testes adicionados

### Frontend
- [C:\dev\concursomestre\src\features\admin\services\__tests__\adminService.test.ts](C:\dev\concursomestre\src\features\admin\services\__tests__\adminService.test.ts)
  - feedback threads
  - feedback replies
  - falha em update de status
  - normalizacao de cache stats

### Backend
- [C:\xampp\htdocs\questão-pro-backend\tests\AdminSecurityWiringTest.php](C:\xampp\htdocs\questão-pro-backend\tests\AdminSecurityWiringTest.php)
  - garante wiring mínimo de auth/admin helpers nos endpoints administrativos endurecidos

## Como validar
- Frontend:
  - `npm run build`
  - `npm run test:admin`
- Backend:
  - `C:\xampp\php\php.exe C:\xampp\htdocs\questão-pro-backend\tests\AdminSecurityWiringTest.php`
  - `C:\xampp\php\php.exe -l <arquivo.php>`

## Pendencias reais
- Ainda vale uma passada futura de observabilidade E2E no admin com navegador para cobrir casos de UX visual e latencia real.
- O painel tem componentes historicos grandes em [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx); a proxima melhoria natural e modularizar por dominio sem alterar contrato funcional.

---

## Fonte absorvida: `C:\dev\concursomestre\docs\admin-cache-endpoint-formalization.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Admin Cache Endpoint Formalization

## Objetivo
Mover o endpoint oficial de gestão de cache para a area administrativa do backend e deixar `api/cache/manage.php` apenas como compatibilidade legada.

## Endpoint oficial
- `C:\xampp\htdocs\questão-pro-backend\api\admin\cache.php`

## Bridge legado
- `C:\xampp\htdocs\questão-pro-backend\api\cache\manage.php`

## Alinhamentos realizados
- frontend passou a usar `admin/cache.php`
- alias `cacheManage` no roteamento legado agora aponta para `api/admin/cache.php`
- `api/cache/manage.php` permanece vivo so como bridge

## Validação executada
- php lint dos endpoints e teste de wiring
- `AdminCacheEndpointWiringTest.php`
- `src/services/admin/__tests__/adminService.test.ts`
- `npm run build`
- smoke `401` em `api/admin/cache.php?action=stats`
- smoke `401` em `api/cache/manage.php?action=stats`
- smoke `200` na home `http://localhost:3000/#/`

---

## Fonte absorvida: `C:\dev\concursomestre\docs\admin-legacy-bridge-hardening.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Admin Legacy Bridge Hardening

## Objetivo
Consolidar `api/admin` como camada de compatibilidade fina para o modulo administrativo oficial.

## Formalizacoes desta rodada
- endpoint oficial de logs em `C:\xampp\htdocs\questão-pro-backend\api\admin\logs.php`
- bridge legado `C:\xampp\htdocs\questão-pro-backend\api\system\logs.php`
- alias legado `settingsUpdate` alinhado para `api/admin/settings.php` em `.htaccess` e `router.php`
- teste estrutural `C:\xampp\htdocs\questão-pro-backend\tests\AdminLegacyBridgesWiringTest.php`

## Estado atual de `api/admin`
Todos os arquivos da pasta delegam para `modules/admin/routes.php` e não concentram regra de negocio.

## Validação executada
- `AdminLogsEndpointWiringTest.php`
- `AdminSettingsWiringTest.php`
- `AdminLegacyBridgesWiringTest.php`
- vitest do admin
- smoke `401` em `api/admin/logs.php`
- smoke `401` em `api/system/logs.php`
- smoke `401` em `api/settingsUpdate`
- home `200`

---

## Fonte absorvida: `C:\dev\concursomestre\docs\feedback-reports-email-automation.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Feedback e Reports: Automacao de Respostas por E-mail

## Objetivo

Esta rodada adiciona envio automático de e-mails quando o admin:

- responde um feedback no painel
- altera o status de um feedback para `read` ou `resolved`
- conclui a moderação de uma denúncia (`report`)

Também foram adicionados atalhos visuais no painel administrativo para acelerar a escrita dessas respostas, sem depender de `mailto:` manual.

## Backend

### Modulo oficial de reports

Arquivos principais:

- `C:\xampp\htdocs\questão-pro-backend\modules\reports\controllers\ReportsController.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\reports\services\ReportsService.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\reports\repositories\ReportsRepository.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\reports\validators\ReportsValidator.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\reports\routes.php`

Bridges legados:

- `C:\xampp\htdocs\questão-pro-backend\api\reports\handle.php`
- `C:\xampp\htdocs\questão-pro-backend\api\reports\list.php`

### Serviço transversal de comunicacao com usuários

Arquivo principal:

- `C:\xampp\htdocs\questão-pro-backend\modules\admin\services\AdminUserCommunicationService.php`

Responsabilidades:

- montar assunto, título e corpo do e-mail para feedbacks
- montar assunto, título e corpo do e-mail para denúncias
- adaptar o texto automaticamente ao tipo do feedback ou do alvo denunciado
- usar a infraestrutura oficial de envio em `Mailer.php`

### Fluxo automático de feedback

Arquivos envolvidos:

- `C:\xampp\htdocs\questão-pro-backend\modules\admin\services\AdminFeedbackService.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\admin\repositories\AdminFeedbackRepository.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\admin\controllers\AdminFeedbackController.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\admin\validators\AdminFeedbackValidator.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\admin\routes.php`

Como funciona:

1. O admin responde a thread em `admin/feedback.php` com `POST`.
2. A resposta e persistida em `user_feedback`.
3. A thread raiz e marcada como `read`.
4. O backend dispara e-mail automático para o usuário.

Tipos de feedback com copy dedicada:

- `bug`
- `suggestion`
- `cancellation`
- `report`
- `support` / fallback

### Fluxo automático de moderação de denúncias

Arquivos envolvidos:

- `C:\xampp\htdocs\questão-pro-backend\modules\admin\services\AdminReportModerationService.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\admin\repositories\AdminReportModerationRepository.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\admin\routes.php`

Como funciona:

1. O admin resolve ou ignora a denúncia.
2. O backend atualiza `reports.status`, `admin_reason`, `evidence_url` e `handled_by`.
3. O sistema cria notificação in-app para o denunciante.
4. O backend envia e-mail automático ao denunciante.

Alvos de denúncia com copy dedicada:

- `question`
- `material`
- `comment`

Decisoes com copy dedicada:

- `resolved`
- `ignored`

## Frontend

### Service oficial

Arquivos principais:

- `C:\dev\concursomestre\src\services\reports\reportsService.ts`
- `C:\dev\concursomestre\src\services\reports\index.ts`
- `C:\dev\concursomestre\src\services\comments\commentsService.ts`
- `C:\dev\concursomestre\src\providers\DataProvider.tsx`

Como funciona:

- `commentsService.reportComment(...)` delega para `reportsService.createReport(...)`
- `DataProvider.reportError(...)` persiste a denúncia no backend oficial
- a listagem administrativa de reports passa a sair da camada oficial de services

### Painel admin: feedback

Arquivo principal:

- `C:\dev\concursomestre\src\components\admin\support\AdminFeedback.tsx`

Melhorias:

- remove dependencia do `mailto:` no fluxo principal
- adiciona respostas sugeridas por tipo
- avisa explicitamente que enviar pelo painel dispara e-mail automático

Presets adicionados:

- `bug`: bug em análise, correcao aplicada, precisamos de contexto
- `suggestion`: sugestao recebida, sugestao aprovada, sugestao em estudo
- `cancellation`: cancelamento em análise, cancelamento orientado, retencao amigavel
- `report`: denúncia recebida, denúncia em validação, precisamos de prova
- `support`: atendimento iniciado, orientacao enviada, aguardando retorno

### Painel admin: reports

Arquivo principal:

- `C:\dev\concursomestre\src\app\admin\page.tsx`

Melhorias:

- rotulo correto para `question`, `material` e `comment`
- botao de ação unificado para abrir a moderação
- presets de justificativa por tipo de alvo denunciado
- resolucao rapida com motivo padrao melhor que `Resolvido via dashboard`

Presets adicionados:

- `question`: questão corrigida, questão mantida, aguardando evidencias
- `material`: material ocultado, material mantido, ajuste solicitado
- `comment`: comentário removido, comentário mantido, comentário em revisao

## Tabelas impactadas

- `user_feedback`
- `reports`
- `users`
- `notifications`

## Validação executada

- `php -l` nos arquivos alterados de `modules/admin` e bridges de `reports`
- `C:\xampp\htdocs\questão-pro-backend\tests\ReportsModuleWiringTest.php`
- `C:\xampp\htdocs\questão-pro-backend\tests\AuthModuleWiringTest.php`
- `npx vitest run src/services/reports/__tests__/reportsService.test.ts src/services/comments/__tests__/commentsService.test.ts src/services/admin/__tests__/adminService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`
- smoke `401` coerente em:
  - `http://localhost/questão-pro-backend/api/reports/list.php`
  - `http://localhost/questão-pro-backend/api/reports/handle.php`
  - `http://localhost/questão-pro-backend/api/admin/feedback.php`
  - `http://localhost/questão-pro-backend/api/admin/report_actions.php`

## Observacao

Os arquivos historicos `audit-report.md` e `feature-report.md` antigos estão com encoding misto e precisam de uma passada de normalizacao antes de novas edicoes seguras com `apply_patch`. Este suplemento registra a rodada atual em UTF-8 limpo sem arriscar corromper os relatórios legados.

---

## Fonte absorvida: `C:\dev\concursomestre\docs\settings-cleanup.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Settings Cleanup

## Objetivo

Fechar a pend?ncia arquitetural do fluxo de configurações do admin e remover artefatos técnicos sensiveis que ainda poluiam a raiz operacional do backend.

## O que mudou

### Frontend

- O botao explicito de salvar planos no admin deixou de fazer `apiClient.post('settings.php', ...)` direto.
- A persistencia imediata agora usa a camada oficial de dados via `saveSystemSettingsNow(...)`.
- O contexto de dados continua suportando autosave com debounce por `updateSystemSettings(...)`, mas passou a expor um flush imediato para telas que precisam de salvamento explicito.

### Backend

- O endpoint oficial [C:\xampp\htdocs\questão-pro-backend\api\settings.php](C:\xampp\htdocs\questão-pro-backend\api\settings.php) continua sendo o unico endpoint valido de configurações.
- O log técnico de settings saiu de `api/settings_log.txt` e foi movido para `storage/logs/settings.log`.
- O endpoint duplicado da raiz [C:\xampp\htdocs\questão-pro-backend\settings.php](C:\xampp\htdocs\questão-pro-backend\settings.php) foi removido.

## Arquivos removidos

- `C:\xampp\htdocs\questão-pro-backend\settings.php`
- `C:\xampp\htdocs\questão-pro-backend\api\settings_debug.php`
- `C:\xampp\htdocs\questão-pro-backend\api\settings_ultra_debug.php`
- `C:\xampp\htdocs\questão-pro-backend\api\dump_settings.php`
- `C:\xampp\htdocs\questão-pro-backend\api\test_save.php`
- `C:\xampp\htdocs\questão-pro-backend\api\settings_debug.log`
- `C:\xampp\htdocs\questão-pro-backend\api\settings_log.txt`
- `C:\xampp\htdocs\questão-pro-backend\api\debug.log`
- `C:\xampp\htdocs\questão-pro-backend\api\admin\keys.txt`
- `C:\xampp\htdocs\questão-pro-backend\api\admin\keys_addr.txt`
- `C:\xampp\htdocs\questão-pro-backend\api\admin\keys_ua.txt`

## Impacto

- O admin segue salvando configurações sem mudar contrato funcional.
- O save duplicado foi eliminado.
- A raiz `api/` ficou menos exposta e menos poluida.
- Os residuos de debug e chaves soltas deixaram de existir no código ativo.

---

## Fonte absorvida: `C:\dev\concursomestre\docs\settings-endpoint-formalization.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Formalizacao dos endpoints de settings

## Objetivo

Separar o contrato administrativo oficial de configurações sistemicas do endpoint público legado, sem quebrar o carregamento inicial da plataforma.

## Decisao adotada

- `GET /api/settings.php` permanece como bridge de compatibilidade para leitura pública das configurações saneadas.
- `POST /api/admin/settings.php` passa a ser o entry point administrativo oficial para salvar configurações.
- O alias legado `settingsUpdate` continua existindo apenas como compatibilidade, mas agora delega para `admin/settings.php`.

## Impacto

- O frontend administrativo salva configurações pela rota oficial administrativa.
- O carregamento inicial da plataforma continua usando o endpoint público de leitura.
- A arquitetura fica menos ambigua sem quebrar clientes antigos.
