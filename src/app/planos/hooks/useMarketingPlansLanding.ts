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

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { adminService } from '@services/admin/adminService';
import { planService } from '@services/plans';
import {
  getMarketingLandingPreviewById,
  getPublishedMarketingLandingBySlug,
  mergeMarketingLandingPages,
  normalizeLandingSlug,
} from '@services/marketing/landingPages';
import { websiteManifest } from '../../../config/platform';
import type { MarketingLandingPage, Plan } from '@types';

interface UseMarketingPlansLandingOptions {
  slug: string;
}

const ADMIN_PREVIEW_ROLES = new Set(['admin', 'staff']);

/**
 * Resolve a landing comercial publicada ou em preview sem acoplar regra de fetch ao page shell.
 * O preview usa o endpoint oficial de settings apenas quando existe `?preview=` e o usuario possui papel administrativo.
 *
 * @since v1.0.0
 */
export const useMarketingPlansLanding = ({ slug }: UseMarketingPlansLandingOptions) => {
  const { currentUser } = useAuth();
  const { systemSettings, isSystemSettingsLoaded } = useData();
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [previewPages, setPreviewPages] = useState<MarketingLandingPage[] | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  const queryParams = useMemo(() => new URLSearchParams(searchParams?.toString()), [searchParams]);
  const previewId = String(queryParams.get('preview') || '').trim();
  const siteName = systemSettings.siteName || websiteManifest.website.applicationName || 'ConcursoMestre';
  const normalizedSlug = normalizeLandingSlug(slug);
  const canAccessPreview = ADMIN_PREVIEW_ROLES.has(String(currentUser?.role || '').toLowerCase());

  useEffect(() => {
    let active = true;

    planService.getPlans()
      .then((catalog) => {
        if (active) {
          setPlans(Array.isArray(catalog) ? catalog : []);
        }
      })
      .finally(() => {
        if (active) {
          setPlansLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!previewId || !canAccessPreview) {
      setPreviewPages(null);
      setPreviewLoaded(!previewId);
      return;
    }

    let active = true;
    setPreviewLoaded(false);

    adminService.getSystemSettings()
      .then((settings) => {
        if (!active) {
          return;
        }

        setPreviewPages(mergeMarketingLandingPages(settings.landingPages, settings.siteName || siteName));
      })
      .catch(() => {
        if (active) {
          setPreviewPages(null);
        }
      })
      .finally(() => {
        if (active) {
          setPreviewLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [canAccessPreview, previewId, siteName]);

  const publicPages = useMemo(
    () => mergeMarketingLandingPages(systemSettings.landingPages, siteName),
    [siteName, systemSettings.landingPages],
  );

  const previewLanding = useMemo(
    () => getMarketingLandingPreviewById(previewPages || [], previewId),
    [previewId, previewPages],
  );

  const publishedLanding = useMemo(
    () => getPublishedMarketingLandingBySlug(publicPages, normalizedSlug),
    [normalizedSlug, publicPages],
  );

  const landing = previewLanding || publishedLanding;
  const isPreviewMode = Boolean(previewLanding && previewId);
  const loading = !isSystemSettingsLoaded || !plansLoaded || (Boolean(previewId) && canAccessPreview && !previewLoaded);

  return {
    siteName,
    plans,
    systemSettings,
    landing,
    loading,
    isPreviewMode,
    previewRequested: Boolean(previewId),
    canAccessPreview,
  };
};

export default useMarketingPlansLanding;
