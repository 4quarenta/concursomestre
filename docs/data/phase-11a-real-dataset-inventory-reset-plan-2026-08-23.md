# Macroetapa 11A - Inventario e plano do dataset definitivo

Data da medicao: 2026-08-23T23:17:21-03:00

> Escopo somente leitura. Este documento nao autoriza reset, carga, migration, backfill, deploy, indexacao ou sitemap.

## A. Resumo executivo

Classificacao: **INTERROMPER / DATASET_PHASE_11B_EXECUTION_NOT_READY**. O alvo e o acesso read-only estao comprovados, todas as 125 tabelas foram classificadas e existe backup recente com checksum valido. SEO_LAUNCH_MODE esta ausente e o modo efetivo continua PRELAUNCH. A execucao continua insegura porque o reset legado alcanca dados operacionais de usuarios, ha FKs de dados protegidos para conteudo temporario, faltam fontes reais aprovadas, tres migrations canonicas nao estao na producao, nao ha restore rehearsal descartavel nem backup comprovado dos arquivos e a janela de escritores nao foi ensaiada.

## B. Baseline

Branch `1.0.0`; baseline `fbb34f83f94bbda0792bd861c20d137916566a58`; correspondencia confirmada antes da medicao.

## C. Git/worktree

Worktree estava limpo no precheck. Esta etapa cria somente este relatorio e um manifesto ignorado; nenhum commit sera feito.

## D. Database fingerprint

Fingerprint aprovado apenas para comparacao futura: `DE1C17E4F451257F521E879C37B7CDCFBAA58F0BC11EDC00EA8F4BF346B2989A`. Componentes: banco, ambiente, versao, 125 tabelas, schema/count hashes e migration maxima. Host e credenciais nao sao publicados.

## E. Environment classification

Alvo classificado como PRODUCTION_PRIMARY_WITH_DEDICATED_READ_ONLY_USER. Nao e staging nem replica; o servidor MySQL globalmente aceita escrita, mas a credencial de auditoria nao.

## F. DB role/access

SSH PASS; SQL PASS; SELECT/SHOW VIEW/EXPLAIN PASS; write privileges=0; transporte por SSH ate MySQL 127.0.0.1:3306. Nenhum fallback de escrita foi usado.

## G. Schema inventory

125 tabelas InnoDB, 125 PKs, 91 FKs, 204 linhas de indices unicos, zero views/routines/triggers/events encontrados no inventario de objetos. Collations utf8mb4_unicode_ci e utf8mb4_0900_ai_ci coexistem.

## H. Table inventory

Contagem exata leve: 313.629 linhas. O inventario integral esta em CE.

## I. Table classification

| Categoria | Tabelas | Linhas |
| --- | --- | --- |
| SCHEMA_INFRASTRUCTURE | 3 | 63 |
| SYSTEM_CONFIGURATION | 4 | 113 |
| AUTH_IDENTITY | 8 | 851 |
| BILLING_FINANCIAL | 9 | 694 |
| USER_GENERATED_OPERATIONAL | 34 | 463 |
| CONTENT_CANONICAL | 22 | 2147 |
| CONTENT_RELATION | 18 | 19669 |
| TAXONOMY | 5 | 283837 |
| SEO_OPERATIONAL | 3 | 1157 |
| IMPORT_STAGING | 12 | 2694 |
| AUDIT_LOG | 6 | 1941 |
| TEMP_FIXTURE | 1 | 0 |
| UNKNOWN | 0 | 0 |

## J. Protected tables

65 tabelas estao NEVER_PURGE/PRESERVE_ALL. Users/auth/billing/settings/migrations/audit e dados operacionais de usuario nunca entram em allowlist destrutiva.

## K. Auth/users

6 usuarios, incluindo perfis admin/staff/student; ha CPF/telefone/Stripe em parte dos registros. Nenhum usuario foi classificado como teste. Auth tem 24 sessoes e 812 refresh tokens no snapshot.

## L. Billing/financial

13 assinaturas, 45 transacoes, 48 ledger entries, 587 webhooks e 1 coupon reservation. Esses dados sao operacionais e NEVER_PURGE.

## M. Configuration/settings

system_settings=99, plans=14, cache_settings=0, security_ip_bans=0. Preservar integralmente; o plano de teste em plans exige revisao pontual, nunca truncate.

## N. Migration history

62 migrations aplicadas ate 20260811_151000. Historico NEVER_PURGE. Tres migrations locais posteriores estao ausentes na producao; ver BN.

## O. Content domains

Dominios de conteudo atuais foram classificados como temporarios pela premissa de negocio, mas essa premissa nao autoriza apagar dados de usuarios nem substitui marcadores objetivos em tabelas mistas.

## P. Question domain

1.130 questoes publicadas/publicas; 1.078 Gran e 52 sem source_provider. Ha 4.881 opcoes, 12.289 relacoes de filtros e 1.130 relacoes com provas. A fonte definitiva e direitos nao estao aprovados.

## Q. Taxonomies

63.073 filters, 63.428 source identities e 157.326 relationships. Gran domina a taxonomia; manifests nao registram sync total concluido e existem falhas abertas.

## R. Boards/organizations

Bancas e orgaos vivem em filters, com identidade de fonte Gran quando presente. Nao ha fonte real aprovada nem dedupe final para a carga definitiva.

## S. Exams

100 provas publicas/publicadas, 195 arquivos, 855 extracoes (774 done, 65 failed, 16 review) e 572 prova_filters. Associacoes reais exigem manifest e direitos.

## T. Contests

Tabelas canonicas Contest nao existem no schema medido. A migration local 20260819_120000 nao foi aplicada; nao ha fonte editorial real aprovada.

## U. Careers/positions

Carreiras/cargos estao em filters e filter_relationships Gran. O sincronizador/importador deve ser revisto antes da carga real; inferencia por nome e proibida.

## V. Public simulations

simulations=3 representa tentativas privadas atuais. As tabelas public_simulation_* nao existem no schema medido; nao confundir as duas identidades.

## W. Laws/articles

1 lei, 4 artigos e 1 progresso de usuario. Planalto e fonte oficial potencial; comentario/editorial exige aprovacao separada. O progresso protegido impede purge amplo por cascade.

## X. Materials

materials=0, mas o dominio possui autoria/arquivos/ratings e migration publica pendente. Nao ha catalogo real nem direitos aprovados.

## Y. Blog

6 artigos publicados, 6 categorias, 17 tags e 17 relacoes. Fonte definitiva e editorial; corpus e direitos de imagem nao foram fornecidos.

## Z. User operational data

Dados operacionais protegidos incluem respostas, progresso, favoritos, notas, comentarios, notificacoes, gamificacao, sessoes de estudo e eventos. Nao sao fixture por aparencia.

## AA. Fixture provenance

| Tabela/dominio | Estrategia | Fonte | Marcador | Confianca | Selector seguro? |
| --- | --- | --- | --- | --- | --- |
| questions/provas/filters | source_provider/source identities/provider batch | Gran crawler/private ingestion | provider=gran and explicit source identity | HIGH for provenance; LOW for business test ownership | NO until source manifest and preserve closure approved |
| manual questions | exact source-null row set | manual/admin or historical seed | source_provider IS NULL | LOW | NO |
| legal areas | migration ID and exact seeded identities | 20260808_160200_seed_legal_areas | migration-defined IDs/slugs | HIGH | Only with explicit editorial decision |
| stripe_testing_matrix_runs | table ownership + run identity | billing test matrix | dedicated table | HIGH | YES when rows exist and exact run IDs approved |
| rankings | seed script identities | rankings_seed_data.sql | known seed IDs | MEDIUM | NO until DB rows matched exactly |
| users/auth/billing | no safe fixture ownership marker | unknown/mixed operational use | none | NONE | NEVER |
| user operational rows | FK to real user identities | runtime activity | user_id and timestamps | HIGH operational; not test-safe | NEVER without explicit user-data policy |

## AB. Test-row identification

Marcadores de provider/batch provam origem, nao provam por si so que a linha pode ser apagada. Linhas manuais/source NULL e tabelas mistas nao possuem selector destrutivo aprovado.

## AC. Unknown records

Tabelas UNKNOWN=0. Registros de propriedade incerta permanecem REVIEW_REQUIRED; unknown records nao entram no purge.

## AD. FK graph

91 FKs inventariadas. Existem auto-referencias em comments e filters. O grafo completo esta em CF.

## AE. Purge order

Foi calculada uma ordem children-to-parents para 45 tabelas candidatas. Ela e somente plano; todas as linhas estao executeIn11B=NO ate os blockers fecharem.

## AF. Preserve plan

O preserve plan esta em CH. Contagem, PK checksum/agregados e nenhuma exposicao de conteudo devem ser validados antes e depois.

## AG. File/storage assets

| Path | Files | Bytes | Classificacao | Notas |
| --- | --- | --- | --- | --- |
| storage/logs | 8 | 9584488 | PRESERVE | Operational logs; retention policy only |
| storage/runtime | 124 | 3690 | PRESERVE_RUNTIME | Cookies/rate limits; not dataset content |
| storage/health | 4 | 786 | PRESERVE | Worker health evidence |
| storage/sitemaps | 13 | 214950 | DERIVED_PRESERVE_PRELAUNCH | Do not publish or regenerate in 11A |
| uploads/question-assets | 137 | 2350210 | REVIEW_REQUIRED | Content assets need DB/file manifest and approved source |
| uploads/exams | 197 | 88663854 | REVIEW_REQUIRED | Exam assets need checksum, rights and DB relation closure |
| uploads/profiles | 1 | 389045 | PRESERVE | User asset |
| uploads/materials | 1 | 19 | REVIEW_REQUIRED | Potential user/marketplace ownership |
| uploads/admin-assets | 1 | 13022 | PRESERVE_OR_EDITORIAL_REVIEW | Editorial/admin asset |
| uploads/question-contexts | 0 | 0 | REVIEW_REQUIRED | Content asset namespace |

## AH. Real-data sources

Nenhum conjunto completo de fontes reais esta READY. Gran e importadores existentes sao apenas fontes potenciais/parciais; Contests, simulados publicos, materiais e blog dependem de fonte/editorial.

## AI. Existing importers

Existem crawler Gran, private ingestion, importador de provas/PDF, extrator e PlanaltoImportService. Nao foram executados nesta etapa.

## AJ. Gran/external crawler

Crawler Gran: contrato e identidades existem, mas manifests incompletos, falhas abertas, direitos nao aprovados e idempotencia sem rehearsal impedem uso real.

## AK. Exam importer

Importador/extrator de provas existe. O pacote definitivo, checksums, direitos, quarentena de 65 failed/16 review e rehearsal idempotente ainda faltam.

## AL. Law importer

Planalto importer existe e usa URL oficial. Catalogo, selecao editorial e separacao entre texto oficial e comentario devem ser aprovados.

## AM. Rights/provenance

Rights/provenance e gate obrigatorio por dominio. Nenhum provider externo e considerado aprovado apenas porque dados temporarios ja foram importados.

