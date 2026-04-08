/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

# Subscriptions Plan Sync

## Estado atual

O sync legado de planos do Mercado Pago foi encerrado.
O endpoint `api/subscriptions/sync_plans_mp.php` responde `410`.

## Regra atual

- o produto nao sincroniza mais planos em Mercado Pago
- `external_plan_id` permanece apenas como campo canonico para identificador remoto
- qualquer sincronizacao futura deve seguir Stripe-only e entrar no modulo oficial `subscriptions`
