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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicPlanCatalogForServerTest } from '../plansServerData';

describe('Plans server data', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps the public plan catalog without a second entity projection', async () => {
    const plans = [{ id: 1, name: 'Plano Publico', price: 0 }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { items: plans } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPublicPlanCatalogForServerTest()).resolves.toEqual(plans);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: { Accept: 'application/json' },
        next: { revalidate: 300 },
      }),
    );
  });

  it('fails closed to an empty public catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(fetchPublicPlanCatalogForServerTest()).resolves.toEqual([]);
  });
});
