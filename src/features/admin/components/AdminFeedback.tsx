import React, { useState, useEffect } from 'react';
import { apiClient } from '@core/api';
import { CheckCircle, Clock, AlertTriangle, User, MessageSquare, Info, Send, Loader2, Mail } from 'lucide-react';


interface Feedback {
    id: number;
    user_id: string;
    user_name: string;
    user_email: string;
    type: 'cancellation' | 'support' | 'report';
    reason: string;
    details: string;
    created_at: string;
    status: 'new' | 'read' | 'resolved';
}

export const AdminFeedback: React.FC = () => {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);

    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [replies, setReplies] = useState<Record<number, any[]>>({});
    const [loadingReplies, setLoadingReplies] = useState<number | null>(null);
    const [replyText, setReplyText] = useState('');
    const [sendingReply, setSendingReply] = useState(false);

    const fetchFeedback = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get<Feedback[]>('/admin/feedback.php');
            // Check if response is the array directly or inside data
            const data = (response as any).data ? (response as any).data : response;
            if (Array.isArray(data)) {
                setFeedbacks(data);
            } else {
                setFeedbacks([]);
            }
        } catch (error) {
            console.error('Error fetching feedback:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: number, status: 'new' | 'read' | 'resolved') => {
        try {
            await apiClient.put('/admin/feedback.php', { id, status });
            fetchFeedback(); // Refresh
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    useEffect(() => {
        fetchFeedback();
    }, []);

    const toggleExpand = async (id: number) => {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }

        setExpandedId(id);
        if (!replies[id]) {
            setLoadingReplies(id);
            try {
                // We use the public list endpoint but we might need admin privileges?
                // Actually the public endpoint checks for user_id match.
                // We need an admin specific endpoint OR use the public one if we are admin?
                // The public one restricts to user_id. Admin has different user_id.
                // We need api/admin/feedback_details.php OR modify api/admin/feedback.php to handle GET params for details.
                // Let's modify api/admin/feedback.php to handle ?id= param for replies.

                // WAIT: I havne't modified api/admin/feedback.php to return replies yet.
                // I should do that.

                // For now, let's assume I will update api/admin/feedback.php to return replies if ID is present.
                const res: any = await apiClient.get(`/admin/feedback.php?id=${id}`);
                if (res && res.replies) {
                    setReplies(prev => ({ ...prev, [id]: res.replies }));
                }
            } catch (error) {
                console.error('Error fetching replies', error);
            } finally {
                setLoadingReplies(null);
            }
        }
    }

    const sendReply = async (parentId: number) => {
        if (!replyText.trim()) return;

        setSendingReply(true);
        try {
            await apiClient.post('/feedback/create.php', {
                parent_id: parentId,
                type: 'support', // Admin replies are support
                reason: 'Reply',
                details: replyText
            });

            // Refresh replies
            const res: any = await apiClient.get(`/admin/feedback.php?id=${parentId}`);
            if (res && res.replies) {
                setReplies(prev => ({ ...prev, [parentId]: res.replies }));
            }
            setReplyText('');
            fetchFeedback(); // Update reply count in main list
        } catch (error) {
            console.error('Error sending reply', error);
            alert('Erro ao enviar resposta');
        } finally {
            setSendingReply(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Carregando feedbacks...</div>;

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-black text-slate-800 dark:text-white">Feedback e Suporte</h3>

            <div className="grid gap-4">
                {feedbacks.length === 0 ? (
                    <div className="text-center p-8 text-slate-400">Nenhum feedback encontrado.</div>
                ) : (
                    feedbacks.map((item: any) => (
                        <div key={item.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="p-6 flex flex-col md:flex-row gap-6">
                                <div className="flex-shrink-0">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${item.type === 'cancellation' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {item.type === 'cancellation' ? <AlertTriangle size={24} /> : <MessageSquare size={24} />}
                                    </div>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-lg">{item.reason}</h4>
                                            <p className="text-xs text-slate-500 flex items-center gap-2">
                                                <User size={12} /> {item.user_name} ({item.user_email})
                                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                <Clock size={12} /> {new Date(item.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={item.status}
                                                onChange={(e) => updateStatus(item.id, e.target.value as any)}
                                                className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-xs font-bold uppercase p-2"
                                            >
                                                <option value="new">Novo</option>
                                                <option value="read">Lido</option>
                                                <option value="resolved">Resolvido</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic border border-slate-100 dark:border-slate-800">
                                        "{item.details || 'Sem detalhes fornecidos.'}"
                                    </div>

                                    <div className="pt-2 flex items-center justify-between">
                                        <button
                                            onClick={() => toggleExpand(item.id)}
                                            className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-2"
                                        >
                                            <MessageSquare size={16} />
                                            {expandedId === item.id ? 'Ocultar Conversa' : `Ver Conversa (${item.reply_count || 0})`}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Thread / Replies Section */}
                            {expandedId === item.id && (
                                <div className="bg-slate-50 dark:bg-slate-950/30 border-t border-slate-100 dark:border-slate-800 p-6 space-y-4">
                                    {loadingReplies === item.id ? (
                                        <div className="text-center text-slate-400 py-4"><Loader2 className="animate-spin mx-auto" /> Carregando...</div>
                                    ) : (
                                        <>
                                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {replies[item.id] && replies[item.id].map((reply: any) => (
                                                    <div key={reply.id} className={`flex gap-4 ${reply.user_email ? 'flex-row' : 'flex-row-reverse'}`}>
                                                        {/* If user_email is present in reply object (joined from users table), it means it is a user reply? 
                                                          Wait, the reply query in backend will join users. 
                                                          If I am admin replying, my user is admin. User replying is user.
                                                          We need to distinguish. 
                                                          Usually check role or id.
                                                       */}
                                                        <div className={`p-4 rounded-xl max-w-[80%] ${
                                                            // Simple heuristic: if the reply user_id is the same as the thread user_id, it is the user. Else it's admin/support
                                                            reply.user_id === item.user_id
                                                                ? 'bg-white border border-slate-200'
                                                                : 'bg-indigo-100 text-indigo-900 ml-auto'
                                                            }`}>
                                                            <div className="flex justify-between items-center mb-1 gap-4">
                                                                <span className="font-bold text-xs">{reply.user_name}</span>
                                                                <span className="text-[10px] opacity-70">{new Date(reply.created_at).toLocaleString()}</span>
                                                            </div>
                                                            <p className="text-sm">{reply.details}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(!replies[item.id] || replies[item.id].length === 0) && (
                                                    <p className="text-center text-slate-400 italic text-sm">Nenhuma resposta ainda.</p>
                                                )}
                                            </div>

                                            <div className="flex gap-2 items-start pt-4 border-t border-slate-200 dark:border-slate-700">
                                                <textarea
                                                    value={replyText}
                                                    onChange={e => setReplyText(e.target.value)}
                                                    placeholder="Escreva uma resposta..."
                                                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                                                />
                                                <button
                                                    onClick={() => window.open(`mailto:${item.user_email}?subject=Resposta: ${item.reason}&body=${encodeURIComponent(replyText)}`, '_blank')}
                                                    className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                                    title="Responder por Email"
                                                >
                                                    <Mail size={20} />
                                                </button>
                                                <button
                                                    onClick={() => sendReply(item.id)}
                                                    disabled={sendingReply || !replyText.trim()}
                                                    className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    title="Enviar resposta no sistema"
                                                >
                                                    {sendingReply ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
