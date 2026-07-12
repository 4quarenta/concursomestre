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

Concluida para os hotfixes P0 definidos neste escopo, com codigo, testes,
rollback e evidencia de producao. A proxima fase permanece bloqueada ate
aprovacao explicita do usuario.
