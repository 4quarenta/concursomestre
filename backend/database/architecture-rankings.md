# Architecture Rankings

## Contexto

O dominio `rankings` cobre:

- listagem publica e administrativa de rankings
- criacao de ranking
- participacao do usuario
- moderacao administrativa
- atualizacao e exclusao
- garantia estrutural do schema do dominio

## Tabelas

### `rankings`

Responsavel por:

- identificacao do ranking
- instituicao
- total de questoes
- vagas
- chave oficial
- status
- metadados de prova

Campos relevantes:

- `id`
- `name`
- `institution`
- `total_questions`
- `vacancies`
- `vacancies_ac`
- `vacancies_afro`
- `vacancies_pcd`
- `official_key_release_date`
- `key_status`
- `has_discursive`
- `exam_types`
- `correct_key`
- `image_url`
- `reserve_limit`
- `status`
- `created_at`

### `ranking_entries`

Responsavel por:

- participacoes dos usuarios
- categoria
- respostas
- nota
- status da participacao

Campos relevantes:

- `id`
- `ranking_id`
- `user_id`
- `user_name`
- `registration_number`
- `exam_type`
- `category`
- `user_answers`
- `score`
- `discursive_score`
- `status`
- `created_at`

## Fluxos estruturais

### Install

1. Exige contexto admin.
2. Garante a tabela `rankings`.
3. Garante a tabela `ranking_entries`.

### Migrate

1. Exige contexto admin.
2. Garante colunas faltantes em `rankings`.
3. Garante colunas faltantes em `ranking_entries`.
4. Reforca o tipo de `score`.
5. Garante o indice `unique_participation`.

## Bridges

Os endpoints em `api/rankings/*` agora atuam apenas como adaptadores HTTP para `modules/rankings`.
