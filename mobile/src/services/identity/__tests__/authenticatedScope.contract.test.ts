import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('@/services/api/client', () => ({ apiClient: mocks }));
vi.mock('@/api/client', () => ({ apiClient: mocks }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: mocks.getItem,
    setItem: mocks.setItem,
    removeItem: mocks.removeItem,
  },
}));

import { reportsService } from '@/services/reports/reportsService';
import { transactionsService } from '@/services/transactions/transactionsService';

describe('authenticated scope transport contract', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.getItem.mockReset();
    mocks.setItem.mockReset();
    mocks.removeItem.mockReset();
    mocks.getItem.mockResolvedValue(null);
  });

  it('creates reports without a client-controlled reporter id', async () => {
    mocks.post.mockResolvedValue({ success: true, data: { id: 'report-1' } });

    await reportsService.createReport({
      reporterId: 'client-user',
      targetType: 'question',
      targetId: 101,
      reason: 'wrong_answer',
    });

    expect(mocks.post).toHaveBeenCalledWith('reportsCreate', expect.not.objectContaining({
      reporter_id: expect.anything(),
    }));
  });

  it('lists transactions without a client-controlled user id', async () => {
    mocks.get.mockResolvedValue({ success: true, data: { rows: [] } });

    await transactionsService.list({ userId: 'client-user', page: 1, limit: 20 });

    expect(mocks.get).toHaveBeenCalledWith('transactionsList', {
      params: { page: 1, limit: 20 },
    });
  });
});
