/**
 * Marketplace Service
 * Handles all marketplace-related operations with transaction helpers
 */

import { apiClient, ENDPOINTS } from '@core/api';
import type { ApiResponse } from '@core/api/types';
import type { Material, Transaction } from 'types';

export const marketplaceService = {
    /**
     * Get all materials
     */
    async getMaterials(filters?: { subject?: string }): Promise<Material[]> {
        try {
            const response = await apiClient.get<ApiResponse<{ rows: Material[] }>>(
                ENDPOINTS.materials.list,
                { params: filters }
            );
            return response.data.data?.rows || [];
        } catch (error) {
            console.error('Error fetching materials:', error);
            return [];
        }
    },

    /**
     * Purchase a material
     */
    async purchaseMaterial(materialId: number): Promise<boolean> {
        try {
            const response = await apiClient.post<ApiResponse>(
                ENDPOINTS.transactions.list,
                { material_id: materialId, type: 'purchase' }
            );
            return response.data.success;
        } catch (error) {
            console.error('Error purchasing material:', error);
            return false;
        }
    },

    /**
     * Upload a new material
     */
    async uploadMaterial(material: Partial<Material>): Promise<boolean> {
        try {
            const response = await apiClient.post<ApiResponse>(
                ENDPOINTS.materials.create,
                material
            );
            return response.data.success;
        } catch (error) {
            console.error('Error uploading material:', error);
            return false;
        }
    },

    /**
     * Get user transactions
     */
    async getTransactions(userId: number): Promise<Transaction[]> {
        try {
            console.log('🌐 Fetching transactions for userId:', userId);
            const response = await apiClient.get<ApiResponse<{ rows: Transaction[] }>>(
                ENDPOINTS.transactions.list,
                { params: { user_id: userId.toString() } }
            );
            console.log('📡 API Response:', response);
            console.log('📊 Response data:', response.data);
            console.log('📋 Transactions rows:', response.data.data?.rows);
            return response.data.data?.rows || [];
        } catch (error) {
            console.error('❌ Error fetching transactions:', error);
            return [];
        }
    },

    // ============================================
    // HELPER METHODS (for local state management)
    // ============================================

    /**
     * Get user transactions (alias for compatibility)
     */
    async getUserTransactions(userId: string): Promise<Transaction[]> {
        console.log('🔍 getUserTransactions called with userId:', userId);
        // Don't convert to number - userId is a string like 'u-admin' or 'u-partner'
        const result = await this.getTransactionsByUserId(userId);
        console.log('📦 getUserTransactions result:', result);
        return result;
    },

    /**
     * Get user transactions by string userId
     */
    async getTransactionsByUserId(userId: string): Promise<Transaction[]> {
        try {
            console.log('🌐 Fetching transactions for userId (string):', userId);
            const response = await apiClient.get<ApiResponse<{ rows: Transaction[] }>>(
                ENDPOINTS.transactions.list,
                { params: { user_id: userId } }
            );
            console.log('📡 API Response:', response);
            console.log('📊 Response data:', response.data);

            // apiClient already extracts .data, so response IS the data object
            // Backend returns: {success: true, data: {rows: [...]}}
            const rows = (response as any).rows || (response as any).data?.rows || [];
            console.log('📋 Transactions rows:', rows);
            return rows;
        } catch (error) {
            console.error('❌ Error fetching transactions:', error);
            return [];
        }
    },

    /**
     * Process transaction (mock for now)
     */
    async processTransaction(user: any, material: Material): Promise<Transaction> {
        // Mock implementation - replace with real payment gateway
        await new Promise(resolve => setTimeout(resolve, 1500));

        const transaction: Transaction = {
            id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            buyerId: user.id,
            buyerName: user.name,
            materialId: material.id,
            materialTitle: material.title,
            sellerId: material.authorId || (material as any).author_id || '',
            amount: material.price,
            platformFee: material.price * 0.20,
            status: 'completed',
            timestamp: Date.now()
        };

        return transaction;
    },

    /**
     * Request refund
     */
    async requestRefund(transactionId: string, reason: string): Promise<any> {
        try {
            const response = await apiClient.post<any>('transactions/refund.php', {
                transaction_id: transactionId,
                reason: reason
            });
            return response;
        } catch (error) {
            console.error('Error requesting refund:', error);
            throw error;
        }
    },

    async processRefund(transactionId: string, approved: boolean): Promise<any> {
        try {
            const endpoint = approved ? 'transactions/approve_refund.php' : 'transactions/reject_refund.php';
            const response = await apiClient.post<any>(endpoint, {
                transaction_id: transactionId
            });
            return response;
        } catch (error) {
            console.error('Error processing refund:', error);
            throw error;
        }
    },

    /**
     * Get partner transactions
     */
    async getPartnerTransactions(partnerId: string): Promise<Transaction[]> {
        // TODO: Implement API endpoint
        return [];
    },

    /**
     * Set transactions (local state helper)
     */
    setTransactions(txs: Transaction[]) {
        // This is a local state helper - contexts will handle this
        // No-op here as this is just for compatibility
    },
};

export default marketplaceService;
