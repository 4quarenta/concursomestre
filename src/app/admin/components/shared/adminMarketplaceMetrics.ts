/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import type { Material, UserProfile } from '@types';

type LooseRecord = Record<string, unknown>;
type LooseUser = Partial<UserProfile>;
type LooseMaterial = Partial<Material>;
type LooseTransaction = LooseRecord;

const readRecordValue = (record: object | null | undefined, key: string) => (
  (record as LooseRecord | null | undefined)?.[key]
);

export interface AdminMarketplaceSellerMetric {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  paymentDay: number | null;
  totalSales: number;
  heldBalance: number;
  availablePayout: number;
  materialsCount: number;
  publishedMaterialsCount: number;
  transactions: LooseTransaction[];
}

const PAID_TRANSACTION_STATUSES = new Set(['completed', 'approved']);
const PUBLISHED_MATERIAL_STATUSES = new Set(['approved', 'published', 'active']);
const INACTIVE_SELLER_STATUSES = new Set(['banned', 'blocked', 'inactive', 'rejected', 'suspended']);

const normalizeIdentifier = (value: unknown) => String(value ?? '').trim();

const normalizeStatus = (value: unknown) => String(value || '').trim().toLowerCase();

export const isAdminMarketplaceVendorUser = (user: LooseUser | null | undefined): boolean => {
  const role = normalizeStatus(user?.role);
  return Boolean(user?.isPartner || role === 'partner');
};

export const isPublishedMarketplaceMaterial = (material: LooseMaterial | null | undefined): boolean => {
  const status = normalizeStatus(material?.status);
  const publicationStatus = normalizeStatus(readRecordValue(material, 'publicationStatus') ?? readRecordValue(material, 'publication_status'));

  return Boolean(
    readRecordValue(material, 'isPublished') === true
    || readRecordValue(material, 'published') === true
    || PUBLISHED_MATERIAL_STATUSES.has(status)
    || PUBLISHED_MATERIAL_STATUSES.has(publicationStatus),
  );
};

export const countPublishedMarketplaceMaterials = (materials: Material[] = []): number => (
  materials.filter(isPublishedMarketplaceMaterial).length
);

export const countActiveAdminMarketplaceSellers = (sellers: AdminMarketplaceSellerMetric[] = []): number => (
  sellers.filter((seller) => !INACTIVE_SELLER_STATUSES.has(normalizeStatus(seller.status))).length
);

const readTransactionAmount = (transaction: LooseTransaction) => Number(transaction?.amount || 0);

const readTransactionPlatformFee = (transaction: LooseTransaction) => {
  const amount = readTransactionAmount(transaction);
  const platformFee = Number(transaction?.platformFee ?? transaction?.platform_fee);
  return Number.isFinite(platformFee) && platformFee > 0 ? platformFee : amount * 0.20;
};

const isPaidTransactionStatus = (status: unknown) => PAID_TRANSACTION_STATUSES.has(normalizeStatus(status));

const isMarketplaceTransaction = (transaction: LooseTransaction) => {
  const type = normalizeStatus(transaction?.type);
  return type !== 'plan'
    && type !== 'subscription'
    && Boolean(transaction?.sellerId || transaction?.seller_id || transaction?.materialId || transaction?.material_id);
};

const isAdminTransactionHeld = (transaction: LooseTransaction) => {
  const timestamp = Number(transaction?.timestamp || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return true;

  return (Date.now() - timestamp) < (7 * 24 * 60 * 60 * 1000);
};

const readPaymentDay = (user?: LooseUser) => {
  const billingValue = readRecordValue(user, 'billing');
  const billing = typeof billingValue === 'object' && billingValue !== null
    ? billingValue as LooseRecord
    : {};
  const paymentDay = Number(billing.paymentDay ?? readRecordValue(user, 'paymentDay') ?? readRecordValue(user, 'payment_day'));
  return Number.isFinite(paymentDay) && paymentDay > 0 ? paymentDay : null;
};

const createSellerMetric = (
  sellerId: string,
  user?: LooseUser,
  fallback?: LooseRecord,
): AdminMarketplaceSellerMetric => ({
  id: sellerId,
  name: String(user?.name || fallback?.authorName || fallback?.sellerName || 'Vendedor sem nome'),
  email: String(user?.email || fallback?.sellerEmail || '-'),
  role: user?.role || 'partner',
  status: String(user?.status || fallback?.sellerStatus || 'active'),
  paymentDay: readPaymentDay(user),
  totalSales: 0,
  heldBalance: 0,
  availablePayout: 0,
  materialsCount: 0,
  publishedMaterialsCount: 0,
  transactions: [],
});

export const buildAdminMarketplaceSellerMetrics = ({
  users = [],
  materials = [],
  transactions = [],
}: {
  users?: LooseUser[];
  materials?: Material[];
  transactions?: LooseTransaction[];
}): AdminMarketplaceSellerMetric[] => {
  const usersById = new Map<string, LooseUser>();
  const metricsBySeller = new Map<string, AdminMarketplaceSellerMetric>();

  users.forEach((user) => {
    const userId = normalizeIdentifier(user?.id);
    if (userId) {
      usersById.set(userId, user);
    }

    if (!userId || !isAdminMarketplaceVendorUser(user)) {
      return;
    }

    metricsBySeller.set(userId, createSellerMetric(userId, user));
  });

  const ensureSellerMetric = (sellerId: string, fallback?: LooseRecord) => {
    const normalizedSellerId = normalizeIdentifier(sellerId);
    if (!normalizedSellerId) {
      return null;
    }

    if (!metricsBySeller.has(normalizedSellerId)) {
      metricsBySeller.set(
        normalizedSellerId,
        createSellerMetric(normalizedSellerId, usersById.get(normalizedSellerId), fallback),
      );
    }

    return metricsBySeller.get(normalizedSellerId) || null;
  };

  materials.forEach((material) => {
    const materialLike = material as LooseMaterial;
    const sellerId = normalizeIdentifier(
      materialLike.authorId
      || readRecordValue(materialLike, 'author_id')
      || readRecordValue(materialLike, 'sellerId')
      || readRecordValue(materialLike, 'seller_id'),
    );
    const sellerMetric = ensureSellerMetric(sellerId, materialLike as LooseRecord);

    if (!sellerMetric) {
      return;
    }

    sellerMetric.materialsCount += 1;
    if (isPublishedMarketplaceMaterial(materialLike)) {
      sellerMetric.publishedMaterialsCount += 1;
    }
  });

  transactions.forEach((transaction) => {
    if (!isPaidTransactionStatus(transaction?.status) || !isMarketplaceTransaction(transaction)) {
      return;
    }

    const sellerId = normalizeIdentifier(transaction?.sellerId || transaction?.seller_id);
    const sellerMetric = ensureSellerMetric(sellerId, transaction);

    if (!sellerMetric) {
      return;
    }

    const amount = readTransactionAmount(transaction);
    const sellerShare = Math.max(0, amount - readTransactionPlatformFee(transaction));

    sellerMetric.totalSales += amount;
    sellerMetric.transactions.push(transaction);

    if (isAdminTransactionHeld(transaction)) {
      sellerMetric.heldBalance += sellerShare;
    } else {
      sellerMetric.availablePayout += sellerShare;
    }
  });

  return Array.from(metricsBySeller.values());
};
