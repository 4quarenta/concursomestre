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

# PLANO CORRECAO ADMIN BILLING

## P0

### Tecnico

- Remover Mercado Pago do backend ou assumir suporte integral com testes e observabilidade.
- Fechar reconciliacao Stripe para ciclo, expiracao e acesso.
- Criar testes automatizados de webhook duplicado, atrasado e fora de ordem.
- Criar testes reais de renovacao automatica e falha de cobranca.
- Garantir trilha unica para refund, cancelamento e reativacao.

### Funcional

- Provar renovacao ponta a ponta.
- Provar cancelamento dentro e fora de 7 dias.
- Provar religamento de `auto_renew`.
- Provar `local_credit` sem gerar acesso indevido.

### UI/UX

- Remover qualquer CTA fake do admin.
- Exibir estado de persistencia por item.
- Mostrar origem do erro em refund, settings e automacao.

## P1

### Tecnico

- Separar finance admin em submodulos menores.
- Migrar operacoes criticas do admin para services por dominio dedicados.
- Centralizar loaders, confirms e erros criticos em componentes compartilhados.
- Adicionar auditoria server-side para mais acoes administrativas.

### Funcional

- Fechar painel de automacao com status real de cron.
- Expor health de webhook e reconciliacao no admin.
- Adicionar leitura oficial de feedback pendente no dashboard admin.

### UI/UX

- Quebrar finance em `saldo`, `transacoes`, `refunds`, `planos`, `cupons`, `automacao`.
- Quebrar settings em secoes persistentes e deep links.
- Destacar risco financeiro, disputa e falha de cobranca.

## P2

### Tecnico

- Refatorar providers globais para consumo mais fino de services oficiais.
- Adicionar telemetria e audit trail estruturado por `subscription_id`, `invoice_id`, `refund_id`.
- Criar suite de regressao visual do admin.

### Funcional

- Dashboard executivo com health cards de webhook, cron e receita liquida.
- Moderacao com historico completo por item.

### UI/UX

- Consolidar tabelas, filtros, drawers e modais em kit admin unico.
- Criar padrao de danger zone e pending states.

## Backlog tecnico

- Remover bridges com logica residual
- Unificar source of truth local
- Fortalecer rollback e idempotencia
- Cobrir cron e reconciliacao

## Backlog funcional

- Renovacao Stripe comprovada
- Refund reversivel sem estado fantasma
- Auto renew on/off totalmente auditavel
- Admin financeiro sem ambiguidades

## Backlog UI UX

- Navegacao secundaria por dominio
- Cards executivos mais claros
- Formularios com save explicito
- Confirmacoes padrao

## Ordem recomendada

1. Billing critico
2. Webhook e cron
3. Refund e cancelamento
4. Finance admin
5. Settings admin
6. Demais dominios do admin
7. Hardening visual e observabilidade

## Criterios de aceite

- Nenhuma cobranca duplicada em testes
- Nenhum evento Stripe reaplicado gera efeito duplo
- Renovacao comprovada com periodo local correto
- Refund aprovado e rejeitado ficam consistentes
- Admin salva, recarrega e audita acao critica
- Nao existe CTA fake em producao