## AN. Real-data contracts

Contratos minimos: identidade, FK, slug, publication, rights, UTF-8, unicidade, URL segura e source manifest. CK detalha validacoes.

## AO. ID strategy

IDs internos devem ser gerados/preservados conforme contrato por dominio; source IDs ficam em identity mapping. Nunca usar source ID como PK sem contrato expresso.

## AP. Slug strategy

Slug persistido, valido, unico no namespace e estavel. Proibido slugify em runtime para identidade canonica.

## AQ. Alias strategy

Alias deve resolver exatamente um canonical atual, um hop, sem loops nem colisao; canonical vence alias.

## AR. Idempotency

Idempotencia precisa ser provada por migration ID/source identity/batch key. Estado atual nao prova rerun seguro dos importadores em carga real.

## AS. Load order

Ordem proposta: schema rehearsed; filter contract; taxonomias; exams; contests; questions; public simulations; laws; materials; blog; derivados; SEO artifacts. CJ contem dependencias.

## AT. Chunking

Batches pequenos com expected counts, checkpoint e rollback unit por dominio. Evitar uma unica transacao para arquivos ou grandes volumes.

## AU. Failure/quarantine

Invalidos vao para quarantine/rejected report; inserted/updated/skipped/duplicate/invalid/failed devem ser contados. Nenhuma correcao silenciosa.

## AV. Encoding

Validar UTF-8, bytes invalidos, mojibake, HTML entities e acentos antes/depois da carga.

## AW. URLs

URLs: schemes permitidos, sem credenciais, localhost, IP privado/reservado ou token privado exposto.

## AX. Dates

Datas: publication, schedule, contest/exam, embargo e timezone sob regras de dominio.

## AY. Uniqueness

Validar PK, canonical identity, slug, relation e source identity duplicados.

## AZ. Referential integrity

Validar orphan FK, dangling junction e relacoes quebradas por dominio apos cada batch.

## BA. Taxonomy hierarchy

Validar materia/topico/subtopico/assunto, parent type, ciclos e child identity; os 10.929 invalid chains temporarios nao podem migrar automaticamente.

## BB. Domain-specific validation

Question/exam/contest/simulation/law/material/blog checks estao em CK; volume nao substitui identidade nem readiness.

## BC. Backup capability

Backup real recente existe, com dump, heartbeat e checksum valido; inclui schema/data/routines/triggers/events e utf8mb4.

## BD. Backup security

Backup fica fora do webroot, sidecar SHA-256 valido e retencao 14 dias. O dump contem PII, autenticacao e dados financeiros; deve permanecer privado, criptografado/acl controlado e nunca entrar em Git. Nenhum dump foi copiado ao workspace.

## BE. Restore capability

Restore tool existe e e protegido, mas nao ha evidencia de restore completo em banco descartavel com smoke/integridade. Capability=PARTIAL.

## BF. Rollback

Falha futura: interromper writers de conteudo, preservar batch/log, restaurar backup em procedimento aprovado, validar fingerprint/FKs/contagens e manter PRELAUNCH.

## BG. Concurrent writers

Writers ativos: frontend, platform events, dois ingestion workers, extrator, crons financeiros/editoriais/backup e timers de sitemap/archive. Freeze seletivo nao foi ensaiado.

## BH. Billing/user preservation

Billing/webhooks e dados de usuario devem continuar preservados. A operacao precisa separar writers de conteudo de writers financeiros e impedir cascades.

## BI. Dry-run

Dry-run futuro deve usar somente SELECT/COUNT/EXISTS/JOIN e imprimir selectors/expected counts. A 11A executou zero DML/DDL.

## BJ. Expected counts

| Purge policy | Tabelas | Linhas snapshot |
| --- | --- | --- |
| NEVER_PURGE | 60 | 4012 |
| PRESERVE_ALL | 5 | 123 |
| PURGE_ALL_DATA_KEEP_SCHEMA | 3 | 1157 |
| PURGE_TEST_ROWS_ONLY | 1 | 0 |
| REBUILD_FROM_REAL_DATA | 41 | 305643 |
| REVIEW_REQUIRED | 15 | 2694 |

## BK. Test residue detection

Reporter de residuo deve procurar source batches, fixture IDs/slugs e seeds conhecidos, apenas relatar e controlar falsos positivos.

## BL. Real-data load plan

Plano de carga integral em CJ. Nenhum dominio marcado SOURCE_MISSING pode ser fingido como completo.

## BM. Post-load validation

Apos carga: counts, FKs, duplicates, slugs, rights, publication, readiness, security sentinels, SSR/crawl e gates reais.

## BN. Schema gaps

REAL_DATA_SCHEMA_GAP: migrations canonicas de contests, public simulations e public materials nao estao na producao; rehearsal staging e rollout separado sao obrigatorios.

| Domain | Field/schema | Expected | Actual schema | Impact | Proposed change |
| --- | --- | --- | --- | --- | --- |
| Canonical contests | contests + five contest relation/alias tables | Versioned canonical Contest schema | All six tables absent | Cannot load or validate real canonical contests | Rehearse 20260819_120000 in isolated MySQL 8.4, then approve a separate rollout |
| Public simulations | public_simulations + five relation/alias tables | Separated public content model | All six tables absent; only private simulations exists | Cannot load public simulations without mixing attempts | Rehearse 20260819_130000 in isolated MySQL 8.4, then approve a separate rollout |
| Public materials | public columns and material_aliases | Approved public material publication/alias contract | Migration not applied; current materials schema is pre-START #7 | Definitive material load cannot satisfy public contract | Rehearse 20260821_120000 in isolated MySQL 8.4, then approve a separate rollout |

## BO. 20 open gates

Os 20 gates permanecem OPEN_NOW e aparecem exatamente em CL.

## BP. Gate execution timing

Gates de real DB podem iniciar apos carga em staging; production/host/FIELD/RUM/CrUX continuam abertos ate o ambiente correspondente.

## BQ. Real-data reporter

RealDatasetReadinessReporter foi planejado, nao implementado: SELECT-only, fail-closed sem DB_READ e sem projection de conteudo protegido.

## BR. Safety guards

Guardas futuros: fingerprint, environment, explicit execute token, backup/checksum/restore, allowlist, denylist, expected count, source manifest e audit log.

## BS. Destructive flag

Default deve ser zero writes; --execute sozinho nao basta. Exigir token forte e todos os demais guards.

## BT. Fingerprint guard

Fingerprint futuro deve igualar `DE1C17E4F451257F521E879C37B7CDCFBAA58F0BC11EDC00EA8F4BF346B2989A` e tambem validar schema/count drift aprovado; qualquer diferenca aborta.

## BU. Backup guard

Purge aborta sem backup novo, checksum valido, restore rehearsal e asset backup/manifest.

## BV. Allowlist

Allowlist somente por tabela/selector aprovado; nunca todas-as-tabelas-exceto.

## BW. Denylist

Denylist: auth, users, billing, settings, migrations, audit e user operational, inclusive tabelas com cascade para conteudo.

## BX. Expected-count guard

Actual candidate count fora do intervalo aprovado aborta antes do primeiro DELETE.

## BY. Tests

Executados nesta 11A: baseline/status, schema/count/FK inventory, aggregate read-only, grants/EXPLAIN, backup/checksum/heartbeat e asset/writer inventory. Gates locais finais sao relatados ao fim.

## BZ. Security

Nenhuma credencial, PII, conteudo protegido, dump ou filename sensivel foi materializado. Secret scan deve passar.

## CA. P0

1. LEGACY_RESET_SCRIPT_UNSAFE_FOR_11B: Existing production reset allowlist includes user operational rows and uses FOREIGN_KEY_CHECKS=0 without fingerprint, backup or expected-count guards.

## CB. P1

9. PROTECTED_CONTENT_REFERENCE_CLOSURE_UNRESOLVED; REAL_DATA_SOURCE_NOT_AVAILABLE_FOR_ALL_INTENDED_DOMAINS; SOURCE_RIGHTS_AND_PROVENANCE_NOT_APPROVED; CANONICAL_SCHEMA_MIGRATIONS_NOT_APPLIED_OR_REHEARSED; DISPOSABLE_RESTORE_REHEARSAL_NOT_PROVEN; FILE_STORAGE_BACKUP_AND_RESTORE_NOT_PROVEN; CONCURRENT_WRITER_FREEZE_NOT_REHEARSED; FIXTURE_ROW_OWNERSHIP_NOT_OBJECTIVELY_PROVEN_FOR_MIXED_TABLES; CONTENT_RESET_EXPECTED_COUNT_AND_FINGERPRINT_GUARDS_NOT_IMPLEMENTED.

## CC. P2

Importer throughput and chunk-size tuning on the definitive dataset; Optional richer quarantine/reporting UI; FIELD/RUM/CrUX validations remain future by definition

## CD. Execution blockers

- LEGACY_RESET_SCRIPT_UNSAFE_FOR_11B
- PROTECTED_CONTENT_REFERENCE_CLOSURE_UNRESOLVED
- REAL_DATA_SOURCE_NOT_AVAILABLE_FOR_ALL_INTENDED_DOMAINS
- SOURCE_RIGHTS_AND_PROVENANCE_NOT_APPROVED
- CANONICAL_SCHEMA_MIGRATIONS_NOT_APPLIED_OR_REHEARSED
- DISPOSABLE_RESTORE_REHEARSAL_NOT_PROVEN
- FILE_STORAGE_BACKUP_AND_RESTORE_NOT_PROVEN
- CONCURRENT_WRITER_FREEZE_NOT_REHEARSED
- FIXTURE_ROW_OWNERSHIP_NOT_OBJECTIVELY_PROVEN_FOR_MIXED_TABLES
- CONTENT_RESET_EXPECTED_COUNT_AND_FINGERPRINT_GUARDS_NOT_IMPLEMENTED

## CE. Table matrix

