'use client';

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

type UserAvatarProps = {
  name?: string | null;
  src?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  children?: React.ReactNode;
};

export const getAvatarInitials = (name?: string | null): string => {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return 'U';
  }

  const initials = parts.length === 1
    ? parts[0].slice(0, 2)
    : `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`;

  return initials.toLocaleUpperCase('pt-BR');
};

const UserAvatar = ({
  name,
  src,
  alt,
  className = '',
  imageClassName = 'absolute inset-0 h-full w-full object-cover',
  fallbackClassName = '',
  children,
}: UserAvatarProps) => {
  const normalizedSrc = String(src || '').trim();
  const [failedSrc, setFailedSrc] = React.useState('');
  const shouldRenderImage = normalizedSrc !== '' && failedSrc !== normalizedSrc;
  const accessibleLabel = alt || (name ? `Foto de perfil de ${name}` : 'Foto de perfil');

  return (
    <span className={`relative inline-flex items-center justify-center overflow-hidden ${className}`.trim()}>
      {shouldRenderImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={normalizedSrc}
          alt={accessibleLabel}
          className={imageClassName}
          onError={() => setFailedSrc(normalizedSrc)}
        />
      ) : (
        <span className={fallbackClassName} aria-label={`${accessibleLabel} indisponível`}>
          {getAvatarInitials(name)}
        </span>
      )}
      {children}
    </span>
  );
};

export default React.memo(UserAvatar);
