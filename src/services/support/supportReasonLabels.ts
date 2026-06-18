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

const normalizeReasonKey = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, '_');

const SUPPORT_REASON_LABELS: Record<string, string> = {
  price: 'Valor da assinatura',
  valor_da_assinatura: 'Valor da assinatura',
  usage: 'Não estou usando o suficiente',
  nao_estou_usando_o_suficiente: 'Não estou usando o suficiente',
  technical: 'Problemas técnicos',
  problemas_tecnicos: 'Problemas técnicos',
  content: 'Falta de conteúdos específicos',
  falta_de_conteudos_especificos: 'Falta de conteúdos específicos',
  other: 'Outros motivos',
  outros_motivos: 'Outros motivos',
  arrependimento: 'Arrependimento dentro do prazo de garantia',
  user_request: 'Solicitado pelo usuário',
  waiting_for_stripe_reconciliation: 'Aguardando conciliação com a Stripe',
  local_period_ended_without_expected_renewal: 'Período local encerrado sem renovação confirmada',
};

export const getSupportReasonLabel = (reason: unknown) => {
  const raw = String(reason || '').trim();
  if (!raw) return '';

  return SUPPORT_REASON_LABELS[normalizeReasonKey(raw)] || raw;
};

export default getSupportReasonLabel;
