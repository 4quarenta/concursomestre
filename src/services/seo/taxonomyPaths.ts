type BoardPathValue = {
  slug?: unknown;
  sigla?: unknown;
  acronym?: unknown;
  nome?: unknown;
  name?: unknown;
  label?: unknown;
} | null | undefined;

export const buildBoardPath = (board: BoardPathValue): string => {
  const slug = String(board?.slug || '').trim();
  if (slug) return `/bancas/${encodeURIComponent(slug)}`;

  const label = String(
    board?.sigla || board?.acronym || board?.nome || board?.name || board?.label || '',
  ).trim();
  return label ? `/bancas?busca=${encodeURIComponent(label)}` : '/bancas';
};
