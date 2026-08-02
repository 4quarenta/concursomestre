const DEFAULT_MAX_PAGES_PER_REQUEST = 4;
const DEFAULT_MAX_APPROXIMATE_BYTES = 8 * 1024 * 1024;

type GranTaxonomyPage = Record<string, unknown>;

const approximateJsonBytes = (value: GranTaxonomyPage): number => {
  try {
    // UTF-16 length * 2 is deliberately conservative for these JSON payloads.
    return JSON.stringify(value).length * 2;
  } catch {
    return DEFAULT_MAX_APPROXIMATE_BYTES;
  }
};

export const splitGranTaxonomyResponses = (
  responses: GranTaxonomyPage[],
  maxPages = DEFAULT_MAX_PAGES_PER_REQUEST,
  maxApproximateBytes = DEFAULT_MAX_APPROXIMATE_BYTES,
): GranTaxonomyPage[][] => {
  const pageLimit = Math.max(1, Math.floor(maxPages));
  const byteLimit = Math.max(1, Math.floor(maxApproximateBytes));
  const batches: GranTaxonomyPage[][] = [];
  let currentBatch: GranTaxonomyPage[] = [];
  let currentBytes = 0;

  for (const response of responses) {
    const responseBytes = approximateJsonBytes(response);
    if (
      currentBatch.length > 0
      && (currentBatch.length >= pageLimit || currentBytes + responseBytes > byteLimit)
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBytes = 0;
    }

    currentBatch.push(response);
    currentBytes += responseBytes;
  }

  if (currentBatch.length > 0) batches.push(currentBatch);
  return batches;
};

