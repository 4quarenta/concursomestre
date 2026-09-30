/**
 * Pure purchase-flow policy for Google Play updates.
 *
 * This module deliberately does not activate an entitlement itself. A store
 * purchase is considered active only after the authenticated backend verifies
 * it and confirms the resulting entitlement.
 */
export type GooglePlayPurchaseState =
  | "pending"
  | "purchased"
  | "cancelled"
  | "failed";

export type GooglePlayPurchaseEvent = {
  state: GooglePlayPurchaseState;
  productId?: string | null;
  purchaseToken?: string | null;
  message?: string | null;
};

export type GooglePlayVerificationInput = {
  productId: string;
  purchaseToken: string;
};

export type GooglePlayVerificationResult = {
  verified: boolean;
  entitlementActive: boolean;
};

export type GooglePlayPurchaseOutcome =
  | { status: "pending" }
  | { status: "cancelled" }
  | { status: "failed"; message?: string }
  | { status: "verification_failed" }
  | { status: "not_entitled" }
  | { status: "active" };

export type GooglePlayPurchaseVerifier = (
  input: GooglePlayVerificationInput,
) => Promise<GooglePlayVerificationResult>;

/**
 * Converts a native store update into a safe app outcome.
 * Only PURCHASED events with identifiers reach the backend verifier.
 */
export async function processGooglePlayPurchaseEvent(
  event: GooglePlayPurchaseEvent,
  verifyWithBackend: GooglePlayPurchaseVerifier,
): Promise<GooglePlayPurchaseOutcome> {
  if (event.state === "pending") return { status: "pending" };
  if (event.state === "cancelled") return { status: "cancelled" };
  if (event.state === "failed") {
    return { status: "failed", message: event.message || undefined };
  }

  const productId = String(event.productId || "").trim();
  const purchaseToken = String(event.purchaseToken || "").trim();
  if (!productId || !purchaseToken) return { status: "verification_failed" };

  const verification = await verifyWithBackend({ productId, purchaseToken });
  if (!verification.verified) return { status: "verification_failed" };
  if (!verification.entitlementActive) return { status: "not_entitled" };

  return { status: "active" };
}
