import { describe, expect, it } from 'vitest';
import { shouldLoadMarketplaceTransactionsForPath } from '../marketplaceRouting';

describe('marketplace transaction routing', () => {
  it('leaves profile billing history to the profile query', () => {
    expect(shouldLoadMarketplaceTransactionsForPath('/profile')).toBe(false);
    expect(shouldLoadMarketplaceTransactionsForPath('/profile/billing')).toBe(false);
    expect(shouldLoadMarketplaceTransactionsForPath('/profile/billing-history')).toBe(false);
  });

  it('keeps marketplace and finance transaction consumers enabled', () => {
    expect(shouldLoadMarketplaceTransactionsForPath('/marketplace')).toBe(true);
    expect(shouldLoadMarketplaceTransactionsForPath('/admin/finance/transactions')).toBe(true);
    expect(shouldLoadMarketplaceTransactionsForPath('/partner-dashboard')).toBe(true);
  });
});

