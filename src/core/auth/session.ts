const TOKEN_STORAGE_KEY = 'token';
const USER_STORAGE_KEY = 'user';
const SESSION_EXPIRY_SKEW_SECONDS = 30;

type JwtPayload = {
    exp?: number;
    [key: string]: unknown;
};

function decodeBase64Url(input: string): string | null {
    try {
        const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
        return atob(padded);
    } catch {
        return null;
    }
}

export function decodeJwtPayload(token: string): JwtPayload | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
        return null;
    }

    const payload = decodeBase64Url(parts[1]);
    if (!payload) {
        return null;
    }

    try {
        return JSON.parse(payload) as JwtPayload;
    } catch {
        return null;
    }
}

export function isJwtExpired(token: string, skewSeconds = SESSION_EXPIRY_SKEW_SECONDS): boolean {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) {
        return false;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    return nowInSeconds >= payload.exp - skewSeconds;
}

export function clearStoredSession(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
}

export function getStoredToken(): string | null {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
        return null;
    }

    if (isJwtExpired(token)) {
        clearStoredSession();
        return null;
    }

    return token;
}
