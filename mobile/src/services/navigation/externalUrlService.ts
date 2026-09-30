const OFFICIAL_HOSTS = new Set([
  "concursomestre.com",
  "www.concursomestre.com",
]);

const TRUSTED_EXTERNAL_HOSTS = new Set([
  "checkout.stripe.com",
  "billing.stripe.com",
  "www.planalto.gov.br",
]);

const isAllowedHost = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return OFFICIAL_HOSTS.has(normalized) || TRUSTED_EXTERNAL_HOSTS.has(normalized);
};

export const assertAllowedExternalUrl = (
  value: string,
  purpose = "link",
): string => {
  const candidate = String(value || "").trim();

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`Não foi possível abrir este ${purpose}.`);
  }

  if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
    throw new Error(`Este ${purpose} não pertence a um domínio autorizado.`);
  }

  return parsed.toString();
};
