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

interface PlatformMetadataProviderProps {
  children: React.ReactNode;
}

/**
 * Compatibility boundary for consumers that still import the platform provider.
 * Metadata is authoritative on the server and is never mutated here.
 * @since 1.0.0
 */
export const PlatformMetadataProvider: React.FC<PlatformMetadataProviderProps> = ({ children }) => {
  return <>{children}</>;
};

export default PlatformMetadataProvider;
