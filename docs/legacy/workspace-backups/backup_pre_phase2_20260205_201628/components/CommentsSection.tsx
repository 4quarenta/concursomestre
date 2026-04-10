
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, XCircle, ThumbsUp, Reply, Crown, Zap, Star, Flag } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { Comment } from '../types';
import { useAuth } from '../context/AuthContext';

interface CommentItemProps {
    comment: Comment;
    onReply: (id: string, name: string) => void;
    onLike: (id: string) => void;
    onReport: (id: string) => void;
    depth?: number;
    highlightedId?: string | null;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, onReply, onLike, onReport, depth = 0, highlightedId }) => {
    const isHighlighted = highlightedId === comment.id;
    const [showAllReplies, setShowAllReplies] = useState(false);

    const getBadge = (plan?: string) => {
        switch (plan) {
            case 'Elite': return <span title="Usuário Elite"><Crown size={12} className="text-amber-500 fill-amber-500" /></span>;
            case 'Pro': return <span title="Usuário Pro"><Zap size={12} className="text-indigo-500 fill-indigo-500" /></span>;
            case 'Essencial': return <span title="Usuário Essencial"><Star size={12} className="text-blue-500 fill-blue-500" /></span>;
            default: return null;
        }
    };

    const replies = comment.replies || [];
    const hasReplies = replies.length > 0;
    const visibleReplies = showAllReplies ? replies : [];
    const hiddenCount = replies.length;

    return (
        <div
            id={`comment-${comment.id}`}
            className={`flex flex-col gap-2 relative transition-all duration-1000 ${depth > 0 ? 'ml-4 sm:ml-8 pl-4 border-l border-slate-200 dark:border-slate-800' : ''} ${isHighlighted ? 'scale-[1.02] z-10' : ''}`}
        >
            {depth > 0 && (
                <div className="absolute left-0 top-6 w-3 h-[1px] bg-slate-200 dark:border-slate-800" />
            )}
            <div className={`${isHighlighted ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200' : (depth > 0 ? 'bg-slate-50/50 dark:bg-slate-900/20' : 'bg-white dark:bg-slate-800')} p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-2 transition-all`}>
                <div className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-2">
                        <img
                            src={comment.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.userName)}&background=random&color=fff&size=32`}
                            alt={comment.userName}
                            className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-700 dark:text-slate-200">{comment.userName}</span>
                                {getBadge(comment.userPlan)}
                            </div>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500">{comment.date}</span>
                        </div>
                    </div>
                    {isHighlighted && <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase animate-pulse">Novo</span>}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: comment.text }} />
                <div className="flex gap-3 mt-1">
                    <button onClick={() => onLike(comment.id)}
                        className={`flex items-center gap-1 text-[10px] font-bold transition-all ${comment.isLiked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'}`}>
                        <ThumbsUp size={12} className={comment.isLiked ? 'fill-current' : ''} /> {comment.likes > 0 && comment.likes}
                    </button>
                    <button onClick={() => onReply(comment.id, comment.userName)} className="flex items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 text-[10px] font-bold transition-all">
                        <Reply size={12} /> Responder
                    </button>
                    <button onClick={() => onReport(comment.id)} className="flex items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 text-[10px] font-bold transition-all">
                        <Flag size={11} /> Reportar
                    </button>
                </div>
            </div>
            {visibleReplies.map(reply => (
                <MemoizedCommentItem
                    key={reply.id}
                    comment={reply}
                    onReply={onReply}
                    onLike={onLike}
                    onReport={onReport}
                    depth={depth + 1}
                    highlightedId={highlightedId}
                />
            ))}
            {hasReplies && !showAllReplies && (
                <button
                    onClick={() => setShowAllReplies(true)}
                    className="ml-4 sm:ml-8 pl-4 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all flex items-center gap-1"
                >
                    <MessageSquare size={12} />
                    Ver {hiddenCount} {hiddenCount === 1 ? 'resposta' : 'respostas'}
                </button>
            )}
        </div>
    );
};

// Memoize CommentItem to prevent unnecessary re-renders
const MemoizedCommentItem = React.memo(CommentItem, (prev, next) => {
    return (
        prev.comment.id === next.comment.id &&
        prev.comment.likes === next.comment.likes &&
        prev.comment.isLiked === next.comment.isLiked &&
        prev.highlightedId === next.highlightedId
    );
});

