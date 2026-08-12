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

'use client';

import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import CommentsSection from '@/components/shared/feedback/CommentsSection';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { blogService } from '@services/blog';
import { commentService } from '@services/comments/commentsService';
import type { QuestaoComentario } from '@types';

export default function BlogArticleEngagement({
  articleId,
  articleSlug,
  initialLikesCount,
  initialIsLiked,
  allowComments,
}: {
  articleId: number;
  articleSlug: string;
  initialLikesCount: number;
  initialIsLiked: boolean;
  allowComments: boolean;
}) {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const [liked, setLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [comments, setComments] = useState<QuestaoComentario[]>([]);
  const currentUserId = currentUser?.id;
  const displayLiked = Boolean(currentUserId) && liked;

  const loadComments = async () => {
    if (!allowComments) return;
    setComments(await commentService.getComments(String(articleId), currentUser?.id, 'blog_article'));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadComments();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, currentUser?.id, allowComments]);

  useEffect(() => {
    if (!currentUserId) return;
    let active = true;
    void blogService.detail(articleSlug).then((article) => {
      if (!active) return;
      setLiked(article.engagement.isLiked);
      setLikesCount(article.engagement.likesCount);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [articleSlug, currentUserId]);

  const requireUser = () => {
    if (!currentUser) {
      addToast('Entre na sua conta para participar.', 'warning');
      return false;
    }
    return true;
  };

  return (
    <section className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            if (!requireUser()) return;
            const result = await blogService.toggleLike(articleId);
            setLiked(result.liked);
            setLikesCount(result.likesCount);
          }}
          className={`inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-bold ${
            displayLiked
              ? 'border-rose-200 bg-rose-50 text-rose-600'
              : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
          }`}
        >
          <Heart size={17} className={displayLiked ? 'fill-current' : ''} /> {likesCount}
        </button>
      </div>

      {allowComments ? (
        <div className="mt-8">
          <CommentsSection
            targetId={String(articleId)}
            comments={comments}
            title="Comentários da notícia"
            onAddComment={async (text, parentId) => {
              if (!requireUser() || !currentUser) return;
              await commentService.addComment({
                questionId: String(articleId),
                content: text,
                parentId,
                targetType: 'blog_article',
                userId: currentUser.id,
                userName: currentUser.name,
                userAvatar: currentUser.photoUrl,
                userPlan: currentUser.plan,
                userRole: currentUser.role,
              });
              await loadComments();
            }}
            onLikeComment={async (commentId) => {
              if (!requireUser()) return;
              await commentService.likeComment(commentId);
              await loadComments();
            }}
            onReportComment={async (commentId, reason, details) => {
              if (!requireUser() || !currentUser) return false;
              await commentService.reportComment(commentId, reason, details, currentUser.id);
              addToast('Denúncia enviada para moderação.', 'success');
              return true;
            }}
            onDeleteComment={async (commentId) => {
              await commentService.deleteComment(commentId);
              await loadComments();
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
