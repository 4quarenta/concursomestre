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

import React, { useState, useEffect, useRef } from 'react';
import type { Question, UserAnswer, QuestaoComentario as Comment, ErrorReport, UserNote, QuestionStats } from '@types';
import {
  CheckCircle2, XCircle, Flag, BookOpen, GraduationCap,
  Eye, EyeOff, Building2, Calendar, Briefcase, ThumbsUp, MessageSquare, BarChart3, AlertTriangle, Share2, Lock, StickyNote, Bookmark, BookmarkCheck, ChevronDown, ChevronUp, Layers, Tag, Crown, Zap, Star, Reply, History, PlusCircle, MinusCircle
} from 'lucide-react';
import { getAssetUrl } from '@services/api';
import { questionService } from '@services/questions';
import ReactMarkdown from 'react-markdown';

const fixHtmlImages = (html: string) => {
  if (!html) return html;
  // This regex finds <img> tags and captures the src attribute
  // It replaces relative paths like 'uploads/questions/...' with absolute ones using getAssetUrl
  return html.replace(/<img[^>]+src=(['"])([^'"]+)\1[^>]*>/gi, (match, quote, src) => {
    if (src.startsWith('http')) return match;
    const absoluteUrl = getAssetUrl(src);
    return match.replace(src, absoluteUrl);
  });
};
import RichTextEditor from '../../../components/shared/ui/RichTextEditor';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import AuthModal from '../../../components/shared/overlays/AuthModal';
import CommentsSection from '../../../components/shared/feedback/CommentsSection';
import { createPortal } from 'react-dom';
import { useMarketplace } from '@providers/MarketplaceProvider';
import { Link, useNavigate } from 'react-router-dom';
import AdBanner from '../../../components/shared/feedback/AdBanner';
import { getBenefitPlanLabel, getBenefitRequiredPlan, hasPlanBenefit } from '@services/plans/planAccess';
import { buildQuestionPath } from '@services/seo';

interface QuestionCardProps {
  question: Question;
  existingAnswer?: UserAnswer;
  onAnswerSubmit: (answer: UserAnswer) => void;
  onReportError?: (report: Omit<ErrorReport, 'id' | 'status' | 'timestamp'>) => void;
  onAddComment?: (qId: string, text: string, parentId?: string) => void;
  onLikeComment?: (qId: string, cId: string) => void;
  indexDisplay: number;
  isAlreadyReported?: boolean;
  userPlan?: 'Gratuito' | 'Essencial' | 'Pro' | 'Elite';
  existingNote?: UserNote;
  onSaveNote?: (qId: string, text: string) => void;
  onToggleSave?: (qId: string) => void;
  isSaved?: boolean;
  mode?: 'practice' | 'simulation';
  hideFeedback?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  onGuestAction?: (action: string) => void;
  isHighlighted?: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question, existingAnswer, onAnswerSubmit, onReportError, onAddComment, onLikeComment, indexDisplay,
  isAlreadyReported = false, userPlan = 'Gratuito', existingNote, onSaveNote, onToggleSave, isSaved = false,
  mode = 'practice', hideFeedback = false, currentUserId, currentUserName, onGuestAction, isHighlighted = false
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { systemSettings, fetchComments, reportComment, deleteComment } = useData();
  const [selectedOptionId, setSelectedOptionId] = useState<number | string | null>(null);
  const [eliminatedOptionIds, setEliminatedOptionIds] = useState<(number | string)[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);

  // Added useMarketplace here to do a lightweight check for the materials button rendering
  const { materials } = useMarketplace();
  const [isContextExpanded, setIsContextExpanded] = useState(false);

  const hasRelatedMaterials = React.useMemo(() => {
    if (!systemSettings.features.marketplaceEnabled || !materials || materials.length === 0) return false;
    const questionSubjects = question.assuntos?.map((a: any) => a?.nome?.toLowerCase()).filter(Boolean) || [];
    const questionTopics = question.assuntos?.map((a: any) => a?.topico ? a.topico.toLowerCase() : '').filter(Boolean) || [];
    if (questionSubjects.length === 0) return false;

    return materials.some(m => {
      // Relaxed status check matching availableMaterials logic
      if (m.status !== 'approved' && m.status !== undefined) return false;
      const matSubjectInfo = typeof m.subject === 'string' ? m.subject : ((m.subject as any)?.name || m.subjectText || '');
      const matSubject = matSubjectInfo.toLowerCase();
      const matTopic = (m.topic || '').toLowerCase();

      // Check Subject or Topic Match
      const hasSubjectMatch = matSubject && questionSubjects.some((qs: string) => qs.includes(matSubject) || matSubject.includes(qs));
      const hasTopicMatch = matTopic && (questionTopics.some((qt: string) => qt.includes(matTopic) || matTopic.includes(qt)) || questionSubjects.some((qs: string) => qs.includes(matTopic) || matTopic.includes(qs)));

      if (hasSubjectMatch || hasTopicMatch) return true;

      // Also check topic weakly
      const titleLower = (m.title || '').toLowerCase();
      if (questionSubjects.some((qs: string) => titleLower.includes(qs))) return true;

      return false;
    });
  }, [materials, question.assuntos, systemSettings.features.marketplaceEnabled]);

  const [showTeacherComment, setShowTeacherComment] = useState(false);
  const [showDetailedComment, setShowDetailedComment] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  // Modal de upgrade de plano
  const [planUpgradeModal, setPlanUpgradeModal] = useState<{ featureName: string; requiredPlan: string; planLabel: string } | null>(null);

  // Auto-expand comments when question is highlighted OR when there's a comment hash
  useEffect(() => {
    const hash = window.location.hash;
    const hasCommentQuery = new URLSearchParams(window.location.search).has('comment');
    const hasCommentHash = hash.includes('comment-');

    if (isHighlighted || hasCommentQuery || hasCommentHash) {
      setShowComments(true);

      // Scroll to comment if hash exists
      if (hasCommentHash) {
        setTimeout(() => {
          const commentId = hash.substring(1); // Remove the #
          const element = document.getElementById(commentId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    }
  }, [isHighlighted]);
  const [noteText, setNoteText] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [history, setHistory] = useState<UserAnswer[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [isReporting, setIsReporting] = useState(false);
  const [reportDetails, setReportDetails] = useState({ reason: 'Gabarito Errado', details: '' });
  const [reportEvidence, setReportEvidence] = useState<string | null>(null);

  const commentEditorRef = useRef<HTMLDivElement>(null);
  const startTime = useRef<number>(Date.now());

  useEffect(() => {
    // Reset timer when question ID changes
    startTime.current = Date.now();
    setSelectedOptionId(null); // Ensure unselected
  }, [question.id]);

  // New state to track if the user submitted an answer in THIS session
  const [sessionAnswer, setSessionAnswer] = useState<UserAnswer | null>(null);
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);

  // We rely on sessionAnswer for locking the UI in practice mode.
  // existingAnswer is used for history display.
  const isSubmitted = !!sessionAnswer;
  // Revised: Only show result if current session is submitted OR if we are in a mode that forces feedback (like review)
  // But for 'practice' with retry, we want clean state until session answer.
  const showResult = showAnswerFeedback || isSubmitted || (mode === 'simulation' && !!existingAnswer && !hideFeedback);

  // Logic Refinement:
  // - If I have history (`existingAnswer`), I show the TAG in header.
  // - The options should be CLEAN (unselected) to allow re-answering.
  // - Once I answer (`sessionAnswer`), I show the result details.

  // So:
  // Is locked? Only if `sessionAnswer` exists.
  // Show Result (Colors)? Only if `sessionAnswer` exists.
  // ... Unless it's Simulation Review mode (`hideFeedback=false` but we are reviewing). 
  // But here `mode='practice'`.

  // Revised Logic for Practice:
  // Header Tag: Visible if `existingAnswer` || `sessionAnswer`.
  // Options: Interactive until `sessionAnswer`.
  // Feedback (Colors): Visible if `sessionAnswer`.

  // What about "box com histórico"?

  const showHistoryTag = !!existingAnswer;

  const accuracyRate = (question.stats && question.stats.totalAttempts > 0)
    ? Math.round((question.stats.correctCount / question.stats.totalAttempts) * 100)
    : 0;

  // Normaliza o plano para comparação (podem vir em minúsculas do backend)
  // Hierarquia e regras de acesso de plano
  const teacherRequiredPlan = getBenefitRequiredPlan('teacher_comments', systemSettings.planEntitlements);
  const detailedRequiredPlan = getBenefitRequiredPlan('detailed_analysis', systemSettings.planEntitlements);
  const teacherPlanLabel = getBenefitPlanLabel('teacher_comments', systemSettings.planEntitlements);
  const detailedPlanLabel = getBenefitPlanLabel('detailed_analysis', systemSettings.planEntitlements);

  // Gabarito Comentado: Pro ou Elite
  const canSeeTeacher = hasPlanBenefit(currentUser, 'teacher_comments', systemSettings.planEntitlements);
  // Análise Detalhada: apenas Elite
  const canSeeDetailed = hasPlanBenefit(currentUser, 'detailed_analysis', systemSettings.planEntitlements);

  useEffect(() => {
    // Reset session state ONLY when question changes
    setSessionAnswer(null);
    setShowAnswerFeedback(false);
    setSelectedOptionId(null);
    setEliminatedOptionIds([]);
    setIsReporting(false);
    setShowTeacherComment(false);
    setShowDetailedComment(false);
    setShowFilters(false);
    setShowStats(false);
    setShowMaterials(false);
    setLocalStats(question.stats || null);
    setIsContextExpanded(false); // Reset context expansion when question changes

    // In simulation mode, we might want to pre-load the answer if it exists.
    // However, for Practice, we want a clean slate.
    // We do NOT want to reset if existingAnswer changes (which happens when we just answered).
  }, [question.id]);

  useEffect(() => {
    if (mode === 'simulation' && existingAnswer && !sessionAnswer) {
      setSelectedOptionId(existingAnswer.selectedOptionIndex);
    }
  }, [mode, existingAnswer, sessionAnswer, question.id]); // Keep simulation logic updated if needed.

  const [showStats, setShowStats] = useState(false);
  const [localStats, setLocalStats] = useState<QuestionStats | null>(question.stats || null);
  const [loadingStats, setLoadingStats] = useState(false);

  const handleToggleStats = async () => {
    const nextState = !showStats;
    setShowStats(nextState);
    if (nextState) {
      setShowTeacherComment(false);
      setShowDetailedComment(false);
      setShowComments(false);
      setShowMaterials(false);

      setLoadingStats(true);
      try {
        const data = await questionService.getQuestionStats(question.id);
        setLocalStats(data);
      } catch (err) {
        console.error("Failed to load stats", err);
      } finally {
        setLoadingStats(false);
      }
    }
  };

  useEffect(() => {
    if (existingNote) {
      setNoteText(existingNote.text);
    } else {
      setNoteText('');
    }
  }, [existingNote, question.id]);

  useEffect(() => {
    // Only fetch if comments are exactly null (means not yet loaded)
    if (showComments && question.comments === null) {
      fetchComments(Number(question.id));
    }
  }, [showComments, question.id, question.comments, fetchComments]);

  useEffect(() => {
    if (isHistoryModalOpen) {
      setIsLoadingHistory(true);
      // Try to fetch history from backend, fallback to existingAnswer if fail or offline
      questionService.getQuestionHistory(question.id, currentUser?.id || '')
        .then(data => {
          if (Array.isArray(data)) {
            setHistory(data);
            return;
          }

          // Fallback: Show current answer if available
          setHistory(existingAnswer ? [existingAnswer] : []);
        })
        .catch(() => {
          // Fallback on error
          setHistory(existingAnswer ? [existingAnswer] : []);
        })
        .finally(() => setIsLoadingHistory(false));
    }
  }, [isHistoryModalOpen, question.id, existingAnswer]);

  const handleSubmit = () => {
    if (!currentUser) {
      onGuestAction?.('answer');
      return;
    }
    if (selectedOptionId === null || isSubmitted) return;

    // Find selected item index for robust checking
    const selectedItemIndex = question.itens?.findIndex(item => item.id === selectedOptionId) ?? -1;

    // Check correctness by ID OR by Index
    const isAnswerCorrect = Number(selectedOptionId) === Number(question.resposta) ||
      (selectedItemIndex !== -1 && selectedItemIndex === Number(question.resposta));

    const newAnswer = {
      questionId: Number(question.id),
      selectedOptionIndex: Number(selectedOptionId),
      isCorrect: isAnswerCorrect,
      timestamp: Date.now(),
      timeTaken: Math.round((Date.now() - startTime.current) / 1000)
    };
    setSessionAnswer(newAnswer); // Lock interaction locally
    setShowAnswerFeedback(true); // Show correct/incorrect highlighting
    onAnswerSubmit(newAnswer);
  };


  const handleOptionClick = (id: number | string) => {
    if (!currentUser) {
      onGuestAction?.('answer');
      return;
    }
    if (isSubmitted) return;
    setSelectedOptionId(id);
    if (hideFeedback) {
      onAnswerSubmit({
        questionId: Number(question.id),
        selectedOptionIndex: id as number,
        isCorrect: id === question.resposta,
        timestamp: Date.now()
      });
    }
  };

  const handleSendReport = () => {
    if (!currentUser) {
      onGuestAction?.('report');
      return;
    }
    if (!reportDetails.details.trim()) {
      alert("Por favor, detalhe o problema encontrado. A justificativa é obrigatória.");
      return;
    }
    if (onReportError) {
      (onReportError as any)({
        targetType: 'question',
        questionId: Number(question.id),
        userName: currentUserName || 'Usuário',
        userId: currentUserId,
        reason: reportDetails.reason,
        details: reportDetails.details
      });
      setIsReporting(false);
      setReportDetails({ reason: 'Gabarito Errado', details: '' });
    }
  };

  const handleShare = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const questionUrl = `${baseUrl}?questionId=${question.id}`;

    const textToShare = `Confira esta questão no ConcursoMestre! 📚\n\n${question.enunciado_clean ? question.enunciado_clean.substring(0, 150) + '...' : ''}\n\nAcesse o link abaixo para testar seus conhecimentos e ver o gabarito.`;

    if (navigator.share) {
      navigator.share({
        title: 'Desafio ConcursoMestre',
        text: textToShare,
        url: questionUrl
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(`${textToShare}\n\nLink: ${questionUrl}`);
      alert("Link e texto copiados para a área de transferência!");
    }
  };

  const handleSaveNoteLocal = () => {
    if (!currentUser) {
      onGuestAction?.('note');
      return;
    }
    if (onSaveNote) {
      onSaveNote(String(question.id), noteText);
      setIsNoteModalOpen(false);
    }
  };

  const isImageOption = (text: string) => {
    return text.startsWith('blob:') || text.startsWith('http') && (text.match(/\.(jpeg|jpg|gif|png)$/) != null || text.includes('images'));
  };

  const cardContent = (
    <div id={String(question.id)} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm w-full overflow-hidden flex flex-col transition-all relative">

      {/* Header Compacto */}
      <div className="bg-slate-50/70 dark:bg-slate-800/50 p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">#{indexDisplay}</span>
            <Link
              to={buildQuestionPath(question)}
              className="text-[10px] font-bold text-slate-300 transition-colors hover:text-indigo-500 hover:underline dark:text-slate-600 dark:hover:text-indigo-400"
              title={`Abrir pagina da questao ${question.id}`}
            >
              Q{question.id}
            </Link>
            <div className="flex gap-1.5">
              <span className="inline-flex items-center justify-center px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 text-[8px] font-bold rounded uppercase tracking-wide">{(question.assuntos && question.assuntos.length > 0) ? question.assuntos[0].nome : 'Geral'}</span>
              <span className="inline-flex items-center justify-center px-2 py-0.5 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[8px] font-bold rounded border border-slate-200 dark:border-slate-600 uppercase">{['', 'Muito Fácil', 'Fácil', 'Médio', 'Difícil', 'Muito Difícil'][Number(question.dificuldade)] || 'Dificuldade ' + question.dificuldade}</span>
              {!!question.anulada && <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase">Anulada</span>}
              {!!question.desatualizada && <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase">Desatualizada</span>}
              {!!question.desatualizada && <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase">Desatualizada</span>}
              {(existingAnswer || sessionAnswer) && (
                (sessionAnswer || existingAnswer)!.isCorrect
                  ? <span className="border border-emerald-500 text-emerald-600 bg-white dark:bg-emerald-900/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1.5"><CheckCircle2 size={12} /> Resolvida (Certa)</span>
                  : <span className="border border-red-500 text-red-600 bg-white dark:bg-red-900/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1.5"><XCircle size={12} /> Resolvida (Errada)</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (!currentUser) {
                  onGuestAction?.('save');
                  return;
                }
                onToggleSave?.(String(question.id));
              }}
              className={`p-2 rounded-lg transition-all ${isSaved ? 'text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-700 border border-indigo-100 dark:border-indigo-900 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700'}`}
            >
              {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            </button>
            <button onClick={handleShare} className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"><Share2 size={16} /></button>
            {systemSettings.features.reportsEnabled && (
              <button
                onClick={() => !isAlreadyReported && setIsReporting(!isReporting)}
                disabled={isAlreadyReported}
                className={`p-2 rounded-lg transition-all ${isAlreadyReported ? 'text-amber-500 opacity-50' : isReporting ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400'}`}
              >
                <Flag size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${showFilters ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >
            {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Filtros da Questão
          </button>

          {mode === 'practice' && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">
              <BarChart3 size={12} className="text-emerald-500" />
              <span>{accuracyRate}% Acertos</span>
            </div>
          )}
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-3 animate-slide-down">
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Banca</span>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate"><Building2 size={10} className="text-indigo-300 dark:text-indigo-600 flex-shrink-0" /> {question.bancas?.map(b => b.sigla).join(' / ') || '---'}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Ano</span>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300"><Calendar size={10} className="text-indigo-300 dark:text-indigo-600 flex-shrink-0" /> {question.anos?.join(', ') || '---'}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Orgão</span>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate"><Layers size={10} className="text-indigo-300 dark:text-indigo-600 flex-shrink-0" /> {question.orgaos?.map(o => o.sigla || o.nome).join(' / ') || '---'}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Cargo</span>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate"><Briefcase size={10} className="text-indigo-300 dark:text-indigo-600 flex-shrink-0" /> {question.cargos?.map(c => c.descrição).join(', ') || 'Geral'}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Assunto</span>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate"><Tag size={10} className="text-indigo-300 dark:text-indigo-600 flex-shrink-0" /> {question.assuntos?.map(a => a.nome).join(', ') || 'Geral'}</div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {isReporting && (
          <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-5 rounded-2xl animate-slide-down space-y-4 shadow-inner">
            <h4 className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase flex items-center gap-2"><AlertTriangle size={14} /> Reportar Problema na Questão</h4>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-red-400 dark:text-red-500 uppercase ml-1">Tipo de Erro</label>
                <select
                  value={reportDetails.reason}
                  onChange={e => setReportDetails({ ...reportDetails, reason: e.target.value })}
                  className="w-full h-11 px-4 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option>Gabarito Errado</option>
                  <option>Erro de Digitação</option>
                  <option>Matéria Incorreta</option>
                  <option>Desatualizada / Anulada</option>
                  <option>Imagem com Erro</option>
                  <option>Outro</option>
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[9px] font-black text-red-400 dark:text-red-500 uppercase">Explique o Problema {reportDetails.details.trim() === '' && <span className="text-[8px] italic">(OBRIGATÓRIO)</span>}</label>
                </div>
                <textarea
                  placeholder="Descreva detalhadamente o erro que você encontrou para que possamos corrigir..."
                  value={reportDetails.details}
                  onChange={e => setReportDetails({ ...reportDetails, details: e.target.value })}
                  className={`w-full p-4 bg-white dark:bg-slate-800 border ${reportDetails.details.trim() === '' ? 'border-red-200 dark:border-red-800' : 'border-red-100 dark:border-red-900/30'} rounded-xl text-xs text-slate-700 dark:text-slate-300 outline-none min-h-[100px] font-medium resize-none focus:ring-2 focus:ring-red-200`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setIsReporting(false); }} className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase px-4 py-2 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Cancelar</button>
              <button
                onClick={handleSendReport}
                disabled={!reportDetails.details.trim()}
                className="bg-red-600 text-white text-[10px] font-black uppercase px-6 py-2.5 rounded-xl shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 transition-all disabled:opacity-50"
              >
                Enviar Denúncia
              </button>
            </div>
          </div>
        )}

        {(question.grupoQuestao || question.introText) && (
          <div className="mb-4">
            <button
              onClick={() => setIsContextExpanded(!isContextExpanded)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all group"
            >
              Texto associado {isContextExpanded ? <MinusCircle size={14} className="group-hover:scale-110 transition-transform" /> : <PlusCircle size={14} className="group-hover:scale-110 transition-transform" />}
            </button>
          </div>
        )}

        {isContextExpanded && (
          <div className="animate-slide-down">
            {question.grupoQuestao && (question.grupoQuestao.enunciado || question.grupoQuestao.texto || question.grupoQuestao.image_url) && (
              <div className="mb-6 space-y-4">
                {question.grupoQuestao.enunciado && (
                  <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium prose dark:prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: fixHtmlImages(question.grupoQuestao.enunciado) }} />
                  </div>
                )}

                {(question.grupoQuestao.texto && question.grupoQuestao.texto !== question.grupoQuestao.enunciado) && (
                  <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium italic prose dark:prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: fixHtmlImages(question.grupoQuestao.texto) }} />
                  </div>
                )}

                {question.grupoQuestao.image_url && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
                    <img
                      src={getAssetUrl(question.grupoQuestao.image_url)}
                      className="w-full h-auto max-h-[400px] object-contain mx-auto"
                      alt="Texto de apoio"
                    />
                  </div>
                )}
                
                <div className="h-px bg-slate-100 dark:bg-slate-800 w-full my-4" />
              </div>
            )}

            {question.introText && (
              <div className="bg-slate-50 dark:bg-slate-800/50 border-l-2 border-indigo-200 dark:border-indigo-800 p-4 rounded-r-xl mb-6">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed italic whitespace-pre-wrap font-medium">
                  {question.introText}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div className="text-base text-slate-800 dark:text-slate-100 font-semibold leading-relaxed prose prose-indigo dark:prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: fixHtmlImages(question.enunciado) }} />
          </div>
          {question.imageUrl && (
            <div className="my-4 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
              <img src={getAssetUrl(question.imageUrl)} alt="Anexo" className="max-w-full h-auto mx-auto max-h-[400px]" />
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          {(question.itens || []).map((item, index) => {
            const isEliminated = eliminatedOptionIds.includes(item.id);
            const isSelected = selectedOptionId === item.id;
            // Robust check: match by ID OR by Index (since database might store index as answer)
            const isCorrect = Number(question.resposta) === Number(item.id) || Number(question.resposta) === index;
            const isImg = isImageOption(item.corpo);

            let btnClass = "border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10";
            let circleClass = "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700";
            let textClass = "text-slate-600 dark:text-slate-300";

            if (showResult) {
              if (isCorrect) {
                btnClass = "border-emerald-500 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20 shadow-sm";
                circleClass = "bg-emerald-500 text-white border-emerald-500";
                textClass = "font-bold text-slate-900 dark:text-slate-100";
              } else if (isSelected) {
                btnClass = "border-red-500 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20 shadow-sm";
                circleClass = "bg-red-500 text-white border-red-500";
                textClass = "font-bold text-slate-900 dark:text-slate-100";
              } else {
                btnClass = "border-slate-100 dark:border-slate-800 opacity-50";
              }
            } else {
              if (isEliminated) {
                btnClass = "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 opacity-50";
                textClass = "text-slate-400 dark:text-slate-600 italic line-through";
              } else if (isSelected) {
                btnClass = "border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500/10 shadow-sm";
                circleClass = "bg-indigo-600 text-white border-indigo-600";
                textClass = "font-bold text-slate-900 dark:text-slate-100";
              }
            }

            return (
              <div key={index} className="flex gap-2 items-stretch group">
                {!isSubmitted && mode === 'practice' && (
                  <button
                    onClick={() => setEliminatedOptionIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])}
                    className={`px-2 transition-all flex items-center justify-center rounded-xl ${isEliminated ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800' : 'text-slate-200 dark:text-slate-700 hover:text-indigo-400 group-hover:bg-slate-50 dark:group-hover:bg-slate-800'}`}
                    title="Eliminar"
                  >
                    {isEliminated ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
                <div className={`flex-1 flex flex-col gap-2`}>
                  <button
                    disabled={isSubmitted && !hideFeedback}
                    onClick={() => !isEliminated && handleOptionClick(item.id)}
                    className={`flex flex-col gap-2 p-4 rounded-xl border transition-all text-left relative overflow-hidden ${btnClass}`}
                  >
                    <div className="flex items-center gap-4 z-10 relative">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border transition-all flex-shrink-0 ${circleClass}`}>
                        {item.rotulo.trim() || String.fromCharCode(65 + index)}
                      </div>
                      {isImg ? (
                        <div className="max-w-[200px] rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-1">
                          <img src={item.corpo} className="w-full h-auto" alt="" />
                        </div>
                      ) : (
                        <div className={`text-sm font-medium leading-relaxed ${textClass}`} dangerouslySetInnerHTML={{ __html: item.corpo }} />
                      )}
                      {showResult && isCorrect && <CheckCircle2 className="ml-auto text-emerald-500" size={20} />}
                      {showResult && isSelected && !isCorrect && <XCircle className="ml-auto text-red-500" size={20} />}
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between transition-colors duration-300">
          <div className="flex gap-2 items-center flex-wrap">
            {/* Gabarito Comentado - sempre visível, bloqueado por plano */}
            {(question.hasTeacherComment || question.teacherComment) && (
              <button
                onClick={() => {
                  if (!canSeeTeacher) {
                    setPlanUpgradeModal({ featureName: 'Gabarito Comentado', requiredPlan: teacherRequiredPlan, planLabel: teacherPlanLabel });
                    return;
                  }
                  setShowTeacherComment(!showTeacherComment);
                  setShowDetailedComment(false);
                }}
                className={`flex items-center gap-1.5 font-bold text-[9px] uppercase px-3 py-2 rounded-lg border transition-all ${showTeacherComment ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : canSeeTeacher ? 'text-amber-700 dark:text-amber-400 bg-white dark:bg-slate-700 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-slate-600' : 'text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
              >
                {canSeeTeacher ? <GraduationCap size={14} /> : <Lock size={12} />}
                Gabarito Comentado
              </button>
            )}

            {/* Análise Detalhada - sempre visível, bloqueado por plano */}
            {(question.hasDetailedComment || question.detailedComment) && (
              <button
                onClick={() => {
                  if (!canSeeDetailed) {
                    setPlanUpgradeModal({ featureName: 'Análise Detalhada', requiredPlan: detailedRequiredPlan, planLabel: detailedPlanLabel });
                    return;
                  }
                  setShowDetailedComment(!showDetailedComment);
                  setShowTeacherComment(false);
                }}
                className={`flex items-center gap-1.5 font-bold text-[9px] uppercase px-3 py-2 rounded-lg border transition-all ${showDetailedComment ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : canSeeDetailed ? 'text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-700 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-slate-600' : 'text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
              >
                {canSeeDetailed ? <BookOpen size={14} /> : <Lock size={12} />}
                Análise Detalhada
              </button>
            )}

            {systemSettings.features.communityEnabled && (
              <button onClick={() => { setShowComments(!showComments); setShowMaterials(false); setShowStats(false); setShowTeacherComment(false); setShowDetailedComment(false); }} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-[9px] uppercase border transition-all ${showComments ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300'}`}>
                <MessageSquare size={14} /> {question.commentsCount || 0} Comentários
              </button>
            )}

            <button onClick={() => { handleToggleStats(); setShowMaterials(false); }} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-[9px] uppercase border transition-all ${showStats ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300'}`}>
              <BarChart3 size={14} /> Estatísticas
            </button>

            {systemSettings.features.marketplaceEnabled && hasRelatedMaterials && (
              <button onClick={() => { setShowMaterials(!showMaterials); setShowStats(false); setShowComments(false); setShowTeacherComment(false); setShowDetailedComment(false); }} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-[9px] uppercase border transition-all ${showMaterials ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300'}`}>
                <BookOpen size={14} /> Materiais Relacionados
              </button>
            )}

            <button onClick={() => setIsNoteModalOpen(true)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-[9px] uppercase border transition-all ${noteText ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/50' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/10'}`}>
              <StickyNote size={14} /> {noteText ? 'Anotação ✅' : 'Anotar'}
            </button>

            {isSubmitted && (
              <button onClick={() => setIsHistoryModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-[9px] uppercase border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all">
                <History size={14} /> Histórico
              </button>
            )}
          </div>

          {!isSubmitted && mode === 'practice' ? (
            <button
              disabled={selectedOptionId === null}
              onClick={handleSubmit}
              className="px-8 py-3 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all disabled:opacity-30 text-[10px] shadow-lg shadow-slate-200 dark:shadow-none"
            >
              Responder
            </button>
          ) : null}
        </div>

        {/* Áreas Expandidas */}
        {(showComments || showTeacherComment || showDetailedComment || showStats || showMaterials) && (
          <div className="bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 animate-fade-in divide-y divide-slate-100 dark:divide-slate-800">

            {showStats && (
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 animate-slide-down">
                <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-400 font-bold text-[9px] uppercase tracking-widest mb-4">
                  <BarChart3 size={14} /> Estatísticas da Questão
                </div>

                {loadingStats ? (
                  <div className="flex justify-center py-8"><span className="animate-spin text-2xl">⏳</span></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total de Respostas</span>
                      <span className="text-3xl font-black text-slate-800 dark:text-slate-200">{localStats?.totalAttempts || 0}</span>

                      {(() => {
                        // FIX: Use the EXACT SAME logic as the bars to find the count for the correct item.
                        // 1. Identify Correct Item
                        // Robust check: matches ID or Index
                        const correctItem = (question.itens || []).find((it, idx) =>
                          Number(it.id) === Number(question.resposta) || idx === Number(question.resposta)
                        );
                        const correctIndex = (question.itens || []).indexOf(correctItem as any);

                        const dist = localStats?.optionDistribution || {};
                        let calculatedCorrect = 0;

                        // 2. Calculate Count for that item using established fallback chain
                        if (correctItem) {
                          calculatedCorrect = dist[String(correctItem.id)] ||
                            dist[correctItem.rotulo] ||
                            dist[String(correctIndex)] || 0;
                        } else {
                          // Fallback if item not found but answer might be a raw index
                          calculatedCorrect = dist[String(question.resposta)] || 0;
                        }

                        // Safety: Cannot be more than total
                        const total = localStats?.totalAttempts || 0;
                        if (calculatedCorrect > total) calculatedCorrect = total;

                        const calculatedWrong = total - calculatedCorrect;

                        return (
                          <div className="flex gap-4 mt-2 w-full justify-center">
                            <div className="text-center">
                              <div className="text-xs font-bold text-emerald-600">{calculatedCorrect}</div>
                              <div className="text-[8px] font-bold text-slate-400 uppercase">Certos</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs font-bold text-red-600">{calculatedWrong}</div>
                              <div className="text-[8px] font-bold text-slate-400 uppercase">Errados</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="space-y-3">
                      {(question.itens || []).map((item, idx) => {
                        const count = localStats?.optionDistribution?.[String(item.id)] || localStats?.optionDistribution?.[item.rotulo] || localStats?.optionDistribution?.[String(idx)] || 0;
                        const total = localStats?.totalAttempts || 1;
                        const percent = total > 0 ? Math.round((count / total) * 100) : 0;

                        return (
                          <div key={item.id} className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold text-slate-500">
                              <span>Alternativa {item.rotulo || String.fromCharCode(65 + idx)}</span>
                              <span className="flex items-center gap-1">
                                <span className="text-slate-700 dark:text-slate-300">{percent}%</span>
                                <span className="text-slate-400 font-medium">({count} votos)</span>
                              </span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {showTeacherComment && (
              <div className="p-6 bg-amber-50/30 dark:bg-amber-900/10 animate-slide-down">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-bold text-[9px] uppercase tracking-widest mb-3">
                  <GraduationCap size={14} /> Comentário do Professor
                </div>
                {question.teacherComment ? (
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-amber-100/50 dark:border-amber-900/30 shadow-sm text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                    {question.teacherComment}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-dashed border-amber-200 dark:border-amber-900/30 text-center">
                    <GraduationCap size={24} className="text-amber-300 dark:text-amber-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Comentário do professor ainda não disponível para esta questão.</p>
                  </div>
                )}
              </div>
            )}

            {showDetailedComment && (
              <div className="p-6 bg-indigo-50/30 dark:bg-indigo-900/10 animate-slide-down">
                <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-400 font-bold text-[9px] uppercase tracking-widest mb-3">
                  <BookOpen size={14} /> Análise Detalhada
                </div>
                {question.detailedComment ? (
                  <div className="prose prose-indigo prose-sm max-w-none text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-6 rounded-xl border border-indigo-100/50 dark:border-indigo-900/30 shadow-sm">
                    <ReactMarkdown>{question.detailedComment}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-900/30 text-center">
                    <BookOpen size={24} className="text-indigo-300 dark:text-indigo-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Análise detalhada ainda não disponível para esta questão.</p>
                  </div>
                )}
              </div>
            )}

            {showComments && (
              <CommentsSection
                targetId={String(question.id)}
                comments={question.comments || []}
                onAddComment={(text, parentId) => onAddComment?.(String(question.id), text, parentId)}
                onLikeComment={(commentId) => onLikeComment?.(String(question.id), commentId)}
                onReportComment={(commentId) => reportComment(commentId, 'Abuso', 'Reportado via interface de comentários')}
                onDeleteComment={(commentId) => deleteComment(Number(question.id), commentId)}
              />
            )}

            {showMaterials && <RelatedMaterialsSection question={question} currentUser={currentUser} onClose={() => setShowMaterials(false)} />}
            <div className="px-6 py-4">
              <AdBanner type="bottom" />
            </div>
          </div>
        )}

        {/* Modal de Anotações Simplificado */}
        {isNoteModalOpen && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-xl animate-scale-in overflow-hidden flex flex-col transition-colors">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-yellow-50/50 dark:bg-yellow-900/20">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest flex items-center gap-2"><StickyNote size={16} /> Minha Anotação</h3>
                <button onClick={() => setIsNoteModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><XCircle size={20} /></button>
              </div>
              <div className="p-6">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  className="w-full h-60 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-yellow-400/20 text-sm text-slate-700 dark:text-slate-300 resize-none transition-colors"
                  placeholder="Sua nota aqui..."
                />
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50/50 dark:bg-slate-800/50">
                <button onClick={() => setIsNoteModalOpen(false)} className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Fechar</button>
                <button onClick={handleSaveNoteLocal} className="px-6 py-2 bg-yellow-400 dark:bg-yellow-600 text-yellow-900 dark:text-white rounded-xl text-[10px] font-black uppercase shadow-sm">Salvar</button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Modal de Histórico */}
        {isHistoryModalOpen && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-xl animate-scale-in overflow-hidden flex flex-col transition-colors">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest flex items-center gap-2"><History size={16} /> Histórico de Resoluções</h3>
                <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><XCircle size={20} /></button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {isLoadingHistory ? (
                  <div className="text-center py-8 text-slate-400 text-xs">Carregando...</div>
                ) : history.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">Nenhum histórico encontrado.</div>
                ) : (
                  <div className="space-y-3">
                    {history.map((h, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${h.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {(question.itens || []).find(item => item.id === h.selectedOptionIndex)?.rotulo || '?'}
                          </div>
                          <div>
                            <p className={`text-xs font-bold ${h.isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>{h.isCorrect ? 'Correto' : 'Incorreto'}</p>
                            <p className="text-[10px] text-slate-400">{new Date(h.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/50">
                <button onClick={() => setIsHistoryModalOpen(false)} className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase shadow-sm">Fechar</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );

  // Modal de upgrade de plano
  const upgradeModal = planUpgradeModal ? createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => setPlanUpgradeModal(null)}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8 max-w-sm w-full text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
          <Lock size={28} className="text-indigo-500 dark:text-indigo-400" />
        </div>
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-1">{planUpgradeModal.featureName}</h3>
        <p className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-4">{planUpgradeModal.planLabel}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
          Este recurso está disponível apenas para assinantes do{' '}
          <strong className="text-slate-700 dark:text-slate-200">{planUpgradeModal.planLabel}</strong>.
          Faça upgrade para desbloquear todos os recursos premium.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setPlanUpgradeModal(null)}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Fechar
          </button>
          <button
            onClick={() => { setPlanUpgradeModal(null); navigate('/plans'); }}
            className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black uppercase tracking-wide transition-all shadow-lg"
          >
            Ver Planos
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {upgradeModal}
      {cardContent}
    </>
  );
};

const RelatedMaterialsSection = ({ question, currentUser, onClose }: any) => {
  const { materials, transactions } = useMarketplace();
  const navigate = useNavigate();

  // Encontrar materiais relacionados
  const relatedMaterials = React.useMemo(() => {
    if (!materials || materials.length === 0) return [];

    console.log('[QuestionCard] Filtering related materials. Total available:', materials.length);

    // Ajuste: materiais podem vir do painel de compras e não ter o status 'approved', 
    // então removemos a trava de status caso o material pertença ao sistema ou ao usuário.
    const availableMaterials = materials;

    console.log('[QuestionCard] Available materials for match:', availableMaterials.length);

    // Critérios de combinação - Removemos itens vazios para evitar matches coringa (includes(""))
    const questionSubjects = question.assuntos?.map((a: any) => a.nome?.trim().toLowerCase()).filter(Boolean) || [];
    const questionTopics = question.assuntos?.map((a: any) => a.topico?.trim().toLowerCase()).filter(Boolean) || [];

    // Tentar encontrar matches fortes (Assunto/Materia ou Tópico)
    let matches = availableMaterials.filter(m => {
      const matSubjectInfo = typeof m.subject === 'string' ? m.subject : ((m.subject as any)?.name || m.subjectText || '');
      const matSubject = matSubjectInfo?.trim().toLowerCase();
      const matTopic = (m.topic || '')?.trim().toLowerCase();

      const hasSubjectMatch = matSubject && questionSubjects.some((qs: string) => qs.includes(matSubject) || matSubject.includes(qs));
      const hasTopicMatch = matTopic && (questionTopics.some((qt: string) => qt.includes(matTopic) || matTopic.includes(qt)) || questionSubjects.some((qs: string) => qs.includes(matTopic) || matTopic.includes(qs)));

      // Retorna match se a matéria OU o tópico baterem com as tags da questão
      return hasSubjectMatch || hasTopicMatch;
    });

    // Se poucos, tentar matches mais fracos (Nome do material contém a matéria)
    if (matches.length < 3 && questionSubjects.length > 0) {
      const moreMatches = availableMaterials.filter(m => !matches.find(x => x.id === m.id)).filter(m => {
        const titleLower = (m.title || '').toLowerCase();
        return questionSubjects.some((qs: string) => titleLower.includes(qs));
      });
      matches = [...matches, ...moreMatches];
    }

    // Se AINDA tiver pouco, tentar preencher com materiais relevantes aprovados gerais,
    // que o usuário ainda não possui, para incentivar a compra
    if (matches.length < 3) {
      const fallback = availableMaterials
        .filter(m => m.status === 'approved')
        .filter(m => !matches.find(x => x.id === m.id));

      matches = [...matches, ...fallback];
    }

    // Retorna os 3 primeiros (ou aleatórios se houver muitos)
    return matches.slice(0, 3);
  }, [materials, question]);

  if (relatedMaterials.length === 0) {
    return (
      <div className="p-6 bg-slate-50 dark:bg-slate-800/50 animate-slide-down flex flex-col items-center justify-center text-center">
        <BookOpen size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Não encontramos materiais perfeitamente relacionados no momento.</p>
        <button onClick={() => navigate('/marketplace')} className="mt-4 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">Ver todos os materiais na Loja</button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-indigo-50/30 dark:bg-indigo-900/10 animate-slide-down">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-400 font-bold text-[9px] uppercase tracking-widest">
          <BookOpen size={14} /> Materiais Recomendados para este assunto
        </div>
      </div>

      <AdBanner type="sidebar" className="my-4" />

      <div className="flex flex-col gap-2">
        {relatedMaterials.map(m => {
          // Robust access check considering refunds via transactions array
          const validTransaction = transactions?.find((t: any) =>
            t.materialId === m.id &&
            t.buyerId === currentUser?.id &&
            (t.status === 'completed' || t.status === 'approved')
          );

          const isPurchased = !!validTransaction;
          const isAuthor = currentUser?.id === m.authorId;
          const showAsOwned = isPurchased || isAuthor;
          const materialUrl = `/marketplace?materialId=${m.id}`;

          return (
            <div key={m.id} onClick={() => navigate(materialUrl)} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-pointer group gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-600 group-hover:border-indigo-200 dark:group-hover:border-indigo-600 transition-colors flex-shrink-0 overflow-hidden">
                  {m.coverUrl ? (
                    <img src={m.coverUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <BookOpen size={18} />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate pr-4 transition-colors">{m.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 rounded transition-colors">{m.type}</span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate transition-colors">{m.authorName}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center w-full sm:w-auto justify-between sm:justify-start gap-4 sm:pl-4 sm:border-l border-slate-100 dark:border-slate-700 transition-colors pt-2 sm:pt-0">
                {!showAsOwned ? (
                  <div className="flex flex-col items-start sm:items-end bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">Valor</span>
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">R$ {m.price > 0 ? m.price.toFixed(2).replace('.', ',') : 'Grátis'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
                    <CheckCircle2 size={14} /> <span className="hidden sm:inline">Adquirido</span>
                  </div>
                )}

                {showAsOwned ? (
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/read/${m.id}`); }} className="px-5 py-2.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors shadow-sm w-full sm:w-auto">
                    Ler
                  </button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); navigate(materialUrl); }} className="px-5 py-2.5 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-colors shadow-sm w-full sm:w-auto">
                    Comprar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(QuestionCard, (prevProps, nextProps) => {
  return (
    prevProps.question.id === nextProps.question.id &&
    prevProps.existingAnswer?.selectedOptionIndex === nextProps.existingAnswer?.selectedOptionIndex &&
    prevProps.isSaved === nextProps.isSaved &&
    prevProps.isAlreadyReported === nextProps.isAlreadyReported &&
    prevProps.existingNote === nextProps.existingNote &&
    prevProps.question.commentsCount === nextProps.question.commentsCount &&
    prevProps.question.comments === nextProps.question.comments &&
    prevProps.isHighlighted === nextProps.isHighlighted
  );
});
