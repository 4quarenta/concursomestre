# Fase 01 - Hotfix de seguranca pos-auditoria

**Data:** 12 de julho de 2026  
**Branch/checkpoint:** `4quarenta/auditoria-pos-fase-01-hotfix`  
**Escopo:** corrigir os vazamentos P0 de questoes e endurecer a entrada web de
rotas administrativas apontados no pacote de auditoria. Esta entrega nao cria
migrations e nao altera dados de negocio.

## Achados confirmados

Antes da publicacao, a leitura anonima de
`/api/questions/list.php?limit=1` devolvia os campos canonicos `answer`,
`correctAlternativeTempIds` e `editorial`, ainda que os aliases legados de
gabarito estivessem ocultos. Isso permitia descobrir o gabarito pelo Network e
tambem contornava a restricao de conteudo editorial por plano.

Tambem foi confirmado que `src/proxy.ts` tratava a simples presenca de cookie de
refresh como acesso suficiente para renderizar `/admin`. Um aluno autenticado
podia entrar no shell administrativo, mesmo que as APIs ainda aplicassem RBAC.

## Implementacao

| Risco | Correcao aplicada | Arquivo principal |
| --- | --- | --- |
| Gabarito no DTO publico | `QuestionOutputPolicy` remove toda representacao de resposta antes da serializacao publica. | `backend/modules/questions/services/QuestionOutputPolicy.php` |
| Editorial fora do beneficio | A lista canonica `editorial` passa pelo mesmo filtro de entitlement dos aliases de comentario. | `backend/modules/questions/services/QuestionsService.php` |
| Ownership de staff amplo | Staff so pode alterar/excluir conteudo cujo `created_by_user_id` seja o seu proprio ID. | `QuestionOwnershipPolicy.php`, `LegalCommentaryRepository.php` |
| Colisao de contexto importado | Contextos importados usam chave escopada pelo ID persistido da prova; contextos manuais usam a chave do grupo persistido. | `QuestionsService.php` |
| Shell `/admin` para membro comum | O proxy consulta um endpoint sem payload que valida sessao ativa e papel `admin` ou `staff`; qualquer outra resposta devolve 404 sem cache. | `src/proxy.ts`, `admin-route-access.php` |
| Segredos e backups locais | Backups/dumps passaram a ser ignorados; ha varredura de segredos rastreados e procedimento de rotacao. | `.gitignore`, `check-versioned-secrets.mjs`, `credential-rotation.md` |

O endpoint de guarda administrativa devolve somente HTTP `204` quando a sessao
de refresh ativa pertence a `admin` ou `staff`. Ele nao devolve perfil, token,
permissoes nem dados pessoais. Falhas, sessoes expiradas e usuarios comuns
recebem `404`.

## Consumidores afetados e compatibilidade

- `api/questions/list.php` e demais leituras que serializam questoes agora
  preservam alternativa e conteudo, mas nao entregam resposta/editorial sem
  autorizacao explicita.
- Leitura administrativa continua recebendo gabarito e editorial integral.
- O frontend usa a guarda somente antes de permitir o shell de `/admin`; as
  APIs permanecem a autoridade final de autorizacao.
- Nenhum alias novo, fallback permanente ou contrato paralelo foi introduzido.

## Validacao

### Local

| Comando | Resultado |
| --- | --- |
| `npx vitest run src/services/auth/__tests__/adminRouteAccess.test.ts` | 3 testes passaram |
| `npm run typecheck` | passou |
| `npx eslint src/proxy.ts src/services/auth/adminRouteAccess.ts src/services/auth/__tests__/adminRouteAccess.test.ts` | passou |
| `npm run check:secrets` | passou |
| `node scripts/checks/check-next-proxy-convention.mjs` | passou |
| `git diff --check` | passou, sem erro de whitespace |
| `npx vitest run` | 389 testes passaram; 7 falhas preexistentes fora do escopo desta fase |

