import {
  finishTransaction,
  type ProductSubscription,
  type Purchase,
} from "expo-iap";
import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import { assertApiSuccess, readApiData } from "@/services/api/response";
import type { Plan } from "@/types/plans";

export type GooglePlayPlanSelection = {
  productId: string;
  basePlanId: string | null;
  offerToken: string;
  localizedPrice: string;
  currency: string | null;
  amount: number | null;
};

/**
 * Resolve only the product explicitly mapped to this admin plan. We never
 * infer a Play SKU from the plan name or fall back to Stripe identifiers.
 */
export const resolveGooglePlayPlanSelection = (
  plan: Plan,
  products: ProductSubscription[],
): GooglePlayPlanSelection | null => {
  if (plan.google_play_billing_enabled !== true) return null;
  const productId = String(plan.google_play_product_id || "").trim();
  if (!productId) return null;

  const product = products.find((candidate) => candidate.id === productId);
  if (!product) return null;

  const expectedBasePlanId = String(plan.google_play_base_plan_id || "").trim();
  const expectedOfferId = String(plan.google_play_offer_id || "").trim();
  const offers = product.subscriptionOffers || [];
  const matchingOffers = offers.filter((offer) =>
    (!expectedBasePlanId || offer.basePlanIdAndroid === expectedBasePlanId) &&
      (expectedOfferId ? offer.id === expectedOfferId : offer.id === ""),
  );
  if (matchingOffers.length !== 1) return null;

  const offer = matchingOffers[0];
  const offerToken = String(offer.offerTokenAndroid || "").trim();
  if (!offerToken || !offer.displayPrice) return null;

  return {
    productId,
    basePlanId: offer.basePlanIdAndroid || expectedBasePlanId || null,
    offerToken,
    localizedPrice: offer.displayPrice,
    currency: offer.currency || product.currency || null,
    amount: Number.isFinite(offer.price) ? offer.price : null,
  };
};

/**
 * Ask the first-party API to verify a Play purchase. Benefits must only be
 * granted by the server after checking purchaseToken with Google Play.
 */
export const verifyGooglePlayPurchase = async (
  plan: Plan,
  purchase: Purchase,
): Promise<void> => {
  const purchaseToken = String(purchase.purchaseToken || "").trim();
  const productId = String(purchase.productId || "").trim();
  const expectedProductId = String(plan.google_play_product_id || "").trim();

  if (!purchaseToken || !productId || !expectedProductId || productId !== expectedProductId) {
    throw new Error("A compra não corresponde ao plano selecionado.");
  }

  const response: any = await apiClient.post<any>(
    ENDPOINTS.subscriptions.verifyGooglePlayPurchase,
    {
      plan_id: plan.id,
      product_id: productId,
      base_plan_id: purchase.currentPlanId || plan.google_play_base_plan_id || undefined,
      purchase_token: purchaseToken,
      order_id: purchase.id,
    },
  );
  assertApiSuccess(response, "Não foi possível validar a compra pela Google Play.");

  const payload = readApiData<any>(response, {});
  if (payload?.verified !== true || payload?.entitlement_active !== true) {
    throw new Error("A Google Play ainda não confirmou a assinatura. Tente novamente em instantes.");
  }
};

/** Finish/acknowledge only after the backend has confirmed the entitlement. */
export const acknowledgeVerifiedGooglePlayPurchase = async (
  purchase: Purchase,
): Promise<void> => {
  if ("isAcknowledgedAndroid" in purchase && purchase.isAcknowledgedAndroid === true) return;
  await finishTransaction({ purchase, isConsumable: false });
};
