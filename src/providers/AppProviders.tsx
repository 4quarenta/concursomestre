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
import { ToastProvider } from './ToastProvider';
import { AuthProvider } from './AuthProvider';
import { ModalProvider } from './ModalProvider';
import { DataProvider } from './DataProvider';
import { MarketplaceProvider } from './MarketplaceProvider';
import { PlatformMetadataProvider } from './PlatformMetadataProvider';
import { ThemeProvider } from './ThemeProvider';

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Centraliza a composicao dos providers globais do app.
 * Isso reduz acoplamento na entrada da aplicacao e deixa mais claro
 * quais camadas de contexto sustentam a UI inteira.
 * @since 1.0.0
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <PlatformMetadataProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ModalProvider>
              <DataProvider>
                <MarketplaceProvider>{children}</MarketplaceProvider>
              </DataProvider>
            </ModalProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </PlatformMetadataProvider>
  );
};