A suite completa permanece com sete falhas anteriores ao hotfix, em cupons
anuais (2), fallback de SEO (1), orcamento/contratos da arquitetura admin (3)
e coordenacao de refresh entre abas (1). O teste novo da guarda administrativa
e todos os testes diretamente afetados por esta fase passaram.

### VPS de producao

| Evidencia | Resultado |
| --- | --- |
| Lint dos 645 PHPs do backend | `php_lint_files=645 syntax_ok=645` |
| Testes PHP do hotfix | `QuestionPublicOutputPolicyTest`, `QuestionOwnershipPolicyTest`, `LegalCommentaryOwnershipWiringTest` e `AdminRouteAccessWiringTest` passaram |
| Build frontend | `npm run build` passou com Next 16.2.4 |
| Servico frontend | reiniciado e ativo: `concursomestre-frontend.service` |
| DTO publico de questao | resposta, IDs corretos, aliases e editorial ausentes em consulta anonima |
| Protecao de borda | `/admin` anonimo e guarda sem sessao retornaram 404 |
| Nginx | `nginx -t` passou; endpoints de setup/teste continuaram 404 |

Foi criado antes do deploy o backup restauravel:

`/var/backups/concursomestre/phase1-hotfix-20260712-032716n/application-and-nginx.tgz`

Depois do deploy foi limpo somente o diretorio conhecido de cache
`/var/www/concursomestre/backend/storage/cache`, para remover respostas publicas
antigas armazenadas antes do hotfix. Nenhum dado do MySQL foi alterado.

## Rollback

1. Colocar a aplicacao em janela controlada e restaurar o backup com
   `tar -xzf /var/backups/concursomestre/phase1-hotfix-20260712-032716n/application-and-nginx.tgz -C /`.
2. Validar `nginx -t`, limpar apenas
   `/var/www/concursomestre/backend/storage/cache`, executar o build do frontend
   como usuario `concursomestre` e reiniciar `concursomestre-frontend.service`.
3. Verificar que `/api/questions/list.php?limit=1` e `/admin` respondem conforme
   esperado. Este rollback nao envolve restauracao de banco, pois nao houve
   migration nem escrita de negocio nesta fase.

## Limite de evidencia

O endpoint e a politica foram testados com sessao ausente e por testes unitarios
de todos os papeis. A fumaça autenticada em producao para um membro comum e um
staff/admin exige sessoes descartaveis dedicadas; ela nao foi executada para
evitar usar conta real de usuario durante o hotfix. A regra aplicada em
producao e verificavel no endpoint: somente `admin` e `staff` ativos recebem
`204`.

## Complemento de validacao condicionada

Esta secao fecha as condicoes solicitadas depois da revisao do commit
`954b524`.

### Respostas: o cliente nao decide acerto

O fluxo de resposta comum e de simulado foi revisado. O navegador envia apenas
o identificador/indice da alternativa selecionada e o tempo gasto. Campos que
tentem declarar o resultado agora sao recusados pelo validador antes da camada
de persistencia, inclusive quando vierem aninhados.

| Etapa | Evidencia de codigo | Garantia |
| --- | --- | --- |
| Entrada HTTP | `backend/modules/questions/validators/QuestionsValidator.php` (`validateAnswerPayload`, linhas 39-113) | Rejeita `is_correct`, `isCorrect`, `correct`, `answerCorrect`, indices/IDs corretos, `resposta` e aliases aninhados. |
| Correcao | `backend/modules/questions/services/QuestionsService.php` (linhas 43-105) | Consulta a questao persistida e chama `QuestionAnswerEvaluator::evaluate($question, $data['selectedOption'])`. |
| Persistencia e estatisticas | `QuestionsService.php` (linhas 72-83) | `user_answers.is_correct`, estatisticas, XP, nivel, streak/badges e gamificacao usam somente `$isCorrect` calculado pelo servidor. |
| Simulados | `backend/modules/simulations/services/SimulationsService.php` (linhas 79-101) | Reavalia cada alternativa contra a questao persistida antes de gravar score e `user_answers`. |
| Gabarito canonico | `backend/modules/questions/services/QuestionAnswerEvaluator.php` | Resolve o indice correto pelas colunas/JSON canonicos da questao; nao le veredito do request. |

