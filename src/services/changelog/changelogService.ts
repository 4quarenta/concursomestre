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

type ChangelogListPayload = {
  versions?: ChangelogVersion[];
};

/**
 * Centraliza a leitura do changelog público da plataforma.
 * @since 1.0.0
 */
export const changelogService = {
  /**
   * Lista as versoes publicadas ordenadas pelo backend.
   * @since 1.0.0
   */
  async listVersions(): Promise<ChangelogVersion[]> {
    const response = await apiClient.get(ENDPOINTS.changelog.list) as unknown;
    const payload = readApiData<ChangelogVersion[] | ChangelogListPayload>(response, []);

    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.versions)) {
      return payload.versions;
    }

    return [];
  },
};

export default changelogService;
