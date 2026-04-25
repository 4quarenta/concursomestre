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
import { PLATFORM_PAGE_DESCRIPTION_CLASS, PLATFORM_PAGE_TITLE_CLASS } from '@constants/layout';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
}

const AdminPageHeader = ({
  title,
  description = 'Gestao completa da plataforma.',
}: AdminPageHeaderProps) => (
  <header className="mb-6">
    <div className="flex flex-col gap-3">
      <div className="min-w-0">
        <h1 className={PLATFORM_PAGE_TITLE_CLASS}>{title}</h1>
        <p className={`mt-1 ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>{description}</p>
      </div>
    </div>
  </header>
);

export default AdminPageHeader;
