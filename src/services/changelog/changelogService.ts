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

import { apiClient, ENDPOINTS, readApiData } from '@services/api';

export type ChangelogCategory = {
  title: string;
  icon: string;
  items: string[];
};

export type ChangelogVersion = {
  id: number;
  version: string;
  release_date: string;
  title: string;
  description: string;
  content_json: ChangelogCategory[];
};

/**
 * Centraliza a leitura do changelog publico da plataforma.
 */
export const changelogService = {
  /**
   * Lista as versoes publicadas ordenadas pelo backend.
   */
  async listVersions(): Promise<ChangelogVersion[]> {
    const response = await apiClient.get<any>(ENDPOINTS.changelog.list) as any;
    const payload = readApiData<any>(response, []);

    if (Array.isArray(payload)) {
      return payload as ChangelogVersion[];
    }

    if (Array.isArray(payload?.versions)) {
      return payload.versions as ChangelogVersion[];
    }

    return [];
  },
};

export default changelogService;
