import { describe, expect, it } from 'vitest';
import { evaluateSeoRuntimeEnvironment, getTrustedRequestOrigin } from './runtimeEnvironment';

describe('SEO runtime request origin', () => {
  it('uses the HTTPS origin supplied by the trusted reverse proxy', () => {
    const request = new Request('http://127.0.0.1:3000/', {
      headers: {
        host: 'concursomestre.com',
        'x-forwarded-proto': 'https',
      },
    });
    const requestOrigin = getTrustedRequestOrigin(request);

    expect(requestOrigin).toBe('https://concursomestre.com');
    expect(evaluateSeoRuntimeEnvironment({
      launchMode: 'PRODUCTION',
      configuredOrigin: 'https://concursomestre.com',
      requestOrigin,
      deploymentEnvironment: 'PRODUCTION',
      indexActivation: 'CONFIRMED',
      sitemapActivation: 'CONFIRMED',
      vercelEnvironment: '',
    }).sitemapPublicationAllowed).toBe(true);
  });

  it('fails closed for a non-canonical host or invalid forwarded protocol', () => {
    const wrongHost = new Request('http://127.0.0.1:3000/', {
      headers: { host: 'attacker.example', 'x-forwarded-proto': 'https' },
    });
    const wrongProtocol = new Request('http://127.0.0.1:3000/', {
      headers: { host: 'concursomestre.com', 'x-forwarded-proto': 'javascript' },
    });

    expect(getTrustedRequestOrigin(wrongHost)).toBe('https://attacker.example');
    expect(getTrustedRequestOrigin(wrongProtocol)).toBe('http://127.0.0.1:3000');
    expect(evaluateSeoRuntimeEnvironment({
      launchMode: 'PRODUCTION',
      configuredOrigin: 'https://concursomestre.com',
      requestOrigin: getTrustedRequestOrigin(wrongHost),
      deploymentEnvironment: 'PRODUCTION',
      indexActivation: 'CONFIRMED',
      sitemapActivation: 'CONFIRMED',
      vercelEnvironment: '',
    }).runtimeIndexingAllowed).toBe(false);
  });
});
