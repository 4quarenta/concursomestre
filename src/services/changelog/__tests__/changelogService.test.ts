import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('@services/api', () => ({
  apiClient: { get: mockGet },
  assertApiSuccess: vi.fn(),
  readApiData: (response: { data?: unknown } | null | undefined, fallback: unknown) => response?.data ?? fallback,
  ENDPOINTS: {
    changelog: {
      list: 'changelog/list.php',
      adminList: 'changelog/admin/list.php',
      adminDetail: 'changelog/admin/detail.php',
      adminSave: 'changelog/admin/save.php',
      adminArchive: 'changelog/admin/archive.php',
      adminSuggestions: 'changelog/admin/suggestions.php',
    },
  },
}));

import { changelogService } from '../changelogService';

describe('changelogService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the canonical public novidades page', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        items: [{
          id: 1,
          version: '1.0.0',
          slug: 'primeira-versao',
          releaseDate: '2026-04-02',
          publishedAt: '2026-04-02 12:00:00',
          title: 'Primeira versão',
          description: 'Descrição',
          content: [],
          status: 'published',
        }],
        pageInfo: { page: 1, limit: 8, total: 1, totalPages: 1, hasMore: false },
      },
    });

    const page = await changelogService.list({ page: 1 });

    expect(mockGet).toHaveBeenCalledWith('changelog/list.php', { params: { page: 1 } });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.version).toBe('1.0.0');
  });

  it('removes private development content before public rendering', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 2,
            version: '1.1.0',
            slug: 'melhorias-publicas',
            releaseDate: '2026-06-10',
            publishedAt: '2026-06-10 12:00:00',
            title: 'Melhorias públicas',
            description: 'Atualização visível ao aluno.',
            status: 'published',
            content: [
              { title: 'Experiência', icon: 'BookOpen', items: ['Novo painel de estudo.', '[dev] Ajuste interno.'] },
              { title: '(dev) Infraestrutura', icon: 'Shield', items: ['Item interno.'] },
            ],
          },
          {
            id: 3,
            version: '1.1.1-dev',
            slug: 'release-interna',
            releaseDate: '2026-06-11',
            publishedAt: '2026-06-11 12:00:00',
            title: 'Release interna',
            description: 'Não deve aparecer.',
            status: 'published',
            content: [],
          },
        ],
        pageInfo: { page: 1, limit: 8, total: 2, totalPages: 1, hasMore: false },
      },
    });

    const page = await changelogService.list();
    const publicRelease = page.items.find((entry) => entry.version === '1.1.0');

    expect(page.items.some((entry) => entry.version === '1.1.1-dev')).toBe(false);
    expect(publicRelease?.content).toHaveLength(1);
    expect(publicRelease?.content[0]?.items).toEqual(['Novo painel de estudo.']);
  });

  it('preserves the server-defined platform version on user suggestions', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        items: [{
          id: 17,
          title: 'Adicionar um novo filtro',
          details: 'Sugestao enviada pelo aluno.',
          supportStatus: 'new',
          status: 'pending',
          platformVersion: '1.4.2',
          adminNote: null,
          changelogId: null,
          changelogTitle: null,
          likes: 0,
          dislikes: 0,
          createdAt: '2026-08-11 15:00:00',
          updatedAt: '2026-08-11 15:00:00',
          reviewedAt: null,
          user: { id: 'user-1', name: 'Aluno', email: 'aluno@example.com' },
        }],
        pageInfo: { page: 1, limit: 10, total: 1, totalPages: 1, hasMore: false },
      },
    });

    const page = await changelogService.listSuggestions({ page: 1, limit: 10 });

    expect(mockGet).toHaveBeenCalledWith('changelog/admin/suggestions.php', {
      params: { page: 1, limit: 10 },
    });
    expect(page.items[0]?.platformVersion).toBe('1.4.2');
  });
});
