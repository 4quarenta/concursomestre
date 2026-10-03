import { describe, expect, it, vi } from "vitest";
import { resolveGooglePlayPlanSelection } from "@/services/subscriptions/googlePlayBillingService";
import type { Plan } from "@/types/plans";

vi.mock("expo-iap", () => ({ finishTransaction: vi.fn() }));
vi.mock("@/services/api/client", () => ({ apiClient: { post: vi.fn() } }));

const basePlan: Plan = {
  id: 12,
  name: "Pro Anual",
  description: "",
  price: 119.88,
  interval_count: 12,
  interval_unit: "month",
  google_play_product_id: "concursomestre_pro",
  google_play_base_plan_id: "pro-anual",
  google_play_billing_enabled: true,
};

describe("Google Play plan mapping", () => {
  it("uses only the explicitly mapped product and base plan", () => {
    const selection = resolveGooglePlayPlanSelection(basePlan, [
      {
        id: "concursomestre_pro",
        currency: "BRL",
        subscriptionOffers: [
          {
          id: "",
            basePlanIdAndroid: "pro-anual",
            offerTokenAndroid: "play-offer-token",
            displayPrice: "R$ 119,88 por ano",
            price: 119.88,
            type: "base-plan",
          },
        ],
      } as any,
    ]);

    expect(selection).toEqual({
      productId: "concursomestre_pro",
      basePlanId: "pro-anual",
      offerToken: "play-offer-token",
      localizedPrice: "R$ 119,88 por ano",
      currency: "BRL",
      amount: 119.88,
    });
  });

  it("fails closed when the store product or exact base plan is absent or ambiguous", () => {
    const product = {
      id: "concursomestre_pro",
      currency: "BRL",
      subscriptionOffers: [
        {
          id: "",
          basePlanIdAndroid: "pro-mensal",
          offerTokenAndroid: "monthly-token",
          displayPrice: "R$ 19,99 por mês",
          price: 19.99,
          type: "base-plan",
        },
        {
          id: "",
          basePlanIdAndroid: "pro-anual",
          offerTokenAndroid: "annual-token",
          displayPrice: "R$ 119,88 por ano",
          price: 119.88,
          type: "base-plan",
        },
        {
          id: "intro",
          basePlanIdAndroid: "pro-anual",
          offerTokenAndroid: "intro-token",
          displayPrice: "R$ 0,00 por 7 dias",
          price: 0,
          type: "introductory",
        },
      ],
    } as any;

    expect(resolveGooglePlayPlanSelection(basePlan, [])).toBeNull();
    expect(resolveGooglePlayPlanSelection({ ...basePlan, google_play_base_plan_id: null }, [product])).toBeNull();
    expect(resolveGooglePlayPlanSelection({ ...basePlan, google_play_base_plan_id: "unknown" }, [product])).toBeNull();
    expect(resolveGooglePlayPlanSelection(basePlan, [product])?.offerToken).toBe("annual-token");
    expect(
      resolveGooglePlayPlanSelection(
        { ...basePlan, google_play_offer_id: "intro" },
        [product],
      )?.offerToken,
    ).toBe("intro-token");
  });

  it("does not invent a Play product ID from the plan name", () => {
    expect(
      resolveGooglePlayPlanSelection(
        { ...basePlan, google_play_product_id: null },
        [{ id: "concursomestre_pro", subscriptionOffers: [] } as any],
      ),
    ).toBeNull();
  });

  it("keeps the offer unavailable until the backend explicitly enables verified billing", () => {
    expect(
      resolveGooglePlayPlanSelection(
        { ...basePlan, google_play_billing_enabled: false },
        [{ id: "concursomestre_pro", subscriptionOffers: [] } as any],
      ),
    ).toBeNull();
  });
});
