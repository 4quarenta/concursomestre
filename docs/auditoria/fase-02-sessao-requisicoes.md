# Fase 02 - Sessao, login e requisicoes iniciais

Data: 2026-07-12

## Status

Concluida tecnicamente na revisao R2, aguardando somente a captura autenticada
no navegador apos a publicacao desta revisao. Esta secao substitui os contratos
de sessao descritos nas anotacoes anteriores deste mesmo documento.

### Revisao R2 - login sem `/auth/me` e billing isolado

**Causa raiz confirmada:** apos o login, `AuthProvider` executava um efeito de
"hidratacao de foto" que chamava `fetchAuthenticatedUser()`. Como esse metodo
faz `GET /api/auth/me.php`, ele duplicava o snapshot ja retornado por
`POST /api/auth/login.php`.

**Correcao aplicada:** o efeito foi removido. Login, cadastro, OAuth e 2FA
passam o DTO canonico recebido no proprio endpoint para
`establishAuthenticatedSession()`, que grava somente memoria local, aborta
qualquer bootstrap em andamento e navega client-side. O bootstrap nao chama
`/auth/me.php`: restaura a sessao exclusivamente por `auth/refresh.php` e
cookie HttpOnly. `fetchAuthenticatedUser()` permanece apenas como
sincronizacao manual explicita.

O gerenciador em `src/services/auth/session.ts` possui estados `idle`,
`bootstrapping`, `authenticated` e `anonymous`, uma unica promise de bootstrap,
`AbortController` e contador de geracao. Assim, Strict Mode, dois providers ou
um login concluido durante bootstrap nao criam uma segunda restauracao nem
permitem que uma resposta anterior sobrescreva o login novo.

O DTO retornado por login, refresh e `/auth/me.php` e agora:

```json
{
  "success": true,
  "message": "Session data retrieved",
  "data": {
    "user": {
      "id": "uuid",
      "displayName": "John",
      "email": "john@example.test",
      "avatarUrl": null,
      "status": "active",
      "emailVerified": true,
      "role": "admin",
      "permissions": ["admin.access"]
    },
    "subscription": {
      "status": "active",
      "plan": { "id": 134, "code": "elite", "displayName": "Elite", "tier": 4 }
    },
    "gamification": { "level": 1, "xp": 371, "reputation": 100 },
    "linkedProviders": ["google"],
    "partnership": { "status": "inactive" }
  }
}
```

Os aliases `name`, `photoUrl`, `isAdmin`, `isStaff`, `canAccessAdmin`, `plan`,
`planDisplayName`, `hasActivePlan`, `hasGoogleLinked`, `hasFacebookLinked` e
`isPartner` nao sao mais serializados por esses endpoints. Ha apenas um adapter
local e isolado em `toSessionUserProfile()` para telas legadas; ele nunca e
enviado ao backend, esta marcado para retirada na Fase 08 e os consumidores
restantes estao inventariados na secao "Aliases temporarios" abaixo.

Seletores novos usam `permissions.includes('admin.access')` para area
administrativa e `partner.access`/`partnership.status` para parceria. O RBAC
final continua exclusivamente no backend.

### Status financeiro dedicado

O aviso de pagamento nao depende mais de `user.hasSavedCard`. Foi criado
`GET /api/v2/users/me/billing/payment-status.php`, que obtem o usuario somente
do JWT autenticado e retorna apenas:

```json
{
  "subscriptionStatus": "active",
  "billingMode": "recurring_card",
  "requiresPaymentMethod": true,
  "hasValidPaymentMethod": true,
  "actionRequired": null
}
```

Sua fonte e a assinatura ativa canonica, modo de cobranca, renovacao,
recorrencia e o cartao local vinculado a recorrencia ou definido como padrao,
incluindo validade. Pix/boleto, cortesia/manual, trial sem obrigacao e plano
gratuito retornam `requiresPaymentMethod: false`. Falha de HTTP, carregamento ou
contrato incompleto mantem o aviso oculto; nao sao interpretados como falta de
cartao. O request so ocorre em `/profile` e `/checkout`, possui deduplicacao de
60 segundos, cancelamento no unmount e invalidacao apos sincronizar, remover ou
definir cartao.

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

