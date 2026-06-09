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

export type ProfileTab =
  | 'evolution'
  | 'notebook'
  | 'saved-questions'
  | 'favorite-laws'
  | 'materials'
  | 'personal'
  | 'testimonial'
  | 'support-history'
  | 'billing'
  | 'billing-history'
  | 'security'
  | 'referral';

const VALID_PROFILE_TABS: ProfileTab[] = [
  'evolution',
  'notebook',
  'saved-questions',
  'favorite-laws',
  'materials',
  'personal',
  'testimonial',
  'support-history',
  'billing',
  'billing-history',
  'security',
  'referral',
];

/**
 * Resolve a aba canônica do perfil com compatibilidade para estados legados.
 *
 * @since 1.0.0
 */
export const resolveProfileTab = (rawTab?: string | null): Exclude<ProfileTab, 'evolution'> => {
  const normalized = String(rawTab || '').trim().toLowerCase();

  if (normalized === 'evolution' || !normalized) {
    return 'personal';
  }

  return VALID_PROFILE_TABS.includes(normalized as ProfileTab)
    ? (normalized as Exclude<ProfileTab, 'evolution'>)
    : 'personal';
};

/**
 * Monta a rota canônica do perfil no formato `/profile/<tab>`.
 *
 * @since 1.0.0
 */
export const buildProfilePath = (tab?: string | null) => `/profile/${resolveProfileTab(tab)}`;
