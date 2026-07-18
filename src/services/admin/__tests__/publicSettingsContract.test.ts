import { describe, expect, it } from 'vitest';

import { adaptPublicSystemSettings } from '../publicSettingsContract';

describe('public settings contract adapter', () => {
  it('adapts the versioned domain contract only at the frontend boundary', () => {
    const settings = adaptPublicSystemSettings({
      contractVersion: 'public-settings.v1',
      branding: { appName: 'ConcursoMestre' },
      features: { practiceEnabled: true },
      commerce: { paymentProvider: 'stripe' },
      authentication: {
        recaptcha: { enabled: true, siteKey: 'site-key' },
        google: { clientId: 'google-client-id' },
        facebook: {},
        apple: {},
      },
    });

    expect(settings).toMatchObject({
      appName: 'ConcursoMestre',
      paymentProvider: 'stripe',
      recaptchaEnabled: true,
      recaptchaSiteKey: 'site-key',
      googleAuthClientId: 'google-client-id',
      hasGoogleAuthClientConfigured: true,
      hasFacebookAuthConfigured: false,
    });
  });

  it('keeps temporary compatibility with internal settings outside the API contract', () => {
    const legacy = { paymentProvider: 'stripe' } as const;
    expect(adaptPublicSystemSettings(legacy)).toEqual(legacy);
  });
});