interface CommentsSectionProps {
    targetId: string;
    comments: Comment[];
    onAddComment: (text: string, parentId?: string) => void;
    onLikeComment: (commentId: string) => void;
    onReportComment: (commentId: string) => void;
    title?: string;
    isExpanded?: boolean;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({
    targetId,
    comments,
    onAddComment,
    onLikeComment,
    onReportComment,
    title = "Comentários da Comunidade",
    isExpanded = true
}) => {
    const [commentHtml, setCommentHtml] = useState('');
    const [replyTo, setReplyTo] = useState<{ id: string, name: string } | null>(null);
    const [lastAddedId, setLastAddedId] = useState<string | null>(null);
    const commentEditorRef = useRef<HTMLDivElement>(null);
    const { currentUser } = useAuth();

    useEffect(() => {
        if (replyTo && commentEditorRef.current) {
            commentEditorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [replyTo]);

    // Efeito para destacar e rolar até o novo comentário
    useEffect(() => {
        if (lastAddedId) {
            const element = document.getElementById(`comment-${lastAddedId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Limpar o destaque após alguns segundos
                const timer = setTimeout(() => {
                    setLastAddedId(null);
                }, 3000);
                return () => clearTimeout(timer);
            }
        }
    }, [lastAddedId, comments]);

    const handleSubmit = () => {
        if (!commentHtml.trim()) return;
        onAddComment(commentHtml, replyTo?.id);
        setCommentHtml('');
        setReplyTo(null);

        // Sinalizar que estamos aguardando um novo comentário para destacar
        setLastAddedId('pending');
    };

    // Efeito para capturar o ID do último comentário adicionado quando a lista for atualizada
    useEffect(() => {
        if (lastAddedId === 'pending' && comments.length > 0) {
            const findLatestId = (cms: Comment[]): string | null => {
                let latestId = null;
                let latestTime = 0;

                const traverse = (list: Comment[]) => {
                    for (const c of list) {
                        const parts = c.id.split('-');
                        const timeStr = parts[parts.length - 1];
                        const time = parseInt(timeStr);
                        if (!isNaN(time) && time > latestTime) {
                            latestTime = time;
                            latestId = c.id;
                        }
                        if (c.replies.length > 0) traverse(c.replies);
                    }
                };

                traverse(cms);
                return latestId;
            };

            const latest = findLatestId(comments);
            if (latest) {
                setLastAddedId(latest);
            }
        }
    }, [comments, lastAddedId]);

    if (!isExpanded) return null;

    return (
        <div className="p-6 space-y-6">
            <div className="space-y-3" ref={commentEditorRef}>
                <h3 className="text-[9px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={14} /> {title}
                </h3>

                {currentUser ? (
                    <>
                        {replyTo && (
                            <div className="flex items-center gap-2 text-xs bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg border border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-400 w-fit">
                                <span>Respondendo a <strong>{replyTo.name}</strong></span>
                                <button onClick={() => setReplyTo(null)} className="hover:text-red-500 transition-colors">
                                    <XCircle size={14} />
                                </button>
                            </div>
                        )}

                        <RichTextEditor initialValue={commentHtml} onChange={setCommentHtml} placeholder="Escreva seu comentário..." />
                        <div className="flex justify-end">
                            <button
                                onClick={handleSubmit}
                                disabled={!commentHtml.trim()}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-all font-inter"
                            >
                                Publicar
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Você precisa estar logado para participar da discussão.</p>
                        <a href="#/auth" className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                            Fazer Login
                        </a>
                    </div>
                )}
            </div>

            <div className="space-y-4 scroll-smooth">
                {comments.map(comment => (
                    <MemoizedCommentItem
                        key={comment.id}
                        comment={comment}
                        onReply={(id, name) => setReplyTo({ id, name })}
                        onLike={(id) => onLikeComment(id)}
                        onReport={(id) => onReportComment(id)}
                        highlightedId={lastAddedId}
                    />
                ))}
                {comments.length === 0 && (
                    <p className="text-center text-slate-400 dark:text-slate-600 text-xs italic py-4">
                        Seja o primeiro a comentar!
                    </p>
                )}
            </div>
        </div>
    );
};

export default CommentsSection;
