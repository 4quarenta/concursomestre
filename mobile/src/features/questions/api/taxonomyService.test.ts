import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/services/api/client', () => ({ apiClient: mocks }));

import { taxonomyService } from '@/features/questions/api/taxonomyService';

describe('taxonomy service practice catalog contract', () => {
  beforeEach(() => mocks.get.mockReset());

  it('requests the bounded published-practice catalog rather than every filter in the database', async () => {
    mocks.get.mockResolvedValue({
      success: true,
      data: {
        carreiras: [{ id: 18, nome: 'Área de teste' }],
        assuntos: [{ id: 5, nome: 'Direito Constitucional', materia: true, pai: null }],
      },
    });

    const result = await taxonomyService.list();

    expect(mocks.get).toHaveBeenCalledOnce();
    expect(mocks.get).toHaveBeenCalledWith('filtersList', {
      params: { scope: 'practice' },
    });
    expect(result.carreiras).toEqual([{ id: 18, nome: 'Área de teste', sigla: undefined, slug: undefined, pai: null, materia: false, taxonomyLevel: undefined }]);
    expect(result.materias).toHaveLength(1);
  });
});
