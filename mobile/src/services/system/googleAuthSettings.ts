export const normalizeGoogleAuthClientId = (payload: Record<string, unknown>): string | undefined => {
  const authentication = payload.authentication && typeof payload.authentication === 'object'
    ? payload.authentication as Record<string, unknown>
    : {};
  const google = authentication.google && typeof authentication.google === 'object'
    ? authentication.google as Record<string, unknown>
    : {};
  const clientId = String(google.clientId ?? payload.googleAuthClientId ?? '').trim();

  return clientId || undefined;
};
