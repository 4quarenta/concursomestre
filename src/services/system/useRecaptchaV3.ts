import { useCallback, useEffect, useMemo, useState } from 'react';

type GrecaptchaLike = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: GrecaptchaLike;
    __cmRecaptchaLoaderPromise?: Promise<void>;
  }
}

const RECAPTCHA_SCRIPT_ID = 'cm-recaptcha-v3-script';
const RECAPTCHA_SCRIPT_BASE_URL = 'https://www.google.com/recaptcha/api.js';

const readRecaptchaErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
};

const buildRecaptchaScriptUrl = (siteKey: string) => {
  const params = new URLSearchParams({
    render: siteKey,
    trustedtypes: 'true',
  });

  return `${RECAPTCHA_SCRIPT_BASE_URL}?${params.toString()}`;
};

const waitForRecaptchaReady = (): Promise<void> => new Promise((resolve, reject) => {
  if (typeof window === 'undefined' || !window.grecaptcha) {
    reject(new Error('reCAPTCHA v3 indisponivel no navegador.'));
    return;
  }

  let settled = false;
  const timeoutId = window.setTimeout(() => {
    if (settled) {
      return;
    }

    settled = true;
    reject(new Error('O carregamento do reCAPTCHA v3 excedeu o tempo limite.'));
  }, 10000);

  window.grecaptcha.ready(() => {
    if (settled) {
      return;
    }

    settled = true;
    window.clearTimeout(timeoutId);
    resolve();
  });
});

const ensureRecaptchaScript = async (siteKey: string): Promise<void> => {
  if (typeof window === 'undefined') {
    return;
  }

  const existingScript = document.getElementById(RECAPTCHA_SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript && window.grecaptcha) {
    await waitForRecaptchaReady();
    return;
  }

  if (!window.__cmRecaptchaLoaderPromise) {
    window.__cmRecaptchaLoaderPromise = new Promise<void>((resolve, reject) => {
      const script = existingScript ?? document.createElement('script');
      script.id = RECAPTCHA_SCRIPT_ID;
      script.async = true;
      script.defer = true;
      script.src = buildRecaptchaScriptUrl(siteKey);
      script.dataset.siteKey = siteKey;

      script.onload = () => {
        waitForRecaptchaReady().then(resolve).catch(reject);
      };

      script.onerror = () => {
        reject(new Error('Nao foi possivel carregar o script do reCAPTCHA v3.'));
      };

      if (!existingScript) {
        document.head.appendChild(script);
      }
    }).catch((error: unknown) => {
      window.__cmRecaptchaLoaderPromise = undefined;
      throw error;
    });
  }

  await window.__cmRecaptchaLoaderPromise;
};

type UseRecaptchaV3Options = {
  enabled: boolean;
  siteKey?: string | null;
};

type UseRecaptchaV3Result = {
  isReady: boolean;
  loadError: string | null;
  executeRecaptcha: (action: string) => Promise<string | null>;
};

export const useRecaptchaV3 = ({ enabled, siteKey }: UseRecaptchaV3Options): UseRecaptchaV3Result => {
  const normalizedSiteKey = useMemo(() => (siteKey || '').trim(), [siteKey]);
  const [loadState, setLoadState] = useState<{
    isReady: boolean;
    loadError: string | null;
  }>({
    isReady: false,
    loadError: null,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!normalizedSiteKey) {
      return;
    }

    let active = true;
    const frameId = window.requestAnimationFrame(() => {
      if (!active) {
        return;
      }

      setLoadState({
        isReady: false,
        loadError: null,
      });
    });

    void ensureRecaptchaScript(normalizedSiteKey)
      .then(() => {
        if (!active) {
          return;
        }

        setLoadState({
          isReady: true,
          loadError: null,
        });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setLoadState({
          isReady: false,
          loadError: readRecaptchaErrorMessage(error, 'Nao foi possivel inicializar o reCAPTCHA v3.'),
        });
      });

    return () => {
      active = false;
      window.cancelAnimationFrame(frameId);
    };
  }, [enabled, normalizedSiteKey]);

  const executeRecaptcha = useCallback(async (action: string) => {
    if (!enabled) {
      return null;
    }

    if (!normalizedSiteKey) {
      throw new Error('reCAPTCHA v3 nao configurado.');
    }

    await ensureRecaptchaScript(normalizedSiteKey);

    if (!window.grecaptcha) {
      throw new Error('reCAPTCHA v3 indisponivel no navegador.');
    }

    const token = await window.grecaptcha.execute(normalizedSiteKey, { action });
    if (!token) {
      throw new Error('Nao foi possivel gerar o token de seguranca do reCAPTCHA v3.');
    }

    return token;
  }, [enabled, normalizedSiteKey]);

  return {
    isReady: !enabled ? true : normalizedSiteKey ? loadState.isReady : false,
    loadError: !enabled
      ? null
      : normalizedSiteKey
        ? loadState.loadError
        : 'Configure a site key do reCAPTCHA v3 para liberar a autenticacao.',
    executeRecaptcha,
  };
};

export default useRecaptchaV3;
