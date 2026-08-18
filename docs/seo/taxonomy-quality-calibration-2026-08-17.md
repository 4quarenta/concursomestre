# Calibracao real de quality para taxonomias - Checkpoint 4.3

- Medicao UTC: `2026-08-16T23:56:19-03:00`
- Ambiente: `PRODUCTION_READ_ONLY_USER`
- Banco: `concursomestre`
- Engine: `8.4.10-10`
- Conta: `co***` (`SELECT`, `SHOW VIEW`; escrita = 0)
- Reporter: `taxonomy-quality-calibration.v1`, modo `read_only_shadow`

## Seguranca operacional

- Transporte: SSH para a VPS; MySQL em `127.0.0.1:3306`.
- Definicao de questao publica: `publish_status IN (published, scheduled)`, `visibility_status = public`, `published_sort_at IS NOT NULL` e `published_sort_at <= NOW()`.
- Nenhum conteudo de questao, dado pessoal, credencial ou payload protegido foi exportado.
- Runtime permanece `NOINDEX`; novas URLs INDEX = `0`; novas URLs no sitemap = `0`.

## Dataset

| Tabela | Total |
|---|---:|
| filters | 63073 |
| questions | 1130 |
| provas | 100 |

O banco e o operacional de producao, possui atividade de agosto/2026 e backup diario com checksum valido. Foi considerado representativo.

## Niveis de conhecimento

| Nivel | Total | Publico estrutural | Pending | Invalido |
|---|---:|---:|---:|---:|
| materia | 148 | 148 | 0 | 0 |
| topico | 2341 | 2341 | 0 | 0 |
| subtopico | 8041 | 8041 | 0 | 0 |
| assunto | 22698 | 11757 | 0 | 10941 |

> Publico estrutural significa nao-pending e cadeia hierarquica valida; nao implica promocao SEO.

## Disciplinas

Total canonico: `148`.

### Questoes publicas

| Bucket | Disciplinas |
|---|---:|
| 0 | 82 |
| 1-4 | 22 |
| 5-9 | 16 |
| 10-19 | 14 |
| 20-49 | 8 |
| 50-99 | 4 |
| 100-249 | 2 |
| 250+ | 0 |

| Percentil | Questoes |
|---|---:|
| P10 | 0 |
| P25 | 0 |
| P50 | 0 |
| P75 | 7 |
| P90 | 18.3 |
| P95 | 37.3 |
| P99 | 94.31 |

### Provas, bancas e anos

#### examPercentiles

| Percentil | Valor |
|---|---:|
| P10 | 0 |
| P25 | 0 |
| P50 | 0 |
| P75 | 2 |
| P90 | 5 |
| P95 | 7 |
| P99 | 13.06 |

#### boardPercentiles

| Percentil | Valor |
|---|---:|
| P10 | 0 |
| P25 | 0 |
| P50 | 0 |
| P75 | 2.25 |
| P90 | 5 |
| P95 | 7 |
| P99 | 9.06 |

#### yearPercentiles

| Percentil | Valor |
|---|---:|
| P10 | 0 |
| P25 | 0 |
| P50 | 0 |
| P75 | 1 |
| P90 | 2 |
| P95 | 2 |
| P99 | 3 |

### Descricoes

| Faixa | Disciplinas |
|---|---:|
| 0 | 147 |
| 1-49 | 0 |
| 50-149 | 1 |
| 150-299 | 0 |
| 300+ | 0 |

- Pending: `0`
- Pending com questoes: `0`
- Placeholders: `0`

### Slugs, identidades e aliases

- Slug vazio: `0`
- Slug invalido: `0`
- Slug > 80: `1`
- Slug > 190: `0`
- Sufixo de colisao para revisao: `2`
- Com identidade externa: `146`; sem: `2`; multiplas: `0`
- Aliases: zero=`148`, um=`0`, multiplos=`0`, conflitos=`0`
- Autoridade canonica de slug: `filters.slug` persistido.

## Hierarquia

- Parent inexistente: `0`
- Parent/cadeia incompativel: `10941`
- Ciclos: `0`

## Overlap Jaccard

