import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import styled from 'styled-components';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type?: ToastType) => void;
    removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ToastContainer = styled.div`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ToastItem = styled.div<{ $type: ToastType }>`
  background: ${({ $type }) =>
        $type === 'error' ? '#ff4d4f' :
            $type === 'success' ? '#52c41a' :
                $type === 'warning' ? '#faad14' : '#1890ff'};
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  animation: slideIn 0.3s ease;
  min-width: 250px;
  max-width: 400px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: white;
  margin-left: 1rem;
  cursor: pointer;
  font-weight: bold;
`;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 5000);
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            {createPortal(
                <ToastContainer>
                    {toasts.map(t => (
                        <ToastItem key={t.id} $type={t.type}>
                            {t.message}
                            <CloseButton onClick={() => removeToast(t.id)}>×</CloseButton>
                        </ToastItem>
                    ))}
                </ToastContainer>,
                document.body
            )}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
};
