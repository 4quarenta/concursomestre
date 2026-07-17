'use client';

import React from 'react';
import { ImageUp, Loader2 } from 'lucide-react';
import { adminService } from '@services/admin/adminService';
import { readApiErrorMessage } from '@services/api';
import { ADMIN_SECONDARY_BUTTON_CLASS } from '../shared/adminPanelStyles';

interface AdminBrandAssetUploadProps {
  purpose: 'email-logo' | 'og-image';
  onUploaded: (url: string) => void;
}

const AdminBrandAssetUpload = ({ purpose, onUploaded }: AdminBrandAssetUploadProps) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleFile = async (file?: File) => {
    if (!file || isUploading) return;

    setIsUploading(true);
    setError('');
    try {
      const asset = await adminService.uploadBrandAsset(file, purpose);
      onUploaded(asset.url);
    } catch (uploadError) {
      setError(readApiErrorMessage(uploadError, 'Nao foi possivel enviar a imagem.'));
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-xs`}
      >
        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} />}
        {isUploading ? 'Enviando...' : 'Enviar imagem'}
      </button>
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">PNG, JPEG ou WebP, ate 5 MB.</p>
      {error ? <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  );
};

export default AdminBrandAssetUpload;
