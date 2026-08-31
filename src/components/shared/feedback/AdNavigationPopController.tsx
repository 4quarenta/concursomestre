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

import React from 'react';
import { useAuth } from '@providers/AuthProvider';
import { maybeOpenNavigationPop } from '@services/ads/adService';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';

const findAnchorElement = (target: EventTarget | null): HTMLAnchorElement | null => {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest('a[href]');
};

const AdNavigationPopController: React.FC = () => {
  const { currentUser } = useAuth();
  const systemSettings = useAppConfigStore((state) => state.systemSettings);

  React.useEffect(() => {
    if (
      !systemSettings.adsEnabled
      || systemSettings.adPlacementNavigationPopEnabled !== true
    ) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = findAnchorElement(event.target);
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) {
        return;
      }

      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      maybeOpenNavigationPop(currentUser, systemSettings);
    };

    document.addEventListener('click', handleDocumentClick, { capture: true });

    return () => {
      document.removeEventListener('click', handleDocumentClick, { capture: true });
    };
  }, [currentUser, systemSettings]);

  return null;
};

export default AdNavigationPopController;
