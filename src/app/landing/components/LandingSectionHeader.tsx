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

interface LandingSectionHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  align?: 'left' | 'center';
}

const LandingSectionHeader: React.FC<LandingSectionHeaderProps> = ({
  eyebrow,
  title,
  description,
  align = 'center',
}) => {
  const alignmentClassName = align === 'left' ? 'text-left items-start' : 'text-center items-center';

  return (
    <div className={`mb-14 flex flex-col gap-4 ${alignmentClassName}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400">
        {eyebrow}
      </p>
      <div className="space-y-3">
        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl">
          {title}
        </h2>
        <p className={`max-w-3xl text-base font-medium leading-relaxed text-slate-500 dark:text-slate-400 ${align === 'left' ? '' : 'mx-auto'}`}>
          {description}
        </p>
      </div>
    </div>
  );
};

export default LandingSectionHeader;
