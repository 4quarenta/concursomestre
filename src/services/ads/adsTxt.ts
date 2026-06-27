export interface AdsTxtInvalidLine {
  lineNumber: number;
  value: string;
}

export interface AdsTxtValidationResult {
  content: string;
  invalidLines: AdsTxtInvalidLine[];
}

const ADS_TXT_RELATIONSHIPS = new Set(['DIRECT', 'RESELLER']);
const ADS_TXT_VARIABLE_PATTERN = /^(CONTACT|INVENTORYPARTNERDOMAIN|MANAGERDOMAIN|OWNERDOMAIN)\s*=\s*\S+$/i;
const ADS_TXT_DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/i;
const ADS_TXT_ACCOUNT_PATTERN = /^[^\s,]{1,160}$/;
const ADS_TXT_CERTIFICATION_AUTHORITY_PATTERN = /^[a-z0-9]{8,64}$/i;

const isValidAdsTxtRecord = (line: string): boolean => {
  if (line.startsWith('#') || ADS_TXT_VARIABLE_PATTERN.test(line)) {
    return true;
  }

  const fields = line.split(',').map((field) => field.trim());
  if (fields.length < 3 || fields.length > 4) {
    return false;
  }

  const [advertisingSystem, accountId, relationship, certificationAuthorityId] = fields;

  return ADS_TXT_DOMAIN_PATTERN.test(advertisingSystem)
    && ADS_TXT_ACCOUNT_PATTERN.test(accountId)
    && ADS_TXT_RELATIONSHIPS.has(relationship.toUpperCase())
    && (
      certificationAuthorityId === undefined
      || ADS_TXT_CERTIFICATION_AUTHORITY_PATTERN.test(certificationAuthorityId)
    );
};

export const validateAdsTxtContent = (value: unknown): AdsTxtValidationResult => {
  const source = String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/\0/g, '')
    .replace(/\r\n?/g, '\n')
    .slice(0, 20_000);
  const validLines: string[] = [];
  const invalidLines: AdsTxtInvalidLine[] = [];

  source.split('\n').forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    if (isValidAdsTxtRecord(line)) {
      validLines.push(line);
      return;
    }

    invalidLines.push({
      lineNumber: index + 1,
      value: line,
    });
  });

  return {
    content: validLines.length > 0 ? `${validLines.join('\n')}\n` : '',
    invalidLines,
  };
};

export const buildGoogleAdsTxtFallback = (adsenseClientId: unknown): string => {
  const normalizedClientId = String(adsenseClientId || '').trim();
  const match = /^ca-(pub-\d{8,32})$/i.exec(normalizedClientId);

  return match
    ? `google.com, ${match[1].toLowerCase()}, DIRECT, f08c47fec0942fa0\n`
    : '';
};
