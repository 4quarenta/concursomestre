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

import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import type { ChangelogVersion } from '@/types/changelog';

/**
 * Normaliza a resposta do endpoint de changelog aceitando array direto
 * ou wrapper { versions: [...] }, alinhado ao contrato do backend.
 * @since v1.0.0
 */
const normalizeVersions = (payload: unknown): ChangelogVersion[] => {
  if (Array.isArray(payload)) return payload as ChangelogVersion[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as any).versions)) {
    return (payload as any).versions as ChangelogVersion[];
  }
  if (payload && typeof payload === 'object' && Array.isArray((payload as any).data)) {
    return (payload as any).data as ChangelogVersion[];
  }
  return [];
};

/**
 * Fachada mobile do módulo Changelog.
 * Consome o endpoint público de versões e normaliza a resposta.
 * Usado exclusivamente pela ChangelogScreen.
 * @since v1.0.0
 */
export const changelogService = {
  /**
   * Retorna a lista de versões publicadas ordenadas pelo backend.
   * Retorna array vazio em caso de erro ou payload inesperado.
   * @since v1.0.0
   */
  async listVersions(): Promise<ChangelogVersion[]> {
    try {
      const response = await apiClient.get<unknown>(ENDPOINTS.changelog.list);
      return normalizeVersions(response);
    } catch {
      return [];
    }
  },
};

export default changelogService;
