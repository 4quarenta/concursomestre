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
import { Shield } from 'lucide-react';

interface AdminPageHeaderProps {
  title: string;
}

const AdminPageHeader = ({ title }: AdminPageHeaderProps) => (
  <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="flex items-center gap-2 text-3xl font-black text-slate-900 dark:text-slate-100">
          <Shield className="text-rose-600" />
          {title}
        </h1>
        <span className="rounded-md border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
          Admin
        </span>
      </div>
      <p className="text-sm font-medium text-slate-500">Gestao completa da plataforma.</p>
    </div>
  </header>
);

export default AdminPageHeader;
