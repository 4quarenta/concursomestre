'use client';

import { useEffect } from 'react';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';

const ADSENSE_META_NAME = 'google-adsense-account';

const normalizeAdsenseAccountId = (value?: string | null): string => {
  const normalized = String(value || '').trim();
  return /^ca-pub-\d{8,32}$/i.test(normalized) ? normalized : '';
};

const AdsenseVerificationMeta = () => {
  const adsenseClientId = useAppConfigStore((state) => state.systemSettings.adsenseClientId);

  useEffect(() => {
    const accountId = normalizeAdsenseAccountId(adsenseClientId);
    const selector = `meta[name="${ADSENSE_META_NAME}"]`;
    const currentMeta = document.head.querySelector<HTMLMetaElement>(selector);

    if (!accountId) {
      currentMeta?.remove();
      return;
    }

    const meta = currentMeta || document.createElement('meta');
    meta.setAttribute('name', ADSENSE_META_NAME);
    meta.setAttribute('content', accountId);

    if (!currentMeta) {
      document.head.appendChild(meta);
    }
  }, [adsenseClientId]);

  return null;
};

export default AdsenseVerificationMeta;
