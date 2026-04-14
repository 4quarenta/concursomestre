export interface MobileTransaction {
  id: string;
  materialId?: string | number;
  material_id?: string | number;
  buyerId?: string | number;
  buyer_id?: string | number;
  amount?: number;
  status?: string;
  type?: string;
  timestamp?: number | string;
  createdAt?: number | string;
  updatedAt?: number | string;
  planName?: string;
  transactionName?: string;
  description?: string;
  cycleLabel?: string;
  planCycleLabel?: string;
  billingCycleLabel?: string;
  billingCycle?: string;
  intervalUnit?: string;
  interval_unit?: string;
  intervalCount?: number;
  interval_count?: number;
  paymentProvider?: string;
  payment_provider?: string;
  provider?: string;
  gateway?: string;
  paymentMethodLabel?: string;
  paymentMethod?: string;
  payment_method?: string;
  paymentMethodType?: string;
  method?: string;
}

export interface TransactionListParams {
  userId?: string;
  scope?: 'buyer' | 'seller' | 'all';
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  type?: string;
}
