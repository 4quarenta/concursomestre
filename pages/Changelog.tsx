import React, { useState, useEffect } from 'react';
import {
    Rocket, CheckCircle2, Shield, BookOpen,
    BarChart2, Users, ShoppingBag, MessageSquare,
    Zap, Layout, Award, FileText,
    Loader2, ChevronRight, History
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '@core/api';

interface ChangelogVersion {
    id: number;
    version: string;
    release_date: string;
    title: string;
    description: string;
    content_json: {
        title: string;
        icon: string;
        items: string[];
    }[];
}

const Changelog: React.FC = () => {
    const [changelogs, setChangelogs] = useState<ChangelogVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<ChangelogVersion | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchChangelogs = async () => {
            try {
                const response = await apiClient.get<ChangelogVersion[]>('/changelog/list.php');
                const data = (response as any).data ? (response as any).data : response;

                if (Array.isArray(data)) {
                    setChangelogs(data);
                    if (data.length > 0) {
                        setSelectedVersion(data[0]);
                    }
                }
            } catch (error) {
                console.error('Error fetching changelogs:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchChangelogs();
    }, []);

    const getIcon = (iconName: string) => {
        switch (iconName) {
            case 'BookOpen': return <BookOpen className="text-indigo-500" />;
            case 'BarChart2': return <BarChart2 className="text-emerald-500" />;
            case 'FileText': return <FileText className="text-cyan-500" />;
            case 'ShoppingBag': return <ShoppingBag className="text-rose-500" />;
            case 'Trophy': return <TrophyIcon className="text-yellow-500" />;
            case 'Layout': return <Layout className="text-slate-500" />;
            case 'Shield': return <Shield className="text-emerald-600" />;
            case 'Zap': return <Zap className="text-amber-500" />;
            default: return <CheckCircle2 className="text-slate-400" />;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 font-sans transition-colors duration-300">
            {/* Header Hero */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="text-left max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest mb-6 border border-indigo-100 dark:border-indigo-800 shadow-sm">
                            <Rocket size={14} className="animate-pulse" /> Evolução da Plataforma
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tight leading-tight">
                            Changelog & Atualizações
                        </h1>
                        <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                            Acompanhe todas as novidades, melhorias e correções feitas no <span className="text-indigo-600 dark:text-indigo-400">ConcursoMestre</span>.
                        </p>
                    </div>
                    <div className="hidden md:block">
                        <History size={120} className="text-slate-200 dark:text-slate-800" />
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 md:px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">

                    {/* Navigation Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Versões Lançadas</h3>
                        <div className="space-y-1">
                            {changelogs.map((ver) => (
                                <button
                                    key={ver.id}
                                    onClick={() => setSelectedVersion(ver)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${selectedVersion?.id === ver.id
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 translate-x-1'
                                            : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 hover:text-indigo-600 dark:hover:text-indigo-400'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${selectedVersion?.id === ver.id ? 'bg-white' : 'bg-slate-300 dark:bg-slate-700'}`} />
                                        <span>v{ver.version}</span>
                                    </div>
                                    <ChevronRight size={16} className={selectedVersion?.id === ver.id ? 'opacity-100' : 'opacity-0'} />
                                </button>
                            ))}
                        </div>

                        <div className="p-6 bg-slate-900 dark:bg-indigo-900/20 rounded-2xl text-white mt-12">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Dica</p>
                            <p className="text-xs font-bold leading-relaxed">
                                Use o menu acima para navegar pelo histórico de atualizações e ver o que mudou em cada versão.
                            </p>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="lg:col-span-3 space-y-10">
                        {selectedVersion ? (
                            <div className="animate-fade-in space-y-10">
                                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="flex flex-wrap items-center gap-3 mb-6">
                                        <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-lg">
                                            v{selectedVersion.version}
                                        </span>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            Data de Lançamento: {new Date(selectedVersion.release_date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
                                        {selectedVersion.title}
                                    </h2>
                                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg font-medium">
                                        {selectedVersion.description}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {selectedVersion.content_json.map((cat, cIndex) => (
                                        <div key={cIndex} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-indigo-200 dark:hover:border-indigo-900 transition-colors group">
                                            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm group-hover:scale-110 transition-transform duration-300">
                                                    {getIcon(cat.icon)}
                                                </div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">
                                                    {cat.title}
                                                </h4>
                                            </div>
                                            <ul className="p-6 space-y-3">
                                                {cat.items.map((item, iIndex) => (
                                                    <li key={iIndex} className="flex gap-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed group/item hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
                                                        <CheckCircle2 className="flex-shrink-0 text-emerald-500 mt-0.5 opacity-50 group-hover/item:opacity-100 transition-opacity" size={16} />
                                                        <span>{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-20 text-slate-400">
                                <History size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="font-bold">Selecione uma versão para visualizar os detalhes.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Area */}
            <div className="max-w-6xl mx-auto px-6 mt-20 pt-10 border-t border-slate-200 dark:border-slate-800 text-center">
                <p className="text-slate-400 text-sm font-medium">ConcursoMestre © 2026</p>
                <div className="mt-8">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-8 py-3.5 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-xl hover:shadow-indigo-500/20"
                    >
                        <Layout size={16} /> Voltar ao Início
                    </Link>
                </div>
            </div>
        </div>
    );
};

// Helper component for Trophy icon
const TrophyIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
);

export default Changelog;
