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
import { useRouter } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import ConfirmModal from '../overlays/ConfirmModal';

interface LogoutTriggerRenderProps {
  isLoggingOut: boolean;
  openConfirm: () => void;
}

interface LogoutConfirmButtonProps {
  children: (props: LogoutTriggerRenderProps) => React.ReactNode;
  title?: string;
  description?: string;
}

const LogoutConfirmButton: React.FC<LogoutConfirmButtonProps> = ({
  children,
  title = 'Confirmar sa\u00EDda',
  description = 'Tem certeza que deseja sair da sua conta agora?',
}) => {
  const { logout } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const closeConfirm = React.useCallback(() => {
    if (isLoggingOut) {
      return;
    }

    setIsOpen(false);
  }, [isLoggingOut]);

  const handleConfirmLogout = React.useCallback(async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      window.sessionStorage.removeItem('redirectAfterLogin');
      await logout();
      setIsOpen(false);
      setIsLoggingOut(false);
      router.replace('/auth');
    } catch {
      setIsOpen(false);
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, logout, router]);

  return (
    <>
      {children({
        isLoggingOut,
        openConfirm: () => setIsOpen(true),
      })}
      <ConfirmModal
        isOpen={isOpen}
        onCancel={closeConfirm}
        onConfirm={() => {
          void handleConfirmLogout();
        }}
        title={title}
        description={description}
        confirmText={isLoggingOut ? 'Saindo...' : 'Sair'}
        cancelText="Cancelar"
        type="warning"
        isProcessing={isLoggingOut}
      />
    </>
  );
};

export default React.memo(LogoutConfirmButton);
