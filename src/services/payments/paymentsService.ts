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

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData, readApiErrorMessage } from '@services/api';

type InstallmentOption = {
  payment_method_id?: string;
  payer_costs?: Array<{
    installments?: number;
    installment_amount?: number;
    total_amount?: number;
  }>;
};

type InstallmentQuery = {
  amount?: number | null;
  bin?: string;
  paymentMethodId?: string;
};

type MaterialPaymentPayload = {
  token: string;
  transaction_amount: number;
  description: string;
  installments: number;
  payment_method_id: string;
  material_id: string;
  seller_id?: string;
  payer: {
    email: string;
    identification: {
      type: string;
      number: string;
    };
  };
};

type MaterialPaymentResult = {
  status: string;
  message?: string;
};

type MaterialPaymentApiResponse = {
  status?: string;
  message?: string;
};

/**
 * Centraliza consultas auxiliares do checkout para reduzir parsing manual
 * nos entry points de pagamento.
 * @since 1.0.0
 */
export const paymentsService = {
  /**
   * Busca as opcoes de parcelamento do backend e sempre devolve uma lista.
   * Essa leitura alimenta o modal de pagamento com o contrato oficial do gateway.
   * @since 1.0.0
   */
  async getInstallments({ amount, bin, paymentMethodId }: InstallmentQuery): Promise<InstallmentOption[]> {
    const response = await apiClient.get<InstallmentOption[] | { data?: InstallmentOption[] }>(ENDPOINTS.payments.installments, {
      params: {
        amount: amount ?? undefined,
        bin: bin || undefined,
        payment_method_id: paymentMethodId || undefined,
      },
    });

    const payload = readApiData<InstallmentOption[]>(response, []);
    return Array.isArray(payload) ? payload : [];
  },

  /**
   * Processa a compra avulsa de um material no backend e entrega um resultado
   * simples para a UI reagir sem parsing manual. O backend usa a sessão
   * autenticada como fonte de verdade do comprador.
   * @since 1.0.0
   */
  async processMaterialPayment(payload: MaterialPaymentPayload): Promise<MaterialPaymentResult> {
    try {
      const response = await apiClient.post<MaterialPaymentApiResponse>(ENDPOINTS.payments.processMaterial, payload);
      const raw = assertApiSuccess(response, 'Não foi possível processar o pagamento do material.').raw;
      const data = readApiData<MaterialPaymentApiResponse>(raw, {});

      return {
        status: String(data.status || (raw && typeof raw === 'object' && 'status' in raw ? raw.status : 'error')),
        message: data.message || (raw && typeof raw === 'object' && 'message' in raw && typeof raw.message === 'string' ? raw.message : undefined),
      };
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Não foi possível processar o pagamento do material.'));
    }
  },
};

export default paymentsService;
