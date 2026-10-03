export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface Plan {
  id: number;
  name: string;
  description: string;
  price: number;
  interval_count: number;
  interval_unit: "day" | "week" | "month" | "year";
  tier?: number;
  features?: PlanFeature[];
  is_active?: boolean;
  is_test_plan?: boolean;
  canonical_name?: string;
  /** Play Console product (subscription) mapped to this admin-managed plan. */
  google_play_product_id?: string | null;
  /** Optional base plan ID; required when a product exposes multiple base plans. */
  google_play_base_plan_id?: string | null;
  /** Optional offer ID when the admin catalog selects a Play promotional offer. */
  google_play_offer_id?: string | null;
  /** Server enables checkout only after purchase verification and RTDN are ready. */
  google_play_billing_enabled?: boolean;
}

export interface CouponValidationResult {
  valid: boolean;
  message?: string;
  discount_amount?: number;
  discount_percentage?: number;
}
