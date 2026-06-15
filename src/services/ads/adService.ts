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

import type { SystemSettings, UserProfile } from '@types';
import {
  getAccessPlanName,
  getPlanUsageLimitForPlanName,
  hasPlanBenefit,
} from '@services/plans/planAccess';

const GPT_SCRIPT_ID = 'google-publisher-tag-loader';
const GPT_SCRIPT_SRC = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
const OFFICIAL_TEST_INTERSTITIAL_AD_UNIT = '/6355419/Travel/Europe/France/Paris';
const ANSWER_INTERSTITIAL_COUNTER_KEY = 'cm:ads:answer-interstitial-count';
const NAVIGATION_POP_LAST_SHOWN_KEY = 'cm:ads:navigation-pop:last-shown';
const NAVIGATION_POP_MIN_INTERVAL_MS = 10 * 60 * 1000;

type GoogletagSlotLike = {
  addService?: (service: unknown) => GoogletagSlotLike;
  setConfig?: (config: unknown) => GoogletagSlotLike;
};

type GoogletagLike = {
  cmd: Array<() => void>;
  enums?: {
    OutOfPageFormat?: {
      INTERSTITIAL?: string;
    };
  };
  defineOutOfPageSlot?: (adUnitPath: string, format?: string) => GoogletagSlotLike | null;
  pubads?: () => {
    enableSingleRequest?: () => void;
  };
  enableServices?: () => void;
  display?: (slot: GoogletagSlotLike) => void;
  destroySlots?: (slots?: GoogletagSlotLike[]) => boolean;
};

declare global {
  interface Window {
    googletag?: GoogletagLike;
  }
}

const getStorageNumber = (key: string): number => {
  if (typeof window === 'undefined') {
    return 0;
  }

  const value = Number(window.localStorage.getItem(key) || 0);
  return Number.isFinite(value) ? value : 0;
};

const setStorageNumber = (key: string, value: number): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Publicidade nao deve bloquear o fluxo principal do aluno.
  }
};

const resolveAnswerInterstitialCounterKey = (user?: UserProfile | null) => (
  `${ANSWER_INTERSTITIAL_COUNTER_KEY}:${user?.id || 'guest'}`
);

export const loadGooglePublisherTag = (): Promise<GoogletagLike | null> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  window.googletag = window.googletag || { cmd: [] };

  const existingScript = document.getElementById(GPT_SCRIPT_ID)
    || document.querySelector(`script[src="${GPT_SCRIPT_SRC}"]`);

  if (existingScript) {
    return Promise.resolve(window.googletag);
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.id = GPT_SCRIPT_ID;
    script.src = GPT_SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve(window.googletag || null), { once: true });
    script.addEventListener('error', () => resolve(null), { once: true });
    document.head.appendChild(script);
  });
};

const canDisplayAds = (user: UserProfile | null | undefined, settings: SystemSettings): boolean => (
  settings.adsEnabled === true
  && !hasPlanBenefit(user, 'no_ads', settings.planEntitlements)
);

const hasAnyPlanBenefit = (
  user: UserProfile | null | undefined,
  settings: SystemSettings,
  benefitKeys: Array<Parameters<typeof hasPlanBenefit>[1]>,
): boolean => benefitKeys.some((benefitKey) => hasPlanBenefit(user, benefitKey, settings.planEntitlements));

const getAnswerInterstitialInterval = (
  user: UserProfile | null | undefined,
  settings: SystemSettings,
): number => {
  const planName = getAccessPlanName(user);
  const configuredInterval = getPlanUsageLimitForPlanName(
    planName,
    'ad_interstitial_answer_interval',
    settings.planUsageLimits,
  );

  return Math.max(0, Number(configuredInterval || 0));
};

export const maybeShowQuestionAnswerInterstitial = async (
  user: UserProfile | null | undefined,
  settings: SystemSettings,
): Promise<boolean> => {
  if (
    !canDisplayAds(user, settings)
    || settings.adPlacementInterstitialEnabled === false
    || !hasAnyPlanBenefit(user, settings, ['ads.web_interstitial', 'ads.between_questions'])
  ) {
    return false;
  }

  const interval = getAnswerInterstitialInterval(user, settings);
  if (interval <= 0) {
    return false;
  }

  const counterKey = resolveAnswerInterstitialCounterKey(user);
  const nextCount = getStorageNumber(counterKey) + 1;
  setStorageNumber(counterKey, nextCount);

  if (nextCount % interval !== 0) {
    return false;
  }

  const googletag = await loadGooglePublisherTag();
  if (!googletag?.cmd) {
    return false;
  }

  const adUnitPath = settings.adsenseTestMode === true
    ? OFFICIAL_TEST_INTERSTITIAL_AD_UNIT
    : String(settings.adInterstitialSlotId || '').trim() || OFFICIAL_TEST_INTERSTITIAL_AD_UNIT;

  return new Promise((resolve) => {
    googletag.cmd.push(() => {
      const outOfPageFormat = googletag.enums?.OutOfPageFormat?.INTERSTITIAL;
      const slot = googletag.defineOutOfPageSlot?.(adUnitPath, outOfPageFormat);
      const pubadsService = googletag.pubads?.();

      if (!slot || !pubadsService) {
        resolve(false);
        return;
      }

      try {
        slot
          .addService?.(pubadsService)
          ?.setConfig?.({
            interstitial: {
              triggers: {
                navBar: false,
                unhideWindow: false,
              },
            },
          });
        pubadsService.enableSingleRequest?.();
        googletag.enableServices?.();
        googletag.display?.(slot);
        resolve(true);
      } catch {
        resolve(false);
      }
    });
  });
};

export const maybeOpenNavigationPop = (
  user: UserProfile | null | undefined,
  settings: SystemSettings,
): boolean => {
  if (
    !canDisplayAds(user, settings)
    || settings.adPlacementNavigationPopEnabled !== true
    || !hasPlanBenefit(user, 'ads.navigation_pop', settings.planEntitlements)
  ) {
    return false;
  }

  const targetUrl = String(settings.adNavigationPopUrl || '').trim();
  if (!targetUrl) {
    return false;
  }

  const lastShownAt = getStorageNumber(NAVIGATION_POP_LAST_SHOWN_KEY);
  if (Date.now() - lastShownAt < NAVIGATION_POP_MIN_INTERVAL_MS) {
    return false;
  }

  setStorageNumber(NAVIGATION_POP_LAST_SHOWN_KEY, Date.now());

  const popup = window.open(targetUrl, '_blank', 'noopener,noreferrer,width=420,height=680');
  if (popup) {
    try {
      window.focus();
      popup.blur();
    } catch {
      // Alguns navegadores bloqueiam comportamento de popunder.
    }
  }

  return Boolean(popup);
};
