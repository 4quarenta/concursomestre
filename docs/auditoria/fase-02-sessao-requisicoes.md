# Fase 02 - Sessao, login e requisicoes iniciais

Data: 2026-07-12

## Status

Concluida. As validacoes foram executadas no workspace e na VPS de producao,
sem gravar credenciais ou dados pessoais nos relatorios.

## Problemas confirmados e correcao aplicada

1. O login retornava um perfil e o frontend chamava `/auth/me` logo depois.
   `establishAuthenticatedSession` agora usa o usuario que ja veio no login.
   `/auth/me` fica reservado a bootstrap de sessao existente, refresh e
   sincronizacao explicita.
2. `/auth/me` retornava o perfil completo. Agora login, refresh e `/auth/me`
   usam `UsersService::getAuthenticatedSession`.
3. O DTO de sessao nao seleciona nem serializa CPF, telefone, endereco, conta
   bancaria, billing, IDs sociais, codigo de indicacao, flags de exclusao ou
   2FA. Para conexoes sociais, devolve somente `hasGoogleLinked` e
   `hasFacebookLinked`.
4. O dashboard deixava o navegador baixar ate 240 respostas completas. Agora
   busca no maximo 20 respostas recentes e usa `summary` do servidor. Para
   comentarios, pede uma pagina de 1 item apenas para obter
   `summary.totalComments`.
5. As rotas de atividade passaram a ser autocontidas:
   `/api/users/me/answers.php` e `/api/users/me/comments.php` extraem somente
   `authenticatedUserId` da sessao. Os metodos
   `getCurrentUserAnswers` e `getCurrentUserComments` nao recebem nem chamam
   resolucao de `user_id` enviado pelo cliente.
6. Respostas, comentarios e notificacoes usam cursor assinado, keyset por
   `created_at DESC, id DESC`, limite de 1 a 50 e `limit + 1` para `hasMore`.
7. A pagina de respostas deixou de fazer JOIN/GROUP_CONCAT por linha. A pagina
   indexada e carregada primeiro; taxonomias sao hidratadas em uma unica query
   em lote.
8. A troca de aba nao compartilha access token. `BroadcastChannel` e o fallback
   de `storage` carregam apenas tipo de evento, origem, motivo e instante.

## Contratos atuais

### DTO de sessao

