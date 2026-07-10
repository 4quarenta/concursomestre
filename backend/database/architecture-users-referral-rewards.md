# Arquitetura de Recompensas de Indicacao

## Objetivo

Mover o processamento periodico de recompensas de indicacao para a arquitetura oficial, evitando:

- job procedural dentro de `api/tasks`
- helper de dominio em `api/utils`
- SQL e transacao misturados no script legado
- endpoint cron aberto sem chave

## Estrutura oficial

```text
modules/users/
  controllers/
    UsersRewardsController.php
  services/
    UsersReferralRewardsService.php
  repositories/
    UsersRepository.php
  routes.php

scripts/tasks/
  process_referral_rewards.php
```

## Tabelas tocadas

### `referrals`

Usada para:

- listar indicacoes pendentes
- marcar status como `rewarded`
- registrar `rewarded_at`

### `user_subscriptions`

Usada para verificar se o indicado ja passou da carencia minima.

### `users`

Usada para:

- ler plano atual e `subscription_end`
- atualizar plano recompensado
- somar XP do indicador

### `notifications`

Usada para registrar a confirmacao da recompensa concedida.

## Fluxo oficial

1. O scheduler chama `scripts/tasks/process_referral_rewards.php`
2. O script instancia o modulo `users`
3. O service busca indicacoes pendentes ja elegiveis
4. Cada item e processado em transacao
5. O usuario indicador recebe dias extras no plano
6. O usuario indicador recebe 1000 XP
7. A indicacao e marcada como `rewarded`
8. Uma notificacao de sucesso e criada

## Bridge legado

`api/tasks/ProcessRewards.php` continua existindo apenas como bridge fino e agora exige `CRON_SECRET`.
