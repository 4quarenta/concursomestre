# Modulo de Feedback Publico

## Objetivo

Esta rodada move o fluxo publico de suporte/feedback para a arquitetura oficial do backend e conecta a UI do usuario ao fluxo real de resposta por thread.

## Backend

Arquivos principais:

- `C:\xampp\htdocs\questao-pro-backend\modules\feedback\controllers\FeedbackController.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\feedback\services\FeedbackService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\feedback\repositories\FeedbackRepository.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\feedback\validators\FeedbackValidator.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\feedback\routes.php`

Bridges legados:

- `C:\xampp\htdocs\questao-pro-backend\api\feedback\list.php`
- `C:\xampp\htdocs\questao-pro-backend\api\feedback\create.php`

## O que o modulo faz

### `FeedbackService::listThreads(...)`

- usa a sessao autenticada como fonte de verdade
- lista apenas threads raiz do usuario
- devolve `reply_count` para a UI

### `FeedbackService::listReplies(...)`

- valida o id da thread
- garante que apenas o dono da thread ou admin possam ver a conversa
- devolve respostas com `user_name` e `user_role`

### `FeedbackService::createEntry(...)`

- cria uma thread nova quando nao existe `parent_id`
- cria resposta em thread existente quando existe `parent_id`
- preserva o tipo oficial persistido da thread
- quando o usuario responde, a thread volta para status `new`
- quando um admin responder por esse modulo, a thread vai para `read`

### `FeedbackValidator::validateCreatePayload(...)`

- valida `type`, `reason`, `details` e `parent_id`
- normaliza tipos legados:
  - `feedback` -> `suggestion`
  - `info` -> `support`
  - `support` -> `support`

## Frontend

Arquivos principais:

- `C:\dev\concursomestre\src\services\support\supportService.ts`
- `C:\dev\concursomestre\src\app\support\page.tsx`

## Melhorias funcionais

### `supportService`

- passou a usar `ENDPOINTS.feedback.list`
- passou a usar `ENDPOINTS.feedback.create`
- ganhou `replyToThread(...)`

### `src/app/support/page.tsx`

- o usuario agora pode responder a thread pelo proprio painel
- a resposta atualiza a conversa e o historico logo depois do envio
- a tela informa que respostas do admin tambem chegam por e-mail automatico

## Validacao executada

- `php -l` no modulo `feedback` e bridges
- `C:\xampp\htdocs\questao-pro-backend\tests\FeedbackModuleWiringTest.php`
- `npx vitest run src/services/support/__tests__/supportService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`
- smoke `401` coerente em:
  - `http://localhost/questao-pro-backend/api/feedback/list.php`
  - `http://localhost/questao-pro-backend/api/feedback/create.php`
