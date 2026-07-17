# Recuperacao seletiva da R6.1 na 1.0.0

Data: 17/07/2026

Branch: `1.0.0`

Base obrigatoria preservada: `46de69d`

Pacotes usados somente como referencia: R6.1, SQL candidato e prompts de recuperacao seletiva.

## Veredito

- **Overlay integral da R6.1:** REPROVADO.
- **Recuperacao seletiva:** APROVADA para gerar pacote de revisao e homologacao controlada.
- **Producao:** NAO APROVADA nesta rodada. Nao houve deploy nem migration em producao.
- **Escala de tres milhoes de questoes:** NAO COMPROVADA. O maior fixture executado possui 100.000 questoes.

A R6.1 continua disponivel em uma vertente isolada para avaliacao manual. Ela nao e a base do pacote oficial.

## Protecoes preservadas

- `package.json` permanece em `1.0.0` e o projeto continua npm-only.
- DTO canonico de sessao e login sem `/auth/me.php` redundante foram preservados.
- Billing permanece fora do DTO global e usa o endpoint financeiro dedicado.
- Importacoes continuam persistindo questoes nas tabelas canonicas da plataforma.
- Ownership, ingestao privada HMAC, sitemap segmentado e historico oficial de migrations nao foram substituidos.
- Nenhuma migration da R6.1 foi copiada como baseline concorrente.

## Reaproveitado e adaptado

### Banco, taxonomias e identidade

- Migration aditiva `20260717_010000_question_scale_foundation.php`.
- `filter_types`, `filter_aliases`, assets, icones e keywords para taxonomias.
- `selected_option_id` com compatibilidade temporaria com o indice legado.
- `question_answer_idempotency`, colunas derivadas de leitura e `question_search_documents`.
- Indices para keyset, filtros reversos e respostas.
- Rollback explicito e backfills CLI dry-run por padrao.
- Preservacao de IDs das alternativas por `external_key`, evitando mudar o significado de respostas antigas.

### Questoes e leitura em escala

- Cursor keyset assinado e vinculado ao hash dos filtros.
- Limite de 1 a 50 e leitura `limit + 1`, sem `COUNT(*)` ou `OFFSET` no caminho v2.
- DTO publico leve, carregadores em lote e isolamento entre cache publico e estado do usuario.
- Cache publico versionado com rejeicao de payload privado.
- Gabarito resolvido no backend e idempotencia de envio de resposta.
- Scripts de fixture e `EXPLAIN` para diagnostico de escala.
- Rastreamento sanitizado de importacao em massa, sem armazenar enunciados, editoriais ou payloads sensiveis nos logs operacionais.

### Redis e runtime compartilhado

- `RuntimeStoreInterface`, Redis e fallback nulo/local controlado.
- Rate limit Redis-first e locks distribuidos de cron/worker.
- Prefixo por ambiente, TTL, timeout, invalidacao e readiness para multiplas instancias.
- Redis real respondeu no banco isolado da VPS.

### Financeiro e Stripe

- Migration aditiva `20260717_020000_stripe_recovery_queue.php`.
- Fila persistente no fluxo oficial de webhooks, sem criar um segundo ledger.
- Retentativas, claim atomico, idempotencia, dead-letter e worker/cron.
- Backfill do ledger em lotes e regras de recuperacao de pagamento.
- Validacoes de detach, cartao vinculado e validade para parcelamento.
- Testes locais deterministas foram incorporados; chamadas reais a Stripe test mode nao foram repetidas nesta rodada.

### Produto

- Upload administrativo seguro de logo de e-mail e imagem Open Graph.
- Assets/aliases de banca, orgao e taxonomias no admin e nos filtros.
- Links sociais configurados na homepage.
- Correcao de `votos` para `respostas` onde a metrica representa tentativas.
- Rollback otimista de favoritos quando a API falha.
- Fluxos autoritativos de notas/destaques da Lei Comentada preservados.

### Decomposicao aproveitada

- `adminImportWorkflowCore.ts`.
- `adminImportWorkflowParsingCore.ts`.
- `adminImportWorkflowPublicationCore.ts`.
- `adminService.types.ts`.
- `adminService.normalizers.ts`.
- `lawEditorCore.tsx`.

As extracoes foram adaptadas a arvore atual. Nenhum modulo completo da R6.1 foi sobreposto.

### Observabilidade e release

- `Request`, `HttpException`, `RequestContext`, request id e logs estruturados com redacao.
- Liveness e readiness separados, sem DDL e sem criar diretorios durante a verificacao.
- Release metadata, telemetria segura de aliases legados e erros publicos sem detalhes de PDO.
- Manifesto com SHA-256 de arquivos criticos e migrations.
- Verificacao de pacote, deploy atomico por symlink e rollback apenas de codigo.
- Scripts de deploy sao dry-run por padrao e exigem autorizacao explicita por ambiente.

## Rejeitado

- Overlay da R6.1 e seu baseline SQL.
- Remocao do historico oficial de migrations, seeds, rotas e documentacao.
- DTOs paralelos de questoes, sessao, financeiro ou ingestao.
- Segundo ledger, segunda fila Stripe e segundo modulo de crawler.
- `profileCore.tsx` candidato, que estava incompleto.
- `legalReaderCore.tsx` candidato, que reintroduzia `localStorage` e alterava comportamento.
- Runtime/editor actions do importador que divergiam do contrato oficial mais novo.
- Separacao integral de subscriptions, incompatível com as correcoes financeiras posteriores da base.
- Manifestos da R6.1 que declaravam gates executados sem a evidencia correspondente.

