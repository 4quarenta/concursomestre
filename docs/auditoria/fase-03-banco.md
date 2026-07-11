# Fase 03 - Banco de dados e migrations

## Escopo e evidencias

Esta fase estabelece o controle de migrations, diagnosticos e protecoes contra DDL em request. A avaliacao estrutural privada, o dump SQL e a matriz de mudancas foram consultados localmente e permanecem fora do repositorio.

O snapshot auditado aponta 85 tabelas, 291 indices, 55 chaves estrangeiras, 130 colunas relacionais sem FK, 45 colunas textuais com sufixo `_json`, sete assinaturas de indice duplicadas e variacoes de tipos para IDs de usuario. Essas informacoes sao ponto de partida, nao autorizacao para alterar schema sem executar os diagnosticos no banco-alvo.

Nao havia MySQL acessivel neste workspace. Por isso, nenhum EXPLAIN, migration, baseline, backfill ou reparo de dados foi executado nesta fase.

## Entregas

- `SchemaMigrationRunner` registra versao, checksum, executor e tempo em `schema_migrations`.
- Runner CLI com `--status`, `--dry-run`, `--baseline-legacy`, `--apply` e bloqueios por ambiente.
- Migrations observaveis para metadata de auditoria e checkpoints de backfill.
- Migration fundacional e de compatibilidade para sessoes, refresh tokens, notificacoes, eventos de webhook e cronogramas.
- Restricao unica de webhook isolada em migration posterior: ela consulta duplicidades e falha sem alterar dados se houver conflito.
- Diagnostico de IDs de usuario, JSON textual, indices duplicados, FKs incompatíveis, orfaos e collations.
- Script de EXPLAIN para pratica, administracao, estatisticas, financeiro, notificacoes, lei comentada e marketplace.
- Preflight de colunas JSON com dry run e checkpoint opcional. Ele nao converte dados nem muda tipos.
- Quatro caminhos sensiveis deixaram de criar/alterar schema durante request: autenticacao, notificacoes, eventos de webhook e cronograma de estudos.

## Ordem segura de deploy

1. Gerar e verificar backup restauravel do banco.
2. Em staging, executar `php backend/scripts/diagnostics/schema_audit.php --output=tmp/schema-audit.json`.
3. Executar `php backend/scripts/diagnostics/explain_critical_queries.php` e guardar o resultado do plano.
4. Rodar `php backend/scripts/diagnostics/runtime_ddl_inventory.php` para quantificar o legado restante.
5. Executar `php backend/scripts/migrations/run_schema_migrations.php --status`.
6. Validar que as migrations historicas correspondem ao schema real; somente entao usar `MIGRATIONS_ALLOW_APPLY=true php backend/scripts/migrations/run_schema_migrations.php --baseline-legacy`.
7. Conferir `--dry-run` e aplicar novas migrations. Em producao, incluir `MIGRATIONS_ALLOW_PRODUCTION=true` apenas depois da validacao em staging.
8. Rodar `php backend/scripts/backfills/json_column_preflight.php --output=tmp/json-preflight.json` antes de qualquer proposta de JSON nativo ou CHECK JSON_VALID.
9. Aplicar a restricao unica de webhook apenas se o diagnostico nao apontar duplicidades.

## Rollback

Nao ha rollback destrutivo automatico. Cada migration desta fase e aditiva. Para reverter uma entrega, restaure o backup verificado ou publique uma migration corretiva nova; nunca apague uma linha de `schema_migrations` nem altere o checksum de migration aplicada.

## Mudancas deliberadamente adiadas

- Criacao de novas FKs: depende de diagnostico de orfaos e compatibilidade de tipo/collation.
- Normalizacao de IDs de usuario: `users.id` e tabelas relacionadas devem ser migradas em lotes idempotentes, com checkpoint e dupla leitura temporaria quando necessario.
- Conversao de `_json` textuais para JSON nativo: so apos `JSON_VALID`, amostragem e plano de compatibilidade para consultas existentes.
- Consolidacao de collations: exige auditoria de comparacoes e deploy em janela controlada.
- Remocao das demais ocorrencias de DDL runtime: o inventario atual encontrou 228 ocorrencias fora de migrations. Elas continuam como legado e nao foram alteradas sem esquema real. Novas alteracoes nesses dominios devem primeiro ganhar migration e `SchemaReadiness`.
- Maiores concentracoes inventariadas: `QuestionsRepository` (49), `LegalCommentaryRepository` (30), `RankingsService` (20), `ExamsRepository` (12), `AuthRepository` (12) e `FeedbackRepository` (10). Elas definem a fila de migracao posterior por dominio.
- A migration historica `20260630_exam_bank_canonical.sql` referencia `questions.numero`, coluna nao confirmada no snapshot. Ela deve ser tratada como legado e apenas baselineada apos revisao, nao reaplicada automaticamente.

## Fontes canonicas por dominio

| Dominio | Fonte primaria | Complementos |
| --- | --- | --- |
| Usuarios e acesso | `users` | `auth_sessions`, `auth_refresh_tokens` |
| Assinaturas e pagamentos | `user_subscriptions` | `plans`, `transactions`, `provider_webhook_events`, cupons |
| Questoes e provas | `questions` | `provas`, `question_provas`, `question_filters`, contextos |
| Taxonomias | `filters` | relacoes de filtros das questoes e provas |
| Lei comentada | `laws` e `law_articles` | secoes, blocos, editoriais e comentarios |
| Notificacoes | `notifications` | configuracoes e eventos de dominio |
| Marketplace | `materials` | avaliacoes, compras e transacoes |
| Moderacao | `reports` | historico e rascunhos de moderacao |

## Estado da fase

O mecanismo de controle foi implementado e testado estaticamente. A validacao contra dados reais permanece pendente de staging/VPS, incluindo EXPLAIN, orfaos, duplicidades e validade de JSON. Nenhuma migration foi executada e nenhum dado foi modificado.
