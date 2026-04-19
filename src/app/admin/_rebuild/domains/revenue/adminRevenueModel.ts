import type { Transaction, UserProfile } from '@types';

type TransactionLike = Partial<Transaction>;
type UserLike = Partial<UserProfile>;

export interface AdminRevenueModelInput {
  transactions?: TransactionLike[];
  users?: UserLike[];
}

export interface AdminSellerRevenueMetric {
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  totalSales: number;
  platformFees: number;
  availablePayout: number;
  heldBalance: number;
  transactionCount: number;
}

export interface AdminRevenueModel {
  totalRevenue: number;
  netRevenue: number;
  platformFees: number;
  planRevenue: number;
  marketplaceRevenue: number;
  pendingRefunds: number;
  refundedAmount: number;
  failedTransactions: number;
  paidTransactions: number;
  sellers: AdminSellerRevenueMetric[];
}

const PAID_TRANSACTION_STATUSES = new Set(['completed', 'approved']);
const FAILED_TRANSACTION_STATUSES = new Set(['failed', 'rejected', 'cancelled', 'canceled']);

const readString = (value: unknown) => String(value ?? '').trim();
const readField = (record: object, key: string) => (record as Record<string, unknown>)[key];

const readNumber = (value: unknown): number => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const getTransactionStatus = (transaction: TransactionLike) => readString(transaction.status).toLowerCase();

const isPaidTransaction = (transaction: TransactionLike) =>
  PAID_TRANSACTION_STATUSES.has(getTransactionStatus(transaction));

const isFailedTransaction = (transaction: TransactionLike) =>
  FAILED_TRANSACTION_STATUSES.has(getTransactionStatus(transaction));

const getTransactionAmount = (transaction: TransactionLike) =>
  readNumber(transaction.amount ?? readField(transaction, 'total_amount') ?? readField(transaction, 'totalAmount'));

const getPlatformFee = (transaction: TransactionLike) =>
  readNumber(transaction.platformFee ?? readField(transaction, 'platform_fee') ?? readField(transaction, 'fee'));

const getSellerId = (transaction: TransactionLike) =>
  readString(transaction.sellerId ?? readField(transaction, 'seller_id'));

const getTransactionType = (transaction: TransactionLike) =>
  readString(transaction.type ?? readField(transaction, 'transaction_type') ?? readField(transaction, 'source')).toLowerCase();

const isPlanTransaction = (transaction: TransactionLike) => {
  const type = getTransactionType(transaction);
  return type === 'plan' || type === 'subscription';
};

const isMarketplaceTransaction = (transaction: TransactionLike) => {
  if (isPlanTransaction(transaction)) {
    return false;
  }

  return Boolean(getSellerId(transaction) || transaction.materialId || readField(transaction, 'material_id'));
};

const findSeller = (users: UserLike[], sellerId: string) =>
  users.find((user) => readString(user.id) === sellerId);

export const formatAdminCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);

export const buildAdminRevenueModel = ({
  transactions = [],
  users = [],
}: AdminRevenueModelInput): AdminRevenueModel => {
  const sellersById = new Map<string, AdminSellerRevenueMetric>();

  const model = transactions.reduce<AdminRevenueModel>((accumulator, transaction) => {
    const amount = getTransactionAmount(transaction);
    const platformFee = getPlatformFee(transaction);
    const status = getTransactionStatus(transaction);

    if (isPaidTransaction(transaction)) {
      accumulator.paidTransactions += 1;
      accumulator.totalRevenue += amount;
      accumulator.platformFees += platformFee;
      accumulator.netRevenue += readNumber(readField(transaction, 'netAmount') ?? readField(transaction, 'net_amount') ?? (amount - platformFee));

      if (isPlanTransaction(transaction)) {
        accumulator.planRevenue += amount;
      } else if (isMarketplaceTransaction(transaction)) {
        accumulator.marketplaceRevenue += amount;

        const sellerId = getSellerId(transaction);
        if (sellerId) {
          const seller = findSeller(users, sellerId);
          const sellerMetric = sellersById.get(sellerId) || {
            sellerId,
            sellerName: readString(seller?.name) || readString(readField(transaction, 'sellerName') ?? readField(transaction, 'seller_name')) || 'Desconhecido',
            sellerEmail: readString(seller?.email) || readString(readField(transaction, 'sellerEmail') ?? readField(transaction, 'seller_email')) || '-',
            totalSales: 0,
            platformFees: 0,
            availablePayout: 0,
            heldBalance: 0,
            transactionCount: 0,
          };
          const sellerShare = Math.max(0, amount - platformFee);

          sellerMetric.totalSales += amount;
          sellerMetric.platformFees += platformFee;
          sellerMetric.availablePayout += sellerShare;
          sellerMetric.transactionCount += 1;
          sellersById.set(sellerId, sellerMetric);
        }
      }
    }

    if (status === 'refund_requested') {
      accumulator.pendingRefunds += 1;
    }

    if (status === 'refunded') {
      accumulator.refundedAmount += amount;
    }

    if (isFailedTransaction(transaction)) {
      accumulator.failedTransactions += 1;
    }

    return accumulator;
  }, {
    totalRevenue: 0,
    netRevenue: 0,
    platformFees: 0,
    planRevenue: 0,
    marketplaceRevenue: 0,
    pendingRefunds: 0,
    refundedAmount: 0,
    failedTransactions: 0,
    paidTransactions: 0,
    sellers: [],
  });

  return {
    ...model,
    sellers: Array.from(sellersById.values()).sort((left, right) => right.availablePayout - left.availablePayout),
  };
};
