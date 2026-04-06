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
