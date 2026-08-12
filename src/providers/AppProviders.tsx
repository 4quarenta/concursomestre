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
import { PlatformMetadataProvider } from './PlatformMetadataProvider';
import { ThemeProvider } from './ThemeProvider';
import { SetupGate } from './SetupGate';
import AdNavigationPopController from '@/components/shared/feedback/AdNavigationPopController';

interface AppProvidersProps {
  children: React.ReactNode;
  initialPublicSettings?: Record<string, unknown> | null;
}

/**
 * Centraliza a composicao dos providers globais do app.
 * Isso reduz acoplamento na entrada da aplicação e deixa mais claro
 * quais camadas de contexto sustentam a UI inteira.
 * @since 1.0.0
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children, initialPublicSettings = null }) => {
  return (
    <PlatformMetadataProvider>
      <ThemeProvider>
        <QueryProvider>
          <ToastProvider>
            <SetupGate>
              <AuthProvider>
                <AppConfigProvider initialPublicSettings={initialPublicSettings}>
                  <AdNavigationPopController />
                  <ModalProvider>
                    <NotificationsProvider>{children}</NotificationsProvider>
                  </ModalProvider>
                </AppConfigProvider>
              </AuthProvider>
            </SetupGate>
          </ToastProvider>
        </QueryProvider>
      </ThemeProvider>
    </PlatformMetadataProvider>
  );
};
