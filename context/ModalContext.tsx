
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ConfirmOptions {
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

interface ModalContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({});
    const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

    const confirm = useCallback((confirmOptions: ConfirmOptions) => {
        setOptions(confirmOptions);
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            setResolver(() => resolve);
        });
    }, []);

    const handleConfirm = () => {
        resolver?.(true);
        setIsOpen(false);
    };

    const handleCancel = () => {
        resolver?.(false);
        setIsOpen(false);
    };

    return (
        <ModalContext.Provider value={{ confirm }}>
            {children}
            {/* The actual modal component will be injected here or handled via provider */}
            {isOpen && (
                <ConfirmModal
                    isOpen={isOpen}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    {...options}
                />
            )}
        </ModalContext.Provider>
    );
};

// Internal Import helper (since ConfirmModal will be in components)
import ConfirmModal from '../components/ConfirmModal';

export const useConfirm = () => {
    const context = useContext(ModalContext);
    if (!context) throw new Error('useConfirm must be used within ModalProvider');
    return context.confirm;
};
