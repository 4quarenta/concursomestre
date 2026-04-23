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
import Link from 'next/link';
import { useData } from '@providers/DataProvider';
import BrandLogo from './BrandLogo';

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
  const { systemSettings } = useData();
  const siteName = systemSettings?.siteName || 'ConcursoMestre';

  return (
    <Link
      href="/"
      className={className}
      aria-label={`Ir para a home de ${siteName}`}
    >
      <BrandLogo width={width} priority={priority} surface={surface} variant={variant} alt={siteName} />
      <span className="sr-only">{siteName}</span>
    </Link>
  );
};

export default PublicBrandLink;
