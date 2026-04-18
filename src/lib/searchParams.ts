export type RouteSearchParams = Record<string, string | string[] | undefined>;

export const readFirstSearchParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

export const appendSearchParamsToPath = (
  pathname: string,
  searchParams: RouteSearchParams,
) => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
      continue;
    }

    query.append(key, value);
  }

  const queryString = query.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
};