| Table | Domain | Rows | Contains test | Contains potential real | Classification | Purge policy | Load policy | Protected | Evidence | PK | FK out/in | Unique | Purpose | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| addresses | AUTH_IDENTITY | 2 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_IDENTITY | NEVER_PURGE | PRESERVE | true | Exact read-only count=2; schema/FK inventory; category contract; business premise for current content | user_id | 1/0 | PRIMARY(user_id) | auth identity: addresses | - |
| admin_audit_logs | AUDIT_LOG | 1926 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_AUDIT | NEVER_PURGE | PRESERVE | true | Exact read-only count=1926; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | audit log: admin audit logs | - |
| analytics_lifecycle_events | USER_GENERATED_OPERATIONAL | 103 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=103; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id) | user generated operational: analytics lifecycle events | - |
| article_doutrina | CONTENT_CANONICAL | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id) | content canonical: article doutrina | - |
| article_exam_tips | CONTENT_CANONICAL | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id) | content canonical: article exam tips | - |
| article_jurisprudence | CONTENT_CANONICAL | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id) | content canonical: article jurisprudence | - |
| article_sumulas | CONTENT_CANONICAL | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id) | content canonical: article sumulas | - |
| auth_refresh_tokens | AUTH_IDENTITY | 812 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_IDENTITY | NEVER_PURGE | PRESERVE | true | Exact read-only count=812; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); token_hash(token_hash) | auth identity: auth refresh tokens | - |
| auth_sessions | AUTH_IDENTITY | 24 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_IDENTITY | NEVER_PURGE | PRESERVE | true | Exact read-only count=24; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id) | auth identity: auth sessions | - |
| bank_accounts | AUTH_IDENTITY | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_IDENTITY | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | user_id | 1/0 | PRIMARY(user_id) | auth identity: bank accounts | - |
| blog_article_likes | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | article_id,user_id | 1/0 | PRIMARY(article_id,user_id) | user generated operational: blog article likes | - |
| blog_article_tags | CONTENT_RELATION | 17 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=17; schema/FK inventory; category contract; business premise for current content | article_id,tag_id | 2/0 | PRIMARY(article_id,tag_id) | content relation: blog article tags | - |
| blog_articles | CONTENT_CANONICAL | 6 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=6; schema/FK inventory; category contract; business premise for current content | id | 1/2 | PRIMARY(id); uq_blog_articles_slug(slug) | Canonical public blog articles | - |
| blog_categories | CONTENT_CANONICAL | 6 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=6; schema/FK inventory; category contract; business premise for current content | id | 0/1 | PRIMARY(id); uq_blog_categories_slug(slug) | content canonical: blog categories | - |
| blog_tags | CONTENT_CANONICAL | 17 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=17; schema/FK inventory; category contract; business premise for current content | id | 0/1 | PRIMARY(id); uq_blog_tags_slug(slug) | content canonical: blog tags | - |
| cache_settings | SYSTEM_CONFIGURATION | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_PROTECTED_STATE | PROTECTED_CONFIGURATION | PRESERVE_ALL | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | system configuration: cache settings | - |
| changelogs | CONTENT_CANONICAL | 1 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=1; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_changelogs_slug(slug); uq_changelogs_version(version) | content canonical: changelogs | - |
| comment_likes | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | user_id,comment_id | 2/0 | PRIMARY(user_id,comment_id) | user generated operational: comment likes | - |
| comments | USER_GENERATED_OPERATIONAL | 4 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=4; schema/FK inventory; category contract; business premise for current content | id | 2/2 | PRIMARY(id) | user generated operational: comments | - |
| coupon_reservations | BILLING_FINANCIAL | 1 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_FINANCIAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=1; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uniq_coupon_reservation_attempt(coupon_code,user_id,checkout_attempt_id,provider) | billing financial: coupon reservations | - |
| email_verifications | AUTH_IDENTITY | 4 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_IDENTITY | NEVER_PURGE | PRESERVE | true | Exact read-only count=4; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id); token(token) | auth identity: email verifications | - |
| filter_aliases | TAXONOMY | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id); uq_filter_alias(filter_id,normalized_alias) | taxonomy: filter aliases | - |
| filter_relationships | TAXONOMY | 157326 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=157326; schema/FK inventory; category contract; business premise for current content | id | 2/0 | PRIMARY(id); uq_filter_relationship(source_filter_id,target_filter_id,relation_type,source_provider) | Explicit typed relationships between filters | - |
| filter_source_identities | TAXONOMY | 63428 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=63428; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id); uq_filter_source_identity(filter_type,source_provider,source_entity_type,source_external_id) | External-source identity mapping for filters | - |
| filter_types | TAXONOMY | 10 | NO_PROTECTED_CONTRACT | YES_PROTECTED_STATE | PROTECTED_TAXONOMY_CONTRACT | PRESERVE_ALL | PRESERVE | true | Exact read-only count=10; schema/FK inventory; category contract; business premise for current content | code | 0/0 | PRIMARY(code) | taxonomy: filter types | - |
| filters | TAXONOMY | 63073 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=63073; schema/FK inventory; category contract; business premise for current content | id | 1/12 | PRIMARY(id); unique_type_slug(type,slug); uq_filters_source_identity(type,source_provider,source_entity_type,source_external_id); uq_filters_type_acronym(type,acronym) | Canonical filter and taxonomy identities | - |
| financial_ledger_entries | BILLING_FINANCIAL | 48 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_FINANCIAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=48; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_financial_ledger_entry_key(entry_key) | Immutable financial accounting entries | - |
| gran_automatic_crawler_checkpoints | IMPORT_STAGING | 1 | POSSIBLE_IMPORT_TEST_OR_PROVENANCE | UNKNOWN_PROVENANCE_MUST_BE_RETAINED | IMPORT_PROVENANCE_REVIEW | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=1; schema/FK inventory; category contract; business premise for current content | actor_user_id | 0/0 | PRIMARY(actor_user_id) | import staging: gran automatic crawler checkpoints | No destructive selector is approved. |
| gran_question_publication_failures | IMPORT_STAGING | 199 | POSSIBLE_IMPORT_TEST_OR_PROVENANCE | UNKNOWN_PROVENANCE_MUST_BE_RETAINED | IMPORT_PROVENANCE_REVIEW | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=199; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id); uq_gran_failure_source(source_key) | Gran import failure diagnostics | No destructive selector is approved. |
| gran_taxonomy_sync_manifests | IMPORT_STAGING | 7 | POSSIBLE_IMPORT_TEST_OR_PROVENANCE | UNKNOWN_PROVENANCE_MUST_BE_RETAINED | IMPORT_PROVENANCE_REVIEW | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=7; schema/FK inventory; category contract; business premise for current content | taxonomy_kind | 0/0 | PRIMARY(taxonomy_kind) | Gran taxonomy source manifests | No destructive selector is approved. |
| law_article_blocks | CONTENT_CANONICAL | 21 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=21; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id); uniq_article_block_uid(law_article_id,block_uid) | content canonical: law article blocks | - |
| law_article_versions | CONTENT_RELATION | 4 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=4; schema/FK inventory; category contract; business premise for current content | id | 2/0 | PRIMARY(id) | content relation: law article versions | - |
| law_articles | CONTENT_CANONICAL | 4 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=4; schema/FK inventory; category contract; business premise for current content | id | 2/11 | PRIMARY(id); uniq_law_article_slug(law_id,slug) | Canonical law article records | - |
| law_section_editorials | CONTENT_CANONICAL | 1 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=1; schema/FK inventory; category contract; business premise for current content | id | 2/0 | PRIMARY(id); uniq_law_section_editorial_section(law_id,section_id) | content canonical: law section editorials | - |
| law_sections | CONTENT_CANONICAL | 1 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=1; schema/FK inventory; category contract; business premise for current content | id | 1/3 | PRIMARY(id); uniq_law_section_slug(law_id,slug) | content canonical: law sections | - |
| law_updates | CONTENT_RELATION | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 2/0 | PRIMARY(id) | content relation: law updates | - |
| law_versions | CONTENT_RELATION | 1 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=1; schema/FK inventory; category contract; business premise for current content | id | 1/1 | PRIMARY(id); uniq_law_version(law_id,version_number) | content relation: law versions | - |
| laws | CONTENT_CANONICAL | 1 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=1; schema/FK inventory; category contract; business premise for current content | id | 1/11 | PRIMARY(id); slug(slug) | Canonical law records | - |
| legal_ai_batch_items | IMPORT_STAGING | 0 | POSSIBLE_IMPORT_TEST_OR_PROVENANCE | UNKNOWN_PROVENANCE_MUST_BE_RETAINED | IMPORT_PROVENANCE_REVIEW | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 2/0 | PRIMARY(id); uniq_legal_ai_batch_item(batch_run_id,law_article_id) | import staging: legal ai batch items | No destructive selector is approved. |
| legal_ai_batch_runs | IMPORT_STAGING | 0 | POSSIBLE_IMPORT_TEST_OR_PROVENANCE | UNKNOWN_PROVENANCE_MUST_BE_RETAINED | IMPORT_PROVENANCE_REVIEW | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/1 | PRIMARY(id) | import staging: legal ai batch runs | No destructive selector is approved. |
| legal_areas | CONTENT_CANONICAL | 12 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=12; schema/FK inventory; category contract; business premise for current content | id | 0/1 | PRIMARY(id); slug(slug) | content canonical: legal areas | - |
| legal_comment_reports | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 2/0 | PRIMARY(id); uniq_legal_comment_reporter(comment_id,user_id) | user generated operational: legal comment reports | - |
| legal_content_reactions | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id); uniq_legal_content_reaction(target_key,user_id) | user generated operational: legal content reactions | - |
| legal_sync_logs | AUDIT_LOG | 15 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_AUDIT | NEVER_PURGE | PRESERVE | true | Exact read-only count=15; schema/FK inventory; category contract; business premise for current content | id | 1/1 | PRIMARY(id) | audit log: legal sync logs | - |
| legal_user_comments | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 2/1 | PRIMARY(id) | user generated operational: legal user comments | - |
| legal_user_favorites | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id); uniq_legal_favorite(user_id,target_type,target_id) | user generated operational: legal user favorites | - |
| legal_user_notes | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 3/0 | PRIMARY(id); uniq_legal_user_note(user_id,law_article_id) | user generated operational: legal user notes | - |
| legal_user_progress | USER_GENERATED_OPERATIONAL | 1 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=1; schema/FK inventory; category contract; business premise for current content | id | 2/0 | PRIMARY(id); uniq_legal_progress(user_id,law_id) | user generated operational: legal user progress | - |
| legal_user_reader_annotations | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 3/0 | PRIMARY(id); uniq_legal_user_reader_annotation(user_id,law_section_id) | user generated operational: legal user reader annotations | - |
| marketing_automation_events | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_marketing_automation_event(campaign_slug,rule_id,user_id,event_key) | user generated operational: marketing automation events | - |
| material_moderation_events | AUDIT_LOG | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_AUDIT | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | audit log: material moderation events | - |
| material_ratings | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id); uniq_material_ratings_user_material(user_id,material_id) | user generated operational: material ratings | - |
| material_uploads | CONTENT_RELATION | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | MIXED_OR_OWNERSHIP_SENSITIVE | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_material_upload_storage_key(storage_key) | content relation: material uploads | No destructive selector is approved. |
| materials | CONTENT_CANONICAL | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | MIXED_OR_OWNERSHIP_SENSITIVE | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 2/0 | PRIMARY(id) | Marketplace material records with user ownership | No destructive selector is approved. |
| notifications | USER_GENERATED_OPERATIONAL | 72 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=72; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id) | user generated operational: notifications | - |
| password_resets | AUTH_IDENTITY | 1 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_IDENTITY | NEVER_PURGE | PRESERVE | true | Exact read-only count=1; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); token(token) | auth identity: password resets | - |
| plans | SYSTEM_CONFIGURATION | 14 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_PROTECTED_STATE | PROTECTED_CONFIGURATION | PRESERVE_ALL | PRESERVE | true | Exact read-only count=14; schema/FK inventory; category contract; business premise for current content | id | 0/0 | name(name); PRIMARY(id) | system configuration: plans | - |
| platform_event_outbox | USER_GENERATED_OPERATIONAL | 44 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=44; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_platform_event_outbox_idempotency(idempotency_key) | Operational asynchronous event outbox | - |
| private_ingestion_batches | IMPORT_STAGING | 0 | POSSIBLE_IMPORT_TEST_OR_PROVENANCE | UNKNOWN_PROVENANCE_MUST_BE_RETAINED | IMPORT_PROVENANCE_REVIEW | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/2 | PRIMARY(id); uq_private_ingestion_batch_actor_key(actor_user_id,idempotency_key); uq_private_ingestion_batch_public(public_id) | import staging: private ingestion batches | No destructive selector is approved. |
| private_ingestion_jobs | IMPORT_STAGING | 0 | POSSIBLE_IMPORT_TEST_OR_PROVENANCE | UNKNOWN_PROVENANCE_MUST_BE_RETAINED | IMPORT_PROVENANCE_REVIEW | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id) | Private question ingestion work queue | No destructive selector is approved. |
| private_ingestion_nonces | IMPORT_STAGING | 0 | POSSIBLE_IMPORT_TEST_OR_PROVENANCE | UNKNOWN_PROVENANCE_MUST_BE_RETAINED | IMPORT_PROVENANCE_REVIEW | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | nonce_hash | 0/0 | PRIMARY(nonce_hash) | import staging: private ingestion nonces | No destructive selector is approved. |
| private_ingestion_requests | IMPORT_STAGING | 0 | POSSIBLE_IMPORT_TEST_OR_PROVENANCE | UNKNOWN_PROVENANCE_MUST_BE_RETAINED | IMPORT_PROVENANCE_REVIEW | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_private_ingestion_idempotency(client_key,idempotency_key) | import staging: private ingestion requests | No destructive selector is approved. |
| prova_arquivos | CONTENT_RELATION | 195 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=195; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | content relation: prova arquivos | - |
| prova_caderno_cargos | CONTENT_RELATION | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_caderno_cargo(caderno_id,cargo_filter_id) | content relation: prova caderno cargos | - |
| prova_caderno_filters | CONTENT_RELATION | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_caderno_filter_role(caderno_id,filter_id,role) | content relation: prova caderno filters | - |
| prova_cadernos | CONTENT_RELATION | 93 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=93; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_prova_caderno_nome(prova_id,nome) | content relation: prova cadernos | - |
| prova_cargo_detalhes | CONTENT_RELATION | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | content relation: prova cargo detalhes | - |
| prova_cargo_requisitos | CONTENT_RELATION | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | content relation: prova cargo requisitos | - |
| prova_cargo_vagas | CONTENT_RELATION | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | content relation: prova cargo vagas | - |
| prova_extracao_itens | IMPORT_STAGING | 1632 | POSSIBLE_IMPORT_TEST_OR_PROVENANCE | UNKNOWN_PROVENANCE_MUST_BE_RETAINED | IMPORT_PROVENANCE_REVIEW | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=1632; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | import staging: prova extracao itens | No destructive selector is approved. |
| prova_extracoes | IMPORT_STAGING | 855 | POSSIBLE_IMPORT_TEST_OR_PROVENANCE | UNKNOWN_PROVENANCE_MUST_BE_RETAINED | IMPORT_PROVENANCE_REVIEW | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=855; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | import staging: prova extracoes | No destructive selector is approved. |
| prova_filters | CONTENT_RELATION | 572 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=572; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_prova_filter_role(prova_id,filter_id,role) | content relation: prova filters | - |
| provas | CONTENT_CANONICAL | 100 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=100; schema/FK inventory; category contract; business premise for current content | id | 5/2 | PRIMARY(id); uq_provas_source_identity(source_provider,source_external_id) | Canonical exam records and publication state | - |
| provider_webhook_events | BILLING_FINANCIAL | 587 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_FINANCIAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=587; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_provider_webhook_event(provider,event_id) | Payment provider webhook idempotency and audit | - |
| question_answer_idempotency | USER_GENERATED_OPERATIONAL | 40 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=40; schema/FK inventory; category contract; business premise for current content | id | 3/0 | PRIMARY(id); uq_question_answer_idempotency(user_id,idempotency_key) | user generated operational: question answer idempotency | - |
| question_assets | CONTENT_RELATION | 136 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=136; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | content relation: question assets | - |
| question_context_questions | CONTENT_RELATION | 351 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=351; schema/FK inventory; category contract; business premise for current content | context_id,question_id | 0/0 | PRIMARY(context_id,question_id) | content relation: question context questions | - |
| question_contexts | CONTENT_CANONICAL | 139 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=139; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id); uq_question_contexts_external_key(external_key); uq_question_contexts_source_identity(source_provider,source_external_id) | content canonical: question contexts | - |
| question_editorial_feedback | AUDIT_LOG | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_AUDIT | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uniq_question_editorial_feedback_user(question_id,user_id,content_type) | audit log: question editorial feedback | - |
| question_editorials | CONTENT_CANONICAL | 560 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=560; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_question_editorials_type(question_id,editorial_type) | content canonical: question editorials | - |
| question_filters | CONTENT_RELATION | 12289 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=12289; schema/FK inventory; category contract; business premise for current content | question_id,filter_id | 2/0 | PRIMARY(question_id,filter_id) | content relation: question filters | - |
| question_options | CONTENT_RELATION | 4881 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=4881; schema/FK inventory; category contract; business premise for current content | id | 0/2 | PRIMARY(id); uq_question_options_external_key(question_id,external_key); uq_question_options_order(question_id,display_order) | content relation: question options | - |
| question_provas | CONTENT_RELATION | 1130 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=1130; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_question_prova_caderno(question_id,prova_id,caderno_id) | content relation: question provas | - |
| question_search_documents | SEO_OPERATIONAL | 1130 | YES_DERIVED_FROM_TEMPORARY_CONTENT | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | DERIVED_FROM_CONTENT | PURGE_ALL_DATA_KEEP_SCHEMA | REBUILD_DERIVED_AFTER_LOAD | false | Exact read-only count=1130; schema/FK inventory; category contract; business premise for current content | question_id | 1/0 | PRIMARY(question_id) | seo operational: question search documents | - |
| question_stats | SEO_OPERATIONAL | 27 | YES_DERIVED_FROM_TEMPORARY_CONTENT | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | DERIVED_FROM_CONTENT | PURGE_ALL_DATA_KEEP_SCHEMA | REBUILD_DERIVED_AFTER_LOAD | false | Exact read-only count=27; schema/FK inventory; category contract; business premise for current content | question_id | 1/0 | PRIMARY(question_id) | seo operational: question stats | - |
| questions | CONTENT_CANONICAL | 1130 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=1130; schema/FK inventory; category contract; business premise for current content | id | 0/6 | hash_id(hash_id); PRIMARY(id); uq_questions_import_fingerprint(import_fingerprint); uq_questions_source_exam_number(source_exam_key,source_question_number); uq_questions_source_identity(source_provider,source_external_id) | Canonical question content and publication state | - |
| questions_groups | CONTENT_CANONICAL | 148 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=148; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id); uq_question_groups_source_identity(source_provider,source_external_id) | content canonical: questions groups | - |
| ranking_entries | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 2/0 | PRIMARY(id); ranking_id(ranking_id,user_id) | user generated operational: ranking entries | - |
| rankings | CONTENT_CANONICAL | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | MIXED_OR_OWNERSHIP_SENSITIVE | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/1 | PRIMARY(id) | content canonical: rankings | No destructive selector is approved. |
| referral_commission_entries | BILLING_FINANCIAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_FINANCIAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_referral_commission_entry_key(entry_key) | billing financial: referral commission entries | - |
| referral_payout_cycles | BILLING_FINANCIAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_FINANCIAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/1 | PRIMARY(id); uq_referral_payout_cycle_key(cycle_key) | billing financial: referral payout cycles | - |
| referral_payout_items | BILLING_FINANCIAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_FINANCIAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id); uq_referral_payout_cycle_referrer(cycle_id,referrer_id) | billing financial: referral payout items | - |
| referrals | BILLING_FINANCIAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_FINANCIAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uq_referrals_referred_user(referred_user_id) | billing financial: referrals | - |
| report_moderation_drafts | AUDIT_LOG | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_AUDIT | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | report_id | 0/0 | PRIMARY(report_id) | audit log: report moderation drafts | - |
| report_moderation_history | AUDIT_LOG | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_AUDIT | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | audit log: report moderation history | - |
| reports | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id) | user generated operational: reports | - |
| schema_audit_runs | SCHEMA_INFRASTRUCTURE | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_PROTECTED_STATE | PROTECTED_SCHEMA_STATE | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | schema infrastructure: schema audit runs | - |
| schema_backfill_runs | SCHEMA_INFRASTRUCTURE | 1 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_PROTECTED_STATE | PROTECTED_SCHEMA_STATE | NEVER_PURGE | PRESERVE | true | Exact read-only count=1; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | schema infrastructure: schema backfill runs | - |
| schema_migrations | SCHEMA_INFRASTRUCTURE | 62 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_PROTECTED_STATE | PROTECTED_SCHEMA_STATE | NEVER_PURGE | PRESERVE | true | Exact read-only count=62; schema/FK inventory; category contract; business premise for current content | version | 0/0 | PRIMARY(version) | Applied schema migration history | - |
| security_ip_bans | SYSTEM_CONFIGURATION | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_PROTECTED_STATE | PROTECTED_CONFIGURATION | PRESERVE_ALL | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uniq_security_ip_bans_ip(ip_address) | system configuration: security ip bans | - |
| simulations | USER_GENERATED_OPERATIONAL | 3 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=3; schema/FK inventory; category contract; business premise for current content | id | 1/1 | PRIMARY(id) | Private user simulation attempts in current schema | - |
| stripe_testing_matrix_runs | TEMP_FIXTURE | 0 | YES_EXPLICIT_FIXTURE_DOMAIN | NO_BY_DEDICATED_DOMAIN | EXPLICIT_FIXTURE | PURGE_TEST_ROWS_ONLY | DO_NOT_LOAD | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uniq_stripe_testing_run_id(run_id) | temp fixture: stripe testing matrix runs | - |
| study_sessions | USER_GENERATED_OPERATIONAL | 93 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=93; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | user generated operational: study sessions | - |
| subject_statistics | SEO_OPERATIONAL | 0 | YES_DERIVED_FROM_TEMPORARY_CONTENT | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | DERIVED_FROM_CONTENT | PURGE_ALL_DATA_KEEP_SCHEMA | REBUILD_DERIVED_AFTER_LOAD | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); unique_user_subject(user_id,subject) | seo operational: subject statistics | - |
| sync_errors | IMPORT_STAGING | 0 | POSSIBLE_IMPORT_TEST_OR_PROVENANCE | UNKNOWN_PROVENANCE_MUST_BE_RETAINED | IMPORT_PROVENANCE_REVIEW | REVIEW_REQUIRED | REVIEW_BEFORE_LOAD | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 2/0 | PRIMARY(id) | import staging: sync errors | No destructive selector is approved. |
| system_settings | SYSTEM_CONFIGURATION | 99 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_PROTECTED_STATE | PROTECTED_CONFIGURATION | PRESERVE_ALL | PRESERVE | true | Exact read-only count=99; schema/FK inventory; category contract; business premise for current content | key_name | 0/0 | PRIMARY(key_name) | Runtime application, SEO, integration and feature settings | - |
| teacher_comments | CONTENT_CANONICAL | 0 | YES_BY_BUSINESS_PREMISE | POSSIBLE_REAL_LIKE_SOURCE_BUT_NOT_APPROVED_AS_DEFINITIVE | TEMPORARY_CONTENT_BY_BUSINESS_PREMISE | REBUILD_FROM_REAL_DATA | LOAD_FROM_APPROVED_REAL_SOURCE | false | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id) | content canonical: teacher comments | - |
| transactions | BILLING_FINANCIAL | 45 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_FINANCIAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=45; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uniq_transactions_provider_invoice(provider_invoice_id); uniq_transactions_provider_payment_intent(provider_payment_intent_id) | Payment transaction ledger source records | - |
| user_answer_counters | USER_GENERATED_OPERATIONAL | 1 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=1; schema/FK inventory; category contract; business premise for current content | user_id | 1/0 | PRIMARY(user_id) | user generated operational: user answer counters | - |
| user_answers | USER_GENERATED_OPERATIONAL | 47 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=47; schema/FK inventory; category contract; business premise for current content | id | 4/1 | PRIMARY(id) | User answers linked to question content | - |
| user_answers_archive | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | user generated operational: user answers archive | - |
| user_badges | USER_GENERATED_OPERATIONAL | 11 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=11; schema/FK inventory; category contract; business premise for current content | user_id,badge_key | 0/0 | PRIMARY(user_id,badge_key) | user generated operational: user badges | - |
| user_bookmarks | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id) | user generated operational: user bookmarks | - |
| user_cards | AUTH_IDENTITY | 2 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_IDENTITY | NEVER_PURGE | PRESERVE | true | Exact read-only count=2; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | auth identity: user cards | - |
| user_feedback | USER_GENERATED_OPERATIONAL | 2 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=2; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id) | user generated operational: user feedback | - |
| user_feedback_votes | USER_GENERATED_OPERATIONAL | 1 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=1; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uniq_user_feedback_vote(feedback_id,user_id) | user generated operational: user feedback votes | - |
| user_gamification_events | USER_GENERATED_OPERATIONAL | 35 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=35; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uniq_user_gamification_event_key(event_key) | user generated operational: user gamification events | - |
| user_highlights | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id) | user generated operational: user highlights | - |
| user_notes | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | id | 1/0 | PRIMARY(id); user_item_unique(user_id,item_id,type) | user generated operational: user notes | - |
| user_saved_questions | USER_GENERATED_OPERATIONAL | 2 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=2; schema/FK inventory; category contract; business premise for current content | user_id,question_id | 2/0 | PRIMARY(user_id,question_id) | user generated operational: user saved questions | - |
| user_statistics | USER_GENERATED_OPERATIONAL | 3 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=3; schema/FK inventory; category contract; business premise for current content | user_id | 0/0 | PRIMARY(user_id) | user generated operational: user statistics | - |
| user_streaks | USER_GENERATED_OPERATIONAL | 1 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=1; schema/FK inventory; category contract; business premise for current content | user_id | 0/0 | PRIMARY(user_id) | user generated operational: user streaks | - |
| user_study_schedules | USER_GENERATED_OPERATIONAL | 0 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_OPERATIONAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=0; schema/FK inventory; category contract; business premise for current content | user_id | 1/0 | PRIMARY(user_id) | user generated operational: user study schedules | - |
| user_subscriptions | BILLING_FINANCIAL | 13 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_FINANCIAL | NEVER_PURGE | PRESERVE | true | Exact read-only count=13; schema/FK inventory; category contract; business premise for current content | id | 0/0 | PRIMARY(id); uniq_user_subscriptions_mp_preapproval(mp_preapproval_id); uniq_user_subscriptions_provider_subscription(provider_subscription_id) | User subscription lifecycle | - |
| users | AUTH_IDENTITY | 6 | NOT_ESTABLISHED_AND_NOT_A_PURGE_CRITERION | YES_OPERATIONAL_PROTECTED | PROTECTED_IDENTITY | NEVER_PURGE | PRESERVE | true | Exact read-only count=6; schema/FK inventory; category contract; business premise for current content | id | 0/27 | cpf(cpf); email(email); PRIMARY(id); uniq_users_apple_sub(apple_sub); uniq_users_facebook_id(facebook_id); uniq_users_google_sub(google_sub); uniq_users_referral_code(referral_code) | Canonical user identities and profile state | - |

