# Database Architecture

Atualizado em: 2026-04-02

## Objetivo

Este documento descreve a arquitetura atual da base de dados do backend PHP da plataforma `ConcursoMestre`.

Ele responde:

- onde esta a definicao da base
- quais tabelas existem hoje
- como as tabelas se agrupam por dominio
- quais modulos PHP dependem de quais tabelas
- quais fluxos de negocio passam pela base
- quais dividas estruturais ainda existem

---

## Fontes atuais da estrutura

A base atual nao nasce de um unico ponto. Hoje ela esta consolidada em fontes controladas:

1. `database/schema.sql`
- agora e o arquivo-base mais importante do schema
- concentra as tabelas nucleares do produto

2. `database/migrations/*`
- concentrador principal das migracoes incrementais mais recentes
- inclui sessao, referrals, notas e evolucoes estruturais

3. `database/migrations/legacy/*`
- migracoes SQL/PHP historicas mantidas apenas como arquivo interno de referencia
- a pasta `database/` nao e servida publicamente pelo Apache

4. `scripts/migrations/migrate_marketplace_schema_compatibility.php`
- excecao operacional allowlisted para compatibilidade do marketplace/gamificacao em bancos antigos
- deve ser executada somente via CLI e nao deve virar padrao para novas alteracoes

## Regra alvo

O alvo arquitetural daqui para frente e este:

- schema-base em `database/schema.sql`
- migracoes novas em `database/migrations/`
- nada em `api/migrations/`
- nada novo em `scripts/migrations/` sem allowlist, teste e guarda CLI
- nada novo em scripts soltos fora da arvore oficial

---

## Tabelas nucleares do schema-base

Hoje o schema-base contem estas tabelas principais:

### Identidade e perfil

- `users`
- `addresses`
- `bank_accounts`

### Taxonomias e conteudo academico

- `filters`
- `provas`
- `questions`
- `question_filters`
- `question_stats`

### Estudo, progresso e simulacao

- `simulations`
- `user_answers`
- `user_notes`
- `user_saved_questions`

### Marketplace e comunidade

- `materials`
- `transactions`
- `comments`
- `comment_likes`
- `reports`
- `notifications`

### Competicao e administracao

- `rankings`
- `ranking_entries`
- `system_settings`

---

## Tabelas adicionadas por migracao

Estas tabelas existem hoje fora do schema-base original, mas ja fazem parte do modelo real:

### Auth e sessao

- `auth_sessions`
- `auth_refresh_tokens`

### Perfil e referrals

- `referrals`

### Materiais e interacoes

- `user_material_notes`
- `material_ratings`
- `user_highlights`
- `user_bookmarks`

### Comercial e billing

- `plans`
- `user_subscriptions`
- `user_cards`
- `user_feedback`

### Operacao

- `cache_settings`
- `changelogs`

## Observacao importante

A existencia dessas tabelas fora do schema-base mostra uma divida atual:

- o estado real da base e maior do que o arquivo `database/schema.sql`
- o fechamento da auditoria precisa terminar a consolidacao desse schema

---

## Agrupamento da base por dominio

### 1. Dominio de identidade

Tabelas:

- `users`
- `addresses`
- `bank_accounts`
- `auth_sessions`
- `auth_refresh_tokens`
- `referrals`

Responsabilidade:

- perfil do usuario
- dados de contato e pagamento base
- sessao rotativa
- tokens de refresh
- indicacao e referral code

### 2. Dominio de catalogo academico

Tabelas:

- `filters`
- `provas`
- `questions`
- `question_filters`
- `question_stats`

Responsabilidade:

- taxonomias
- prova vinculada
- questao em si
- relacao n-n entre questao e filtro
- agregados estatisticos da questao

### 3. Dominio de estudo e progresso

Tabelas:

- `simulations`
- `user_answers`
- `user_notes`
- `user_saved_questions`
- `user_material_notes`
- `user_highlights`
- `user_bookmarks`

Responsabilidade:

- simulados
- historico de respostas
- anotacoes por item
- favoritos
- anotacoes e marcacoes em materiais

### 4. Dominio de comunidade e moderacao

Tabelas:

- `comments`
- `comment_likes`
- `reports`
- `notifications`
- `user_feedback`
- `changelogs`

Responsabilidade:

- comentarios por questao ou material
- curtidas
- denuncias
- notificacoes internas
- suporte e feedback
- historico de releases publicas

### 5. Dominio comercial

Tabelas:

- `materials`
- `material_ratings`
- `transactions`
- `plans`
- `user_subscriptions`
- `user_cards`

Responsabilidade:

- produtos do marketplace
- avaliacao de materiais
- transacoes
- catalogo de planos
- assinatura do usuario
- cartoes tokenizados ou salvos

### 6. Dominio competitivo e operacional

Tabelas:

- `rankings`
- `ranking_entries`
- `system_settings`
- `cache_settings`

Responsabilidade:

- ranking e pontuacao
- configuracao global do produto
- configuracao de cache operacional

---

## Relacoes estruturais principais

### Usuarios como entidade raiz

`users` e a entidade mais central da base.
Dela saem relacoes para:

- `addresses`
- `bank_accounts`
- `auth_sessions`
- `auth_refresh_tokens`
- `user_answers`
- `user_notes`
- `user_saved_questions`
- `comments`
- `notifications`
- `reports`
- `simulations`
- `transactions`
- `user_subscriptions`
- `user_cards`
- `referrals`
- `ranking_entries`
- `user_feedback`

### Questions como nucleo academico

`questions` se relaciona com:

- `question_filters`
- `question_stats`
- `user_answers`
- `user_notes` quando `type = question`
- `comments` quando `target_type = question`

### Materials como nucleo comercial de conteudo

`materials` se relaciona com:

- `transactions`
- `comments` quando `target_type = material`
- `material_ratings`
- `user_material_notes`
- `user_highlights`
- `user_bookmarks`

### Assinaturas e cobranca

`plans` se relaciona com:

- `user_subscriptions`
- `transactions`

`user_subscriptions` se relaciona com:

- `users`
- `plans`
- `transactions`
- `user_cards` em alguns fluxos de cobranca

---

## Mapeamento entre modulos PHP e tabelas

### `modules/admin`

Usa principalmente:

- `users`
- `addresses`
- `bank_accounts`
- `user_subscriptions`
- `plans`
- `transactions`
- `materials`
- `comments`
- `reports`
- `user_feedback`
- `system_settings`
- `cache_settings`

### `modules/filters`

Usa principalmente:

- `filters`

### `modules/materials`

Usa principalmente:

- `materials`
- `transactions`
- `comments`
- `users`
- `material_ratings`

### `modules/rankings`

Usa principalmente:

- `users`
- `rankings`
- `ranking_entries`

### `modules/subscriptions`

Usa principalmente:

- `users`
- `plans`
- `addresses`
- `user_subscriptions`
- `user_cards`
- `transactions`
- `user_feedback`

### `modules/transactions`

Usa principalmente:

- `materials`
- `users`
- `transactions`
- `user_subscriptions`
- `plans`
- `user_cards`

---

## Fluxos criticos da base

### Fluxo 1 - Resposta de questao

1. o frontend entrega a resposta
2. o backend grava em `user_answers`
3. o agregado pode atualizar `question_stats`
4. o progresso do usuario alimenta dashboards e estatisticas

### Fluxo 2 - Favoritos e notas

1. favorito de questao vai para `user_saved_questions`
2. nota do usuario vai para `user_notes`
3. quando o item e material, a nota vai para `user_material_notes`

### Fluxo 3 - Compra de material

1. o usuario seleciona um item de `materials`
2. o backend grava a compra em `transactions`
3. o acesso ao material passa a ser autorizado por esse historico
4. ratings e comentarios continuam orbitando o mesmo `material_id`

### Fluxo 4 - Assinatura

1. o usuario escolhe um registro em `plans`
2. a cobranca inicial cria ou atualiza `user_subscriptions`
3. o evento financeiro entra em `transactions`
4. cartao salvo pode ser persistido em `user_cards`
5. cancelamento ou refund pode gerar registro em `user_feedback`

### Fluxo 5 - Moderacao e suporte