## Contratos de atividade

O endpoint de perfil proprio (`/api/users/profile.php`) continua sendo a rota
deliberada para CPF, endereco, conta bancaria, billing e dados de conexoes.
Esses campos nao fazem parte do bootstrap global. O contrato de sessao atual e
o da revisao R2, acima; as medicoes antigas de aliases planos foram aposentadas
porque nao representam mais o payload publicado.

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
| `C:/xampp/php/php.exe backend/tests/Phase02CanonicalSessionAndBillingTest.php` | PASS |
| Vitest focado de sessao, fluxo auth, permissoes e billing | 5 arquivos, 28 testes PASS |
| `npm run typecheck` | PASS |
| `npm run build` local | PASS |
| `npm run check:secrets` | PASS |
| lint integral PHP local | 657 arquivos sem erro |

`npx vitest run` completo: 410 passaram, 6 falharam. As falhas ja existiam
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

## Deploy R2 e evidencia de producao

- Backup criado antes da copia:
  `backups/phase02-r2-session-billing-20260712-180202.tar.gz`
  (`sha256: 5d5a6df05dd3e30baa489021392eebda44f67b19397d46395be967d9c7f1d8b1`).
- A VPS recebeu os arquivos de sessao, auth, billing e rota v2; foi executado
  `npm run build` em `frontend`, seguido de restart apenas de
  `concursomestre-frontend.service`.
- Servico ativo, `http://127.0.0.1:3000/` retornou 200 e a URL publica retornou
  HTTP/2 200. Os logs posteriores ao restart mostram apenas `Ready`, sem erro
  novo de runtime.
- `find backend -name "*.php" ... php -l` passou na VPS.
- `Phase02SessionRequestsWiringTest.php`,
  `Phase02CanonicalSessionAndBillingTest.php` e o diagnostico de producao
  passaram na VPS. Este ultimo confirmou, sem imprimir PII, as chaves reais:

```json
{
  "sessionRootKeys": ["user", "subscription", "gamification", "linkedProviders", "partnership"],
  "sessionUserKeys": ["id", "displayName", "email", "avatarUrl", "status", "emailVerified", "role", "permissions"],
  "forbiddenUserKeys": [],
  "billingKeys": ["subscriptionStatus", "billingMode", "requiresPaymentMethod", "hasValidPaymentMethod", "actionRequired"]
}
```

- Sem credenciais, `GET /api/auth/me.php` e
  `GET /api/v2/users/me/billing/payment-status.php` retornaram 401. Isso
  confirma que a nova rota nao aceita `user_id` por query e nao expos status de
  pagamento a visitantes.
- A verificacao autenticada visual foi tentada no Chrome com a aba existente do
  dashboard, mas o claim da aba expirou duas vezes no conector antes de expor
  Network/Initiator. Nenhum cookie, token, senha ou storage foi lido. A prova
  automatizada do comportamento e o teste de sessao: login materializa o DTO
  canonico com `mockGet` em zero e o bootstrap pendente e abortado quando o
  login vence. A confirmacao manual residual no DevTools deve mostrar
  `login.php = 1` e `me.php = 0` apos logout/login; reload usa apenas refresh.

## Rollback R2

```bash
cd /home/concursomestre/htdocs/concursomestre.com
tar -xzf backups/phase02-r2-session-billing-20260712-180202.tar.gz
systemctl restart concursomestre-frontend.service
```

O arquivo `payment-status.php` e a camada `paymentStatus.ts` podem ser
removidos somente junto com o rollback dos seus imports. Nenhum segredo, token
ou dado pessoal foi incluido no commit ou no relatorio.

## Rollback de producao

Backups antes da implantacao foram gravados em:

- `backups/phase02-session-20260712-151502.tar.gz`
- `backups/phase02-auth-dependency-20260712-151636.tar.gz`
- `backups/phase02-minimal-session-20260712-154604.tar.gz`
- `backups/phase02-session-query-20260712-155029.tar.gz`

Para rollback, restaurar os arquivos do backup correspondente e executar o
rollback dos dois indices acima apenas se tambem for revertida a implementacao
keyset. Nenhum segredo, token temporario, dump ou dado pessoal foi versionado.
