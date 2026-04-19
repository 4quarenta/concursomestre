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
import Link from 'next/link';
import { Rocket, HelpCircle, FileText, Shield, Heart, BrainCircuit } from 'lucide-react';

const Footer: React.FC = () => {
    const currentYear = new Date().getFullYear();

    const footerLinks = [
        { label: 'Suporte', icon: HelpCircle, path: '/support' },
        { label: 'FAQ', icon: HelpCircle, path: '/faq' },
        { label: 'Changelog', icon: Rocket, path: '/changelog' },
        { label: 'Termos de Uso', icon: FileText, path: '/terms' },
        { label: 'Privacidade', icon: Shield, path: '/privacy' },
    ];

    return (
        <footer className="mt-20 pb-10 border-t border-slate-200 dark:border-slate-800 pt-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="flex flex-col items-center md:items-start gap-4">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xl">
                        <BrainCircuit className="w-6 h-6" />
                        <span>ConcursoMestre</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs text-center md:text-left">
                        A plataforma completa para sua aprovação. Estude com inteligência e conquiste sua vaga.
                    </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-8">
                    {footerLinks.map((link) => (
                        <Link
                            key={link.path}
                            href={link.path}
                            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
                        >
                            <link.icon size={16} className="group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-bold">{link.label}</span>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="mt-12 flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-slate-100 dark:border-slate-900">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    © {currentYear} ConcursoMestre. Todos os direitos reservados.
                </p>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Desenvolvido com <Heart size={10} className="text-rose-500 animate-pulse" /> para concurseiros
                </div>
            </div>
        </footer>
    );
};

export default Footer;