## CF. FK matrix

| Constraint | Child | Column | Parent | Column | Update | Delete | Protected boundary |
| --- | --- | --- | --- | --- | --- | --- | --- |
| addresses_ibfk_1 | addresses | user_id | users | id | NO ACTION | CASCADE | NO |
| fk_analytics_lifecycle_user_scale | analytics_lifecycle_events | user_id | users | id | CASCADE | SET NULL | NO |
| fk_article_doutrina_article | article_doutrina | law_article_id | law_articles | id | NO ACTION | CASCADE | NO |
| fk_article_exam_tips_article | article_exam_tips | law_article_id | law_articles | id | NO ACTION | CASCADE | NO |
| fk_article_jurisprudence_article | article_jurisprudence | law_article_id | law_articles | id | NO ACTION | CASCADE | NO |
| fk_article_sumulas_article | article_sumulas | law_article_id | law_articles | id | NO ACTION | CASCADE | NO |
| fk_auth_sessions_user_scale | auth_sessions | user_id | users | id | CASCADE | CASCADE | NO |
| bank_accounts_ibfk_1 | bank_accounts | user_id | users | id | NO ACTION | CASCADE | NO |
| fk_blog_article_likes_article | blog_article_likes | article_id | blog_articles | id | NO ACTION | CASCADE | YES |
| fk_blog_article_tags_article | blog_article_tags | article_id | blog_articles | id | NO ACTION | CASCADE | NO |
| fk_blog_article_tags_tag | blog_article_tags | tag_id | blog_tags | id | NO ACTION | CASCADE | NO |
| fk_blog_articles_category | blog_articles | category_id | blog_categories | id | NO ACTION | RESTRICT | NO |
| comment_likes_ibfk_1 | comment_likes | user_id | users | id | NO ACTION | CASCADE | NO |
| comment_likes_ibfk_2 | comment_likes | comment_id | comments | id | NO ACTION | CASCADE | NO |
| comments_ibfk_1 | comments | user_id | users | id | NO ACTION | CASCADE | NO |
| comments_ibfk_2 | comments | parent_id | comments | id | NO ACTION | CASCADE | NO |
| fk_email_verifications_user_scale | email_verifications | user_id | users | id | CASCADE | CASCADE | NO |
| fk_filter_aliases_filter | filter_aliases | filter_id | filters | id | NO ACTION | CASCADE | NO |
| fk_filter_relationship_source | filter_relationships | source_filter_id | filters | id | NO ACTION | CASCADE | NO |
| fk_filter_relationship_target | filter_relationships | target_filter_id | filters | id | NO ACTION | CASCADE | NO |
| fk_filter_source_identity_filter | filter_source_identities | filter_id | filters | id | NO ACTION | CASCADE | NO |
| filters_ibfk_1 | filters | parent_id | filters | id | NO ACTION | SET NULL | NO |
| fk_gran_failure_batch | gran_question_publication_failures | batch_id | private_ingestion_batches | id | NO ACTION | SET NULL | NO |
| fk_law_article_blocks_article | law_article_blocks | law_article_id | law_articles | id | NO ACTION | CASCADE | NO |
| fk_article_versions_article | law_article_versions | law_article_id | law_articles | id | NO ACTION | SET NULL | NO |
| fk_article_versions_version | law_article_versions | law_version_id | law_versions | id | NO ACTION | CASCADE | NO |
| fk_law_articles_law | law_articles | law_id | laws | id | NO ACTION | CASCADE | NO |
| fk_law_articles_section | law_articles | section_id | law_sections | id | NO ACTION | SET NULL | NO |
| fk_law_section_editorials_law | law_section_editorials | law_id | laws | id | NO ACTION | CASCADE | NO |
| fk_law_section_editorials_section | law_section_editorials | section_id | law_sections | id | NO ACTION | CASCADE | NO |
| fk_law_sections_law | law_sections | law_id | laws | id | NO ACTION | CASCADE | NO |
| fk_law_updates_article | law_updates | law_article_id | law_articles | id | NO ACTION | SET NULL | NO |
| fk_law_updates_law | law_updates | law_id | laws | id | NO ACTION | CASCADE | NO |
| fk_law_versions_law | law_versions | law_id | laws | id | NO ACTION | CASCADE | NO |
| fk_laws_legal_area | laws | legal_area_id | legal_areas | id | NO ACTION | RESTRICT | NO |
| fk_legal_ai_batch_items_article | legal_ai_batch_items | law_article_id | law_articles | id | NO ACTION | CASCADE | NO |
| fk_legal_ai_batch_items_run | legal_ai_batch_items | batch_run_id | legal_ai_batch_runs | id | NO ACTION | CASCADE | NO |
| fk_legal_ai_batch_runs_law | legal_ai_batch_runs | law_id | laws | id | NO ACTION | CASCADE | NO |
| fk_legal_comment_reports_comment | legal_comment_reports | comment_id | legal_user_comments | id | NO ACTION | CASCADE | NO |
| fk_legal_comment_reports_user_scale | legal_comment_reports | user_id | users | id | CASCADE | CASCADE | NO |
| fk_legal_content_reactions_user_scale | legal_content_reactions | user_id | users | id | CASCADE | CASCADE | NO |
| fk_legal_sync_logs_law | legal_sync_logs | law_id | laws | id | NO ACTION | SET NULL | YES |
| fk_legal_user_comments_article | legal_user_comments | law_article_id | law_articles | id | NO ACTION | CASCADE | YES |
| fk_legal_user_comments_user_scale | legal_user_comments | user_id | users | id | CASCADE | CASCADE | NO |
| fk_legal_user_favorites_user_scale | legal_user_favorites | user_id | users | id | CASCADE | CASCADE | NO |
| fk_legal_user_notes_article | legal_user_notes | law_article_id | law_articles | id | NO ACTION | CASCADE | YES |
| fk_legal_user_notes_law | legal_user_notes | law_id | laws | id | NO ACTION | CASCADE | YES |
| fk_legal_user_notes_user_scale | legal_user_notes | user_id | users | id | CASCADE | CASCADE | NO |
| fk_legal_user_progress_law | legal_user_progress | law_id | laws | id | NO ACTION | CASCADE | YES |
| fk_legal_user_progress_user_scale | legal_user_progress | user_id | users | id | CASCADE | CASCADE | NO |
| fk_legal_reader_annotations_user_scale | legal_user_reader_annotations | user_id | users | id | CASCADE | CASCADE | NO |
| fk_legal_user_reader_annotations_law | legal_user_reader_annotations | law_id | laws | id | NO ACTION | CASCADE | YES |
| fk_legal_user_reader_annotations_section | legal_user_reader_annotations | law_section_id | law_sections | id | NO ACTION | CASCADE | YES |
| fk_material_ratings_user_scale | material_ratings | user_id | users | id | CASCADE | CASCADE | NO |
| materials_ibfk_1 | materials | author_id | users | id | NO ACTION | CASCADE | NO |
| materials_ibfk_2 | materials | subject_id | filters | id | NO ACTION | SET NULL | NO |
| notifications_ibfk_1 | notifications | user_id | users | id | NO ACTION | CASCADE | NO |
| fk_private_ingestion_jobs_batch | private_ingestion_jobs | batch_id | private_ingestion_batches | id | NO ACTION | SET NULL | NO |
| provas_ibfk_1 | provas | banca_id | filters | id | NO ACTION | SET NULL | NO |
| provas_ibfk_2 | provas | orgao_id | filters | id | NO ACTION | SET NULL | NO |
| provas_ibfk_3 | provas | cargo_id | filters | id | NO ACTION | SET NULL | NO |
| provas_ibfk_4 | provas | nivel_id | filters | id | NO ACTION | SET NULL | NO |
| provas_ibfk_5 | provas | tipo_prova_id | filters | id | NO ACTION | SET NULL | NO |
| fk_question_answer_idempotency_answer | question_answer_idempotency | user_answer_id | user_answers | id | NO ACTION | CASCADE | NO |
| fk_question_answer_idempotency_option | question_answer_idempotency | selected_option_id | question_options | id | NO ACTION | SET NULL | YES |
| fk_question_answer_idempotency_question | question_answer_idempotency | question_id | questions | id | NO ACTION | CASCADE | YES |
| fk_question_contexts_prova | question_contexts | prova_id | provas | id | NO ACTION | RESTRICT | NO |
| question_filters_ibfk_1 | question_filters | question_id | questions | id | NO ACTION | CASCADE | NO |
| question_filters_ibfk_2 | question_filters | filter_id | filters | id | NO ACTION | CASCADE | NO |
| fk_question_search_documents_question | question_search_documents | question_id | questions | id | NO ACTION | CASCADE | NO |
| question_stats_ibfk_1 | question_stats | question_id | questions | id | NO ACTION | CASCADE | NO |
| fk_question_groups_prova | questions_groups | prova_id | provas | id | NO ACTION | RESTRICT | NO |
| ranking_entries_ibfk_1 | ranking_entries | ranking_id | rankings | id | NO ACTION | CASCADE | NO |
| ranking_entries_ibfk_2 | ranking_entries | user_id | users | id | NO ACTION | CASCADE | NO |
| fk_referral_payout_item_cycle | referral_payout_items | cycle_id | referral_payout_cycles | id | RESTRICT | RESTRICT | NO |
| reports_ibfk_1 | reports | reporter_id | users | id | NO ACTION | CASCADE | NO |
| simulations_ibfk_1 | simulations | user_id | users | id | NO ACTION | CASCADE | NO |
| fk_sync_errors_law | sync_errors | law_id | laws | id | NO ACTION | SET NULL | NO |
| fk_sync_errors_log | sync_errors | sync_log_id | legal_sync_logs | id | NO ACTION | SET NULL | NO |
| fk_teacher_comments_article | teacher_comments | law_article_id | law_articles | id | NO ACTION | CASCADE | NO |
| fk_user_answer_counters_user | user_answer_counters | user_id | users | id | NO ACTION | CASCADE | NO |
| fk_user_answers_selected_option | user_answers | selected_option_id | question_options | id | NO ACTION | SET NULL | YES |
| user_answers_ibfk_1 | user_answers | user_id | users | id | NO ACTION | CASCADE | NO |
| user_answers_ibfk_2 | user_answers | question_id | questions | id | NO ACTION | CASCADE | YES |
| user_answers_ibfk_3 | user_answers | simulation_id | simulations | id | NO ACTION | SET NULL | NO |
| fk_user_bookmarks_user_scale | user_bookmarks | user_id | users | id | CASCADE | CASCADE | NO |
| fk_user_highlights_user_scale | user_highlights | user_id | users | id | CASCADE | CASCADE | NO |
| user_notes_ibfk_1 | user_notes | user_id | users | id | NO ACTION | CASCADE | NO |
| user_saved_questions_ibfk_1 | user_saved_questions | user_id | users | id | NO ACTION | CASCADE | NO |
| user_saved_questions_ibfk_2 | user_saved_questions | question_id | questions | id | NO ACTION | CASCADE | YES |
| user_study_schedules_ibfk_1 | user_study_schedules | user_id | users | id | NO ACTION | CASCADE | NO |