| Relacao | Pares |
|---|---:|
| Disciplina - topico | 2341 |
| Disciplina - disciplina (candidatos por questao compartilhada) | 5 |
| Topico - assunto (inclui descendencia via subtopico) | 22686 |

### disciplineTopic

| Jaccard | Pares |
|---|---:|
| 0-0.24 | 1119 |
| 0.25-0.49 | 17 |
| 0.50-0.74 | 7 |
| 0.75-0.89 | 1 |
| 0.90-0.99 | 1 |
| 1.00 | 8 |
| not_evaluable | 1188 |

### disciplineDiscipline

| Jaccard | Pares |
|---|---:|
| 0-0.24 | 4 |
| 0.25-0.49 | 1 |
| 0.50-0.74 | 0 |
| 0.75-0.89 | 0 |
| 0.90-0.99 | 0 |
| 1.00 | 0 |
| not_evaluable | 0 |

### topicSubject

| Jaccard | Pares |
|---|---:|
| 0-0.24 | 6751 |
| 0.25-0.49 | 15 |
| 0.50-0.74 | 10 |
| 0.75-0.89 | 1 |
| 0.90-0.99 | 0 |
| 1.00 | 14 |
| not_evaluable | 15895 |

A comparacao disciplina-disciplina usa inverted index por IDs de questoes publicas; nao executa O(N2) cego.

## Thresholds derivados

| Regra | Candidate A | Candidate B |
|---|---:|---:|
| Questoes minimas | 8 | 17 |
| Relacoes distintas minimas | 3 | 6 |
| Overlap maximo | 0.3333 | 0.0639 |
| Description minima | n/a | 1 |
| Topicos alternativos | n/a | 15 |

- A: P50 positive questions + P25 relations + P75 observed overlap.
- B: P75 positive questions + P50 relations/overlap + median editorial or topic evidence.

## Quality shadow e index budget simulado

| Perfil | PASS | FAIL | NOT_EVALUATED | Potencial INDEX | Permaneceria NOINDEX |
|---|---:|---:|---:|---:|---:|
| candidateA | 33 | 115 | 0 | 33 | 115 |
| candidateB | 8 | 140 | 0 | 8 | 140 |

Diferenca A-B: `25` disciplinas (`75.76%` dos PASS de A).

### Reason codes - Candidate A

| Reason code | Frequencia |
|---|---:|
| quality.low_volume | 114 |
| quality.low_diversity | 86 |
| taxonomy.no_public_content | 82 |
| quality.high_overlap | 3 |
| taxonomy.slug_too_long | 1 |

## Bancas shadow

- Total: `824`
- Threshold de conteudo derivado do P50 positivo: `6`
- PASS: `22`; FAIL: `802`; NOT_EVALUATED: `0`
- Enforcement runtime: `false`.

## EXPLAIN

| Query | type | key | rows | Extra |
|---|---|---|---:|---|
| identity | const | unique_type_slug | 1 |  |
| topics | ref | parent_id | 7 | Using where |
| questions | ref | filter_id | 134 | Using index; Using temporary; Using filesort |
| questions | eq_ref | PRIMARY | 1 | Using where |
| boards | ref | filter_id | 134 | Using index; Using temporary |
| boards | eq_ref | PRIMARY | 1 | Using where |
| boards | ref | PRIMARY | 11 | Using index |
| boards | eq_ref | PRIMARY | 1 | Using where |
| exams | ALL |  | 72 | Using where; Using temporary |
| exams | ref | idx_question_provas_prova | 11 | Distinct |
| exams | eq_ref | PRIMARY | 1 | Using index; Distinct |

O full scan de provas estima 72 linhas e nao justifica migration agora. Questoes usam `filter_id`, mas exibem temporary/filesort para a ordenacao cruzada; monitorar com crescimento.

## Timings leves

| Query | Runs | Mediana ms | P95 aprox. ms | Max ms |
|---|---:|---:|---:|---:|
| identity | 5 | 109.785 | 140.208 | 140.474 |
| topics | 5 | 112.059 | 137.304 | 140.648 |
| questions | 5 | 57.22 | 141.977 | 163.129 |
| boards | 5 | 59.146 | 59.795 | 59.801 |
| exams | 5 | 58.742 | 59.124 | 59.167 |

