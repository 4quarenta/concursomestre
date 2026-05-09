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
import { QueryProvider } from './QueryProvider';
import { ToastProvider } from './ToastProvider';
import { AuthProvider } from './AuthProvider';
import { AppConfigProvider } from './AppConfigProvider';
import { ModalProvider } from './ModalProvider';
import { NotificationsProvider } from './NotificationsProvider';
import { MarketplaceProvider } from './MarketplaceProvider';
import { PlatformMetadataProvider } from './PlatformMetadataProvider';
import { ThemeProvider } from './ThemeProvider';

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * Centraliza a composicao dos providers globais do app.
 * Isso reduz acoplamento na entrada da aplicação e deixa mais claro
 * quais camadas de contexto sustentam a UI inteira.
 * @since 1.0.0
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <PlatformMetadataProvider>
      <ThemeProvider>
        <QueryProvider>
          <ToastProvider>
            <AuthProvider>
              <AppConfigProvider>
                <ModalProvider>
                  <NotificationsProvider>
                    <MarketplaceProvider>{children}</MarketplaceProvider>
                  </NotificationsProvider>
                </ModalProvider>
              </AppConfigProvider>
            </AuthProvider>
          </ToastProvider>
        </QueryProvider>
      </ThemeProvider>
    </PlatformMetadataProvider>
  );
};
