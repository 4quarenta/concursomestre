# Stripe Customer Canonicalization

## Objetivo

Garantir que cada usuario da plataforma permaneça vinculado ao mesmo
`customer_id` da Stripe ao longo do tempo, evitando fragmentacao de:

- cartoes salvos
- assinatura ativa
- invoices
- historico financeiro

## Problema que motivou a regra

Em alguns fluxos historicos, o mesmo usuario acabou acumulando mais de um
customer na Stripe. Isso causou efeitos colaterais como:

- checkout e perfil lendo customers diferentes
- cartoes salvos aparecendo incompletos
- assinatura ativa ancorada em um customer e cofre de cartoes em outro
- risco de novas requisicoes criarem mais um customer para a mesma conta

## Regra canônica

O backend deve resolver o customer Stripe do usuario nesta ordem:

1. `provider_customer_id` da assinatura ativa
2. `users.stripe_customer_id`
3. historico local Stripe em `user_subscriptions`
4. historico local Stripe em `transactions`
5. busca remota por customer existente com:
   - `metadata.user_id`
   - email do usuario
6. criar novo customer apenas se nenhuma fonte acima retornar um customer valido

## Guard rails obrigatorios

### 1. Trava por usuario

Durante a resolucao/criacao do customer Stripe, o backend usa um lock por
usuario para evitar corrida entre requisicoes concorrentes.

Objetivo:

- impedir duas requisicoes simultaneas de criarem customers diferentes antes
  da persistencia de `users.stripe_customer_id`

### 2. Persistencia do customer canônico

Sempre que o backend confirmar um customer valido para o usuario, ele deve:

- atualizar `users.stripe_customer_id`
- manter `provider_customer_id` sincronizado nas assinaturas Stripe
- usar esse mesmo customer nas operacoes futuras de:
  - setup intent
  - listagem de cartoes
  - checkout
  - portal de billing
  - sincronizacao de invoices/assinaturas

### 3. Nao confiar apenas no snapshot do usuario

Se `users.stripe_customer_id` estiver vazio, antigo ou inconsistente, o backend
nao deve criar outro customer imediatamente. Antes disso, precisa consultar:

- assinatura ativa
- historico local de subscription/transaction
- customer existente na Stripe pelo `metadata.user_id` / email

## Regra operacional para cartoes salvos

O cofre de cartoes deve sempre refletir o customer canônico.

Isso significa que:

- `list_cards` deve sincronizar a partir do customer resolvido por essa regra
- checkout e perfil devem usar a mesma origem
- cartoes nao podem depender de um customer secundario ou legado

## Compatibilidade com customers duplicados antigos

Customers duplicados ja existentes na Stripe nao sao a fonte principal da
operacao. O sistema deve:

- escolher o customer correto
- corrigir `users.stripe_customer_id` para esse customer
- parar de gerar duplicatas novas

A limpeza manual/assistida de customers antigos pode acontecer depois, mas a
plataforma deve continuar funcional mesmo antes dessa consolidacao.

## Sinais de regressao

Investigar este fluxo se ocorrer qualquer um destes sintomas:

- Stripe Dashboard mostra cartoes que o perfil nao mostra
- checkout e perfil retornam listas diferentes de cartoes
- usuario ganha novo `customer_id` sem troca deliberada de conta
- assinatura ativa aponta para `provider_customer_id` diferente de
  `users.stripe_customer_id`

## Arquivos-chave

- `C:\xampp\htdocs\questao-pro-backend\modules\users\services\UsersCardsStripeSupport.php`
- `C:\dev\concursomestre\docs\BILLING_E_VALIDACAO.md`
- `C:\dev\concursomestre\docs\STRIPE_CARD_VAULT_OPERATIONS.md`

