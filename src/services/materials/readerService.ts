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

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';

export type MaterialBookmark = {
  id: number;
  page_num: number;
  label: string;
  created_at: string;
};

export type MaterialHighlight = {
  id: number;
  page_num: number;
  color: string;
  rects: any[];
  text: string;
  type: string;
  created_at: string;
};

export type MaterialNote = {
  note_text: string;
  updated_at?: string;
};

/**
 * Fachada oficial do estado de leitura de materiais em PDF.
 * Centraliza notas, marcadores e destaques para o leitor nao depender de
 * endpoints crus espalhados no componente.
 */
export const readerService = {
  async getBookmarks(materialId: string, userId?: string): Promise<MaterialBookmark[]> {
    const response = await apiClient.get<any>(ENDPOINTS.materials.getBookmarks, {
      params: {
        material_id: materialId,
        user_id: userId || undefined,
      },
    });

    const raw = assertApiSuccess(response, 'Erro ao carregar os marcadores.').raw;
    const payload = readApiData<any>(raw, {});
    return Array.isArray(payload?.bookmarks)
      ? payload.bookmarks
      : Array.isArray(raw?.bookmarks)
        ? raw.bookmarks
        : [];
  },

  async saveBookmark(materialId: string, pageNum: number, label: string, userId?: string): Promise<MaterialBookmark> {
    const response = await apiClient.post<any>(ENDPOINTS.materials.saveBookmark, {
      user_id: userId,
      material_id: materialId,
      page_num: pageNum,
      label,
    });

    const raw = assertApiSuccess(response, 'Erro ao salvar o marcador.').raw;
    const payload = readApiData<any>(raw, {});
    return payload?.bookmark ?? raw?.bookmark ?? {
      id: Number(raw?.id || 0),
      page_num: pageNum,
      label,
      created_at: new Date().toISOString(),
    };
  },

  async deleteBookmark(bookmarkId: number): Promise<void> {
    const response = await apiClient.delete<any>(ENDPOINTS.materials.deleteBookmark, {
      params: { id: bookmarkId },
    });

    assertApiSuccess(response, 'Erro ao remover o marcador.');
  },

  async getHighlights(materialId: string, userId?: string): Promise<MaterialHighlight[]> {
    const response = await apiClient.get<any>(ENDPOINTS.materials.getHighlights, {
      params: {
        material_id: materialId,
        user_id: userId || undefined,
      },
    });

    const raw = assertApiSuccess(response, 'Erro ao carregar os destaques.').raw;
    const payload = readApiData<any>(raw, {});
    return Array.isArray(payload?.highlights)
      ? payload.highlights
      : Array.isArray(raw?.highlights)
        ? raw.highlights
        : [];
  },

  async saveHighlight(
    materialId: string,
    data: Pick<MaterialHighlight, 'page_num' | 'color' | 'rects' | 'text' | 'type'>,
    userId?: string,
  ): Promise<MaterialHighlight> {
    const response = await apiClient.post<any>(ENDPOINTS.materials.saveHighlight, {
      user_id: userId,
      material_id: materialId,
      page_num: data.page_num,
      color: data.color,
      rects: data.rects,
      text: data.text,
      type: data.type,
    });

    const raw = assertApiSuccess(response, 'Erro ao salvar o destaque.').raw;
    const payload = readApiData<any>(raw, {});
    return payload?.highlight ?? raw?.highlight;
  },

  async deleteHighlight(highlightId: number): Promise<void> {
    const response = await apiClient.delete<any>(ENDPOINTS.materials.deleteHighlight, {
      params: { id: highlightId },
    });

    assertApiSuccess(response, 'Erro ao remover o destaque.');
  },

  async getNote(materialId: string, userId?: string): Promise<MaterialNote | null> {
    const response = await apiClient.get<any>(ENDPOINTS.materials.getNote, {
      params: {
        material_id: materialId,
        user_id: userId || undefined,
      },
    });

    const raw = assertApiSuccess(response, 'Erro ao carregar a anotacao.').raw;
    const payload = readApiData<any>(raw, {});
    return payload?.note ?? raw?.note ?? null;
  },

  async saveNote(materialId: string, noteText: string, userId?: string): Promise<MaterialNote> {
    const response = await apiClient.post<any>(ENDPOINTS.materials.saveNote, {
      user_id: userId,
      material_id: materialId,
      note_text: noteText,
    });

    const raw = assertApiSuccess(response, 'Erro ao salvar a anotacao.').raw;
    const payload = readApiData<any>(raw, {});
    return payload?.note ?? raw?.note ?? {
      note_text: noteText,
      updated_at: new Date().toISOString(),
    };
  },
};

export default readerService;
