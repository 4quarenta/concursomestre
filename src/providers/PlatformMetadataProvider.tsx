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
import { applyWebsiteMetadata, websiteManifest } from '../config/platform';

interface PlatformMetadataProviderProps {
  children: React.ReactNode;
}

/**
 * Provider de bootstrap da identidade publica da plataforma.
 * Ele aplica no documento web o manifesto oficial antes que o restante da UI navegue entre as rotas.
 * @since 1.0.0
 */
export const PlatformMetadataProvider: React.FC<PlatformMetadataProviderProps> = ({ children }) => {
  /**
   * Aplica os metadados publicos do canal web uma vez por montagem.
   * Esse efeito garante que site, manifesto e branding nascam coerentes em toda navegacao.
   * @since 1.0.0
   */
  React.useEffect(() => {
    applyWebsiteMetadata(websiteManifest);
  }, []);

  return <>{children}</>;
};

export default PlatformMetadataProvider;
