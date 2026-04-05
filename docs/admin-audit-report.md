# Auditoria do Painel Admin

## Stack auditado
- Frontend: React 19 + Vite + TypeScript
- Backend: PHP procedural com endpoints sob `api/`
- Autenticacao: sessao/JWT centralizada + middleware/admin helpers
- Integracoes principais do admin: usuarios, denuncias, rankings, materiais, transacoes, configuracoes e feedback

## Inventario funcional do admin

### 1. Dashboard
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Funcoes:
  - cards de receita, assinaturas, marketplace, usuarios, feedback
  - filtros por periodo
  - navegacao rapida para subareas
- Status antes:
  - funcionando parcialmente
  - dependia de endpoint de stats sem padronizacao forte
- Prioridade:
  - media

### 2. Base de dados / Questoes
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Funcoes:
  - listar questoes
  - paginar questoes
  - criar questao manual
  - editar questao
  - excluir questao
  - importador
- Status antes:
  - funcional, mas com integracoes e erros pouco padronizados
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

### 4. Usuarios
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Backend:
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\user_details.php](C:\xampp\htdocs\questao-pro-backend\api\admin\user_details.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\user_actions.php](C:\xampp\htdocs\questao-pro-backend\api\admin\user_actions.php)
- Funcoes:
  - listar usuarios
  - abrir perfil detalhado
  - atualizar perfil/status/plano
  - acao administrativa sobre usuario
- Status antes:
  - sensivel do ponto de vista de permissao
  - payloads e persistencia inconsistentes
- Prioridade:
  - critica

### 5. Denuncias
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Backend:
  - [C:\xampp\htdocs\questao-pro-backend\api\reports\list.php](C:\xampp\htdocs\questao-pro-backend\api\reports\list.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\report_actions.php](C:\xampp\htdocs\questao-pro-backend\api\admin\report_actions.php)
- Funcoes:
  - listar denuncias
  - abrir moderacao contextual
  - resolver/ignorar denuncia
  - notificar usuario afetado
- Status antes:
  - backend incompleto para a acao administrativa
  - resolucao na UI sem trilha auditavel
- Prioridade:
  - critica

### 6. Materiais
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Backend:
  - [C:\xampp\htdocs\questao-pro-backend\api\materials\moderate.php](C:\xampp\htdocs\questao-pro-backend\api\materials\moderate.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\materials\delete.php](C:\xampp\htdocs\questao-pro-backend\api\materials\delete.php)
- Funcoes:
  - listar materiais
  - moderar/aprovar/rejeitar
  - excluir administrativamente
  - abrir visualizacao autenticada
- Status antes:
  - moderacao sem trava de submit
  - exclusao sem endpoint administrativo real
  - notificacoes parcialmente duplicadas entre frontend e backend
- Prioridade:
  - critica

### 7. Rankings
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Backend:
  - [C:\xampp\htdocs\questao-pro-backend\api\rankings\moderate.php](C:\xampp\htdocs\questao-pro-backend\api\rankings\moderate.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\rankings\update.php](C:\xampp\htdocs\questao-pro-backend\api\rankings\update.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\rankings\delete.php](C:\xampp\htdocs\questao-pro-backend\api\rankings\delete.php)
- Funcoes:
  - listar rankings
  - editar ranking
  - excluir ranking
  - moderar status
- Status antes:
  - UI editava localmente
  - endpoints de update/delete nao existiam de forma funcional
- Prioridade:
  - alta

### 8. Financeiro
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Funcoes:
  - visao de vendedores
  - transacoes
  - reembolsos
  - configuracao de planos/cupons
  - automacao/cron
- Status antes:
  - tabela de transacoes tinha acoes diretas com stub `loadTransactions`
  - risco de clique repetido em aprovar/rejeitar reembolso
  - alguns estados so refletiam localmente
- Prioridade:
  - critica

### 9. Configuracoes do sistema
- Local: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Backend:
  - [C:\xampp\htdocs\questao-pro-backend\api\settings.php](C:\xampp\htdocs\questao-pro-backend\api\settings.php)
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
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\feedback.php](C:\xampp\htdocs\questao-pro-backend\api\admin\feedback.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\feedback\create.php](C:\xampp\htdocs\questao-pro-backend\api\feedback\create.php)
- Funcoes:
  - listar threads
  - abrir conversa
  - mudar status
  - responder no sistema
  - responder por email
- Status antes:
  - componente antigo, com `alert`, estado compartilhado de reply e comentarios TODO
  - endpoint de criacao usava auth legada e permitia reply sem controle de ownership robusto
- Prioridade:
  - critica

## Diagnostico resumido

### Problemas estruturais encontrados
- Endpoints administrativos sem middleware/admin helper unificado.
- Varias acoes do admin dependiam de estado local e nao persistiam no backend.
- Ausencia de trilha de auditoria em operacoes criticas.
- Acoes destrutivas sem idempotencia/trava de clique.
- Integracoes duplicadas entre frontend e backend para notificacoes.
- Componentes com UX incompleta: erro silencioso, `alert`, sem loading granular, sem drafts por item.

### Causas raiz
- Crescimento organico do admin sem service layer unica.
- Endpoints novos e antigos convivendo com contratos diferentes.
- Logica critica concentrada no frontend em vez do servidor.
- Falta de centralizacao em validacao, auth e auditoria.