1. comentario ou evento gera `reports`
2. o admin decide no modulo `admin`
3. notificacoes sao gravadas em `notifications`
4. suporte e feedback do usuario entram em `user_feedback`

### Fluxo 6 - Competicao

1. o ranking nasce em `rankings`
2. a posicao ou participacao do usuario entra em `ranking_entries`
3. o app consolida os dados para leaderboard publico ou administrativo

---

## Integridade e performance

### Indices relevantes ja existentes

Migracoes atuais ja adicionam indices em pontos importantes, como:

- `questions(subject, difficulty, created_at)`
- `user_answers(user_id, question_id, created_at)`
- `comments(question_id, user_id, parent_id, created_at)`
- `notifications(user_id, is_read, created_at)`
- `rankings(user_id, score, created_at)`
- `materials(subject, created_at)`
- `transactions(user_id, created_at)`

### Garantias desejadas

Ao final da auditoria, a base deve convergir para:

- FKs consistentes para entidades centrais
- indices em colunas de filtro, listagem e relacionamento
- nomes previsiveis
- ausencia de colunas mortas
- menor dependencia de alteracoes ad hoc em runtime

---

## Dividas estruturais abertas

### 1. O schema real ainda nao esta 100% consolidado

Hoje o schema-base nao representa sozinho o estado real da base.
Parte importante vive em migracoes antigas e scripts PHP de migracao.

### 2. Migracoes PHP legadas foram retiradas da superficie publica

`api/migrations/*` e `migrations/*` nao existem mais como fonte operacional. As migracoes PHP antigas de `scripts/migrations` foram arquivadas fora de `htdocs`; apenas `migrate_marketplace_schema_compatibility.php` permanece allowlisted para CLI.

### 3. Tabelas comerciais importantes nao estao totalmente no schema-base

Exemplos:

- `plans`
- `user_subscriptions`
- `user_cards`
- `user_feedback`
- `material_ratings`

### 4. Alguns contratos dependem de colunas historicas

Os fluxos de Stripe e Mercado Pago convivem com colunas adicionadas ao longo do tempo, o que exige consolidacao final de naming e tipos.

---

## Regras para evolucao futura da base

A partir de agora, a regra oficial deve ser:

1. tabela nova nasce ligada a um modulo de dominio claro
2. query SQL fica em `repositories/`
3. alteracao estrutural vai para `database/migrations/`
4. nada novo em `api/migrations/`
5. nada novo em `scripts/migrations/` sem allowlist explicito
6. nada de regra de negocio escondida em script de migracao
7. resposta JSON nao deve depender de estrutura improvisada do banco

---

## Estado atual resumido

A base ja sustenta todos os dominios centrais da plataforma:

- autenticacao e sessao
- questoes e filtros
- progresso do usuario
- simulados
- marketplace de materiais
- transacoes
- assinaturas
- comentarios e moderacao
- notificacoes
- rankings
- configuracao administrativa

O maior trabalho restante na camada de dados nao e criar tabelas novas, e sim:

- consolidar o schema-base real
- reduzir migracoes espalhadas
- alinhar 100% a modelagem com os modulos oficiais do backend

## Atualizacao 2026-04-03 - modulo users e limpeza da raiz legado
### modules/users
Tabelas usadas:
- users
- referrals

Responsabilidade:
- garantir referral_code para o usuario autenticado
- contar indicacoes por referrer_id
- somar rewards pagos com status rewarded
- montar o referralLink consumido pelo perfil do aluno

Fluxo:
- routes.php recebe a rota publica do resumo de indicacoes
- controller delega para UsersService
- service aplica a regra de negocio e chama UsersRepository
- repository concentra as queries SQL em users e referrals
- resposta final volta padronizada pela camada HTTP compartilhada

## Atualizacao 2026-04-03 - limpeza da raiz do backend
A compatibilidade com URLs antigas de plans, transactions e subscriptions foi preservada por rewrite em .htaccess.
Com isso, os diretorios fisicos espelho da raiz puderam ser removidos sem quebrar contratos legados ainda usados por integracoes antigas.
## Atualizacao 2026-04-03 - ferramentas operacionais de importacao
### scripts/importers/questions/gran
Responsabilidade:
- ingestao operacional de questoes externas da Gran para a base local.
- apoio interno de curadoria/importacao, fora da API publica.

