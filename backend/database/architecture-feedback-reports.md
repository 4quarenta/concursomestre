# Arquitetura de Dados: Feedback, Reports e Comunicacao Administrativa

## Escopo

Este documento complementa a arquitetura geral da base para o fluxo de:

- feedback do usuario
- denuncias (`reports`)
- resposta administrativa
- e-mails automaticos disparados pelo backend

## Tabelas principais

### `user_feedback`

Responsabilidade:

- armazenar a thread raiz enviada pelo usuario
- armazenar respostas administrativas e respostas do proprio usuario
- controlar o status do atendimento

Campos relevantes esperados pelo fluxo:

- `id`
- `user_id`
- `parent_id`
- `type`
- `reason`
- `details`
- `status`
- `created_at`

Como o fluxo usa:

- `parent_id IS NULL` representa a thread principal
- respostas administrativas sao inseridas com `parent_id` apontando para a thread raiz
- `status` da thread raiz muda para `read` ou `resolved`

### `reports`

Responsabilidade:

- armazenar denuncias de conteudo feitas pelos usuarios
- preservar o motivo original
- registrar a decisao administrativa

Campos relevantes usados pelo fluxo:

- `id`
- `reporter_id`
- `target_type`
- `question_id`
- `material_id`
- `comment_id`
- `reason`
- `details`
- `status`
- `resolved_at`
- `admin_reason`
- `evidence_url`
- `handled_by`

Como o fluxo usa:

- o modulo `reports` cria e lista denuncias
- o modulo `admin` modera e atualiza a linha
- `status` recebe `resolved` ou `ignored`
- `admin_reason` e a mensagem reaproveitada no e-mail automatico

### `users`

Responsabilidade no fluxo:

- fornecer `name`, `email`, `role`, `level`
- identificar o denunciante e o dono do feedback
- permitir montagem do e-mail automatico com nome e destinatario corretos

### `notifications`

Responsabilidade no fluxo:

- registrar o retorno in-app de moderacao de denuncia
- manter o usuario informado dentro da plataforma, alem do e-mail

## Relacao entre modulos e tabelas

### `modules/reports`

Leitura e escrita:

- escreve em `reports`
- consulta `users` para enriquecer a listagem administrativa

### `modules/admin`

Subfluxo de feedback:

- le `user_feedback`
- cria resposta em `user_feedback`
- atualiza `user_feedback.status`

Subfluxo de moderacao de denuncia:

- le `reports`
- atualiza `reports.status`, `admin_reason`, `evidence_url`, `handled_by`, `resolved_at`
- cria notificacao em `notifications`
- resolve destinatario em `users`

## Envio de e-mail

O envio de e-mail nao cria tabela nova nesta rodada.

Infraestrutura usada:

- `C:\xampp\htdocs\questao-pro-backend\api\utils\Mailer.php`

Origem dos dados:

- `user_feedback + users` para respostas e mudancas de status de feedback
- `reports + users` para decisoes de moderacao

## Observacoes arquiteturais

- nao foi necessario criar schema novo para suportar os e-mails automaticos
- a rodada reaproveita colunas ja existentes e formaliza o fluxo na camada de `modules/`
- `api/reports/*` e `api/admin/*` ficam como bridges HTTP; a regra passa a viver em controller/service/repository