## Avaliacao dos 11 prompts recebidos

| Prompt | Decisao | Estado nesta entrega |
|---|---|---|
| 1. Protecao da base `1.0.0` | Cabe integralmente | Aplicado |
| 2. Banco, filtros e IDs estaveis | Cabe como migrations aditivas | Aplicado; baseline concorrente rejeitado |
| 3. Questoes, cursor e cache | Cabe com adaptacao ao contrato oficial | Aplicado; escala de 3 milhoes ainda nao comprovada |
| 4. Redis | Cabe integralmente | Aplicado com fallback controlado e readiness |
| 5. Financeiro e Stripe | Cabe seletivamente | Fila, idempotencia e recuperacao aplicadas; Stripe real nao executado |
| 6. Bugs funcionais | Cabe por correcao comprovada | Correcoes listadas neste relatorio aplicadas; sem importar regressao da R6.1 |
| 7. Decomposicao de arquivos | Cabe incrementalmente | Seis extracoes aplicadas; sete arquivos grandes continuam como divida |
| 8. Observabilidade e backend | Cabe integralmente | Aplicado |
| 9. Release e rollback | Cabe integralmente | Aplicado em modo seguro, dry-run por padrao |
| 10. Homologacao real | Obrigatorio antes de producao | Parcial: VPS isolada validada; pacote final ainda nao ativado em staging |
| 11. Pacote final | Cabe integralmente | Pacote limpo gerado e validado; producao continua bloqueada |

## Ainda aproveitavel, mas nao incorporado

1. Decompor os sete arquivos acima do budget de 4.500 linhas, um dominio por vez.
2. Aplicar TypeScript `strict` e `noUncheckedIndexedAccess` por diretorio, reduzindo a divida sem enfraquecer regras.
3. Melhorar a consulta reversa por filtro, que ainda apresentou `filesort` no fixture de 100.000 questoes.
4. Executar fixture de tres milhoes, `EXPLAIN ANALYZE` e k6 em infraestrutura representativa.
5. Homologar Stripe em test mode com credenciais descartaveis autorizadas.
6. Ensaiar o pacote exato em staging com smoke anonimo, autenticado, admin, worker, cron e rollback.

## Gates executados

| Gate | Resultado | Evidencia |
|---|---|---|
| Vitest | PASS | 65 arquivos; 425 testes |
| TypeScript normal | PASS | `npm run typecheck` |
| Build Next.js | PASS | 41 rotas/paginas geradas |
| ESLint | PASS com divida | 0 erros; 76 warnings |
| TypeScript strict | FAIL | 182 erros preexistentes |
| noUncheckedIndexedAccess | FAIL | 561 diagnosticos preexistentes |
| Encoding | PASS | nenhum mojibake |
| Segredos | PASS | nenhum segredo versionado |
| Artefatos gerados | PASS | nenhum artefato indevido na raiz |
| Budget de tamanho | PASS com divida | nenhum arquivo novo > 4.500; divida nao cresceu |
| npm audit | PASS | 0 vulnerabilidades |
| Composer validate | PASS | VPS isolada |
| Composer install | PASS | lock instalavel na VPS |
| PHP lint | PASS | 1.301 arquivos, incluindo vendor |
| Suite PHP deterministica | PASS apos alinhamento | 134 testes; 1 operacional Stripe NOT RUN |
| Migrations | PASS | dois ups idempotentes em MySQL isolado |
| Backfills | PASS | dry-run e apply em MySQL isolado |
| Redis | PASS | instancia real, DB isolado |
| EXPLAIN | PASS tecnico | indices usados; filesort pendente no filtro reverso |
| Pacote de release | PASS | 1.549 arquivos; 15,49 MiB; sem `.git`, dependencias, dumps ou segredos |
| Stripe real | NOT RUN | sem credencial descartavel nesta rodada |
| Staging do pacote final | NOT RUN | apenas a R6.1 bruta esta publicada isoladamente |

## Benchmark executado

- Banco isolado: `cm_selective_perf_20260717`.
- Questoes sinteticas: 100.000.
- Documentos de busca: 100.000.
- Vinculos de filtro: 5.000.
- Listagem publica: indice `idx_questions_public_keyset_v2`, sem filesort.
- Busca full-text: indice `ft_question_search_statement`, sem filesort.
- Filtro reverso: indice utilizado, mas com filesort; exige otimizacao antes de alegar escala de tres milhoes.

## Vertente R6.1 para teste manual

- URL: `https://r61-76-13-163-93.sslip.io`
- Banco: isolado da producao.
- Usuario Linux, PHP-FPM e processo Next: isolados.
- Basic Auth: removido. Resposta HTTP atual: `200`, sem `WWW-Authenticate`.
- Login aplicativo: validado por HTTP com usuario administrativo de staging.
- Se o navegador ainda mostrar o prompt nativo antigo, usar janela anonima ou limpar as credenciais HTTP em cache.

## Rollback

1. O pacote final nao altera producao automaticamente.
2. Em staging, releases devem ser instaladas em diretorio imutavel e ativadas por symlink.
3. O rollback de codigo troca o symlink para a release anterior.
4. Rollback de banco nunca e automatico; usar os arquivos em `backend/database/rollbacks/` apenas apos backup e avaliacao dos dados escritos.

## Segredos

- Nenhum segredo novo foi versionado.
- Credenciais de bancos de validacao e do staging isolado nao fazem parte do pacote.
- Archives temporarios, `.env`, logs, dumps, uploads privados e `node_modules` ficam fora da entrega.
