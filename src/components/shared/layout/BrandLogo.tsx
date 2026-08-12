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
import Image from 'next/image';
import { useTheme } from '@providers/ThemeProvider';

type BrandLogoSurface = 'theme' | 'light' | 'dark';
type BrandLogoVariant = 'standard' | 'full' | 'adaptive';

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  width?: number;
  priority?: boolean;
  alt?: string;
  surface?: BrandLogoSurface;
  variant?: BrandLogoVariant;
}

const STANDARD_LIGHT_SURFACE_LOGO_SRC = '/branding/logo-dark.png';
const STANDARD_DARK_SURFACE_LOGO_SRC = '/branding/logo-light.png';
const FULL_LIGHT_SURFACE_LOGO_SRC = '/branding/logo-full-dark.png';
const FULL_DARK_SURFACE_LOGO_SRC = '/branding/logo-full-light.png';
const BRAND_LOGO_ASPECT_RATIO = 650 / 180;

const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  imageClassName = '',
  width = 220,
  priority = false,
  alt = 'ConcursoMestre',
  surface = 'theme',
  variant = 'standard',
}) => {
  const { theme } = useTheme();
  const height = Math.max(24, Math.round(width / BRAND_LOGO_ASPECT_RATIO));
  const effectiveSurface = surface === 'theme'
    ? (theme === 'dark' ? 'dark' : 'light')
    : surface;
  const effectiveVariant = variant === 'adaptive'
    ? 'standard'
    : variant;
  const src = effectiveVariant === 'full'
    ? (effectiveSurface === 'dark' ? FULL_DARK_SURFACE_LOGO_SRC : FULL_LIGHT_SURFACE_LOGO_SRC)
    : (effectiveSurface === 'dark' ? STANDARD_DARK_SURFACE_LOGO_SRC : STANDARD_LIGHT_SURFACE_LOGO_SRC);
  const sharedProps = {
    alt,
    width,
    height,
    priority,
    className: `block h-auto w-full max-w-full ${imageClassName}`.trim(),
  };

  if (surface === 'theme') {
    const lightSurfaceSrc = effectiveVariant === 'full'
      ? FULL_LIGHT_SURFACE_LOGO_SRC
      : STANDARD_LIGHT_SURFACE_LOGO_SRC;
    const darkSurfaceSrc = effectiveVariant === 'full'
      ? FULL_DARK_SURFACE_LOGO_SRC
      : STANDARD_DARK_SURFACE_LOGO_SRC;

    return (
      <span
        className={`inline-flex shrink-0 items-center ${className}`.trim()}
        style={{ width }}
        aria-hidden={alt ? undefined : true}
      >
        <Image
          src={lightSurfaceSrc}
          alt={sharedProps.alt}
          width={sharedProps.width}
          height={sharedProps.height}
          priority={priority}
          unoptimized
          className={`${sharedProps.className} dark:hidden`.trim()}
        />
        <Image
          src={darkSurfaceSrc}
          alt={sharedProps.alt}
          width={sharedProps.width}
          height={sharedProps.height}
          priority={priority}
          unoptimized
          className={`${sharedProps.className} hidden dark:block`.trim()}
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center ${className}`.trim()}
      style={{ width }}
      aria-hidden={alt ? undefined : true}
    >
      <Image
        src={src}
        alt={sharedProps.alt}
        width={sharedProps.width}
        height={sharedProps.height}
        priority={priority}
        unoptimized
        className={sharedProps.className}
      />
    </span>
  );
};

export default BrandLogo;
