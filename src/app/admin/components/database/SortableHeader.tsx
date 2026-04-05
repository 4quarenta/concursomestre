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

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  sortConfig: SortConfig | null;
  onRequestSort: (key: string) => void;
  className?: string;
}

const SortableHeader = ({
  label,
  sortKey,
  sortConfig,
  onRequestSort,
  className = '',
}: SortableHeaderProps) => {
  const isActive = sortConfig?.key === sortKey;

  return (
    <th
      className={`group cursor-pointer p-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/80 ${className}`}
      onClick={() => onRequestSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <div className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100">
          <ChevronUp size={10} className={isActive && sortConfig?.direction === 'asc' ? 'text-indigo-600' : 'text-slate-300'} />
          <ChevronDown size={10} className={isActive && sortConfig?.direction === 'desc' ? 'text-indigo-600' : 'text-slate-300'} />
        </div>
        {isActive ? (
          <div className="ml-auto">
            {sortConfig?.direction === 'asc' ? <ChevronUp size={12} className="text-indigo-600" /> : <ChevronDown size={12} className="text-indigo-600" />}
          </div>
        ) : null}
      </div>
    </th>
  );
};

export default SortableHeader;
