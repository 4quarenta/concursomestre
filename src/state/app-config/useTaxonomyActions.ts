'use client';

import { useCallback } from 'react';
import { filtersService } from '@services/filters';
import { useAppConfigStore } from './appConfigStore';
import { mergeSystemSettings } from './systemSettings';

let taxonomyLoadPromise: Promise<void> | null = null;

const hasTaxonomyPayload = (taxonomies: unknown): boolean => {
  if (!taxonomies || typeof taxonomies !== 'object') {
    return false;
  }

  const record = taxonomies as Record<string, unknown>;
  return Object.values(record).some((value) => Array.isArray(value) && value.length > 0);
};

/**
 * Taxonomy actions bound to the app-config store.
 * It replaces DataProvider dependency for taxonomy loading.
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
      const taxonomies = await filtersService.listTaxonomies();
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
