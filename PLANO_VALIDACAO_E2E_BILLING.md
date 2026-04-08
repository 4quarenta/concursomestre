# Plano Validacao E2E Billing

## Cenarios cobertos

1. renovacao Stripe ponta a ponta
2. webhook duplicado
3. webhook fora de ordem
4. webhook atrasado + reconciliacao
5. auto renew off/on
6. refund concorrente
7. upgrade/pro-rata

## Estrategia usada

- Stripe real em modo teste.
- Stripe Test Clock para renovacao.
- fixtures JSON para webhooks.
- runner PHP no backend oficial.
- orquestrador Node no frontend.
- checklist agregado consumindo o report E2E.

## Limites

- nao substitui validacao em ambiente produtivo real.
- eventos atrasados e fora de ordem sao simulados.
- quando o backend falha de verdade, o runner marca `CRITICO`.

## Como rodar

```bash
npm run check:billing-e2e
```

Saidas:

- `C:/dev/concursomestre/scripts/checks/billing-e2e-report.json`
- `C:/dev/concursomestre/scripts/checks/billing-e2e-report.md`
- `C:/dev/concursomestre/billing-renewal-check.json`
- `C:/dev/concursomestre/billing-renewal-check.md`

## Interpretacao

- `OK`: prova real ou semi-E2E concluida
- `RISCO`: fragilidade encontrada, sem quebra imediata
- `CRITICO`: bloqueador real
- `NAO_COMPROVADO`: sem evidencia suficiente

Regra:

- `GO` = zero `CRITICO` e zero `NAO_COMPROVADO`
- `NO-GO` = qualquer `CRITICO` ou `NAO_COMPROVADO`
