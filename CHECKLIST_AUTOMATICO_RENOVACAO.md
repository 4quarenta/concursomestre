# Checklist Automatico Renovacao

## O que e

- runner estrutural do billing:
  - `C:/dev/concursomestre/scripts/checks/billing-renewal-check.mjs`
- saidas:
  - `C:/dev/concursomestre/billing-renewal-check.json`
  - `C:/dev/concursomestre/billing-renewal-check.md`

## Como funciona

- valida estrutura Stripe-only.
- valida persistencia critica.
- valida webhook, reconciliacao, auto renew, refund e estrategia de cobranca.
- consome `billing-e2e-report.json` quando existir.
- transforma prova operacional em status do checklist agregado.

## Como executar

```bash
npm run check:billing-renewal
```

Para atualizar com a rodada E2E antes:

```bash
npm run check:billing-e2e
npm run check:billing-renewal
```

## Status possiveis

- `OK`
- `RISCO`
- `CRITICO`
- `NAO_COMPROVADO`

Regra final:

- `GO` = zero `CRITICO` e zero `NAO_COMPROVADO`
- `NO-GO` = qualquer `CRITICO` ou `NAO_COMPROVADO`

## Resultado atual

- `OK`: 18
- `RISCO`: 0
- `CRITICO`: 0
- `NAO_COMPROVADO`: 4
- veredito: `NO-GO`

## O que mudou nesta rodada

- passou a ler `scripts/checks/billing-e2e-report.json`
- usa evidencia E2E para:
  - renovacao
  - webhook atrasado/fora de ordem
  - estrategia de pro-rata
  - refund concorrente

## Limite atual

- se a suite E2E falhar em item critico, o checklist agregado nao mascara.
- por isso os 4 itens acima seguem `NAO_COMPROVADO` no checklist agregado.
