import { describe, expect, it, vi } from "vitest";
import { processGooglePlayPurchaseEvent } from "@/services/purchases/googlePlayPurchaseFlow";

describe("processGooglePlayPurchaseEvent", () => {
  it.each([
    ["pending", "pending"],
    ["cancelled", "cancelled"],
    ["failed", "failed"],
  ] as const)("does not verify a %s update", async (state, expectedStatus) => {
    const verify = vi.fn();
    const result = await processGooglePlayPurchaseEvent({ state }, verify);

    expect(result.status).toBe(expectedStatus);
    expect(verify).not.toHaveBeenCalled();
  });

  it("does not call the verifier when a completed purchase lacks a token or product id", async () => {
    const verify = vi.fn();
    const result = await processGooglePlayPurchaseEvent(
      { state: "purchased", productId: "pro_monthly" },
      verify,
    );

    expect(result).toEqual({ status: "verification_failed" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("sends only a completed purchase to the backend verifier", async () => {
    const verify = vi.fn().mockResolvedValue({
      verified: true,
      entitlementActive: true,
    });

    const result = await processGooglePlayPurchaseEvent(
      {
        state: "purchased",
        productId: "pro_monthly",
        purchaseToken: "opaque-test-token",
      },
      verify,
    );

    expect(verify).toHaveBeenCalledExactlyOnceWith({
      productId: "pro_monthly",
      purchaseToken: "opaque-test-token",
    });
    expect(result).toEqual({ status: "active" });
  });

  it("never reports active when the backend rejects the purchase", async () => {
    const verify = vi.fn().mockResolvedValue({
      verified: false,
      entitlementActive: false,
    });

    const result = await processGooglePlayPurchaseEvent(
      {
        state: "purchased",
        productId: "pro_monthly",
        purchaseToken: "forged-or-expired-token",
      },
      verify,
    );

    expect(result).toEqual({ status: "verification_failed" });
  });

  it("does not report active when verification succeeds without an active entitlement", async () => {
    const verify = vi.fn().mockResolvedValue({
      verified: true,
      entitlementActive: false,
    });

    const result = await processGooglePlayPurchaseEvent(
      {
        state: "purchased",
        productId: "pro_monthly",
        purchaseToken: "verified-but-inactive-token",
      },
      verify,
    );

    expect(result).toEqual({ status: "not_entitled" });
  });
});
