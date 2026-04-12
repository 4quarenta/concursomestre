# Stripe Card Vault - Operacoes por Caso

## Objetivo

Documentar a operacao do cofre Stripe usada no checkout e no perfil, com a mesma fonte de verdade e as mesmas regras de negocio.

## Fonte de verdade (unica)

- Frontend: `cardsService` (`src/services/billing/cardsService.ts`)
- Endpoints:
  - `api/users/list_cards.php`
  - `api/users/create_stripe_setup_intent.php`
  - `api/users/sync_stripe_card.php`
  - `api/users/set_default_card.php`
  - `api/users/remove_card.php`
- Backend:
  - `modules/users/routes.php`
  - `UsersCardsService`
  - `UsersCardsStripeSupport::syncStripeCardsForUser()`

## Regra de padronizacao checkout/perfil

- Checkout e perfil listam cartoes com o mesmo service: `cardsService.listSavedCards()`.
- A listagem nao depende de `user_id` manual no frontend; o backend resolve pelo usuario autenticado.
- O espelho local (`user_cards`) e sincronizado a partir da Stripe em toda listagem.
- O campo `users.has_saved_card` e apenas indicativo operacional, nao fonte final.

## Casos operacionais (o que e feito em cada caso)

| Caso | Origem | O que o sistema faz |
|---|---|---|
| Usuario abre checkout com cartoes salvos | `list_cards` | Sincroniza Stripe -> `user_cards`, retorna lista atual e marca default. |
| Usuario abre perfil (aba pessoal/cobranca) | `list_cards` | Mesma sincronizacao do checkout; UI mostra os mesmos cartoes. |
| Usuario adiciona novo cartao | `create_stripe_setup_intent` + `sync_stripe_card` | Cria SetupIntent, confirma no Stripe Elements, espelha localmente e atualiza lista. |
| Usuario define cartao padrao | `set_default_card` | Atualiza default local e `invoice_settings.default_payment_method` no customer Stripe. |
| Usuario remove cartao nao vinculado | `remove_card` | Remove no espelho local e tenta detach do PaymentMethod no Stripe. |
| Usuario tenta remover cartao vinculado a recorrencia (locked) | `remove_card` | Bloqueia com erro de dominio; exige trocar padrao antes. |
| Usuario tenta remover unico cartao vinculado | `remove_card` | Bloqueia com erro de dominio; exige adicionar outro e definir padrao antes. |
| Cartao padrao removido (quando permitido) | `remove_card` | Reatribui padrao para cartao mais recente remanescente. |
| Cartao expirado | payload autenticado do perfil | Sinaliza `paymentIssue=expired_card` e gera notificacao deduplicada. |
| Cartao proximo de vencer (<= 1 mes) | payload autenticado do perfil | Sinaliza `paymentIssue=expiring_card` e gera notificacao deduplicada. |
| Sem cartao com assinatura ativa paga | payload autenticado do perfil | Sinaliza `paymentIssue=no_card` para orientar cadastro de cartao. |

## Regras obrigatorias de seguranca

- CVV nao e armazenado no sistema.
- Dados sensiveis ficam no cofre Stripe (PaymentMethod/Customer).
- O sistema local espelha apenas dados operacionais (bandeira, final, expiracao, default, lock recorrente).

## Onde o usuario administra cartoes

- Perfil > Dados pessoais > secao `Cartoes Salvos`:
  - Adicionar cartao
  - Definir como padrao
  - Remover cartao (quando permitido pelas regras)
- Checkout:
  - Usa os mesmos cartoes salvos da Stripe
  - Permite selecionar cartao salvo ou novo cartao

## Mensagens de bloqueio esperadas

- `Este e o unico cartao vinculado a sua assinatura. Adicione outro cartao e defina-o como padrao antes de remover este.`
- `Este cartao esta vinculado a uma assinatura recorrente ativa. Defina outro cartao como padrao antes de remove-lo.`

