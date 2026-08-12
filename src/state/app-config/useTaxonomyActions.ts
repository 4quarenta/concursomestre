'use client';

import { useCallback } from 'react';
import { filtersService } from '@services/filters';
import { useAppConfigStore } from './appConfigStore';
import { mergeSystemSettings } from './systemSettings';

type TaxonomyCatalogScope = 'full' | 'practice';

const taxonomyLoadPromises: Partial<Record<TaxonomyCatalogScope, Promise<void>>> = {};
let loadedTaxonomyScope: TaxonomyCatalogScope | null = null;
const TAXONOMY_LOAD_TIMEOUT_MS = 10000;

const hasTaxonomyPayload = (taxonomies: unknown): boolean => {
  if (!taxonomies || typeof taxonomies !== 'object') {
    return false;
  }

  const record = taxonomies as Record<string, unknown>;
  return Object.values(record).some((value) => Array.isArray(value) && value.length > 0);
};

const withTaxonomyLoadTimeout = async <T,>(promise: Promise<T>): Promise<T> => (
  new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error('Tempo excedido ao carregar taxonomias.'));
    }, TAXONOMY_LOAD_TIMEOUT_MS);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => globalThis.clearTimeout(timeoutId));
  })
);

/**
 * Taxonomy actions bound to the app-config store.
 * It lazily hydrates taxonomy data used by filters, editors and profile flows.
 *
 * @since 1.0.0
 */
export const useTaxonomyActions = () => {
  const replaceSystemSettings = useAppConfigStore((store) => store.replaceSystemSettings);

  const ensureTaxonomiesLoaded = useCallback(async (
    force = false,
    scope: TaxonomyCatalogScope = 'full',
  ) => {
    const snapshot = useAppConfigStore.getState().systemSettings;
    const scopeAlreadyLoaded = loadedTaxonomyScope === 'full' || loadedTaxonomyScope === scope;
    if (!force && scopeAlreadyLoaded && hasTaxonomyPayload(snapshot.taxonomies)) {
      return;
    }

    if (taxonomyLoadPromises[scope] && !force) {
      return taxonomyLoadPromises[scope];
    }

    taxonomyLoadPromises[scope] = (async () => {
      const taxonomies = await withTaxonomyLoadTimeout(
        scope === 'practice'
          ? filtersService.listPracticeTaxonomies(force)
          : filtersService.listTaxonomies(force),
      );
      const latestSettings = useAppConfigStore.getState().systemSettings;
      replaceSystemSettings(mergeSystemSettings(latestSettings, { taxonomies }));
      loadedTaxonomyScope = scope;
    })().finally(() => {
      delete taxonomyLoadPromises[scope];
    });

    return taxonomyLoadPromises[scope];
  }, [replaceSystemSettings]);

  return {
    ensureTaxonomiesLoaded,
  };
};

export default useTaxonomyActions;
