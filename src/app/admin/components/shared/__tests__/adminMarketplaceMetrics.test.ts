import { describe, expect, it } from 'vitest';
import type { Material, UserProfile } from '@types';
import {
  buildAdminMarketplaceSellerMetrics,
  countActiveAdminMarketplaceSellers,
  countPublishedMarketplaceMaterials,
} from '../adminMarketplaceMetrics';

describe('adminMarketplaceMetrics', () => {
  it('consolidates sellers from legacy and canonical marketplace fields', () => {
    const users = [
      {
        id: 'seller-1',
        name: 'Vendedor Um',
        email: 'seller@example.com',
        role: 'partner',
        status: 'active',
        billing: { paymentDay: 12 },
      },
    ] as unknown as UserProfile[];

    const materials = [
      {
        id: 'mat-1',
        title: 'Material legado',
        author_id: 'seller-1',
        status: 'approved',
      },
      {
        id: 'mat-2',
        title: 'Material em revisao',
        seller_id: 'seller-1',
        status: 'pending',
      },
    ] as unknown as Material[];

    const transactions = [
      {
        id: 'tx-1',
        seller_id: 'seller-1',
        material_id: 'mat-1',
        status: 'completed',
        amount: 100,
        platform_fee: 25,
        timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000),
      },
    ];

    const [seller] = buildAdminMarketplaceSellerMetrics({ users, materials, transactions });

    expect(seller).toMatchObject({
      id: 'seller-1',
      name: 'Vendedor Um',
      materialsCount: 2,
      publishedMaterialsCount: 1,
      totalSales: 100,
      availablePayout: 75,
      heldBalance: 0,
      paymentDay: 12,
    });
  });

  it('counts published materials and active sellers consistently for dashboard badges', () => {
    const sellers = buildAdminMarketplaceSellerMetrics({
      users: [
        { id: 'seller-1', role: 'partner', status: 'active' },
        { id: 'seller-2', role: 'partner', status: 'suspended' },
      ] as unknown as UserProfile[],
      materials: [
        { id: 'mat-1', authorId: 'seller-1', status: 'approved' },
        { id: 'mat-2', authorId: 'seller-2', status: 'draft' },
      ] as unknown as Material[],
      transactions: [],
    });

    expect(countActiveAdminMarketplaceSellers(sellers)).toBe(1);
    expect(countPublishedMarketplaceMaterials([
      { id: 'mat-1', status: 'approved' },
      { id: 'mat-2', status: 'pending' },
    ] as unknown as Material[])).toBe(1);
  });
});
