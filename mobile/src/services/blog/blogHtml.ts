const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Prefer the sanitized HTML supplied by the blog API; safely format plain text as fallback. */
export const toBlogArticleHtml = (
  bodyHtml?: string | null,
  bodyText?: string | null,
): string => {
  const html = bodyHtml?.trim();
  if (html) return html;

  const text = bodyText?.trim();
  if (!text) return "";

  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
};
