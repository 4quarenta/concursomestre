import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('mobile API contract', () => {
  it('keeps native refresh credentials in SecureStore and rotates them single-flight', () => {
    const store = read('mobile/src/services/auth/sessionStore.ts');
    const client = read('mobile/src/services/api/client.ts');

    expect(store).toContain('REFRESH_TOKEN_KEY');
    expect(store).toContain('CSRF_TOKEN_KEY');
    expect(store).toContain('SecureStore.setItemAsync');
    expect(client).toContain('let refreshPromise');
    expect(client).toContain('await sessionStore.clearSession();');
    expect(client).toContain("'X-Client-Platform': 'concursomestre-mobile'");
    expect(client).not.toContain("'http://localhost/questao-pro-backend/api/'");
  });

  it('uses the idempotent v2 answer boundary and supports server-side 2FA', () => {
    const endpoints = read('mobile/src/services/api/endpoints.ts');
    const questions = read('mobile/src/services/questions/questionService.ts');
    const provider = read('mobile/src/providers/AuthProvider.tsx');

    expect(endpoints).toContain("submit: 'v2/questions/answer.php'");
    expect(questions).toContain('idempotencyKey');
    expect(questions).toContain('selectedAlternativeId');
    expect(questions).toContain('Math.min(50, pageSize)');
    expect(questions).not.toContain('while (allRows.length < total)');
    expect(provider).toContain('verifyTwoFactor');
  });

  it('keeps browser CSRF and native refresh as separate server contracts', () => {
    const routes = read('backend/modules/auth/routes.php');
    const session = read('backend/shared/auth/AuthSession.php');

    expect(routes).toContain("'concursomestre-mobile'");
    expect(routes).toContain('readNativeMobileAuthCredentials');
    expect(session).toContain('refreshAccessTokenFromCookie');
    expect(session).toContain('refreshNativeAccessToken');
    expect(session).toContain('assertValidCsrfToken');
  });
});
