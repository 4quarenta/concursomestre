import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('authoritative payment status wiring', () => {
  it('does not infer payment warnings from the global session DTO', () => {
    const routeFrame = readSource('src/providers/NextRouteFrame.tsx');
    const layout = readSource('src/components/shared/layout/Layout.tsx');

    expect(routeFrame).not.toContain('resolveUserPaymentIssue');
    expect(routeFrame).toContain('shouldLoadPaymentStatusForPath');
    expect(routeFrame).toContain('resolvePaymentStatusIssue(paymentStatus)');
    expect(layout).not.toContain('resolveUserPaymentIssue');
    expect(layout).not.toContain('GlobalPaymentIssueBanner');
  });
});
