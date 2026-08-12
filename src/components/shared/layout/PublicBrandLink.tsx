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

'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@providers/AuthProvider';
import BrandLogo from './BrandLogo';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';

interface PublicBrandLinkProps {
  className?: string;
  width?: number;
  priority?: boolean;
  surface?: 'theme' | 'light' | 'dark';
  variant?: 'standard' | 'full' | 'adaptive';
}

/**
 * Marca compartilhada das telas publicas com navegação canonica para a home.
 * Centraliza o nome configurado do site e evita headers estaticos divergentes.
 */
const PublicBrandLink: React.FC<PublicBrandLinkProps> = ({
  className = 'inline-flex items-center transition-opacity hover:opacity-90',
  width = 220,
  priority = false,
  surface = 'theme',
  variant = 'adaptive',
}) => {
  const { currentUser } = useAuth();
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const siteName = systemSettings?.siteName || 'ConcursoMestre';
  const targetHref = currentUser ? '/dashboard' : '/';

  return (
    <Link
      href={targetHref}
      prefetch={false}
      className={className}
      aria-label={`Ir para ${currentUser ? 'o dashboard' : 'a home'} de ${siteName}`}
    >
      <BrandLogo width={width} priority={priority} surface={surface} variant={variant} alt="" />
      <span className="sr-only">{siteName}</span>
    </Link>
  );
};

export default PublicBrandLink;