## CG. Purge matrix

| Order | Table | Selector | Expected rows | Preserve condition | FK dependencies | Transaction | Risk | Execute in 11B? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | article_doutrina | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 0 | Preserve denylist and validate exact count | fk_article_doutrina_article | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 2 | article_exam_tips | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 0 | Preserve denylist and validate exact count | fk_article_exam_tips_article | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 3 | article_jurisprudence | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 0 | Preserve denylist and validate exact count | fk_article_jurisprudence_article | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 4 | article_sumulas | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 0 | Preserve denylist and validate exact count | fk_article_sumulas_article | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 5 | blog_article_tags | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 17 | Preserve denylist and validate exact count | fk_blog_article_tags_article; fk_blog_article_tags_tag | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 6 | blog_articles | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 6 | Resolve protected references: blog_article_likes.article_id | fk_blog_article_likes_article; fk_blog_article_tags_article; fk_blog_articles_category | YES_DML_ONLY | CRITICAL_PROTECTED_REFERENCE | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 7 | blog_categories | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 6 | Preserve denylist and validate exact count | fk_blog_articles_category | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 8 | blog_tags | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 17 | Preserve denylist and validate exact count | fk_blog_article_tags_tag | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 9 | changelogs | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 1 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 10 | filter_aliases | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 0 | Preserve denylist and validate exact count | fk_filter_aliases_filter | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 11 | filter_relationships | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 157326 | Preserve denylist and validate exact count | fk_filter_relationship_source; fk_filter_relationship_target | YES_DML_ONLY | HIGH_VOLUME | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 12 | filter_source_identities | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 63428 | Preserve denylist and validate exact count | fk_filter_source_identity_filter | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 13 | law_article_blocks | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 21 | Preserve denylist and validate exact count | fk_law_article_blocks_article | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 14 | law_article_versions | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 4 | Preserve denylist and validate exact count | fk_article_versions_article; fk_article_versions_version | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 15 | law_section_editorials | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 1 | Preserve denylist and validate exact count | fk_law_section_editorials_law; fk_law_section_editorials_section | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 16 | law_updates | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 0 | Preserve denylist and validate exact count | fk_law_updates_article; fk_law_updates_law | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 17 | law_versions | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 1 | Preserve denylist and validate exact count | fk_article_versions_version; fk_law_versions_law | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 18 | prova_arquivos | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 195 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 19 | prova_caderno_cargos | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 0 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 20 | prova_caderno_filters | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 0 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 21 | prova_cadernos | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 93 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 22 | prova_cargo_detalhes | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 0 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 23 | prova_cargo_requisitos | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 0 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 24 | prova_cargo_vagas | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 0 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 25 | prova_filters | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 572 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 26 | question_assets | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 136 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 27 | question_context_questions | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 351 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 28 | question_contexts | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 139 | Preserve denylist and validate exact count | fk_question_contexts_prova | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 29 | question_editorials | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 560 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 30 | question_filters | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 12289 | Preserve denylist and validate exact count | question_filters_ibfk_1; question_filters_ibfk_2 | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 31 | question_options | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 4881 | Resolve protected references: question_answer_idempotency.selected_option_id, user_answers.selected_option_id | fk_question_answer_idempotency_option; fk_user_answers_selected_option | YES_DML_ONLY | CRITICAL_PROTECTED_REFERENCE | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 32 | question_provas | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 1130 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 33 | question_search_documents | ALL_DERIVED_ROWS_AFTER_PARENT_PURGE_APPROVAL | 1130 | Preserve denylist and validate exact count | fk_question_search_documents_question | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 34 | question_stats | ALL_DERIVED_ROWS_AFTER_PARENT_PURGE_APPROVAL | 27 | Preserve denylist and validate exact count | question_stats_ibfk_1 | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 35 | questions | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 1130 | Resolve protected references: question_answer_idempotency.question_id, user_answers.question_id, user_saved_questions.question_id | fk_question_answer_idempotency_question; question_filters_ibfk_1; fk_question_search_documents_question; question_stats_ibfk_1; user_answers_ibfk_2; user_saved_questions_ibfk_2 | YES_DML_ONLY | CRITICAL_PROTECTED_REFERENCE | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 36 | questions_groups | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 148 | Preserve denylist and validate exact count | fk_question_groups_prova | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 37 | provas | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 100 | Preserve denylist and validate exact count | provas_ibfk_1; provas_ibfk_2; provas_ibfk_3; provas_ibfk_4; provas_ibfk_5; fk_question_contexts_prova; fk_question_groups_prova | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 38 | filters | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 63073 | Preserve denylist and validate exact count | fk_filter_aliases_filter; fk_filter_relationship_source; fk_filter_relationship_target; fk_filter_source_identity_filter; filters_ibfk_1; materials_ibfk_2; provas_ibfk_1; provas_ibfk_2; provas_ibfk_3; provas_ibfk_4; provas_ibfk_5; question_filters_ibfk_2 | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 39 | stripe_testing_matrix_runs | EXACT_FIXTURE_MARKER_OR_BATCH_REQUIRED | - | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 40 | subject_statistics | ALL_DERIVED_ROWS_AFTER_PARENT_PURGE_APPROVAL | 0 | Preserve denylist and validate exact count | - | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 41 | teacher_comments | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 0 | Preserve denylist and validate exact count | fk_teacher_comments_article | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 42 | law_articles | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 4 | Resolve protected references: legal_user_comments.law_article_id, legal_user_notes.law_article_id | fk_article_doutrina_article; fk_article_exam_tips_article; fk_article_jurisprudence_article; fk_article_sumulas_article; fk_law_article_blocks_article; fk_article_versions_article; fk_law_articles_law; fk_law_articles_section; fk_law_updates_article; fk_legal_ai_batch_items_article; fk_legal_user_comments_article; fk_legal_user_notes_article; fk_teacher_comments_article | YES_DML_ONLY | CRITICAL_PROTECTED_REFERENCE | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 43 | law_sections | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 1 | Resolve protected references: legal_user_reader_annotations.law_section_id | fk_law_articles_section; fk_law_section_editorials_section; fk_law_sections_law; fk_legal_user_reader_annotations_section | YES_DML_ONLY | CRITICAL_PROTECTED_REFERENCE | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 44 | laws | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 1 | Resolve protected references: legal_sync_logs.law_id, legal_user_notes.law_id, legal_user_progress.law_id, legal_user_reader_annotations.law_id | fk_law_articles_law; fk_law_section_editorials_law; fk_law_sections_law; fk_law_updates_law; fk_law_versions_law; fk_laws_legal_area; fk_legal_ai_batch_runs_law; fk_legal_sync_logs_law; fk_legal_user_notes_law; fk_legal_user_progress_law; fk_legal_user_reader_annotations_law; fk_sync_errors_law | YES_DML_ONLY | CRITICAL_PROTECTED_REFERENCE | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |
| 45 | legal_areas | ALL_ROWS_ONLY_AFTER_SOURCE_APPROVAL_AND_PROTECTED_REFERENCE_CLOSURE | 12 | Preserve denylist and validate exact count | fk_laws_legal_area | YES_DML_ONLY | STANDARD | NO_UNTIL_ALL_EXECUTION_BLOCKERS_CLOSED |

