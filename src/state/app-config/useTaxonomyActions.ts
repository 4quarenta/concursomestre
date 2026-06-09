'use client';

import { useCallback } from 'react';
import { filtersService } from '@services/filters';
import { useAppConfigStore } from './appConfigStore';
import { mergeSystemSettings } from './systemSettings';

let taxonomyLoadPromise: Promise<void> | null = null;
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

  const ensureTaxonomiesLoaded = useCallback(async (force = false) => {
    const snapshot = useAppConfigStore.getState().systemSettings;
    if (!force && hasTaxonomyPayload(snapshot.taxonomies)) {
      return;
    }

    if (taxonomyLoadPromise && !force) {
      return taxonomyLoadPromise;
    }

    taxonomyLoadPromise = (async () => {
      const taxonomies = await withTaxonomyLoadTimeout(filtersService.listTaxonomies());
      const latestSettings = useAppConfigStore.getState().systemSettings;
      replaceSystemSettings(mergeSystemSettings(latestSettings, { taxonomies }));
    })().finally(() => {
      taxonomyLoadPromise = null;
    });

    return taxonomyLoadPromise;
  }, [replaceSystemSettings]);

  return {
    ensureTaxonomiesLoaded,
  };
};

export default useTaxonomyActions;