Observacao arquitetural:
- essa ferramenta saiu da raiz scrapper/ e foi movida para scripts/importers/questions/gran.
- a mudanca reduz poluicao da raiz e alinha o projeto ao papel oficial de scripts/ como area de automacoes e utilitarios operacionais.
## Atualizacao 2026-04-03 - users agora cobre seguranca basica e foto de perfil
### modules/users (expansao funcional)
Tabelas usadas:
- users
- referrals

Fluxos adicionados:
- troca de senha autenticada do proprio usuario, com verificacao da senha atual e novo hash em users.password_hash;
- upload autenticado da foto de perfil, com persistencia do caminho relativo em users.photo_url.

Observacao:
- o upload de foto foi endurecido com validacao de tamanho e MIME real via info, reduzindo confianca em metadados enviados pelo cliente.## Atualizacao 2026-04-03 - profile e update migrados para modules/users
### modules/users (expansao do perfil autenticado)
Tabelas usadas:
- `users`
- `addresses`
- `bank_accounts`
- `comments`
- `user_subscriptions`
- `plans`
- `transactions`
- `user_cards`
- `referrals`

Fluxos adicionados ao modulo:
- leitura consolidada do perfil autenticado, reutilizada por `api/users/profile.php` e `api/auth/me.php`;
- atualizacao transacional do perfil basico em `users`, com `upsert` de endereco e conta bancaria;
- geracao automatica de `referral_code` quando ausente;
- enriquecimento do snapshot com assinatura atual, ciclo de cobranca, pedido de reembolso e alertas basicos de pagamento.

Observacao arquitetural:
- `api/users/profile.php`, `api/users/update.php` e `api/auth/me.php` passaram a ser apenas bridges HTTP.
- a regra de negocio e a montagem do payload ficaram concentradas em `modules/users/services/UsersService.php`.
- o SQL ficou concentrado em `modules/users/repositories/UsersRepository.php`.## Atualizacao 2026-04-03 - biblioteca comprada migrada para modules/materials
### modules/materials (expansao da biblioteca do usuario)
Tabelas usadas:
- `materials`
- `transactions`
- `users`

Fluxo adicionado:
- leitura da biblioteca de materiais comprados pelo usuario autenticado, reaproveitando o dominio `materials` em vez de manter regra procedural em `api/users/materials.php`.

Observacao arquitetural:
- o endpoint `api/users/materials.php` agora e apenas bridge HTTP.
- a validacao do `userId` alvo foi trazida para `modules/materials/validators/MaterialsValidator.php`.## Atualizacao 2026-04-03 - entrega protegida de PDFs migrada para modules/materials
### modules/materials (expansao de entrega de arquivos)
Tabelas usadas:
- `materials`
- `transactions`
- `users`

Fluxos adicionados:
- visualizacao inline do PDF comprado com marca d'agua de propriedade;
- download protegido do PDF com marca d'agua reforcada e rodape nominal;
- validacao central de autoria, compra aprovada e disponibilidade do arquivo fisico.

Observacao arquitetural:
- `api/materials/access.php` e `api/materials/download.php` agora sao apenas bridges HTTP.
- o helper legado `api/materials/material_access_helper.php` foi removido.
## Atualizacao 2026-04-03 - reader state de materiais

- o estado de leitura de PDFs do dominio materials agora fica distribuido entre user_notes, user_bookmarks e user_highlights;
- user_notes continua armazenando anotacoes livres por user_id + item_id + type = material;
- user_bookmarks guarda marcadores por pagina do material;
- user_highlights guarda destaques com page_num, color, ects, 	ext e 	ype;
- nesta rodada, user_bookmarks.user_id/material_id e user_highlights.user_id/material_id foram alinhados para VARCHAR(36), removendo a divergencia antiga com o modelo atual de IDs string usado em users e materials.

## Atualizacao 2026-04-03 - comentarios e notas de perfil em modules/users

