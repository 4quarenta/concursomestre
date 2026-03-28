// Add to types.ts - Plan interface with tier
export interface Plan {
    id: number;
    name: string;
    price: number;
    interval_unit: string;
    interval_count: number;
    tier: number; // 1=Gratuito, 2=Essencial, 3=Pro, 4=Elite
}

export interface UserSubscription {
    id: number;
    user_id: string;
    plan_id: number;
    status: 'active' | 'trialing' | 'canceled' | 'expired';
    auto_renew: boolean;
    current_period_start: string;
    current_period_end: string;
    plan: Plan;
}
