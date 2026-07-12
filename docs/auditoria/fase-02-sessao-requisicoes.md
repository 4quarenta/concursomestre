# Fase 02 - Sessao, login e requisicoes iniciais

Data: 2026-07-12

## Escopo executado

Esta fase corrigiu os achados de login, `/auth/me`, requisicoes iniciais do dashboard e notificacoes listadas na auditoria pos-fases.

Nao foram executadas migrations nesta fase porque as correcoes ficaram restritas a contratos HTTP, DTOs, queries ja existentes e consumidores frontend.

## Achados confirmados

- `login.php` montava perfil completo pelo mesmo caminho de `/auth/me.php`.
- `establishAuthenticatedSession(token, user)` chamava `fetchAuthenticatedUser()` mesmo quando o login ja entregava `user`.
- `/api/auth/me.php` usava `handleUsersAuthenticatedProfileRoute`, retornando CPF, telefone, endereco, conta bancaria e detalhes sensiveis de billing.
- Dashboard carregava comentarios e respostas por endpoints que aceitavam `user_id`.
- Historico de respostas e comentarios nao possuia cursor leve para o uso inicial do dashboard.
- Notificacoes usavam limite alto por padrao e nao retornavam `unreadCount` em contrato paginado.
- O coordenador de refresh entre abas nao tratava `refresh-success`, causando espera indevida quando uma aba aguardava outra finalizar a renovacao.

## Implementacao realizada

- Login, refresh e `/auth/me.php` passaram a usar um DTO minimo de sessao por `UsersService::getAuthenticatedSession`.
- O DTO minimo nao seleciona CPF, telefone, endereco, conta bancaria ou dados sensiveis do perfil financeiro.
- `establishAuthenticatedSession` deixou de chamar `/auth/me.php` imediatamente quando recebe um usuario valido do login.
- Foram criadas rotas proprias:
  - `/api/users/me/comments.php`
  - `/api/users/me/answers.php`
- As rotas `users/me` removem `user_id`/`userId` recebido do cliente antes de delegar ao fluxo existente.
- Comentarios e respostas ganharam envelope paginado com `items`, alias legado (`comments`/`answers`), `count`, `hasMore` e `nextCursor`.
- Respostas tambem retornam `summary` com total, acertos, erros, aproveitamento e ultima atividade.
- Dashboard passou a usar `getCurrentUserAnswers(240)` e `getCurrentUserComments(20)`, sem enviar `user_id`.
- Notificacoes agora usam limite padrao 10, maximo 50, cursor, `hasMore`, `nextCursor` e `unreadCount`.
- `notificationService.getNotifications()` envia `limit: 10` por padrao.
- O fluxo de sessao entre abas aceita `refresh-success` e aplica o token/perfil recebido quando o evento ja contem estado resolvido, evitando autoespera.

## Arquivos alterados

- `backend/api/auth/me.php`
- `backend/api/users/me/comments.php`
- `backend/api/users/me/answers.php`
- `backend/modules/auth/services/AuthService.php`
- `backend/modules/users/controllers/UsersController.php`
- `backend/modules/users/repositories/UsersRepository.php`
- `backend/modules/users/routes.php`
- `backend/modules/users/services/UsersService.php`
- `backend/modules/notifications/repositories/NotificationsRepository.php`
- `backend/modules/notifications/services/NotificationsService.php`
- `backend/modules/notifications/validators/NotificationsValidator.php`
- `backend/tests/Phase02SessionRequestsWiringTest.php`
- `src/app/dashboard/DashboardPage.tsx`
- `src/services/api/endpoints.ts`
- `src/services/auth/session.ts`
- `src/services/auth/__tests__/session.test.ts`
- `src/services/comments/commentsService.ts`
- `src/services/comments/__tests__/commentsService.test.ts`
- `src/services/notifications/notificationService.ts`
- `src/services/notifications/__tests__/notificationService.test.ts`
- `src/services/progress/userProgressService.ts`
- `src/services/progress/__tests__/userProgressService.test.ts`

## Testes e evidencias

- `npx vitest run src/services/auth/__tests__/session.test.ts src/services/notifications/__tests__/notificationService.test.ts src/services/comments/__tests__/commentsService.test.ts src/services/progress/__tests__/userProgressService.test.ts`
  - Resultado: 4 arquivos, 31 testes, 31 passaram.
- `npm run typecheck`
  - Resultado: passou.
- `npm run build`
  - Resultado: passou.
- Verificacao estatica de wiring PHP via Node:
  - Resultado: `Phase02 PHP static wiring assertions: PASS`.
- `npm run check:secrets`
  - Resultado: nenhum segredo de provedor, webhook ou chave privada rastreado.

## Bloqueios reais

- O binario `php` nao esta disponivel no workspace local (`PHP CLI: unavailable in local workspace`).
- Por isso, `php -l` e o teste PHP executavel `backend/tests/Phase02SessionRequestsWiringTest.php` nao puderam ser executados localmente.
- A cobertura equivalente foi feita por verificacao estatica via Node nos mesmos arquivos e contratos.

## Rollback

Rollback seguro:

1. Reverter o commit desta fase.
2. Restaurar `/api/auth/me.php` para `handleUsersAuthenticatedProfileRoute($db)`.
3. Restaurar `AuthService::buildAuthenticatedUserPayload()` para `getAuthenticatedProfile($userId)`.
4. Restaurar `DashboardPage` para `getUserAnswers(currentUser.id)` e `getUserComments(currentUser.id)`.
5. Remover as rotas `/api/users/me/comments.php` e `/api/users/me/answers.php`.

Nao ha migration a reverter.

## Confirmacao de seguranca

- Nenhum segredo foi adicionado.
- Nenhum dump, chave, token, webhook secret ou credencial foi versionado.
- Dados sensiveis de perfil deixam de trafegar no contrato global de sessao.

## Pendencias fora desta fase

- Criar endpoints dedicados para perfil completo, billing profile e entitlements versionados em `/api/v2`.
- Substituir completamente consumidores administrativos legados que ainda usam `users/comments.php?user_id=...`.
- Executar lint PHP formal quando o binario `php` estiver disponivel no ambiente de CI ou VPS.