O teste `backend/tests/QuestionAnswerPayloadTrustBoundaryTest.php` cobre um
payload valido, todos os aliases de veredito recusados e o calculo contra o
gabarito persistido. `QuestionAnswerEvaluatorTest.php` continua cobrindo
gabarito em coluna, legado one-based e rotulo de alternativa.

### DTO publico: verificacao recursiva

`QuestionOutputPolicy` agora remove os campos sensiveis em qualquer nivel da
estrutura e sempre elimina `data_json`/`raw_json` de respostas de leitura. A
politica tambem e aplicada ao detalhe publico v2, nao apenas ao contrato
legado.

O teste `backend/tests/QuestionPublicOutputPolicyTest.php` monta um DTO com
`answer`, editoriais e aliases escondidos em objetos aninhados, `data_json` e
`raw_json`. Ele percorre recursivamente o resultado publico e falha se
encontrar qualquer uma destas chaves:

`answer`, `correct`, `correctOptionIndex`, `correctAlternativeId`,
`correctAlternativeTempIds`, `resposta`, `resposta_correta_item_index`,
`isCorrect`, `is_correct`, `teacherComment`, `detailedComment`, `editorial`,
`questionEditorials`, `data_json`, `raw_json`, `dataJson` ou `rawJson`.

Exemplo sanitizado:

```json
// Antes: registro interno/canonico
{
  "id": 42,
  "alternatives": [{ "id": "alt_a", "label": "A", "text": "..." }],
  "answer": { "correctAlternativeTempIds": ["alt_a"] },
  "editorial": [{ "type": "teacher_comment", "body": "..." }],
  "data_json": "{\"resposta\":1}"
}

// Depois: DTO publico de leitura
{
  "id": 42,
  "alternatives": [{ "id": "alt_a", "label": "A", "text": "..." }]
}
```

O resultado de `POST /api/v2/questions/answer.php` continua devolvendo o
resultado da tentativa recem-processada ao proprio usuario, pois esse nao e um
DTO de leitura de questao e e necessario para mostrar o feedback apos o envio.
O DTO de `GET` nao contem gabarito nem resultado de resposta aninhado.

### Matriz editorial no backend

A decisao e tomada antes da serializacao, em
`backend/modules/questions/routes.php`, e entregue como flags a
`QuestionsService`/`QuestionOutputPolicy`.

| Perfil | Comentario do professor | Analise detalhada | Gabarito no GET publico |
| --- | --- | --- | --- |
| Anonimo | Nao | Nao | Nao |
| Gratuito | Apenas se o plano gratuito conceder o entitlement | Apenas se o plano gratuito conceder o entitlement | Nao |
| Assinante sem entitlement | Nao | Nao | Nao |
| Assinante autorizado | Sim, conforme entitlement | Sim, conforme entitlement | Nao |
| Staff | Sim | Sim | Somente no endpoint administrativo |
| Admin | Sim | Sim | Somente no endpoint administrativo |

O novo bypass para `staff` esta no mesmo ponto de decisao server-side do
entitlement. O teste da politica executa essa matriz e tambem prova que
`data_json` e `raw_json` nunca voltam ao cliente.

### Matriz de `/admin` e APIs administrativas

`src/proxy.ts` consulta `GET /api/auth/admin-route-access.php` usando o cookie
HttpOnly de refresh. O endpoint responde `204` apenas para refresh ativo de
`admin` ou `staff`; qualquer outro estado devolve `404` sem payload.

