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

import { cache } from 'react';
import type { Plan } from '@types';
import { ENDPOINTS } from '@services/api/endpoints';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';

const readEnv = (key: string): string => String(process.env[key] || '').trim();

const resolvePlanRows = (payload: unknown): Plan[] => {
  if (!payload || typeof payload !== 'object') return [];
  const envelope = payload as Record<string, unknown>;
  const data = Object.prototype.hasOwnProperty.call(envelope, 'data') ? envelope.data : payload;
  if (Array.isArray(data)) return data as Plan[];
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: Plan[] }).items;
  }
  return [];
};

const fetchPublicPlanCatalog = async (): Promise<Plan[]> => {
  try {
    const apiBaseUrl = resolveAbsoluteApiBaseUrl(
      readEnv('NEXT_PUBLIC_API_BASE_URL') || readEnv('API_BASE_URL') || undefined,
    );
    const response = await fetch(new URL(ENDPOINTS.plans.list, apiBaseUrl), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });
    if (!response.ok) return [];
    return resolvePlanRows(await response.json());
  } catch {
    return [];
  }
};

export const fetchPublicPlanCatalogForServer = cache(fetchPublicPlanCatalog);
export const fetchPublicPlanCatalogForServerTest = fetchPublicPlanCatalog;
