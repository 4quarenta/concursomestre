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

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPost, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    delete: mockDelete,
  },
  ENDPOINTS: {
    materials: {
      getBookmarks: 'materials/get_bookmarks.php',
      saveBookmark: 'materials/save_bookmark.php',
      deleteBookmark: 'materials/delete_bookmark.php',
      getHighlights: 'materials/get_highlights.php',
      saveHighlight: 'materials/save_highlight.php',
      deleteHighlight: 'materials/delete_highlight.php',
      getNote: 'materials/get_note.php',
      saveNote: 'materials/save_note.php',
    },
  },
  readApiData: (response: any, fallback: any) => {
    if (response?.data !== undefined) return response.data;
    return response ?? fallback;
  },
  assertApiSuccess: (response: any, fallbackMessage: string) => {
    if (!response?.success) {
      throw new Error(response?.message || response?.error || fallbackMessage);
    }

    return {
      success: true,
      message: response?.message,
      data: response?.data,
      raw: response,
    };
  },
}));

import { readerService } from '../readerService';

describe('readerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads bookmarks through the official facade', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        bookmarks: [{ id: 1, page_num: 3, label: 'Resumo', created_at: '2026-04-03T00:00:00Z' }],
      },
    });

    const result = await readerService.getBookmarks('mat-1', 'usr-1');

    expect(mockGet).toHaveBeenCalledWith('materials/get_bookmarks.php', {
      params: { material_id: 'mat-1', user_id: 'usr-1' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].page_num).toBe(3);
  });

  it('saves bookmarks through the official facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        bookmark: { id: 7, page_num: 8, label: 'Capitulo 2', created_at: '2026-04-03T01:00:00Z' },
      },
    });

    const result = await readerService.saveBookmark('mat-1', 8, 'Capitulo 2', 'usr-1');

    expect(mockPost).toHaveBeenCalledWith('materials/save_bookmark.php', {
      user_id: 'usr-1',
      material_id: 'mat-1',
      page_num: 8,
      label: 'Capitulo 2',
    });
    expect(result.id).toBe(7);
  });

  it('deletes bookmarks through the official facade', async () => {
    mockDelete.mockResolvedValueOnce({ success: true });

    await readerService.deleteBookmark(9);

    expect(mockDelete).toHaveBeenCalledWith('materials/delete_bookmark.php', {
      params: { id: 9 },
    });
  });

  it('loads note through the official facade', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        note: { note_text: 'Revisar depois', updated_at: '2026-04-03T02:00:00Z' },
      },
    });

    const result = await readerService.getNote('mat-1', 'usr-1');

    expect(mockGet).toHaveBeenCalledWith('materials/get_note.php', {
      params: { material_id: 'mat-1', user_id: 'usr-1' },
    });
    expect(result?.note_text).toBe('Revisar depois');
  });

  it('saves note through the official facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        note: { note_text: 'Nova nota', updated_at: '2026-04-03T03:00:00Z' },
      },
    });

    const result = await readerService.saveNote('mat-1', 'Nova nota', 'usr-1');

    expect(mockPost).toHaveBeenCalledWith('materials/save_note.php', {
      user_id: 'usr-1',
      material_id: 'mat-1',
      note_text: 'Nova nota',
    });
    expect(result.note_text).toBe('Nova nota');
  });
});
