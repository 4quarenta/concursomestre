
import React from 'react';

interface AdPlaceholderProps {
    className?: string;
    type?: 'banner' | 'sidebar' | 'inline';
}

export const AdPlaceholder: React.FC<AdPlaceholderProps> = ({ className = '', type = 'banner' }) => {
    const heights = {
        banner: 'h-24',
        sidebar: 'h-64',
        inline: 'h-32'
    };

    return (
        <div
            className={`w-full ${heights[type]} bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex items-center justify-center group overflow-hidden relative transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 ${className}`}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 dark:text-slate-700 group-hover:text-indigo-400 transition-colors">
                    Espaço para Anúncio
                </span>
                <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[9px] font-bold text-slate-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 group-hover:text-indigo-600 transition-all">
                    ANÚNCIO
                </div>
            </div>
        </div>
    );
};
