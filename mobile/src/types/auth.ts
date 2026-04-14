export type UserRole = 'admin' | 'user' | string;

export interface UserPlan {
  id?: number;
  name?: string;
  interval_unit?: string;
  interval_count?: number;
}

export interface UserSubscription {
  status?: 'active' | 'trialing' | 'canceled' | 'expired' | string;
  plan_id?: number;
  plan?: UserPlan;
  auto_renew?: boolean;
  current_period_start?: string | number;
  current_period_end?: string | number;
  next_billing_at?: string | number;
  cancel_at_period_end?: boolean;
  total_installments?: number;
  paid_installments?: number;
}

export interface UserBilling {
  plan?: string;
  billingCycle?: 'monthly' | 'quarterly' | 'annual' | string;
  nextBilling?: string | number;
  cardLast4?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: UserRole;
  isAdmin?: boolean;
  emailVerified?: boolean;
  level?: number;
  xp?: number;
  plan?: string;
  billing?: UserBilling;
  subscription?: UserSubscription;
  savedQuestionIds?: string[];
}

export interface AuthFlowPayload {
  user?: UserProfile;
  token?: string | null;
  require2FA?: boolean;
  email?: string;
}

export interface AuthFlowResponse {
  success: boolean;
  message?: string;
  data?: AuthFlowPayload;
  user?: UserProfile;
  token?: string | null;
  require2FA?: boolean;
  email?: string;
}
