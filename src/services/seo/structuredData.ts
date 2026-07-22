/** Serializes JSON-LD without allowing a closing script tag in user-controlled text. */
export const serializeStructuredData = (value: unknown): string => (
  JSON.stringify(value).replace(/</g, '\\u003c')
);