## CH. Preserve matrix

| Table | Rows | Policy | Reason | Verification |
| --- | --- | --- | --- | --- |
| addresses | 2 | NEVER_PURGE | PROTECTED_IDENTITY | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| admin_audit_logs | 1926 | NEVER_PURGE | PROTECTED_AUDIT | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| analytics_lifecycle_events | 103 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| auth_refresh_tokens | 812 | NEVER_PURGE | PROTECTED_IDENTITY | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| auth_sessions | 24 | NEVER_PURGE | PROTECTED_IDENTITY | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| bank_accounts | 0 | NEVER_PURGE | PROTECTED_IDENTITY | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| blog_article_likes | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| cache_settings | 0 | PRESERVE_ALL | PROTECTED_CONFIGURATION | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| comment_likes | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| comments | 4 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| coupon_reservations | 1 | NEVER_PURGE | PROTECTED_FINANCIAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| email_verifications | 4 | NEVER_PURGE | PROTECTED_IDENTITY | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| filter_types | 10 | PRESERVE_ALL | PROTECTED_TAXONOMY_CONTRACT | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| financial_ledger_entries | 48 | NEVER_PURGE | PROTECTED_FINANCIAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| legal_comment_reports | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| legal_content_reactions | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| legal_sync_logs | 15 | NEVER_PURGE | PROTECTED_AUDIT | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| legal_user_comments | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| legal_user_favorites | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| legal_user_notes | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| legal_user_progress | 1 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| legal_user_reader_annotations | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| marketing_automation_events | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| material_moderation_events | 0 | NEVER_PURGE | PROTECTED_AUDIT | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| material_ratings | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| notifications | 72 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| password_resets | 1 | NEVER_PURGE | PROTECTED_IDENTITY | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| plans | 14 | PRESERVE_ALL | PROTECTED_CONFIGURATION | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| platform_event_outbox | 44 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| provider_webhook_events | 587 | NEVER_PURGE | PROTECTED_FINANCIAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| question_answer_idempotency | 40 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| question_editorial_feedback | 0 | NEVER_PURGE | PROTECTED_AUDIT | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| ranking_entries | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| referral_commission_entries | 0 | NEVER_PURGE | PROTECTED_FINANCIAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| referral_payout_cycles | 0 | NEVER_PURGE | PROTECTED_FINANCIAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| referral_payout_items | 0 | NEVER_PURGE | PROTECTED_FINANCIAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| referrals | 0 | NEVER_PURGE | PROTECTED_FINANCIAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| report_moderation_drafts | 0 | NEVER_PURGE | PROTECTED_AUDIT | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| report_moderation_history | 0 | NEVER_PURGE | PROTECTED_AUDIT | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| reports | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| schema_audit_runs | 0 | NEVER_PURGE | PROTECTED_SCHEMA_STATE | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| schema_backfill_runs | 1 | NEVER_PURGE | PROTECTED_SCHEMA_STATE | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| schema_migrations | 62 | NEVER_PURGE | PROTECTED_SCHEMA_STATE | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| security_ip_bans | 0 | PRESERVE_ALL | PROTECTED_CONFIGURATION | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| simulations | 3 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| study_sessions | 93 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| system_settings | 99 | PRESERVE_ALL | PROTECTED_CONFIGURATION | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| transactions | 45 | NEVER_PURGE | PROTECTED_FINANCIAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_answer_counters | 1 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_answers | 47 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_answers_archive | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_badges | 11 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_bookmarks | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_cards | 2 | NEVER_PURGE | PROTECTED_IDENTITY | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_feedback | 2 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_feedback_votes | 1 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_gamification_events | 35 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_highlights | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_notes | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_saved_questions | 2 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_statistics | 3 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_streaks | 1 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_study_schedules | 0 | NEVER_PURGE | PROTECTED_OPERATIONAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| user_subscriptions | 13 | NEVER_PURGE | PROTECTED_FINANCIAL | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |
| users | 6 | NEVER_PURGE | PROTECTED_IDENTITY | Before/after exact count plus PK checksum/sample-free aggregate; no row content in report |

