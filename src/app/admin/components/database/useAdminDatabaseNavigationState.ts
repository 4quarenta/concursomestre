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

import { useEffect, useState } from 'react';
import { ADMIN_DATABASE_SUBTAB_META } from './adminDatabaseNavigationConfig';

type AdminDatabaseSubTab =
  | 'questions'
  | 'exams'
  | 'users'
  | 'materials'
  | 'rankings'
  | 'import'
  | 'reports'
  | 'blocked'
  | 'filters'
  | 'lei-comentada';

type AdminDatabaseCategory = 'content' | 'people';

interface UseAdminDatabaseNavigationStateOptions {
  initialTab?: AdminDatabaseSubTab;
  searchTab?: string | null;
  locationHash?: string;
}

const VALID_SUBTABS: AdminDatabaseSubTab[] = [
  'questions',
  'exams',
  'users',
  'materials',
  'rankings',
  'import',
  'reports',
  'blocked',
  'filters',
  'lei-comentada',
];

const getCategoryFromSubTab = (subTab: string): AdminDatabaseCategory => {
  return (ADMIN_DATABASE_SUBTAB_META[subTab]?.category as AdminDatabaseCategory) || 'content';
};

export const useAdminDatabaseNavigationState = ({
  initialTab = 'questions',
  searchTab,
  locationHash,
}: UseAdminDatabaseNavigationStateOptions) => {
  const [activeSubTab, setActiveSubTab] = useState<AdminDatabaseSubTab>(initialTab);
  const [activeCategory, setActiveCategory] = useState<AdminDatabaseCategory>(getCategoryFromSubTab(initialTab));
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const nextTab = searchTab && VALID_SUBTABS.includes(searchTab as AdminDatabaseSubTab) ? (searchTab as AdminDatabaseSubTab) : initialTab;
    setActiveSubTab(nextTab);
    setActiveCategory(getCategoryFromSubTab(nextTab));
  }, [initialTab, searchTab]);

  useEffect(() => {
    if (!locationHash) return;

    const id = locationHash.replace('#', '');
    const timeoutId = window.setTimeout(() => {
      const element = document.getElementById(id);
      if (!element) return;

      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('bg-indigo-50', 'ring-2', 'ring-indigo-500');
      window.setTimeout(() => {
        element.classList.remove('bg-indigo-50', 'ring-2', 'ring-indigo-500');
      }, 3000);
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [locationHash, activeSubTab]);

  const handleSelectCategory = (categoryId: string, firstTab: string) => {
    setActiveCategory(categoryId as AdminDatabaseCategory);
    setActiveSubTab(firstTab as AdminDatabaseSubTab);
  };

  const handleSelectSubTab = (subTab: string) => {
    setActiveSubTab(subTab as AdminDatabaseSubTab);
    setActiveCategory(getCategoryFromSubTab(subTab));
  };

  return {
    activeSubTab,
    activeCategory,
    filter,
    setFilter,
    handleSelectCategory,
    handleSelectSubTab,
  };
};
