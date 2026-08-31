# Architecture Statistics

## Contexto

O modulo `statistics` centraliza o slice de Raio-X da banca, que antes vivia espalhado em `api/statistics/xray.php` e `api/statistics/banca_info.php`.

## Tabelas consultadas

### `cache_settings`

Usada para controlar:
- habilitacao do cache de analises
- TTL padrao do cache

### `filters`

Usada para:
- resolver ids de `banca`, `cargo` e `ano`
- reconstruir nomes de materias-pai quando a questao nao traz o root explicitamente

Campos mais relevantes:
- `id`
- `type`
- `name`
- `parent_id`
- `meta_materia`

### `question_filters`

Usada para:
- cruzar questoes com os filtros de banca/cargo/ano
- identificar assuntos associados a cada questao

Campos mais relevantes:
- `question_id`
- `filter_id`

### `questions`

Usada para:
- compor a base do raio-x
- medir tamanho medio do enunciado
- identificar contextualizacao
- distribuir dificuldade

Campos mais relevantes:
- `id`
- `enunciado_clean`
- `intro_text`
- `dificuldade`

### `provas`

Usada para:
- listar provas ligadas a banca filtrada

Campos mais relevantes:
- `id`
- `nome`
- `ano`
- `banca_id`

### `system_settings`

Usada para:
- ler a configuracao `geminiApiKey`

Campo consultado:
- `value_json`

## Tabelas estruturais do slice

### `user_statistics`

Responsavel por:
- total respondido
- acertos e erros
- acuracia
- streak atual e melhor streak
- tempo total de estudo
- ultima atividade

### `subject_statistics`

Responsavel por:
- agregado por materia do usuario
- acuracia por materia
- tempo medio por materia

### `question_stats`

Colunas relevantes para este slice:
- `question_id`
- `total_attempts`
- `correct_count`
- `wrong_count`
- `option_distribution`
- `average_time_spent`
- `difficulty_rating`

## Fluxo de `xray`

1. O modulo valida a sessao autenticada.
2. Verifica o beneficio `xray_banca`.
3. Resolve os filtros selecionados em ids.
4. Busca questoes que casam com a banca e filtros opcionais.
5. Agrupa assuntos por materia.
6. Lista provas da banca.
7. Monta a resposta consolidada.
8. Opcionalmente gera recomendacao curta via Gemini.

## Fluxo de `banca_info`

1. O modulo valida a sessao autenticada.
2. Verifica o beneficio `xray_banca`.
3. Normaliza e valida a URL da banca.
4. Usa cache proprio de scraping.
5. Faz tentativas com user-agents rotativos.
6. Converte links relativos em absolutos.
7. Classifica os links em:
   - `emAndamento`
   - `realizados`

## Fluxo de `user`

1. O modulo exige sessao autenticada.
2. Resolve o `user_id` por query ou pela URL legada.
3. Permite consultar outro usuario apenas em contexto admin.
4. Garante baseline em `user_statistics` quando necessario.
5. Agrega `subject_statistics`.

## Fluxo de `question`

1. O modulo resolve `question_id`.
2. Le `question_stats`.
3. Calcula `accuracyRate`.
4. Normaliza `option_distribution`.

## Fluxo de `platform`

1. O modulo exige sessao admin.
2. Agrega indicadores globais de:
   - usuarios
   - atividade recente
   - questoes
   - respostas
   - acuracia media
   - materias populares
   - top performers

## Fluxo de `install`

1. O modulo exige sessao admin.
2. Garante `user_statistics`.
3. Garante `subject_statistics`.
4. Garante colunas extras em `question_stats`.

## Regras arquiteturais aplicadas

- Controller fino
- SQL concentrado no repository
- Regra de negocio na service
- Validacao separada no validator
- `api/statistics/*` reduzido a bridge
- resposta JSON padronizada no fluxo oficial
- comentarios relevantes em pt-BR