- o modulo users agora centraliza tambem as leituras de comments e user_notes voltadas ao perfil/atividade do usuario;
- users/comments.php e users/notes.php ficaram apenas como bridges HTTP para modules/users/routes.php;
- a autorizacao dessas consultas passou a depender da sessao autenticada, com excecao apenas para contexto admin quando o usuario-alvo diverge da sessao.

## Atualizacao 2026-04-03 - user_answers centralizado em modules/users

- a leitura de user_answers para perfil/progresso agora passa pelo modulo users;
- pi/users/answers.php ficou somente como bridge HTTP para modules/users/routes.php;
- o contrato continua expondo resposta, opcao marcada, tempo gasto e simulacao associada, mas agora com autorizacao padronizada por sessao.

## Atualizacao 2026-04-03 - billing de cartoes do perfil em modules/users

- O dominio users passou a centralizar tambem a leitura e manutencao do cofre de user_cards para o perfil autenticado.
- As operacoes de listagem, remocao e definicao de padrao agora fluem por modules/users, preservando o espelho em users.has_saved_card.
- O suporte Stripe de cartoes foi reposicionado para modules/users/services/UsersCardsStripeSupport.php, reduzindo regra de dominio dentro de pi/users.
- A proxima fatia natural deste subdominio e absorver create_stripe_setup_intent.php, sync_stripe_card.php e save_card.php para eliminar o restante do billing procedural em pi/users.
## Atualizacao 2026-04-03 - setup e sync de cartoes tambem em modules/users

- O modulo users agora concentra o ciclo de billing do perfil sobre user_cards: listagem, remocao, definicao de padrao, SetupIntent Stripe, sincronizacao do payment_method_id salvo e persistencia do cofre legado/local.
- O espelho local em user_cards continua sendo a fonte de leitura do frontend, enquanto a sincronizacao remota com Stripe permanece encapsulada em modules/users/services/UsersCardsStripeSupport.php.
- A raiz pi/users ficou reduzida a bridges finos tambem para create_stripe_setup_intent.php, sync_stripe_card.php e save_card.php.
## Atualizacao 2026-04-03 - helpers de dominio de subscriptions saem de api

- A regra auxiliar de assinaturas Stripe deixou pi/subscriptions e foi consolidada em modules/subscriptions/services/SubscriptionsBillingSupport.php e modules/subscriptions/services/StripePaymentApprovalValidator.php.
- modules/subscriptions e modules/transactions agora dependem diretamente desses helpers oficiais do dominio, em vez de importar arquivos de pi/.
- A dependencia remanescente de modules/subscriptions para pi/users/stripe_card_helpers.php foi eliminada; o modulo agora usa modules/users/services/UsersCardsStripeSupport.php.## Atualizacao 2026-04-03 - listagem admin e seguranca de conta em modules/users

Tabelas usadas:
- users
- user_subscriptions
- plans
- user_notes
- system_settings (via reCAPTCHA quando habilitado)

Fluxos adicionados:
- listagem administrativa de usuarios com resumo de plano/assinatura;
- exclusao autenticada de anotacoes em user_notes;
- solicitacao autenticada de exclusao de conta com status pending_deletion.

Observacao arquitetural:
- pi/users/list.php, pi/users/delete_note.php e pi/users/delete.php agora sao apenas bridges HTTP;
- a autorizacao desse slice passou a depender da sessao oficial, deixando de aceitar user_id ou JWT manual como fonte de verdade.## Atualizacao 2026-04-03 - auth session e recovery em modules/auth

Tabelas usadas:
- uth_sessions
- uth_refresh_tokens
- password_resets
- email_verifications
- users
- 
otifications
- system_settings (via reCAPTCHA quando habilitado)

Fluxos adicionados:
- logout e refresh de sessao pelo modulo uth;
- recuperacao de senha com geracao/consumo de token em password_resets;
- reenvio e confirmacao de e-mail com email_verifications;
- notificacao de boas-vindas ao concluir a verificacao de e-mail.

Observacao arquitetural:
- pi/auth/logout.php, pi/auth/refresh.php, pi/auth/forgot-password.php, pi/auth/reset-password.php, pi/auth/resend-confirmation.php e pi/auth/confirm-email.php agora sao apenas bridges HTTP;
- a regra do dominio auth saiu do procedural e passou a viver em modules/auth.## Atualizacao 2026-04-03 - login, cadastro e 2FA em modules/auth

