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
import { BrainCircuit } from 'lucide-react';
import { useData } from '@providers/DataProvider';

interface PublicBrandLinkProps {
  className?: string;
  iconSize?: number;
  iconClassName?: string;
  labelClassName?: string;
}

/**
 * Marca compartilhada das telas publicas com navegação canonica para a home.
 * Centraliza o nome configurado do site e evita headers estaticos divergentes.
 */
const PublicBrandLink: React.FC<PublicBrandLinkProps> = ({
  className = 'flex items-center gap-2 transition-opacity hover:opacity-90',
  iconSize = 28,
  iconClassName = '',
  labelClassName = 'tracking-tight font-black',
}) => {
  const { systemSettings } = useData();
  const siteName = systemSettings?.siteName || 'ConcursoMestre';

  return (
    <Link
      href="/"
      className={className}
      aria-label={`Ir para a home de ${siteName}`}
    >
      <BrainCircuit size={iconSize} className={iconClassName || undefined} />
      <span className={labelClassName}>{siteName}</span>
    </Link>
  );
};

export default PublicBrandLink;
