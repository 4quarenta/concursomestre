'use client';

import React from 'react';

/**
 * Remove a camada HTML progressiva somente depois que a aplicação interativa
 * estiver hidratada. Sem JavaScript, o conteúdo público permanece legível.
 */
export default function ClientHydrationMarker() {
  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      document.documentElement.dataset.clientReady = 'true';
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return null;
}
