# Fase 03 - Banco de dados e migrations

## Estado confirmado em producao

Em 2026-07-11, a Fase 03 foi validada no MySQL 8.4 da VPS de producao.
O banco possui 85 tabelas. Antes de qualquer escrita foi criado e testado o
backup restauravel em
`/root/backups/concursomestre-phase3-20260711T110441Z/database-pre-migration.sql.gz`.
O mesmo diretorio contem backup do backend, frontend e o pacote compactado de
diagnosticos da fase.

Os diagnosticos reais registraram:

- 24 divergencias de ID/collation em relacionamentos de usuario;
- uma divergencia de tipo/collation em FK;
- um orfao em `auth_sessions.user_id` e quatro em `transactions.user_id`;
- nenhum valor JSON invalido nos campos verificados;
- nenhum par duplicado em `provider_webhook_events`;
- sete planos `EXPLAIN` executados para consultas criticas.

Esses achados foram registrados, mas nao foram corrigidos automaticamente:
nenhuma rotina desta fase deve escolher dono de sessao/transacao, apagar
orfaos ou normalizar dados financeiros sem conciliacao de dominio.

## Migrations executadas

O runner foi ajustado para diferenciar migrations legadas com o mesmo prefixo
de data usando um sufixo estavel derivado do nome do arquivo. O baseline
legado tambem passou a ser transacional, evitando historico parcial em caso de
falha.

Na VPS foram baselineadas 14 migrations legadas e aplicadas as cinco
migrations da Fase 03:

1. `20260711_000000`
2. `20260711_000100`
3. `20260711_000200`
4. `20260711_000210`
5. `20260711_000220`

O preflight de JSON foi executado e registrou o checkpoint 1. Ao final da
Fase 03 havia 19 registros em `schema_migrations`; depois das tres migrations
aditivas da Fase 04, o total passou a 22. O status atual do runner informa zero
migrations pendentes.

## Entregas

- `SchemaMigrationRunner` registra versao, checksum, executor e tempo.
- O baseline legado e atomico.
- Migrations aditivas para metadata, sessoes, refresh tokens, notificacoes,
  eventos de webhook e cronogramas.
- Diagnosticos para IDs de usuario, JSON textual, indices, FKs, orfaos,
  collations e consultas criticas.
- Preflight de JSON com checkpoint, sem conversao silenciosa de dados.
- Os caminhos sensiveis auditados deixaram de executar DDL em request.

## Rollback

Nao ha rollback SQL destrutivo automatico. As migrations aplicadas sao
aditivas. Para reverter uma entrega, restaure o dump verificado ou publique
uma migration corretiva; nunca apague registros de `schema_migrations` nem
altere checksums de migrations aplicadas.

## Pendencias deliberadas

- Conciliar os cinco orfaos e as divergencias de ID/collation com regra de
  negocio e trilha de auditoria.
- Planejar, testar e executar em lotes a normalizacao de IDs de usuario.
- Converter colunas `_json` apenas apos plano de compatibilidade e backfill.
- Consolidar collations em janela controlada.
- Remover DDL runtime legado dos demais modulos por fases de dominio.

## Fontes canonicas por dominio

| Dominio | Fonte primaria | Complementos |
| --- | --- | --- |
| Usuarios e acesso | `users` | `auth_sessions`, `auth_refresh_tokens` |
| Assinaturas e pagamentos | `user_subscriptions` | `plans`, `transactions`, `provider_webhook_events`, cupons |
| Questoes e provas | `questions` | `provas`, `question_provas`, `question_filters`, contextos |
| Taxonomias | `filters` | relacoes de filtros das questoes e provas |
| Lei comentada | `laws`, `law_articles` | secoes, blocos, editoriais e comentarios |
| Notificacoes | `notifications` | configuracoes e eventos de dominio |
| Marketplace | `materials` | avaliacoes, compras e transacoes |
| Moderacao | `reports` | historico e rascunhos de moderacao |

## Estado da fase

Fase concluida quanto a infraestrutura de migrations, diagnosticos e
validacao em banco real. As correcoes de dados identificadas foram mantidas
como backlog controlado para fases que possuam a regra de negocio necessaria.
