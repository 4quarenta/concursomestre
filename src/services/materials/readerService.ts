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

type ReaderRect = Record<string, unknown>;

type BookmarksResponse = {
  bookmarks?: MaterialBookmark[];
  bookmark?: MaterialBookmark;
  id?: number | string;
};

type HighlightsResponse = {
  highlights?: MaterialHighlight[];
  highlight?: MaterialHighlight;
};

type NoteResponse = {
  note?: MaterialNote;
};

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
  rects: ReaderRect[];
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
 * Centraliza notas, marcadores e destaques para o leitor não depender de
 * endpoints crus espalhados no componente.
 * @since 1.0.0
 */
export const readerService = {
  /**
   * Lista os marcadores salvos para um material.
   * @since 1.0.0
   */
  async getBookmarks(materialId: string, userId?: string): Promise<MaterialBookmark[]> {
    const response = await apiClient.get<BookmarksResponse>(ENDPOINTS.materials.getBookmarks, {
      params: {
        material_id: materialId,
        user_id: userId || undefined,
      },
    });

    const raw = assertApiSuccess(response, 'Erro ao carregar os marcadores.').raw;
    const payload = readApiData<BookmarksResponse>(response, {});
    return Array.isArray(payload.bookmarks)
      ? payload.bookmarks
      : Array.isArray(raw.bookmarks)
        ? raw.bookmarks as MaterialBookmark[]
        : [];
  },

  /**
   * Cria um novo marcador no reader oficial.
   * @since 1.0.0
   */
  async saveBookmark(materialId: string, pageNum: number, label: string, userId?: string): Promise<MaterialBookmark> {
    const response = await apiClient.post<BookmarksResponse>(ENDPOINTS.materials.saveBookmark, {
      user_id: userId,
      material_id: materialId,
      page_num: pageNum,
      label,
    });

    const raw = assertApiSuccess(response, 'Erro ao salvar o marcador.').raw;
    const payload = readApiData<BookmarksResponse>(response, {});
    return payload.bookmark ?? (raw.bookmark as MaterialBookmark | undefined) ?? {
      id: Number(raw.id || 0),
      page_num: pageNum,
      label,
      created_at: new Date().toISOString(),
    };
  },

  /**
   * Remove um marcador existente.
   * @since 1.0.0
   */
  async deleteBookmark(bookmarkId: number): Promise<void> {
    const response = await apiClient.delete(ENDPOINTS.materials.deleteBookmark, {
      params: { id: bookmarkId },
    });

    assertApiSuccess(response, 'Erro ao remover o marcador.');
  },

  /**
   * Lista destaques salvos do material aberto no reader.
   * @since 1.0.0
   */
  async getHighlights(materialId: string, userId?: string): Promise<MaterialHighlight[]> {
    const response = await apiClient.get<HighlightsResponse>(ENDPOINTS.materials.getHighlights, {
      params: {
        material_id: materialId,
        user_id: userId || undefined,
      },
    });

    const raw = assertApiSuccess(response, 'Erro ao carregar os destaques.').raw;
    const payload = readApiData<HighlightsResponse>(response, {});
    return Array.isArray(payload.highlights)
      ? payload.highlights
      : Array.isArray(raw.highlights)
        ? raw.highlights as MaterialHighlight[]
        : [];
  },

  /**
   * Persiste um novo destaque visual do PDF.
   * @since 1.0.0
   */
  async saveHighlight(
    materialId: string,
    data: Pick<MaterialHighlight, 'page_num' | 'color' | 'rects' | 'text' | 'type'>,
    userId?: string,
  ): Promise<MaterialHighlight> {
    const response = await apiClient.post<HighlightsResponse>(ENDPOINTS.materials.saveHighlight, {
      user_id: userId,
      material_id: materialId,
      page_num: data.page_num,
      color: data.color,
      rects: data.rects,
      text: data.text,
      type: data.type,
    });

    const raw = assertApiSuccess(response, 'Erro ao salvar o destaque.').raw;
    const payload = readApiData<HighlightsResponse>(response, {});
    return payload.highlight ?? (raw.highlight as MaterialHighlight);
  },

  /**
   * Remove um destaque salvo.
   * @since 1.0.0
   */
  async deleteHighlight(highlightId: number): Promise<void> {
    const response = await apiClient.delete(ENDPOINTS.materials.deleteHighlight, {
      params: { id: highlightId },
    });

    assertApiSuccess(response, 'Erro ao remover o destaque.');
  },

  /**
   * Busca a anotacao textual do usuário para o material atual.
   * @since 1.0.0
   */
  async getNote(materialId: string, userId?: string): Promise<MaterialNote | null> {
    const response = await apiClient.get<NoteResponse>(ENDPOINTS.materials.getNote, {
      params: {
        material_id: materialId,
        user_id: userId || undefined,
      },
    });

    const raw = assertApiSuccess(response, 'Erro ao carregar a anotacao.').raw;
    const payload = readApiData<NoteResponse>(response, {});
    return payload.note ?? (raw.note as MaterialNote | undefined) ?? null;
  },

  /**
   * Salva a anotacao textual do material no reader.
   * @since 1.0.0
   */
  async saveNote(materialId: string, noteText: string, userId?: string): Promise<MaterialNote> {
    const response = await apiClient.post<NoteResponse>(ENDPOINTS.materials.saveNote, {
      user_id: userId,
      material_id: materialId,
      note_text: noteText,
    });

    const raw = assertApiSuccess(response, 'Erro ao salvar a anotacao.').raw;
    const payload = readApiData<NoteResponse>(response, {});
    return payload.note ?? (raw.note as MaterialNote | undefined) ?? {
      note_text: noteText,
      updated_at: new Date().toISOString(),
    };
  },
};

export default readerService;
