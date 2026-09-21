import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import { assertApiSuccess, readApiData } from "@/services/api/response";
import type { CouponValidationResult, Plan } from "@/types/plans";

type StripeBillingMode = "single_installment" | "term_recurring";

type StripeCheckoutPayload = {
  plan_id: number;
  auto_renew?: boolean;
  coupon_code?: string;
  checkout_attempt_id?: string;
  billing_mode?: StripeBillingMode;
  installment_count?: number;
  checkout_adhesion_terms_accepted: true;
  checkout_adhesion_terms_version: string;
};

export type StripeCheckoutSessionResult = {
  url?: string;
  redirect_url?: string;
  mode?: string;
  [key: string]: unknown;
};

type StripeInlineSubscriptionPayload = {
  plan_id: number;
  auto_renew?: boolean;
  coupon_code?: string;
  payment_method_id?: string;
  saved_card_id?: string;
  save_card?: boolean;
  billing_mode?: StripeBillingMode;
  installment_count?: number;
};

type StripeFinalizePayload = {
  subscription_id: string;
  plan_id?: number;
  auto_renew?: boolean;
  payment_method_id?: string;
  payment_intent_id?: string;
  saved_card_id?: string;
  save_card?: boolean;
  billing_mode?: StripeBillingMode;
};

/**
 * Fachada mobile do dominio de planos e checkout.
 * @since v1.0.0
 */
export const planService = {
  async getPlans(): Promise<Plan[]> {
    const response: any = await apiClient.get<any>(ENDPOINTS.plans.list, {
      params: { _: Date.now() },
    });
    assertApiSuccess(response, "Nao foi possivel carregar os planos.");

    const payload = readApiData<any>(response, []);
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.rows)
        ? payload.rows
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(response?.items)
            ? response.items
            : [];

    return rows
      .filter((row: unknown): row is Plan =>
        Boolean(row && typeof row === "object"),
      )
      .map((row: Plan) => {
        const rawRow = row as Omit<Plan, "is_test_plan"> & {
          is_test_plan?: unknown;
        };
        return {
          ...row,
          is_test_plan:
            rawRow.is_test_plan === true ||
            rawRow.is_test_plan === 1 ||
            rawRow.is_test_plan === "1",
        };
      });
  },

  async validateCoupon(
    code: string,
    amount: number,
    planId: number,
  ): Promise<CouponValidationResult> {
    const response: any = await apiClient.post<any>(
      ENDPOINTS.subscriptions.validateCoupon,
      {
        code,
        amount,
        plan_id: planId,
        target_type: "plan",
        target_id: planId,
      },
    );

    const payload = readApiData<any>(response, {});
    const discountAmount = Number(
      payload?.discount_amount ?? response?.discount_amount ?? 0,
    );
    const discountPercentage = Number(
      payload?.discount_percentage ?? response?.discount_percentage ?? 0,
    );

    if (response?.success === false) {
      return {
        valid: false,
        message: String(response?.message || "Cupom invalido."),
      };
    }

    return {
      valid: true,
      message: String(
        response?.message || payload?.message || "Cupom aplicado com sucesso.",
      ),
      discount_amount: Number.isFinite(discountAmount) ? discountAmount : 0,
      discount_percentage: Number.isFinite(discountPercentage)
        ? discountPercentage
        : 0,
    };
  },

  async createStripeCheckoutSession(
    payload: StripeCheckoutPayload,
  ): Promise<StripeCheckoutSessionResult> {
    const response: any = await apiClient.post<any>(
      ENDPOINTS.subscriptions.createStripeCheckout,
      payload,
    );
    assertApiSuccess(response, "Nao foi possivel iniciar o checkout.");

    const rawData = readApiData<any>(response, {});
    const url = String(
      rawData?.url || response?.url || rawData?.redirect_url || "",
    ).trim();

    const mode = String(rawData?.mode || response?.mode || "").trim();
    // O backend pode ativar uma assinatura integralmente coberta por crédito
    // interno. Nesse caso não existe Checkout Session nem URL para abrir.
    if (!url && mode !== "local_credit") {
      throw new Error("Checkout retornou sem URL de redirecionamento.");
    }

    return {
      ...(rawData && typeof rawData === "object" && !Array.isArray(rawData)
        ? rawData
        : {}),
      url: url || undefined,
      mode: mode || undefined,
    };
  },

  async createStripeSubscription(
    payload: StripeInlineSubscriptionPayload,
  ): Promise<any> {
    const response: any = await apiClient.post<any>(
      ENDPOINTS.subscriptions.createStripeSubscription,
      payload,
    );
    assertApiSuccess(response, "Nao foi possivel iniciar a assinatura Stripe.");
    return response;
  },

  async finalizeStripeSubscription(
    payload: StripeFinalizePayload,
  ): Promise<any> {
    const response: any = await apiClient.post<any>(
      ENDPOINTS.subscriptions.finalizeStripeSubscription,
      payload,
    );
    assertApiSuccess(
      response,
      "Nao foi possivel finalizar a assinatura Stripe.",
    );
    return response;
  },
};

export default planService;