## CI. Source matrix

| Domain | Source | Format | Importer | Provenance | Rights | Available? | Ready? | Missing requirements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Taxonomies | Gran taxonomy crawler/API | provider manifests + API payloads | Gran admin crawler and typed filter mapper | provider=gran/source identities | UNKNOWN_NOT_APPROVED | YES_PARTIAL | NO | Approve rights, freeze source manifest, reconcile unsynced manifests and failures |
| Boards and organizations | Gran taxonomy source | provider records | Gran taxonomy mapper | explicit source identities | UNKNOWN_NOT_APPROVED | YES_PARTIAL | NO | Rights approval, canonical dedupe, final source checksum/manifest |
| Careers and positions | Gran taxonomy source | provider records + explicit relationships | Gran taxonomy mapper | cargo_career/cargo_organization | UNKNOWN_NOT_APPROVED | YES_PARTIAL | NO | Importer review before real load and explicit relationship validation |
| Exams | Gran exam crawler and supplied PDF importer | API/PDF | private ingestion + exam importer/extractor | provider and exam-file manifests | UNKNOWN_NOT_APPROVED | YES_PARTIAL | NO | Definitive source package, rights, idempotency rehearsal, failed/review queue closure |
| Questions | Gran question crawler/private ingestion | API payloads | private ingestion worker | source_provider/source identity/batch | UNKNOWN_NOT_APPROVED | YES_PARTIAL | NO | Rights approval, source manifest, idempotency/dedup rehearsal, failure closure |
| Canonical contests | Editorial/admin source | NOT_AVAILABLE | Canonical Contest repository exists; safe CRUD/source path incomplete | No production rows/tables yet | REQUIRED | NO | NO | Apply schema only after rehearsal; provide approved editorial source and CRUD workflow |
| Public simulations | Editorial curation | NOT_AVAILABLE | Public simulation schema/import path not deployed | No production canonical tables | REQUIRED | NO | NO | Approved simulation manifest, schema rehearsal and editorial workflow |
| Laws and official text | Official Planalto URLs | official HTML | PlanaltoImportService | official URL/version hash | OFFICIAL_SOURCE_TEXT; EDITORIAL_RIGHTS_SEPARATE | YES | EDITORIAL_REQUIRED | Approve law catalog; keep commentary/editorial provenance separate |
| Materials | Editorial/marketplace contributors | NOT_AVAILABLE | Material APIs exist; public material schema migration pending | author/upload provenance | REQUIRED | NO | NO | Approved catalog, contributor rights, safe files, schema rehearsal |
| Blog | Editorial CMS/admin | NOT_AVAILABLE | Blog admin service | author/editorial audit | REQUIRED | NO | EDITORIAL_REQUIRED | Final editorial corpus, image rights, author/category/tag approval |
| Changelogs/novidades | Editorial release process | manual | Admin/system settings path | release identity | INTERNAL_EDITORIAL | YES_PARTIAL | EDITORIAL_REQUIRED | Confirm definitive release notes and publication dates |

## CJ. Load matrix

| Order | Domain | Source | Importer | Dependencies | Idempotent? | Expected volume | Pre-validation | Post-validation | Rollback unit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Schema prerequisites | Versioned migrations | migration runner in isolated staging first | verified backup + staging rehearsal | YES_BY_MIGRATION_ID | 3 pending migrations | schema diff/rollback review | schema inventory and migration parity | migration unit |
| 2 | Filter type contract | preserved production rows | none | schema prerequisites | N/A | 10 rows preserved | enum parity | required types present | none |
| 3 | Taxonomies/boards/organizations/careers/positions | approved provider manifest | Gran mapper after approval | filter type contract | MUST_BE_PROVEN | unknown | offline dedupe/rights/slug validation | identity, hierarchy and relationship validation | source batch |
| 4 | Exams and exam assets | approved exam/PDF manifest | private ingestion/exam importer | canonical filters | MUST_BE_PROVEN | unknown | file checksum, MIME, rights, canonical mapping | exam relation/orphan/file validation | exam batch + files |
| 5 | Canonical contests | approved editorial manifest | safe admin/import path missing | schema + organizations/boards/positions | MUST_BE_PROVEN | unknown | publication/date/slug/relation contracts | contest readiness and open-rule validation | contest batch |
| 6 | Questions/options/assets | approved question manifest | private ingestion worker | taxonomies + exams | MUST_BE_PROVEN | unknown | dedupe, rights, option and answer contract | publication, relations, security and duplicates | question batch + files |
| 7 | Public simulations | approved editorial manifest | path not yet approved | schema + questions/filters/contests/exams | MUST_BE_PROVEN | unknown | question ordering and publication contract | readiness and relation validation | simulation batch |
| 8 | Laws/articles | approved official URL catalog | Planalto importer + editorial review | schema | PREVIEW_REQUIRED | catalog dependent | official URL/version and UTF-8 validation | article hierarchy/version/editorial security | law unit |
| 9 | Materials/files | approved contributor catalog | material admin/import path | schema + users/taxonomies | MUST_BE_PROVEN | unknown | rights, file security, publication | entitlements/ownership/URL/security | material batch + files |
| 10 | Blog/taxonomies/assets | approved editorial corpus | blog admin path | users/authors | MUST_BE_PROVEN | unknown | slug/title/body/image rights | taxonomy/orphan/structured data checks | article batch |
| 11 | Derived search/statistics | loaded canonical data | existing reporters/materializers | all canonical domains | REBUILDABLE | derived | canonical load must pass | counts/search/statistics consistency | derived rebuild |
| 12 | SEO runtime artifacts | validated real dataset | sitemap/reporters only after authorization | all validation gates | REBUILDABLE | derived | PRELAUNCH remains | 20-gate matrix; no search submission | artifact batch |

## CK. Validation matrix