Exemplo sanitizado de `/api/auth/me.php`:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Usuario",
      "email": "usuario@example.test",
      "role": "user",
      "plan": "Pro",
      "level": 1,
      "xp": 0,
      "reputation": 0,
      "emailVerified": true,
      "isAdmin": false,
      "isStaff": false,
      "isPartner": false,
      "canAccessAdmin": false,
      "status": "active",
      "photoUrl": null,
      "hasGoogleLinked": true,
      "hasFacebookLinked": false,
      "hasActivePlan": true
    }
  }
}
```

O endpoint de perfil proprio (`/api/users/profile.php`) continua sendo a rota
deliberada para CPF, endereco, conta bancaria, billing e dados de conexoes.
Esses campos nao fazem parte do bootstrap global.

Medicao HTTP sanitizada na VPS, com a mesma rota de perfil privada como
referencia do contrato anterior: perfil privado com 31 chaves e 820 bytes;
sessao global com 18 chaves e 451 bytes para a conta de teste. Em uma conta
com assinatura, a sessao global medida caiu de 1.083 para 614 bytes apos a
remocao de billing e IDs sociais.

### Atividade propria

```text
GET /api/users/me/answers.php?limit=20&cursor=<assinado>&range=month
GET /api/users/me/comments.php?limit=1&cursor=<assinado>&range=month
```

Resposta canonica:

```json
{
  "items": [],
  "limit": 20,
  "count": 0,
  "hasMore": false,
  "nextCursor": null,
  "summary": {}
}
```

O dashboard nao usa `getCurrentUserAnswers()` nem `getCurrentUserComments()`.
Usa `getCurrentUserAnswersPage({ limit: 20, range })` e
`getCurrentUserCommentsPage({ limit: 1, range })`; suas metricas de total,
acertos, erros, aproveitamento e comentarios vem dos resumos do servidor.

No fluxo de atividade, antes havia duas requisicoes que podiam entregar 240
respostas completas e 20 comentarios, com uma query de respostas contendo
JOIN, GROUP BY e GROUP_CONCAT. Depois continuam duas requisicoes HTTP, mas o
custo e limitado a cinco queries curtas: pagina de respostas, lote de
taxonomias, resumo de respostas, pagina de comentarios e contagem de
comentarios. Nenhuma metrica inicial exige baixar o historico integral.

## Paginacao keyset

`backend/shared/pagination/SignedKeysetCursor.php` codifica `scope`,
`createdAt` e `id`, assina com HMAC-SHA256 usando `JWT_SECRET` e rejeita
assinatura, escopo ou estrutura invalidos.

As consultas usam:

```sql
WHERE created_at < :cursor_created_at
   OR (created_at = :cursor_created_at AND id < :cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT :limit_plus_one
```

Nao ha `OFFSET`. O par data+ID torna a ordenacao estavel mesmo quando dois
registros possuem o mesmo `created_at`.

Cobertura executada:

- primeira pagina e proxima pagina HTTP: 200, sem repeticao do primeiro item;
- mesmo `created_at` com IDs diferentes: teste de cursor assinado aprovado;
- cursor invalido/adulterado ou de outro escopo: rejeitado; HTTP retorna 400;
- `limit=0`: normalizado para 1;
- `limit=99`: limitado a 50;
- `user_id` arbitrario em `/users/me/answers.php`: resposta e resumo iguais ao
  escopo da sessao autenticada.

## Banco e EXPLAIN

Migration aditiva aplicada na VPS:

`backend/database/migrations/20260712_020000_user_activity_keyset_indexes.php`

```text
idx_user_answers_history_keyset(user_id, created_at, id)
idx_comments_user_history_keyset(user_id, created_at, id)
```

Foi aplicada por `scripts/migrations/run_schema_migrations.php` com
`MIGRATIONS_ALLOW_APPLY=true` e
`MIGRATIONS_ALLOW_PRODUCTION=true`; retorno: `executed:["20260712_020000"]`.

EXPLAIN sanitizado, apos migration e refatoracao:

| Consulta | Tipo | Indice escolhido | Linhas | Extra |
| --- | --- | --- | ---: | --- |
| respostas | `ref` | `idx_user_history` (compativel com o novo indice) | 4 | `Backward index scan` |
| comentarios | `ref` | `idx_comments_user_history_keyset` | 7 | `Backward index scan` |
| notificacoes | `ref` | `idx_notifications_user_visible` | 251 | `Using where; Backward index scan` |
| `unreadCount` | `ref` | `idx_notifications_user_unread` | 3 | `Using where; Using index` |

Nao houve full table scan nem filesort nessas quatro consultas. `unreadCount`
usa exclusivamente:

```sql
SELECT COUNT(*)
FROM notifications
WHERE user_id = :user_id AND is_read = 0 AND deleted_at IS NULL
```

Ele nao carrega a lista de notificacoes para montar o badge.

Rollback da migration:

```sql
DROP INDEX idx_user_answers_history_keyset ON user_answers;
DROP INDEX idx_comments_user_history_keyset ON comments;
```

## Notificacoes

`NotificationsValidator::validateListQuery` aplica padrao 10 e maximo 50.
`NotificationsService::listNotifications` devolve `items`, `limit`,
`hasMore`, `nextCursor` e `unreadCount` em uma unica resposta. A pagina
visivel busca 10 por padrao; o polling e suspenso quando a aba fica oculta.

## Tokens e coordenacao entre abas

- Access token: somente memoria do modulo `session.ts`; TTL entregue pelo
  servidor (padrao de 900 segundos).
- `localStorage`: nao recebe access token, perfil nem refresh token. Guarda
  apenas o hint `cm-auth-session-present`, um lock temporario de refresh e um
  evento sem segredo (`type`, `sourceTabId`, `reason`, `at`).
- `BroadcastChannel`: envia o mesmo evento sem segredo.
- Sem `BroadcastChannel`: o evento efemero de `storage` acorda a outra aba,
  que renova usando seu proprio cookie HttpOnly e envia a atualizacao local sem
  propagar token.
- Refresh exige cookie HttpOnly `cm_refresh`, cookie `cm_csrf` e cabecalho
  `X-CSRF-Token`; o teste HTTP com os tres retornou 200.

## Aliases temporarios e retirada planejada

`items` e o contrato canonico. `answers` e `comments` ainda sao aliases de
compatibilidade no mesmo envelope.

Consumidores ainda legados identificados:

- `src/services/progress/userProgressService.ts`: metodo legado
  `getUserAnswers(userId)`;
- `src/services/comments/commentsService.ts`: metodo legado
  `getUserComments(userId)`;
- `src/state/user-progress/userProgressQuery.ts`: usa os dois metodos legados.

Fase 08 deve migrar `userProgressQuery` e todos os consumidores restantes para
os endpoints `/users/me` (ou endpoints administrativos explicitamente RBAC).
Fase 10 deve remover os aliases somente apos a telemetria confirmar ausencia de
consumo legado. Eles nao sao permanentes.

## Evidencias HTTP reais e sanitizadas

| Caso | Resultado |
| --- | --- |
| anonimo em `/auth/me` | 401 |
| anonimo em `/users/me/answers` | 401 |
| autenticado em `/auth/me` | 200, sem campos privados |
| refresh com cookie + CSRF | 200, sem campos privados |
| answers `limit=0` | 200, `limit: 1` |
| answers `limit=99` | 200, `limit: 50` |
| comments `limit=0` / `99` | 200, `limit: 1` / `50` |
| notifications `limit=0` / `99` | 200, `limit: 1` / `50` |
| cursor adulterado | 400 |
| `user_id` arbitrario em `/users/me` | mesmo resumo e pagina do usuario autenticado |

## Arquivos alterados

Backend: rotas autocontidas de usuarios, controller/service/repository de
usuarios, repositorio/service de notificacoes, cursor assinado, migration e
testes PHP de Fase 02.

Frontend: `DashboardPage`, servicos de respostas e comentarios, sessao e seu
teste, tipos de usuario, perfil (flags sociais) e teste de requisicoes iniciais
do dashboard.

## Testes executados

| Comando | Resultado |
| --- | --- |
| `C:/xampp/php/php.exe backend/tests/Phase02SessionRequestsWiringTest.php` | PASS |
| `C:/xampp/php/php.exe backend/tests/SignedKeysetCursorTest.php` | PASS |
| `C:/xampp/php/php.exe backend/tests/UserActivityKeysetPaginationWiringTest.php` | PASS |
| `C:/xampp/php/php.exe backend/tests/AdminApiRbacWiringTest.php` | PASS |
| `C:/xampp/php/php.exe backend/tests/AdminRouteAccessWiringTest.php` | PASS |
| VPS: `find backend -name "*.php" ... php -l` | 1.242 arquivos sem erro |
| VPS: tres testes da Fase 02 | PASS |
| VPS: `AdminApiRbacWiringTest.php` | PASS |
| Vitest focado da Fase 02 | 5 arquivos, 35 testes PASS |
| `npm run typecheck` | PASS |
| `npm run build` local e VPS | PASS |
| `npm run check:secrets` | PASS |

`npx vitest run` completo: 402 passaram, 6 falharam. As falhas ja existiam
antes desta mudanca e os arquivos modificados nesta fase nao pertencem a elas:

| Arquivo / teste | Mensagem resumida | Risco | Fase responsavel |
| --- | --- | --- | --- |
| `planAutoCoupon.test.ts` / phantom 1% | 658.80 diferente de 660.00 | financeiro/comercial | 06 |
| `planAutoCoupon.test.ts` / valor anual | 39.97 diferente de 9.95 | financeiro/comercial | 06 |
| `landingPageSeo.test.ts` / fallback | esperado `Plano Elite`, recebeu campanha indisponivel | SEO | 09 |
| `adminArchitecture.test.ts` / shell fino | 728 linhas, limite 700 | manutencao | 10 |
| `adminArchitecture.test.ts` / console | `console.log` no importador | limpeza | 10 |
| `adminArchitecture.test.ts` / notificacoes topbar | texto esperado ausente | notificacoes UI | 09 |

Nao existe um unico runner seguro que execute os 110 scripts PHP indiscriminadamente:
parte deles chama Stripe, cron, backup ou manipula fixtures operacionais. Em vez
de executar testes financeiros destrutivos na producao, foram executados lint
integral e os testes PHP de contrato, RBAC e Fase 02 acima. A suite operacional
completa permanece responsabilidade das fases financeira e de QA, com ambiente
de homologacao dedicado.

## Rollback de producao

Backups antes da implantacao foram gravados em:

- `backups/phase02-session-20260712-151502.tar.gz`
- `backups/phase02-auth-dependency-20260712-151636.tar.gz`
- `backups/phase02-minimal-session-20260712-154604.tar.gz`
- `backups/phase02-session-query-20260712-155029.tar.gz`

Para rollback, restaurar os arquivos do backup correspondente e executar o
rollback dos dois indices acima apenas se tambem for revertida a implementacao
keyset. Nenhum segredo, token temporario, dump ou dado pessoal foi versionado.
