# Arquitetura financeira de indicacoes

## Regra contabil

O cadastro por `?ref=CODIGO` cria apenas o relacionamento em `referrals`. Nenhum
saldo nasce do clique ou do cadastro. A obrigacao financeira surge somente
quando uma transacao real de assinatura (`transactions.type = plan`) e
sincronizada como capturada.

O percentual e a carencia vigentes ficam congelados no lancamento. Alterar as
configuracoes afeta apenas novas capturas. A migration nao gera passivo
retroativo.

## Livro auxiliar

- `referral_commission_entries`: accruals e estornos assinados, idempotentes por
  `entry_key` e vinculados a uma transacao real.
- `referral_payout_cycles`: fechamento operacional do dia mensal configurado.
- `referral_payout_items`: valor por indicador, estado e comprovante do repasse.

O saldo e a soma dos lancamentos. Um reembolso atualiza um unico lancamento
negativo `refund-total`; chamadas repetidas nao duplicam o estorno. Se o
reembolso chegar durante a formacao do ciclo, o item e recalculado a partir dos
lancamentos efetivamente vinculados.

## Estados e valores

- `pending`: comissao reconhecida ainda dentro da carencia de reembolso.
- `available`: saldo liquido maduro, ainda fora de um ciclo.
- `scheduled`: item em revisao/aprovacao no ciclo.
- `paid`: repasse confirmado por admin com referencia ou comprovante.

Um saldo negativo decorrente de estorno posterior ao pagamento nao vira
repasse negativo. Ele permanece como compensacao para capturas futuras do mesmo
indicador.

## Fluxo oficial

1. O usuario compartilha `/auth?ref=CODIGO`.
2. O indicado cria a conta; `referrals` preserva a atribuicao.
3. O ledger financeiro sincroniza uma captura de assinatura.
4. `ReferralFinance` cria o accrual com percentual e carencia congelados.
5. Estornos integrais ou parciais geram ajuste negativo idempotente.
6. O cron legado preservado chama `UsersReferralRewardsService`, que agora cria
   somente o ciclo monetario no dia configurado.
7. O admin revisa o item e confirma o pagamento com comprovante.
8. O usuario recebe notificacao com o valor efetivamente pago.

Nao existem mais concessoes automaticas de dias de plano ou XP por indicacao.

## Configuracoes

- `referralCommissionPercent`
- `referralRefundGraceDays`
- `referralPayoutCycleDays`
- `referralPayoutDay`

O percentual padrao e `0%`. O programa so cria novas obrigacoes depois que um
admin configura explicitamente `referralCommissionPercent` acima de zero.

## Seguranca operacional e rollback

Antes da migration, executar `scripts/tasks/backup_mysql.php` e validar o
checksum. O rollback de codigo pode manter as tabelas aditivas sem impacto. Nao
remover tabelas enquanto houver lancamentos ou itens de repasse. Uma reversao
de regra deve desabilitar a comissao para novas capturas (`0%`) e preservar o
historico para conciliacao.

`api/tasks/ProcessRewards.php` permanece apenas como bridge fino protegido por
`CRON_SECRET`.
