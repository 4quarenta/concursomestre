/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved.
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

'use client';

import React, { useEffect, useState } from 'react';

interface AdminEditorShellProps {
  children: React.ReactNode;
  className?: string;
  dirty?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

const AdminEditorShell = ({ children, className = '', dirty, onDirtyChange }: AdminEditorShellProps) => {
  const [hasUserInput, setHasUserInput] = useState(false);
  const isDirty = typeof dirty === 'boolean' ? dirty : hasUserInput;

  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const markDirty = () => {
    setHasUserInput(true);
    onDirtyChange?.(true);
  };

  const markClean = () => {
    setHasUserInput(false);
    onDirtyChange?.(false);
  };

  return (
    <div
      className={`space-y-5 ${className}`}
      data-admin-editor-shell
      data-dirty={isDirty ? 'true' : 'false'}
      onInputCapture={markDirty}
      onSubmitCapture={markClean}
    >
      {children}
    </div>
  );
};

export default AdminEditorShell;
