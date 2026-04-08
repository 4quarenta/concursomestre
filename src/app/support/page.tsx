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

import React, { useState, useEffect } from 'react';
import {
    Bug, MessageSquare, Info, Heart, Send, AlertTriangle,
    CheckCircle2, Coffee, Shield, CreditCard
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import { useData } from '@providers/DataProvider';
import { supportService } from '@services/support';

type SupportTab = 'bug' | 'feedback' | 'info' | 'donation';

const Support: React.FC = () => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { systemSettings } = useData();
    const pixKey = systemSettings?.pixKey || 'pix@concursomestre.com.br';
    const [activeTab, setActiveTab] = useState<SupportTab>('bug');

    const [subject, setSubject] = useState('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedbackHistory, setFeedbackHistory] = useState<any[]>([]);

    useEffect(() => {
        if (activeTab === 'bug' || activeTab === 'feedback' || activeTab === 'info') {
            fetchHistory();
        }
    }, [activeTab]);

    const fetchHistory = async () => {
        try {
            const threads = await supportService.listThreads();
            setFeedbackHistory(threads);
        } catch (error) {
            console.error('Error fetching feedback history', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!details.trim()) {
            addToast('Por favor, descreva os detalhes.', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            const typeMap: Record<string, string> = {
                'bug': 'bug',
                'feedback': 'suggestion',
                'info': 'support'
            };

            const payload = {
                type: typeMap[activeTab] || 'other',
                reason: subject,
                details: details
            };

            await supportService.createThread(payload);

                addToast('Solicitação enviada com sucesso!', 'success');
                setSubject('');
                setDetails('');
                fetchHistory();
        } catch (error) {
            addToast('Erro ao enviar solicitação.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const [expandedFeedbackId, setExpandedFeedbackId] = useState<number | null>(null);
    const [replies, setReplies] = useState<Record<number, any[]>>({});
    const [loadingReplies, setLoadingReplies] = useState<number | null>(null);
    const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
    const [sendingReplyId, setSendingReplyId] = useState<number | null>(null);

    const toggleFeedback = async (id: number) => {
        if (expandedFeedbackId === id) {
            setExpandedFeedbackId(null);
            return;
        }

        setExpandedFeedbackId(id);

        if (!replies[id]) {
            setLoadingReplies(id);
            try {
                const threadReplies = await supportService.listReplies(id);
                setReplies(prev => ({ ...prev, [id]: threadReplies }));
            } catch (error) {
                console.error('Error fetching replies', error);
            } finally {
                setLoadingReplies(null);
            }
        }
    };

    const handleReplySubmit = async (threadId: number, type: string) => {
        const message = (replyDrafts[threadId] || '').trim();
        if (!message) {
            addToast('Escreva uma resposta antes de enviar.', 'warning');
            return;
        }

        setSendingReplyId(threadId);
        try {
            await supportService.replyToThread(threadId, type, message);
            const threadReplies = await supportService.listReplies(threadId);
            setReplies(prev => ({ ...prev, [threadId]: threadReplies }));
            setReplyDrafts(prev => ({ ...prev, [threadId]: '' }));
            await fetchHistory();
            addToast('Resposta enviada com sucesso.', 'success');
        } catch (error) {
            console.error('Error sending support reply', error);
            addToast('Não foi possível enviar sua resposta.', 'error');
        } finally {
            setSendingReplyId(null);
        }
    };

    const renderHistory = () => {
        const typeFilter = activeTab === 'bug' ? 'bug'
            : activeTab === 'feedback' ? 'suggestion'
                : activeTab === 'info' ? 'support' : 'all';

        const filtered = feedbackHistory.filter(f =>
            typeFilter === 'all' || f.type === typeFilter || (typeFilter === 'suggestion' && f.type === 'other')
        );

        if (filtered.length === 0) return null;

        return (
            <div className="mt-8">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
                    Histórico Recente
                </h3>
                <div className="space-y-3">
                    {filtered.map((item) => (
                        <div key={item.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div
                                onClick={() => toggleFeedback(item.id)}
                                className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${item.status === 'resolved' ? 'bg-emerald-100 text-emerald-600' :
                                        item.status === 'read' ? 'bg-blue-100 text-blue-600' :
                                            'bg-amber-100 text-amber-600'
                                        }`}>
                                        {item.status === 'new' ? 'Aberto' : item.status === 'read' ? 'Em Análise' : 'Resolvido'}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">
                                    {item.reason || 'Sem título'}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {item.details}
                                </p>

                                <div className="mt-2 flex items-center gap-4">
                                    {item.reply_count > 0 && (
                                        <div className="text-[10px] text-indigo-500 font-bold flex items-center gap-1">
                                            <MessageSquare size={10} />
                                            {item.reply_count} resposta(s)
                                        </div>
                                    )}
                                    {expandedFeedbackId === item.id ? (
                                        <span className="text-[10px] text-slate-400">Ocultar conversa</span>
                                    ) : (
                                        <span className="text-[10px] text-slate-400">Ver detalhes...</span>
                                    )}
                                </div>
                            </div>

                            {/* Replies Section */}
                            {expandedFeedbackId === item.id && (
                                <div className="bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 p-4 space-y-3">
                                    {loadingReplies === item.id ? (
                                        <div className="text-center py-2 text-xs text-slate-400">Carregando respostas...</div>
                                    ) : replies[item.id] && replies[item.id].length > 0 ? (
                                        replies[item.id].map((reply: any) => (
                                            <div key={reply.id} className={`p-3 rounded-lg text-xs ${reply.user_id === currentUser?.id ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ml-4' : 'bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20 mr-4'}`}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                                        {reply.user_id === currentUser?.id ? 'Você' : 'Suporte'}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400">
                                                        {new Date(reply.created_at).toLocaleString()}
                                                    </span>
                                                </div>
                                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                                    {reply.details}
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-2 text-xs text-slate-400 italic">Nenhuma resposta ainda.</div>
                                    )}

                                    <div className="pt-2">
                                        <form onSubmit={(e) => {
                                            e.preventDefault();
                                            void handleReplySubmit(item.id, item.type);
                                        }} className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Responder..."
                                                value={replyDrafts[item.id] || ''}
                                                onChange={(e) => setReplyDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 transition-colors"
                                            />
                                            <button
                                                type="submit"
                                                disabled={sendingReplyId === item.id || !(replyDrafts[item.id] || '').trim()}
                                                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Send size={14} />
                                            </button>
                                        </form>
                                        <p className="mt-2 text-[10px] text-slate-400">
                                            Quando o suporte responder pelo painel administrativo, você também recebe um e-mail automático com a atualizacao.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <Shield className="text-indigo-600" />
                    Central de Suporte e Feedback
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                    Ajude-nos a melhorar a plataforma, relate problemas ou apoie nosso trabalho.
                </p>
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
                <button
                    onClick={() => setActiveTab('bug')}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'bug'
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <Bug size={18} /> Reportar Bug
                </button>
                <button
                    onClick={() => setActiveTab('feedback')}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'feedback'
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <MessageSquare size={18} /> Dar Feedback
                </button>
                <button
                    onClick={() => setActiveTab('info')}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'info'
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <Info size={18} /> Pedir Informação
                </button>
                <button
                    onClick={() => setActiveTab('donation')}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'donation'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <Heart size={18} /> Fazer Doação
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    {activeTab === 'donation' ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
                            <div className="text-center mb-8">
                                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                    <Heart size={40} fill="currentColor" />
                                </div>
                                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Apoie o ConcursoMestre</h2>
                                <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg mx-auto">
                                    Somos uma plataforma independente construída com paixão para ajudar estudantes a alcançarem seus sonhos.
                                    Os custos de servidores, desenvolvimento e manutenção são altos.
                                    Qualquer valor nos ajuda a continuar evoluindo e mantendo o acesso democrático.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                                <div className="p-4 border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl text-center">
                                    <Coffee className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                                    <h3 className="font-bold text-slate-800 dark:text-slate-200">PIX</h3>
                                    <p className="text-xs text-slate-500 mb-3">Chave Aleatória ou Email</p>
                                    <code className="block bg-white dark:bg-slate-800 p-2 rounded border border-dashed border-slate-300 dark:border-slate-700 text-xs font-mono select-all">
                                        {pixKey}
                                    </code>
                                </div>
                                <div className="p-4 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl text-center">
                                    <CreditCard className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                                    <h3 className="font-bold text-slate-800 dark:text-slate-200">Doacao por cartao</h3>
                                    <p className="text-xs text-slate-500 mb-3">Canal em reestruturacao</p>
                                    <button disabled className="text-xs bg-slate-300 text-white px-3 py-1.5 rounded-lg font-bold cursor-not-allowed">
                                        Em breve
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-center">
                                <p className="text-xs font-medium text-slate-500 italic">
                                    "O conhecimento é a única ferramenta que ninguém pode tirar de você."
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                                {activeTab === 'bug' && <><AlertTriangle className="text-red-500" /> Reportar um Problema</>}
                                {activeTab === 'feedback' && <><MessageSquare className="text-indigo-500" /> Enviar Sugestão</>}
                                {activeTab === 'info' && <><Info className="text-blue-500" /> Solicitar Informação</>}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assunto / Resumo</label>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                                        placeholder={activeTab === 'bug' ? "Ex: Erro ao salvar questão" : "Ex: Sugestão de nova funcionalidade"}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Detalhes</label>
                                    <textarea
                                        value={details}
                                        onChange={e => setDetails(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium h-40 resize-none"
                                        placeholder="Descreva detalhadamente..."
                                        required
                                    />
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                        {isSubmitting ? 'Enviando...' : <><Send size={18} /> Enviar</>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                <div className="md:col-span-1">
                    {renderHistory()}

                    <div className="mt-8 bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                        <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-2 flex items-center gap-2">
                            <CheckCircle2 size={18} /> Dicas Úteis
                        </h3>
                        <ul className="text-xs text-indigo-800 dark:text-indigo-200 space-y-2 opacity-80">
                            <li>? Ao reportar bugs, inclua passos para reproduzir.</li>
                            <li>• Para sugestões, explique como isso ajudaria seus estudos.</li>
                            <li>• Verifique se sua dúvida já não está no FAQ.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Support;