| Domain | Checks | Timing | Failure action |
| --- | --- | --- | --- |
| Target | Fingerprint exactly equals approved hash | Before any write | ABORT |
| Schema | Migration parity and expected tables/columns/FKs/indexes | Before load and after migration | ABORT |
| Source | Manifest/checksum/provenance/rights approved | Before each domain batch | ABORT_DOMAIN |
| Counts | Expected range and per-batch actuals | Before/after each batch | ABORT_ON_MATERIAL_DRIFT |
| Uniqueness | PK, canonical identity, slug namespace, source identity, relation | Preload offline and postload SQL | QUARANTINE_OR_ABORT |
| FK integrity | No orphan/dangling junction/missing parent | After each batch and final | ROLLBACK_BATCH |
| Taxonomy | Level, parent type, cycles, cross-type resolution | After taxonomy load | ROLLBACK_BATCH |
| Questions | Statement/options/answer/source/exam/taxonomy/assets | Preload and postload | QUARANTINE_OR_ABORT |
| Exams | Board/org/year/role/booklet/documents/question links | Preload and postload | QUARANTINE_OR_ABORT |
| Contests | Publication/status/dates/explicit relations/slug | Preload and postload | QUARANTINE_OR_ABORT |
| Public simulations | Publication/question order/explicit relations | Preload and postload | QUARANTINE_OR_ABORT |
| Laws | Official source/version/article hierarchy/editorial separation | Preload and postload | QUARANTINE_OR_ABORT |
| Materials | Rights/files/URLs/ownership/entitlements | Preload and postload | ABORT_ON_SECURITY_OR_OWNERSHIP |
| Blog | Publication/author/taxonomy/slug/body/assets | Preload and postload | QUARANTINE_OR_ABORT |
| Encoding | UTF-8, invalid bytes, mojibake, HTML entities | Offline and postload sample-free scans | QUARANTINE |
| URLs | Allowed schemes, no credentials/private IP/localhost/tokenized public URL | Offline and postload | ABORT_ON_SECURITY |
| Security | Protected sentinels absent from public projections | Postload SSR/API crawl | ABORT_GO |
| Test residue | Known fixture markers/batches/slugs reported, never auto-deleted | After purge and after load | ABORT_GO |

## CL. 20-gates matrix

| # | Gate | Status | After real load? | Staging? | Canonical prod host? | FIELD? | Production activation? | Earliest | Closeable in 11? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | INTERNAL_LINK_GRAPH_REAL_DATA_VALIDATION_REQUIRED | OPEN_NOW | true | true | false | false | false | AFTER_REAL_DATA_LOAD_IN_STAGING | true |
| 2 | SEO_ORPHAN_REAL_DATA_VALIDATION_REQUIRED | OPEN_NOW | true | true | false | false | false | AFTER_REAL_DATA_LOAD_IN_STAGING | true |
| 3 | BREADCRUMB_REAL_DATA_VALIDATION_REQUIRED | OPEN_NOW | true | true | false | false | false | AFTER_REAL_DATA_LOAD_IN_STAGING | true |
| 4 | STRUCTURED_DATA_REAL_DATA_VALIDATION_REQUIRED | OPEN_NOW | true | true | false | false | false | AFTER_REAL_DATA_LOAD_IN_STAGING | true |
| 5 | BLOG_TAXONOMY_REAL_DATA_VALIDATION | OPEN_NOW | true | true | false | false | false | AFTER_REAL_DATA_LOAD_IN_STAGING | true |
| 6 | BLOG_TAXONOMY_REAL_DATA_QUALITY_GATE | OPEN_NOW | true | true | false | false | false | AFTER_REAL_DATA_LOAD_IN_STAGING | true |
| 7 | BLOG_TAXONOMY_REAL_DATA_EXPLAIN_REQUIRED | OPEN_NOW | true | true | false | false | false | AFTER_REAL_DATA_LOAD_IN_STAGING | true |
| 8 | SITEMAP_REAL_DATA_VALIDATION_REQUIRED | OPEN_NOW | true | true | false | false | false | AFTER_REAL_DATA_LOAD_IN_STAGING | true |
| 9 | INDEX_POLICY_REAL_DATA_VALIDATION_REQUIRED | OPEN_NOW | true | false | false | false | true | SEO_GO_CANDIDATE_OR_PRODUCTION_AS_SPECIFIED | false |
| 10 | ROBOTS_PRODUCTION_VALIDATION_REQUIRED | OPEN_NOW | true | false | true | false | true | SEO_GO_CANDIDATE_OR_PRODUCTION_AS_SPECIFIED | false |
| 11 | CANONICAL_HOST_PRODUCTION_VALIDATION_REQUIRED | OPEN_NOW | true | false | true | false | true | SEO_GO_CANDIDATE_OR_PRODUCTION_AS_SPECIFIED | false |
| 12 | SITEMAP_PRODUCTION_SCALE_VALIDATION_REQUIRED | OPEN_NOW | true | true | false | false | true | SEO_GO_CANDIDATE_OR_PRODUCTION_AS_SPECIFIED | false |
| 13 | SEARCH_ENGINE_SUBMISSION_AFTER_SEO_GO | OPEN_NOW | true | false | true | false | true | SEO_GO_CANDIDATE_OR_PRODUCTION_AS_SPECIFIED | false |
| 14 | PERFORMANCE_REAL_DATA_QUERY_VALIDATION_REQUIRED | OPEN_NOW | true | true | false | false | false | AFTER_REAL_DATA_LOAD_IN_STAGING | true |
| 15 | PERFORMANCE_REAL_DATA_EXPLAIN_REQUIRED | OPEN_NOW | true | true | false | false | false | AFTER_REAL_DATA_LOAD_IN_STAGING | true |
| 16 | CORE_WEB_VITALS_REAL_USER_VALIDATION_REQUIRED | OPEN_NOW | false | false | true | true | true | POST_PRODUCTION_FIELD_RUM | false |
| 17 | PRODUCTION_PERFORMANCE_SMOKE_REQUIRED | OPEN_NOW | true | false | true | false | true | SEO_GO_CANDIDATE_OR_PRODUCTION_AS_SPECIFIED | false |
| 18 | CDN_CACHE_PRODUCTION_VALIDATION_REQUIRED | OPEN_NOW | true | false | true | false | true | SEO_GO_CANDIDATE_OR_PRODUCTION_AS_SPECIFIED | false |
| 19 | FONT_DELIVERY_PRODUCTION_VALIDATION_REQUIRED | OPEN_NOW | true | false | true | false | true | SEO_GO_CANDIDATE_OR_PRODUCTION_AS_SPECIFIED | false |
| 20 | IMAGE_DELIVERY_REAL_DATA_VALIDATION_REQUIRED | OPEN_NOW | true | true | false | false | true | SEO_GO_CANDIDATE_OR_PRODUCTION_AS_SPECIFIED | false |

## CM. Backup/restore matrix

| Control | Evidence | Status |
| --- | --- | --- |
| Backup command | mysqldump single-transaction/quick/routines/triggers/events/utf8mb4 | PASS |
| Backup destination | Outside public webroot | PASS |
| Existing dumps | 17 SQL dumps found | PASS |
| Latest dump | 60,916,382 bytes at 2026-08-24T02:20:06Z | PASS |
| Latest checksum | SHA-256 sidecar matches computed hash | PASS |
| Backup heartbeat | Recent success heartbeat, retention 14 days | PASS |
| Restore tool | Guarded restore script with checksum and explicit execute token | PASS_CAPABILITY |
| Restore dry-run | Code path exists; not executed in 11A | NOT_EXECUTED |
| Disposable restore rehearsal | No evidence of a completed restore plus integrity smoke | FAIL |
| File-storage backup | 91 MB uploads and manifests inventoried; no recoverable backup/checksum evidence | FAIL |

## CN. Data-safety matrix

| Risk | Protected surface | Guard | Evidence | Status |
| --- | --- | --- | --- | --- |
| Wrong target | Entire database | Exact environment + schema/count/migration fingerprint | Hash generated; future guard not implemented | BLOCKED |
| Protected auth deletion | Users/auth/sessions | Denylist plus no cascade from content purge | Tables classified; cascade closure unresolved | BLOCKED |
| Billing loss | Transactions/subscriptions/ledger/webhooks | Never-purge denylist and live billing writers preserved | Tables classified; maintenance orchestration not rehearsed | BLOCKED |
| User progress loss | Answers/saved questions/legal progress | Preserve/remap decision before content parent deletion | 47 answers, 2 saves, 40 idempotency rows, 1 legal progress row affected | BLOCKED |
| Unsafe legacy reset | User operational and content tables | Prohibit reset_production_content.php for 11B | Disables FK checks and lacks fingerprint/backup/count guards | P0_BLOCKER |
| Unknown table deletion | Schema | All tables classified; abort on schema drift | 125/125 classified, future fingerprint required | PASS_PLAN |
| Source contamination | Canonical content | Approved source manifest/checksum/rights | No complete approved source set | BLOCKED |
| Concurrent writes | Content queues/admin/webhooks/users | Maintenance runbook with content writer freeze and billing lane continuity | Workers/cron identified; freeze not rehearsed | BLOCKED |
| Backup unusable | Database rollback | Checksum plus disposable restore and integrity smoke | Checksum pass; restore rehearsal absent | BLOCKED |
| File mismatch | Uploads/exams/assets | Asset manifest, backup and DB/file consistency checks | Assets inventoried; backup evidence absent | BLOCKED |
| Schema mismatch | Contest/simulation/material domains | Staging migration rehearsal before any real load | Three local migrations absent in production | BLOCKED |
| Premature indexing | All public content | Keep PRELAUNCH; no sitemap/search notification | No runtime or operational change in 11A | PASS |

## CO. Diffstat

Relatorio Markdown novo e manifesto JSON ignorado. Nenhum runtime, schema, migration ou dependencia alterado.

## CP. Worktree

Esperado ao final: somente docs/data/phase-11a-real-dataset-inventory-reset-plan-2026-08-23.md como tracked uncommitted; .tmp ignorado.

## CQ. Recommendation

**INTERROMPER.** Nao autorizar 11B. Primeiro eliminar/proibir o reset legado, fechar referencias protegidas, aprovar fontes/rights, ensaiar migrations, provar restore DB+assets e ensaiar writer freeze. Depois repetir fingerprint e dry-run read-only.

## Declaracoes obrigatorias

```text
baseline = fbb34f83f94bbda0792bd861c20d137916566a58
test dataset removed = NÃO
real dataset loaded = NÃO
real dataset validated = NÃO
destructive DB operations executed = 0
DELETE executed = 0
TRUNCATE executed = 0
DROP executed = 0
backfill writes = 0
production indexing activated = NÃO
production sitemap published = NÃO
search engines notified = NÃO
platform production ready = NÃO
CONCURSOMESTRE_PRODUCTION_GO = NÃO
commit = NÃO
push realizado = NÃO
deploy realizado = NÃO
```

## Veredito

```text
DATASET_PHASE_11B_EXECUTION_NOT_READY
```
