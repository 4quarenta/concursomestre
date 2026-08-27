# Macroetapa 11B - Correcao database-driven do sitemap

## Contexto

O reset `RESET_POLICY_V2` removeu o dataset temporario, mas o Nginx continuou
servindo diretamente um indice e cinco shards materializados a partir do dataset
anterior. O estado observado antes da remediacao era 1.275 URLs stale acessiveis
publicamente. A causa nao era uma lista manual no gerador: era a ausencia de
invalidacao vinculada ao dataset e um `alias` do Nginx que contornava os guards
de launch mode e frescor da aplicacao.

## Contrato corrigido

O pipeline materializado permanece database-driven:

1. consulta entidades canonicas no banco;
2. aplica publicacao, eligibility, readiness, canonical e index policy;
3. materializa shards em diretorio de staging;
4. valida o conjunto completo;
5. calcula fingerprint logico das URLs elegiveis e fingerprint fisico dos XMLs;
6. promove somente o conjunto validado por troca atomica;
7. publica somente quando o estado do artefato e `CURRENT` e ambos os
   fingerprints conferem.

Qualquer estado `DIRTY`, falha de geracao, fingerprint divergente ou launch mode
sem permissao falha fechado. O reset integral invalida e retira o artefato antigo
de forma atomica. Writers canonicos de filtros, questoes, provas, blog, materiais,
Lei Comentada e sincronizacao taxonomica marcam o sitemap como `DIRTY` antes da
mutacao. Interacoes privadas de usuario nao invalidam o sitemap.

## PRELAUNCH

`SEO_LAUNCH_MODE` permanece ausente e o fallback efetivo e `PRELAUNCH`.
O sitemap interno pode ser simulado em ambiente isolado, mas o sitemap publico
de producao fica indisponivel. O exemplo versionado do Nginx deixou de usar
`alias` direto e encaminha a leitura para os routes protegidos da aplicacao.

Na producao atual foi aplicado um bloqueio fail-closed no Nginx para
`/sitemap.xml`, `/sitemap-index.xml` e `/sitemaps/`. O artefato antigo foi movido
atomicamente para quarentena operacional, sem editar XML e sem criar um sitemap
vazio manual. Os dois timers continuam ativos; execucoes em `PRELAUNCH` terminam
com sucesso sem republicar o conjunto retirado.

## Analytics zero-state

O writer de analytics passou a descartar eventos quando o launch mode efetivo e
`PRELAUNCH` e o dataset canonico esta vazio. Como defesa operacional imediata,
os dois caminhos HTTP do tracker tambem estao bloqueados no Nginx com resposta
de descarte factual. A unica linha residual foi removida por transacao controlada
apos precondicao read-only de cardinalidade exata.

## Evidencia operacional

Captura read-only final: `2026-08-26T03:33:15Z`.

| Controle | Resultado |
| --- | ---: |
| RESETTABLE vazias | 113/113 |
| Total de linhas RESETTABLE | 0 |
| `analytics_lifecycle_events` | 0 |
| Repopulacao apos probes | 0 |
| Diretorio publico de artefato | ausente |
| Sitemap index stale servido | nao |
| Shards stale servidos | 0 |
| URLs stale servidas | 0 |
| `/sitemap.xml` origem/publico | 503/503 |
| `/sitemap-index.xml` origem/publico | 503/503 |
| Shards amostrados origem/publico | 503/503 |

Os services de sitemap principal e blog reportaram `success`; os timers estao
`active`. Nenhum conteudo real foi inserido.

## Writes de producao

Esta remediacao executou exatamente um DML de producao: `DELETE` controlado da
unica linha residual de `analytics_lifecycle_events`. O resultado foi
`deletedRows=1`, `remainingRows=0`. Nao houve `INSERT`, backfill, migration ou
carga de dataset real.

## Testes

- PHP lint dos arquivos alterados: PASS.
- Estado/fingerprint/invalidation/publisher/contract/reset/analytics: PASS.
- Vitest focado de sitemap e launch policy: 8/8 PASS.
- Launch-control validator: PASS, 55 familias mapeadas.
- Secret scan: PASS.
- Encoding: PASS.
- `git diff --check`: PASS, apenas avisos de EOL do worktree Windows.
- Full Vitest apos o fechamento dos hooks: 154/154 arquivos e 911/911 testes.
- Typecheck e route types: PASS.
- ESLint focado: PASS.
- Build Next limpo: PASS, 52 paginas geradas.

## Limites e proximo gate

A protecao Nginx e a retirada do artefato stale estao ativas em producao. As
alteracoes de aplicacao que implementam fingerprints separados, leitura
fail-closed, invalidacao dos writers e reset integrado permanecem no worktree;
nao houve commit, push ou deploy de aplicacao nesta remediacao. Elas precisam
passar pelo fluxo normal de revisao e deploy antes de autorizar a carga do dataset
definitivo.

`REAL_DATA_INSERTION_AUTHORIZED = NAO`.
