# Arquitetura de Dados: Suporte e Feedback Publico

## Escopo

Este documento cobre a fatia publica do suporte da plataforma, diferente do documento de moderacao administrativa.

## Tabela principal

### `user_feedback`

Responsabilidade:

- armazenar tickets/chamados abertos pelo usuario
- armazenar respostas em formato de thread
- controlar o status operacional da conversa

Campos usados no fluxo:

- `id`
- `user_id`
- `parent_id`
- `type`
- `reason`
- `details`
- `status`
- `created_at`

## Semantica de thread

- `parent_id IS NULL`: thread raiz criada pelo usuario
- `parent_id = <id da thread>`: resposta dentro da conversa
- a thread raiz concentra o `status`

## Status usados

- `new`: aguardando leitura/tratativa
- `read`: atendimento em andamento ou ja visto pela equipe
- `resolved`: caso concluido

## Regras de dominio persistidas

- so o dono da thread ou admin pode listar respostas da conversa
- resposta do usuario recoloca a thread em `new`
- resposta administrativa pelo fluxo publico ou privado pode marcar a thread como `read`

## Modulos envolvidos

### `modules/feedback`

Usa:

- `user_feedback`
- `users` apenas para enriquecer respostas com nome e papel

### `modules/admin`

Usa:

- `user_feedback`
- `users`
- `Mailer.php`

Para:

- responder a thread como suporte
- disparar e-mail automatico para o usuario

## Observacao arquitetural

- `api/feedback/list.php` e `api/feedback/create.php` agora sao apenas bridges HTTP
- a regra publica da central de suporte saiu do procedural e passou a viver em `modules/feedback`
