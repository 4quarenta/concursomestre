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
  interval_unit: 'day' | 'week' | 'month' | 'year';
  tier?: number;
  features?: PlanFeature[];
  is_active?: boolean;
}

export interface CouponValidationResult {
  valid: boolean;
  message?: string;
  discount_amount?: number;
  discount_percentage?: number;
}