Reporter completo: `7935 ms`, `42` queries constantes. N+1 detectado: `false`.

## Amostras manuais

### strong

| ID | Slug | Nome | Questoes | Provas | Bancas | Anos | Desc. | Topicos | Overlap | Hard fails |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 33540 | gran-assunto-403587-lingua-portuguesa | Língua Portuguesa | 134 | 17 | 14 | 3 | 0 | 7 | 0 |  |
| 33638 | gran-assunto-14-tecnologia-da-informacao | Tecnologia da Informação | 107 | 7 | 6 | 2 | 0 | 16 | 0 |  |
| 33536 | gran-assunto-405030-informatica | Informática | 80 | 11 | 8 | 3 | 0 | 11 | 0 |  |
| 192 | atualidades-e-conhecimentos-gerais | Atualidades e Conhecimentos Gerais | 75 | 11 | 10 | 2 | 0 | 3 | 0.1733 |  |
| 33531 | gran-assunto-405199-direito-constitucional | Direito Constitucional | 58 | 14 | 7 | 2 | 0 | 14 | 0.0169 |  |
| 33580 | gran-assunto-403911-economia-e-financas | Economia e Finanças | 64 | 8 | 4 | 1 | 0 | 17 | 0 |  |
| 33555 | gran-assunto-1210-conhecimentos-especificos-de-um-determinado-cargo-area | Conhecimentos Específicos de um determinado Cargo/Área | 48 | 7 | 4 | 1 | 0 | 125 | 0.0333 |  |
| 33529 | gran-assunto-404335-direito-administrativo | Direito Administrativo | 35 | 12 | 8 | 3 | 0 | 19 | 0 |  |
| 33541 | gran-assunto-403825-matematica | Matemática | 36 | 9 | 8 | 3 | 0 | 13 | 0.0189 |  |
| 33528 | gran-assunto-104-contabilidade-geral | Contabilidade Geral | 38 | 7 | 4 | 1 | 0 | 52 | 0 |  |

### medium

| ID | Slug | Nome | Questoes | Provas | Bancas | Anos | Desc. | Topicos | Overlap | Hard fails |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 152 | medicina | Medicina | 7 | 5 | 4 | 1 | 0 | 15 | 0 |  |
| 33525 | gran-assunto-405626-administracao-financeira-e-orcamentaria-afo | Administração Financeira e Orçamentária - AFO | 11 | 3 | 2 | 1 | 0 | 21 | 0.2727 |  |
| 33530 | gran-assunto-405864-direito-civil | Direito Civil | 11 | 3 | 2 | 1 | 0 | 14 | 0 |  |
| 33550 | gran-assunto-12-biologia | Biologia | 8 | 3 | 5 | 1 | 0 | 26 | 0 |  |
| 33557 | gran-assunto-405707-contabilidade-publica | Contabilidade Pública | 9 | 3 | 4 | 2 | 0 | 16 | 0 |  |
| 147 | psicologia | Psicologia | 7 | 5 | 3 | 1 | 0 | 19 | 0 |  |
| 33534 | gran-assunto-406602-direito-processual-penal | Direito Processual Penal | 11 | 2 | 2 | 1 | 0 | 19 | 0 |  |
| 33611 | gran-assunto-1211-legislacao-estadual-distrital-e-municipal | Legislação Estadual, Distrital e Municipal | 7 | 3 | 5 | 2 | 0 | 2 | 0 |  |
| 177 | lingua-espanhola | Língua Espanhola | 6 | 2 | 4 | 2 | 0 | 6 | 0 |  |
| 3181 | gran-assunto-398730-ciencia-politica | Ciência Política | 6 | 4 | 2 | 1 | 0 | 3 | 0 |  |

### weak