| Caso | Resultado esperado | Cobertura |
| --- | --- | --- |
| Anonimo sem cookie | 404 | `adminRouteAccess.test.ts` nao chama o backend e nega acesso. |
| Aluno autenticado | 404 | teste de status `404`. |
| Cookie com sessao invalida | 404 | teste de status `404` e validacao de refresh ativo no backend. |
| Sessao expirada/revogada | 404 | teste de status `404` e asserts de `expires_at`, `session_expires_at` e `session_revoked_at`. |
| Staff | acesso | teste de `204`; backend permite explicitamente `staff`. |
| Admin | acesso | teste de `204`; backend permite explicitamente `admin`. |

O teste `backend/tests/AdminApiRbacWiringTest.php` percorre os 22 bridges de
`backend/api/admin/*.php`, confirma que todos delegam para
`modules/admin/routes.php` e que cada handler chama
`requireAdminSessionContext()` ou `requirePlatformAdminSessionContext()`.
Portanto, a protecao da pagina nao substitui o RBAC das APIs.

### Falhas da suite completa

O relatorio original de `954b524` registrava sete falhas preexistentes. A
execucao atual de `npx vitest run` fechou com **404 testes: 398 passaram e 6
falharam**. A setima, de coordenacao de refresh entre abas, passou depois da
correcao de sessao na fase seguinte.

| Arquivo | Teste | Mensagem atual/resumo | Ja falhava antes do hotfix? | Risco | Fase responsavel |
| --- | --- | --- | --- | --- | --- |
| `src/services/plans/__tests__/planAutoCoupon.test.ts` | `does not force a phantom 1% badge when there is no discount amount` | `658.8` recebido, esperado `660` | Sim, documentado como cupom anual | Comercial/financeiro: preco exibido diverge | Financeiro/cupons |
| `src/services/plans/__tests__/planAutoCoupon.test.ts` | `normalizes annual card values to the same monthly cents charged by Stripe` | `39.97` recebido, esperado `9.95` | Sim, documentado como cupom anual | Financeiro: parcela/cartao anual pode divergir do Stripe | Financeiro/cupons |
| `src/services/marketing/__tests__/landingPageSeo.test.ts` | `falls back to the default published landings when settings are unavailable` | titulo `Campanha indisponivel`, esperado conter `Plano Elite` | Sim, documentado como fallback SEO | SEO/comercial: pagina publica de campanha perde metadata | SEO/marketing |
| `src/services/admin/__tests__/adminArchitecture.test.ts` | `keeps the admin shell helpers thin` | `useAdminPageController.tsx` com 728 linhas, teto 700 | Sim, documentado como arquitetura admin | Manutencao/performance do painel | Frontend/admin |
| `src/services/admin/__tests__/adminArchitecture.test.ts` | `keeps runtime code free of DataProvider imports and debug-only logs` | 1 ocorrencia de log/debug encontrada | Sim, documentado como arquitetura admin | Ruido de runtime e quebra de orcamento arquitetural | Frontend/admin |
| `src/services/admin/__tests__/adminArchitecture.test.ts` | `marks top-bar notifications as seen when the dropdown is opened` | contrato esperado nao esta presente em `AdminTopBar.tsx` | Sim, documentado como arquitetura admin | UX de notificacoes administrativas | Frontend/notificacoes |
| `src/services/auth/__tests__/session.test.ts` | `aguarda refresh de outra aba quando encontra lock externo ativo` | **Passou na execucao atual** | Sim, era a setima falha | Sessao multiaba | Sessao/autenticacao, resolvida no checkpoint posterior |

Essas falhas nao foram ocultadas nem reclassificadas como fora de escopo. As
duas de cupom merecem prioridade financeira; as demais permanecem para suas
fases de dominio.

### Evidencia de execucao deste complemento

