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

export interface FiltersApiPayload {
  bancas?: Record<string, any>[];
  orgaos?: Record<string, any>[];
  assuntos?: Record<string, any>[];
  cargos?: Record<string, any>[];
  anos?: Array<string | number>;
  carreiras?: Record<string, any>[];
}

export interface FilterSavePayload {
  id?: number;
  type: string;
  name: string;
  slug?: string;
  parent_id?: number | null;
  description?: string;
  website?: string;
  metadata?: Record<string, any>;
}

/**
 * Converte o payload bruto da API para o formato de taxonomias usado no app.
 */
export const normalizeFiltersToTaxonomies = (data: FiltersApiPayload) => ({
  agencies: data.bancas?.map((b: any) => ({
    id: b.id,
    name: b.nome || b.name,
    sigla: b.sigla,
    slug: b.slug,
    description: b.description,
    website: b.website,
    type: 'agency',
  })) || [],
  organizations: data.orgaos?.map((o: any) => ({
    id: o.id,
    name: o.nome || o.name,
    sigla: o.sigla,
    slug: o.slug,
    description: o.description,
    website: o.website,
    type: 'organization',
  })) || [],
  subjects: data.assuntos?.filter((a: any) => a.materia).map((a: any) => ({
    id: a.id,
    name: a.nome || a.name,
    slug: a.slug,
    description: a.description,
    website: a.website,
    materia: true,
    type: 'subject',
  })) || [],
  topics: data.assuntos?.filter((a: any) => !a.materia).map((a: any) => ({
    id: a.id,
    name: a.nome || a.name,
    slug: a.slug,
    description: a.description,
    website: a.website,
    parentId: a.pai || a.parent_id,
    materia: false,
    type: 'topic',
  })) || [],
  roles: data.cargos?.map((c: any) => ({
    id: c.id,
    name: c.descrição || c.name,
    slug: c.slug,
    description: c.description,
    website: c.website,
    parentId: c.pai || c.parent_id,
    type: 'role',
  })) || [],
  careers: data.carreiras?.map((c: any) => ({
    id: c.id,
    name: c.nome || c.name,
    slug: c.slug,
    description: c.description,
    website: c.website,
    parentId: c.pai || c.parent_id,
    type: 'career',
  })) || [],
  years: data.anos?.map(String) || [],
  modalities: ['Múltipla Escolha', 'Certo/Errado'],
});

export const filtersService = {
  async list(): Promise<FiltersApiPayload> {
    const response = await apiClient.get<any>(ENDPOINTS.filters.list) as any;
    return readApiData(response, {});
  },

  async listTaxonomies() {
    const payload = await this.list();
    return normalizeFiltersToTaxonomies(payload);
  },

  async save(payload: FilterSavePayload): Promise<number> {
    const response = await apiClient.post<any>(ENDPOINTS.filters.save, payload) as any;
    const raw = assertApiSuccess(response, 'Erro ao salvar filtro').raw;

    return raw?.data?.id ?? raw?.id ?? 0;
  },

  async remove(id: number): Promise<void> {
    const response = await apiClient.get<any>(ENDPOINTS.filters.delete, { params: { id: id.toString() } }) as any;
    assertApiSuccess(response, 'Erro ao deletar filtro');
  },
};

export default filtersService;