| ID | Slug | Nome | Questoes | Provas | Bancas | Anos | Desc. | Topicos | Overlap | Hard fails |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 33537 | gran-assunto-421855-legislacao-de-transito-e-ctb | Legislação de Trânsito e CTB | 1 | 1 | 1 | 1 | 0 | 9 | 0 |  |
| 181 | conhecimentos-pedagogicos | Conhecimentos Pedagógicos | 1 | 1 | 1 | 1 | 0 | 0 | 0 |  |
| 173 | fisica | Física | 1 | 1 | 1 | 1 | 0 | 20 | 0 |  |
| 33639 | gran-assunto-398386-teologia-e-religioes | Teologia e Religiões | 1 | 1 | 2 | 1 | 0 | 2 | 0 |  |
| 33612 | gran-assunto-2932-legislacao-federal | Legislação Federal | 1 | 1 | 2 | 1 | 0 | 7 | 0.3333 |  |
| 33607 | gran-assunto-49-geografia | Geografia | 1 | 1 | 2 | 1 | 0 | 12 | 0 |  |
| 33574 | gran-assunto-406809-direito-processual-do-trabalho | Direito Processual do Trabalho | 1 | 1 | 2 | 1 | 0 | 18 | 0 |  |
| 33569 | gran-assunto-29-direito-internacional | Direito Internacional | 1 | 1 | 2 | 1 | 0 | 2 | 0 |  |
| 33562 | gran-assunto-1193-direito-ambiental | Direito ambiental | 1 | 1 | 2 | 1 | 0 | 8 | 0 |  |
| 33554 | gran-assunto-18-conhecimentos-bancarios | Conhecimentos Bancários | 1 | 1 | 2 | 1 | 0 | 20 | 0 |  |

### edge

| ID | Slug | Nome | Questoes | Provas | Bancas | Anos | Desc. | Topicos | Overlap | Hard fails |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1634 | gran-assunto-412040-museologia | Museologia | 0 | 0 | 0 | 0 | 0 | 16 | 0 | taxonomy.no_public_content |
| 1636 | gran-assunto-426034-arqueologia | Arqueologia | 0 | 0 | 0 | 0 | 0 | 1 | 0 | taxonomy.no_public_content |
| 3049 | gran-assunto-397773-biblioteconomia | Biblioteconomia | 0 | 0 | 0 | 0 | 0 | 18 | 0 | taxonomy.no_public_content |
| 3494 | gran-assunto-418315-relacoes-publicas | Relações Públicas | 0 | 0 | 0 | 0 | 0 | 16 | 0 | taxonomy.no_public_content |
| 5949 | gran-assunto-404409-controle-da-administracao | Controle da Administração | 0 | 0 | 0 | 0 | 0 | 4 | 0 | taxonomy.no_public_content |
| 15930 | gran-assunto-403972-financas-publicas | Finanças Públicas | 0 | 0 | 0 | 0 | 0 | 5 | 0 | taxonomy.no_public_content |
| 16991 | gran-assunto-403392-meio-ambiente | Meio Ambiente | 0 | 0 | 0 | 0 | 0 | 15 | 0 | taxonomy.no_public_content |
| 18418 | gran-assunto-417992-primeiros-socorros | Primeiros Socorros | 0 | 0 | 0 | 0 | 0 | 17 | 0 | taxonomy.no_public_content |
| 18542 | gran-assunto-402928-filosofia-do-direito | Filosofia do Direito | 0 | 0 | 0 | 0 | 0 | 9 | 0 | taxonomy.no_public_content |
| 25171 | gran-assunto-429664-antropologia | Antropologia | 0 | 0 | 0 | 0 | 0 | 19 | 0 | taxonomy.no_public_content |

## Limitacoes e decisao

- Description editorial praticamente ausente (147/148 sem description), portanto nao deve ser gate positivo isolado.
- 10.941 assuntos possuem parent/cadeia incompativel com o modelo atual; isso bloqueia expansao para assuntos, mas nao o piloto de disciplinas.
- O Candidate A e o perfil recomendado para revisao editorial manual no 4.4; nao para ativacao automatica.
- `/concursos` permanece NOINDEX e fora do sitemap.
- `/disciplinas/{slug}` permanece render + NOINDEX + sitemap false.
- Runtime sitemap changes = `0`.
