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
const BRAND_LOGO_ASPECT_RATIO = 662 / 137;

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

  return (
    <span
      className={`inline-flex shrink-0 items-center ${className}`.trim()}
      style={{ width }}
      aria-hidden={alt ? undefined : true}
    >
      <img
        src={src}
        alt={sharedProps.alt}
        width={sharedProps.width}
        height={sharedProps.height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={sharedProps.className}
      />
    </span>
  );
};

export default BrandLogo;
