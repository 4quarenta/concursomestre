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

const getNextApiBaseUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost/questao-pro-backend/api/';
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
};

/**
 * Utilitario de fetch server-side para uso pelo SSR/SSG do App Router.
 * Ele nao envia cookies/tokens, servindo apenas endpoints de escopo publico.
 */
export async function serverFetch<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getNextApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint.substring(1) : endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Trata formato padrao do backend (payload.data ou response direto).
  if (data?.success !== false && data?.data) {
    return data.data as T;
  }
  
  return data as T;
}

export async function safeServerFetch<T = unknown>(
  endpoint: string,
  fallback: T,
  options: RequestInit = {},
): Promise<T> {
  try {
    return await serverFetch<T>(endpoint, options);
  } catch {
    return fallback;
  }
}
