
import { apiClient, ENDPOINTS } from '@core/api';
import type { ApiResponse } from '@core/api/types';
import type { Plan, UserSubscription } from '../../../../types';

export const planService = {
    /**
     * List all available plans
     */
    async getPlans(): Promise<Plan[]> {
        try {
            // apiClient interceptor returns response.data (the body)
            // body is { success: true, data: [...] }
            const response = await apiClient.get<ApiResponse<Plan[]>>('/plans/list.php');
            // Cast to any because the generic typing might conflict with the interceptor's return type in IDE, 
            // but at runtime 'response' is the body.
            const body = response as any;
            return body.data || [];
        } catch (error) {
            console.error('Error fetching plans:', error);
            return [];
        }
    },

    /**
     * Create a subscription preference
     */
    async createSubscription(planId: number, userId: string): Promise<{ preferenceId: string; initPoint: string } | null> {
        try {
            const response = await apiClient.post<ApiResponse<{ preferenceId: string; initPoint: string }>>('/subscriptions/create.php', {
                plan_id: planId,
                user_id: userId
            });

            const body = response as any;

            if (body.success && body.data) {
                return body.data;
            }

            // Fallback
            if (body.preferenceId) {
                return {
                    preferenceId: body.preferenceId,
                    initPoint: body.initPoint
                };
            }
            return null;
        } catch (error) {
            console.error('Error creating subscription:', error);
            return null;
        }
    },

    /**
     * Process direct payment
     */
    async processPayment(paymentData: any): Promise<any> {
        try {
            const response = await apiClient.post<ApiResponse<any>>('/subscriptions/process_payment.php', paymentData);
            return response;
        } catch (error) {
            console.error('Error processing payment:', error);
            throw error;
        }
    },

    /**
     * Create a Stripe-hosted checkout session for subscriptions.
     */
    async createStripeCheckoutSession(payload: {
        plan_id: number;
        auto_renew?: boolean;
        coupon_code?: string;
    }): Promise<any> {
        try {
            const response = await apiClient.post<ApiResponse<any>>('/subscriptions/create_stripe_checkout.php', payload);
            return response;
        } catch (error) {
            console.error('Error creating Stripe checkout session:', error);
            throw error;
        }
    },

    async createStripeSubscription(payload: {
        plan_id: number;
        auto_renew?: boolean;
        coupon_code?: string;
        payment_method_id?: string;
        saved_card_id?: string;
        save_card?: boolean;
    }): Promise<any> {
        try {
            const response = await apiClient.post<ApiResponse<any>>('/subscriptions/create_stripe_subscription.php', payload);
            return response;
        } catch (error) {
            console.error('Error creating Stripe inline subscription:', error);
            throw error;
        }
    },

    async finalizeStripeSubscription(payload: {
        subscription_id: string;
        plan_id?: number;
        auto_renew?: boolean;
        payment_method_id?: string;
        saved_card_id?: string;
        save_card?: boolean;
    }): Promise<any> {
        try {
            const response = await apiClient.post<ApiResponse<any>>('/subscriptions/finalize_stripe_subscription.php', payload);
            return response;
        } catch (error) {
            console.error('Error finalizing Stripe subscription:', error);
            throw error;
        }
    },

    async createStripeSetupIntent(): Promise<any> {
        try {
            const response = await apiClient.post<ApiResponse<any>>('/users/create_stripe_setup_intent.php', {});
            return response;
        } catch (error) {
            console.error('Error creating Stripe setup intent:', error);
            throw error;
        }
    },

    async syncStripeCard(paymentMethodId: string): Promise<any> {
        try {
            const response = await apiClient.post<ApiResponse<any>>('/users/sync_stripe_card.php', {
                payment_method_id: paymentMethodId,
            });
            return response;
        } catch (error) {
            console.error('Error syncing Stripe card:', error);
            throw error;
        }
    },

    /**
     * Open the Stripe Billing Portal for the authenticated user.
     */
    async createStripePortalSession(): Promise<any> {
        try {
            const response = await apiClient.post<ApiResponse<any>>('/subscriptions/create_stripe_portal.php', {});
            return response;
        } catch (error) {
            console.error('Error creating Stripe portal session:', error);
            throw error;
        }
    },

    /**
     * Cancel subscription
     */
    async cancelSubscription(userId: string, reason?: string, details?: string): Promise<any> {
        try {
            const response = await apiClient.post<ApiResponse>('/subscriptions/cancel.php', {
                user_id: userId,
                reason,
                details
            });
            return response;
        } catch (error) {
            console.error('Error canceling subscription:', error);
            throw error;
        }
    },

    /**
     * Update auto-renewal preference
     */
    async updateRenewal(autoRenew: boolean): Promise<any> {
        return apiClient.post('/subscriptions/update_renewal.php', {
            auto_renew: autoRenew
        });
    }
};
