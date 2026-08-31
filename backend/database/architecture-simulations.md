# Arquitetura de Dados: Simulados

## Escopo

Este documento cobre a persistencia de sessoes de simulados e das respostas vinculadas.

## Tabelas principais

### `simulations`

Responsabilidade:

- armazenar a sessao principal do simulado
- guardar nome, status, nota e janela temporal
- preservar a configuracao do simulado em JSON

Campos usados no fluxo:

- `id`
- `user_id`
- `name`
- `status`
- `score`
- `start_time`
- `end_time`
- `config_json`

### `user_answers`

Responsabilidade no fluxo:

- armazenar as respostas individuais dadas no simulado
- vincular cada resposta a `simulation_id`

Campos usados:

- `user_id`
- `question_id`
- `simulation_id`
- `selected_option_index`
- `is_correct`
- `time_taken_seconds`

## Regras de dominio

- a sessao autenticada e a fonte de verdade do `user_id`
- o payload nao pode salvar simulados para outro usuario
- respostas simples e respostas enriquecidas coexistem no contrato legado
- a operacao funciona como `upsert` tanto na sessao principal quanto nas respostas

## Modulo envolvido

### `modules/simulations`

Responsavel por:

- validar a sessao de simulado
- serializar `config_json`
- persistir `simulations`
- persistir `user_answers` vinculadas

## Observacao arquitetural

- `api/simulations/create.php` agora e apenas bridge HTTP
- a regra de dominio saiu do script procedural e passou a viver em `modules/simulations`