| Comando | Resultado |
| --- | --- |
| `npx vitest run src/services/auth/__tests__/adminRouteAccess.test.ts src/services/questions/__tests__/questionService.test.ts` | 21 testes passaram |
| `C:\\xampp\\php\\php.exe backend/tests/QuestionPublicOutputPolicyTest.php` | passou |
| `C:\\xampp\\php\\php.exe backend/tests/QuestionAnswerPayloadTrustBoundaryTest.php` | passou |
| `C:\\xampp\\php\\php.exe backend/tests/AdminRouteAccessWiringTest.php` | passou |
| `C:\\xampp\\php\\php.exe backend/tests/AdminApiRbacWiringTest.php` | passou |
| `npm run typecheck` | passou |
| `npm run build` | passou |
| lint de todos os PHPs em `backend/` | 651 arquivos, 0 erros de sintaxe |
| `npm run check:secrets` | passou; nenhum segredo rastreado |
| `npm run check:next-proxy` | passou |
| `npx vitest run` | 398 passaram, 6 falhas documentadas acima |

### Diff de `954b524` e arquivos deste complemento

O commit `954b524` criou a politica de saida publica, a guarda server-side de
`/admin`, testes iniciais de ambos e protecoes complementares de ownership e
segredos: 19 arquivos, 723 insercoes e 40 remocoes.

Este complemento altera somente a validacao condicionada:

- `backend/modules/questions/services/QuestionOutputPolicy.php`
- `backend/modules/questions/validators/QuestionsValidator.php`
- `backend/modules/questions/services/QuestionsService.php`
- `backend/modules/questions/routes.php`
- `backend/tests/QuestionPublicOutputPolicyTest.php`
- `backend/tests/QuestionAnswerPayloadTrustBoundaryTest.php`
- `backend/tests/AdminRouteAccessWiringTest.php`
- `backend/tests/AdminApiRbacWiringTest.php`
- `src/services/auth/__tests__/adminRouteAccess.test.ts`

Nao houve migration, escrita de banco ou mudanca de dados de usuarios. Nenhum
segredo foi adicionado ao versionamento. Rollback: reverter o commit deste
complemento restaura exatamente o comportamento anterior, sem exigir acao no
banco.

## Arquivos alterados

- `.gitignore`
- `backend/api/auth/admin-route-access.php`
- `backend/modules/auth/routes.php`
- `backend/modules/legal_commentary/repositories/LegalCommentaryRepository.php`
- `backend/modules/questions/services/QuestionOutputPolicy.php`
- `backend/modules/questions/services/QuestionOwnershipPolicy.php`
- `backend/modules/questions/services/QuestionsService.php`
- `backend/tests/AdminRouteAccessWiringTest.php`
- `backend/tests/LegalCommentaryOwnershipWiringTest.php`
- `backend/tests/QuestionOwnershipPolicyTest.php`
- `backend/tests/QuestionPublicOutputPolicyTest.php`
- `docs/security/credential-rotation.md`
- `package.json`
- `scripts/checks/check-next-proxy-convention.mjs`
- `scripts/checks/check-versioned-secrets.mjs`
- `src/proxy.ts`
- `src/services/auth/adminRouteAccess.ts`
- `src/services/auth/__tests__/adminRouteAccess.test.ts`

## Segredos e banco

Nenhum segredo foi adicionado ao Git. A varredura de arquivos rastreados passou.
Nenhuma migration foi necessaria, e nenhum banco, registro financeiro ou dado de
usuario foi modificado nesta fase.

## Estado da fase

Concluida para os hotfixes P0 definidos neste escopo. A validacao complementar
confirmou que o servidor calcula respostas, que o DTO publico e saneado de
forma recursiva e que `/admin` e suas APIs mantem RBAC independente. As seis
falhas restantes da suite completa estao registradas acima com risco e fase
responsavel; nenhuma pertence aos dois hotfixes P0 desta fase. A proxima fase
permanece bloqueada ate aprovacao explicita do usuario.
