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

import { useState } from 'react';

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: string;
  direction: SortDirection;
}

const getNestedValue = (obj: unknown, path: string): unknown => {
  return path.split('.').reduce<unknown>((accumulator, part) => {
    if (!accumulator || typeof accumulator !== 'object') {
      return undefined;
    }

    return (accumulator as Record<string, unknown>)[part];
  }, obj);
};

const toComparableValue = (value: unknown): string | number => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase();
  }

  return value === null || value === undefined ? '' : String(value).toLowerCase();
};

export const useAdminTableSorting = () => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortData = <T,>(data: T[]) => {
    if (!data || !sortConfig) return data || [];

    return [...data].sort((a, b) => {
      const aVal = toComparableValue(getNestedValue(a, sortConfig.key));
      const bVal = toComparableValue(getNestedValue(b, sortConfig.key));

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  return {
    sortConfig,
    requestSort,
    sortData,
  };
};