## Correcoes implementadas

### Backend
- Criado helper administrativo central:
  - [C:\xampp\htdocs\questao-pro-backend\api\utils\AdminSecurity.php](C:\xampp\htdocs\questao-pro-backend\api\utils\AdminSecurity.php)
- Endpoints protegidos/refatorados:
  - [C:\xampp\htdocs\questao-pro-backend\api\settings.php](C:\xampp\htdocs\questao-pro-backend\api\settings.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\cache\manage.php](C:\xampp\htdocs\questao-pro-backend\api\cache\manage.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\stats.php](C:\xampp\htdocs\questao-pro-backend\api\admin\stats.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\list_tables.php](C:\xampp\htdocs\questao-pro-backend\api\admin\list_tables.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\reset_db.php](C:\xampp\htdocs\questao-pro-backend\api\admin\reset_db.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\user_details.php](C:\xampp\htdocs\questao-pro-backend\api\admin\user_details.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\user_actions.php](C:\xampp\htdocs\questao-pro-backend\api\admin\user_actions.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\reports\list.php](C:\xampp\htdocs\questao-pro-backend\api\reports\list.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\filters\save.php](C:\xampp\htdocs\questao-pro-backend\api\filters\save.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\filters\delete.php](C:\xampp\htdocs\questao-pro-backend\api\filters\delete.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\report_actions.php](C:\xampp\htdocs\questao-pro-backend\api\admin\report_actions.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\feedback.php](C:\xampp\htdocs\questao-pro-backend\api\admin\feedback.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\rankings\moderate.php](C:\xampp\htdocs\questao-pro-backend\api\rankings\moderate.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\rankings\update.php](C:\xampp\htdocs\questao-pro-backend\api\rankings\update.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\rankings\delete.php](C:\xampp\htdocs\questao-pro-backend\api\rankings\delete.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\transactions\reject_refund.php](C:\xampp\htdocs\questao-pro-backend\api\transactions\reject_refund.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\materials\moderate.php](C:\xampp\htdocs\questao-pro-backend\api\materials\moderate.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\materials\delete.php](C:\xampp\htdocs\questao-pro-backend\api\materials\delete.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\feedback\create.php](C:\xampp\htdocs\questao-pro-backend\api\feedback\create.php)
- Router ajustado:
  - [C:\xampp\htdocs\questao-pro-backend\router.php](C:\xampp\htdocs\questao-pro-backend\router.php)

### Frontend
- Service layer administrativa criada:
  - [C:\dev\concursomestre\src\features\admin\services\adminService.ts](C:\dev\concursomestre\src\features\admin\services\adminService.ts)
- Persistencia debounced e confiavel das configuracoes:
  - [C:\dev\concursomestre\context\DataContext.tsx](C:\dev\concursomestre\context\DataContext.tsx)
- Fluxos de moderacao e reembolso com trava de clique:
  - [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Feedback admin refeito:
  - [C:\dev\concursomestre\src\features\admin\components\AdminFeedback.tsx](C:\dev\concursomestre\src\features\admin\components\AdminFeedback.tsx)
- Marketplace/admin alinhado para evitar duplicacao de notificacoes:
  - [C:\dev\concursomestre\context\MarketplaceContext.tsx](C:\dev\concursomestre\context\MarketplaceContext.tsx)

## Seguranca

### Vulnerabilidades corrigidas
- Endpoints admin sem verificacao administrativa consistente.
- Acao administrativa de feedback respondendo por endpoint legado.
- Risco de exclusao/moderacao sem trilha auditavel.
- Risco de IDOR em replies de feedback.
- Acoes destrutivas/financeiras suscetiveis a multiplos cliques.

### Protecoes adicionadas
- `requireAdminSessionContext(...)` nos endpoints criticos do admin.
- `AuthMiddleware::requireAuth()` no endpoint de feedback/reply.
- Audit log para mudancas criticas.
- Notificacao server-side em moderacao/reembolso.
- Travas de submit e estados de carregamento por acao.

## Testes adicionados

### Frontend
- [C:\dev\concursomestre\src\features\admin\services\__tests__\adminService.test.ts](C:\dev\concursomestre\src\features\admin\services\__tests__\adminService.test.ts)
  - feedback threads
  - feedback replies
  - falha em update de status
  - normalizacao de cache stats

### Backend
- [C:\xampp\htdocs\questao-pro-backend\tests\AdminSecurityWiringTest.php](C:\xampp\htdocs\questao-pro-backend\tests\AdminSecurityWiringTest.php)
  - garante wiring minimo de auth/admin helpers nos endpoints administrativos endurecidos

## Como validar
- Frontend:
  - `npm run build`
  - `npm run test:admin`
- Backend:
  - `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\AdminSecurityWiringTest.php`
  - `C:\xampp\php\php.exe -l <arquivo.php>`

## Pendencias reais
- Ainda vale uma passada futura de observabilidade E2E no admin com navegador para cobrir casos de UX visual e latencia real.
- O painel tem componentes historicos grandes em [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx); a proxima melhoria natural e modularizar por dominio sem alterar contrato funcional.