Tabelas usadas:
- users
- uth_sessions
- uth_refresh_tokens
- email_verifications
- 
otifications
- eferrals
- system_settings (via ppMode e reCAPTCHA)

Fluxos adicionados:
- login por email/senha com emissao da sessao oficial;
- cadastro de estudante com referral opcional e envio de confirmacao de e-mail;
- setup, ativacao e verificacao de 2FA para administradores;
- reaproveitamento do snapshot oficial de usuario do modulo users dentro do login/cadastro.

Observacao arquitetural:
- pi/auth/login.php, pi/auth/register.php, pi/auth/setup_2fa.php, pi/auth/enable_2fa.php e pi/auth/verify_2fa.php agora sao apenas bridges HTTP;
- o dominio uth passou a concentrar o fluxo principal de autenticacao da plataforma, deixando pi/auth/* apenas como camada de compatibilidade.## Atualizacao 2026-04-03 - notificacoes em modules/notifications

Tabelas usadas:
- notifications
- auth_sessions (via request_auth para identificar o usuario autenticado)

Fluxos adicionados:
- listagem autenticada do inbox;
- marcacao individual como lida;
- marcacao em lote como lida;
- soft delete por deleted_at;
- limpeza em lote do inbox;
- envio autenticado de notificacoes para si mesmo, admin ou outros escopos administrativos.

Observacao arquitetural:
- api/notifications/list.php, mark-read.php, mark_read.php, mark-all-read.php, mark_all_read.php, delete.php, clear_all.php e send.php agora sao apenas bridges HTTP.
- api/notifications/clear.php foi adicionado como bridge de compatibilidade para rewrites antigos.
- api/.htaccess agora cobre notificationsMarkAllRead e notificationsClearAll, alinhando o roteamento ao catalogo oficial do frontend.## Atualizacao 2026-04-03 - comentarios em modules/comments

Tabelas usadas:
- comments
- comment_likes
- notifications
- users
- materials
- auth_sessions (via request_auth nas mutacoes autenticadas)

Fluxos adicionados:
- listagem publica de comentarios por target_id com autenticacao opcional para isLiked;
- criacao autenticada de comentario;
- toggle autenticado de curtida;
- exclusao autenticada por ownership;
- notificacoes derivadas de resposta, comentario em material e curtida.

Observacao arquitetural:
- api/comments/list.php, api/comments/handle.php e api/comments/list_cached.php agora sao apenas bridges HTTP.
- o cache procedural antigo do endpoint list_cached saiu do fluxo principal; a listagem oficial agora vive em modules/comments.## Atualizacao 2026-04-03 - progresso de questoes em modules/questions

O dominio questions passou a concentrar o slice de progressao do usuario:
- gravacao de respostas em user_answers
- atualizacao de question_stats
- evolucao de users.xp e users.level
- leitura de historico de tentativas por questao
- limpeza de respostas do usuario
- toggle de salvos em user_saved_questions

A regra saiu dos scripts procedurais de pi/questions/* e agora vive em modules/questions, com acesso SQL centralizado no repository e validacao separada no validator.## Atualizacao 2026-04-03 - leitura e estatisticas de questoes em modules/questions

O modulo questions agora concentra tambem o slice de leitura operacional do dominio:
- listagem principal de questions com question_groups, question_filters, question_stats e comments
- filtro administrativo de questoes com busca por keyword
- agregacao de distribuicao de respostas em user_answers

Com isso, pi/questions/list.php, ilter.php e get_stats.php deixaram de carregar SQL e passaram a atuar apenas como bridges HTTP.## Atualizacao 2026-04-03 - manutencao administrativa de questoes em modules/questions

O modulo questions agora cobre tambem o ciclo administrativo do dominio:
- criacao e atualizacao de registros em questions
- sincronizacao de taxonomias em question_filters e ilters
- leitura isolada da questao para edicao
- exclusao administrativa da questao

Com isso, pi/questions/create.php, save.php, update.php, edit.php e delete.php deixaram de concentrar SQL e passaram a atuar apenas como bridges HTTP.
