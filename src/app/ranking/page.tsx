'use client';

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

import React, { useState, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Ranking, RankingEntry } from '../../types';
import {
   Trophy, Plus, Users, BarChart3, ChevronRight,
   Info, Calendar, Save, X, ArrowRight, Settings, LayoutGrid, List, Search, Clock, AlertCircle, Edit3, Trash2, CheckCircle, ShieldCheck, Hash, Layers, UserCheck, FileText, Check, PlusCircle, UploadCloud, Loader2, AlertTriangle
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useToast } from '@providers/ToastProvider';
import AuthModal from '../../components/shared/overlays/AuthModal';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Tela pública de rankings pos-prova.
 * Ela conecta listagem, participacao do candidato e moderação administrativa no fluxo de rankings do site.
 * @since v1.0.0
 */
const RankingPage: React.FC = () => {
   const { currentUser } = useAuth();
   const { addToast } = useToast();
   const { rankings, addRanking, updateRanking, deleteRanking, submitRankingEntry, moderateRanking, ensureRankingsLoaded } = useData();
   const [selectedRanking, setSelectedRanking] = useState<Ranking | null>(null);
   const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
   const [searchTerm, setSearchTerm] = useState('');

   React.useEffect(() => {
      ensureRankingsLoaded();
   }, [ensureRankingsLoaded]);

   // Modais
   const [isCreating, setIsCreating] = useState(false);
   const [isEditing, setIsEditing] = useState(false);
   const [isParticipating, setIsParticipating] = useState(false);
   const [participationStep, setParticipationStep] = useState(1);
   const [showInfo, setShowInfo] = useState(false);
   const [showAuthModal, setShowAuthModal] = useState(false);
   const [authModalConfig, setAuthModalConfig] = useState({
      title: '',
      description: '',
      actionSource: 'ranking'
   });

   // Forms
   const [rankingForm, setRankingForm] = useState({
      name: '', institution: '', totalQuestions: 60, vacanciesAc: 0, vacanciesAfro: 0, vacanciesPcd: 0, officialKeyReleaseDate: '',
      keyStatus: 'pending' as 'official' | 'pending', hasDiscursive: false, examTypes: [],
      officialKeyPdfFile: null as File | null,
      correctKey: ''
   });
   const [newTypeName, setNewTypeName] = useState('');

   const [partForm, setPartForm] = useState({
      registration: '',
      examType: '',
      category: 'AC' as 'AC' | 'Afro' | 'PCD',
      discursiveScore: undefined as number | undefined,
      answers: [] as string[]
   });

   const isAdmin = currentUser?.isAdmin;

   /**
    * Normaliza a colecao de rankings recebida do contexto.
    * Isso evita crash na tela quando algum payload legado chega envelopado por engano.
    * @since 1.0.0
    */
   const rankingsList = useMemo(() => {
      return Array.isArray(rankings) ? rankings : [];
   }, [rankings]);

   // Filtro de rankings por nome
   const filteredRankings = useMemo(() => {
      return rankingsList.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.institution.toLowerCase().includes(searchTerm.toLowerCase()));
   }, [rankingsList, searchTerm]);

   /**
    * Calcula o gabarito de consenso quando o ranking ainda não tem gabarito oficial.
    * Esse fallback sustenta a classificacao colaborativa exibida na propria pagina.
    * @since v1.0.0
    */
   const getConsensusKey = (entries: RankingEntry[], totalQuestions: number): string => {
      let consensusKey = "";
      for (let i = 0; i < totalQuestions; i++) {
         const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
         entries.forEach(entry => {
            const char = entry.userAnswers[i];
            if (['A', 'B', 'C', 'D', 'E'].includes(char)) counts[char] = (counts[char] || 0) + 1;
         });
         let maxChar = 'X', maxCount = -1;
         Object.entries(counts).forEach(([char, count]) => {
            if (count > maxCount) { maxCount = count; maxChar = char; }
            else if (count === maxCount && count > 0) maxChar = 'X';
         });
         consensusKey += maxChar;
      }
      return consensusKey;
   };

   /**
    * Calcula a nota objetiva do candidato comparando respostas e gabarito ativo.
    * O resultado e reaproveitado tanto no ranking em tela quanto no envio da participacao.
    * @since v1.0.0
    */
   const calculateScore = (key: string, userAnswers: string) => {
      let score = 0;
      for (let i = 0; i < Math.min(key.length, userAnswers.length); i++) {
         if (key[i] !== 'X' && key[i] === userAnswers[i]) score++;
      }
      return score;
   };

   const processedData = useMemo(() => {
      if (!selectedRanking) return null;
      const rankingEntries = Array.isArray(selectedRanking.entries) ? selectedRanking.entries : [];
      const activeKey = selectedRanking.keyStatus === 'official' ? selectedRanking.correctKey : getConsensusKey(rankingEntries, selectedRanking.totalQuestions);
      const entries = rankingEntries.map(e => ({ ...e, score: calculateScore(activeKey, e.userAnswers) })).sort((a, b) => b.score - a.score);
      return { entries, activeKey };
   }, [selectedRanking]);

   /**
    * Cria ou atualiza um ranking no fluxo administrativo da pagina.
    * Essa funcao e usada quando admins abrem o modal de manutencao diretamente no ranking.
    * @since v1.0.0
    */
   const handleCreateOrUpdate = (e: React.FormEvent) => {
      e.preventDefault();

      const payload: Partial<Ranking> = {
         name: rankingForm.name,
         institution: rankingForm.institution,
         totalQuestions: rankingForm.totalQuestions,
         vacanciesAc: rankingForm.vacanciesAc,
         vacanciesAfro: rankingForm.vacanciesAfro,
         vacanciesPcd: rankingForm.vacanciesPcd,
         officialKeyReleaseDate: rankingForm.officialKeyReleaseDate,
         keyStatus: rankingForm.keyStatus,
         hasDiscursive: rankingForm.hasDiscursive,
         examTypes: rankingForm.examTypes,
         correctKey: rankingForm.correctKey
      };

      // Handle file upload if keyStatus === 'official' and officialKeyPdfFile exists
      // Fake handling for preview
      let pdfUrl = selectedRanking?.officialKeyPdfUrl || '';
      if (rankingForm.keyStatus === 'official' && rankingForm.officialKeyPdfFile) {
         pdfUrl = URL.createObjectURL(rankingForm.officialKeyPdfFile);
      }

      if (isEditing && selectedRanking) {
         const updated = {
            ...selectedRanking,
            ...rankingForm,
            officialKeyPdfUrl: rankingForm.keyStatus === 'official' ? pdfUrl : undefined,
            officialKeyReleaseDate: rankingForm.keyStatus === 'pending' ? rankingForm.officialKeyReleaseDate : undefined
         };
         updateRanking(updated);
         setSelectedRanking(updated);
         setIsEditing(false);
      } else {
         const n: Ranking = {
            id: `r-${Date.now()}`, ...rankingForm, reserveLimit: 10, correctKey: '',
            entries: [], createdAt: Date.now(), imageUrl: '',
            examTypes: rankingForm.examTypes.length > 0 ? rankingForm.examTypes : ['Padrão'],
            officialKeyPdfUrl: rankingForm.keyStatus === 'official' ? pdfUrl : undefined,
            officialKeyReleaseDate: rankingForm.keyStatus === 'pending' ? rankingForm.officialKeyReleaseDate : undefined
         };
         addRanking(n);
         setIsCreating(false);
      }
   };

   /**
    * Finaliza a participacao do usuário autenticado e envia a tentativa ao contexto global.
    * Esse fechamento e o ponto que persiste a nota e reidrata a lista local do ranking aberto.
    * @since v1.0.0
    */
   const handleFinishParticipation = () => {
      if (!currentUser) {
         setAuthModalConfig({
            title: "Participe do Ranking",
            description: "Crie uma conta gratuita para registrar sua nota, ver sua colocação real e simular sua aprovação.",
            actionSource: 'ranking_submit'
         });
         setShowAuthModal(true);
         return;
      }
      if (!currentUser.emailVerified) {
         setAuthModalConfig({
            title: "Confirme seu E-mail",
            description: "Para participar dos rankings e simular sua aprovação, você precisa confirmar seu e-mail.",
            actionSource: 'ranking_email_verification'
         });
         setShowAuthModal(true);
         return;
      }
      if (!selectedRanking) return;

      const userAnswers = partForm.answers.join('');
      const rankingEntries = Array.isArray(selectedRanking.entries) ? selectedRanking.entries : [];
      const activeKey = selectedRanking.keyStatus === 'official'
         ? selectedRanking.correctKey
         : getConsensusKey(rankingEntries, selectedRanking.totalQuestions);

      const score = calculateScore(activeKey, userAnswers);

      // Check if user already has an entry to reuse ID or at least update correctly
      const existingEntry = rankingEntries.find(en => en.userId === currentUser.id);

      const e: RankingEntry = {
         id: existingEntry?.id || `u-${Date.now()}`,
         userName: currentUser?.name || 'Candidato',
         registrationNumber: partForm.registration,
         examType: partForm.examType || (selectedRanking.examTypes[0] || 'Geral'),
         category: partForm.category,
         discursiveScore: selectedRanking.hasDiscursive ? partForm.discursiveScore : undefined,
         userAnswers,
         score,
         timestamp: Date.now(),
         status: 'active',
         userId: currentUser.id
      };

      let newEntries;
      if (existingEntry) {
         newEntries = rankingEntries.map(en => en.userId === currentUser.id ? e : en);
      } else {
         newEntries = [...rankingEntries, e];
      }

      const r = { ...selectedRanking, entries: newEntries };
      submitRankingEntry(r.id, e);
      setSelectedRanking(r);
      setIsParticipating(false);
      setParticipationStep(1);
   };

   /**
    * Prepara o formulário de participacao para um ranking especifico.
    * Ela reaproveita respostas anteriores do usuário quando ele retorna para editar a tentativa.
    * @since v1.0.0
    */
   const participateRanking = (r: Ranking) => {
      if (!currentUser) {
         setAuthModalConfig({
            title: "Participe do Ranking",
            description: "Crie uma conta gratuita para registrar sua nota, ver sua colocação real e simular sua aprovação.",
            actionSource: 'ranking_submit'
         });
         setShowAuthModal(true);
         return;
      }

      setSelectedRanking(r);
      const rankingEntries = Array.isArray(r.entries) ? r.entries : [];
      const existingEntry = rankingEntries.find(e => e.userId === currentUser?.id);
      if (existingEntry) {
         let existingAnswers = existingEntry.userAnswers.split('');
         // Pad with empty strings if the current ranking has more questions than the previous entry
         if (existingAnswers.length < r.totalQuestions) {
            existingAnswers = [...existingAnswers, ...Array(r.totalQuestions - existingAnswers.length).fill('')];
         }

         setPartForm({
            answers: existingAnswers,
            registration: existingEntry.registrationNumber,
            examType: existingEntry.examType,
            category: existingEntry.category,
            discursiveScore: existingEntry.discursiveScore || 0
         });
         addToast("Suas respostas anteriores foram carregadas para edição.", "info");
      } else {
         setPartForm({
            ...partForm,
            answers: Array(r.totalQuestions).fill(''),
            registration: '',
            examType: r.examTypes[0] || '',
            category: 'AC',
            discursiveScore: 0
         });
      }

      setParticipationStep(1);
      setIsParticipating(true);
   };

   /**
    * Adiciona um tipo de prova ao formulário administrativo do ranking.
    * O valor alimenta o modal de criacao/edicao usado pelos admins nesta tela.
    * @since v1.0.0
    */
   const addExamType = () => {
      if (newTypeName.trim()) {
         setRankingForm({ ...rankingForm, examTypes: [...rankingForm.examTypes, newTypeName.trim()] });
         setNewTypeName('');
      }
   };

   return (
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-32">
         {!selectedRanking ? (
            <>
               <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                  <div>
                     <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors"><Trophy className="text-indigo-600 dark:text-indigo-400" size={24} /> Rankings</h1>
                        <span className="bg-indigo-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-widest ml-1 shadow-sm">Beta</span>
                     </div>
                     <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Ranking pós-prova. Classificação colaborativa e nota de corte projetada.</p>
                  </div>

                  <div className="flex gap-2">
                     <button onClick={() => {
                        if (!currentUser) {
                           setAuthModalConfig({
                              title: "Crie seu Ranking",
                              description: "Organize um ranking colaborativo para o seu concurso e ajude toda a comunidade.",
                              actionSource: 'ranking_create'
                           });
                           setShowAuthModal(true);
                           return;
                        }
                        setRankingForm({ name: '', institution: '', totalQuestions: 60, vacanciesAc: 0, vacanciesAfro: 0, vacanciesPcd: 0, officialKeyReleaseDate: '', keyStatus: 'pending', hasDiscursive: false, examTypes: [], officialKeyPdfFile: null, correctKey: '' }); setIsCreating(true);
                     }} className="bg-slate-900 dark:bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-slate-200 dark:shadow-none">
                        <Plus size={14} /> Criar Ranking
                     </button>
                  </div>
               </header>

               <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 transition-colors">
                  <div className="flex flex-col md:flex-row gap-3 items-center">
                     <div className="flex-1 relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                        <input
                           type="text"
                           placeholder="Buscar concurso ou banca..."
                           value={searchTerm}
                           onChange={e => setSearchTerm(e.target.value)}
                           className="w-full h-11 pl-10 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 font-bold text-xs transition-all"
                        />
                     </div>
                     <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}><LayoutGrid size={16} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}><List size={16} /></button>
                     </div>
                  </div>
               </div>

               {filteredRankings.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 transition-colors">
                     <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                        <Trophy size={40} className="text-slate-300 dark:text-slate-600" />
                     </div>
                     <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">Nenhum ranking disponível</h3>
                     <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8 max-w-sm mx-auto">
                        {searchTerm ? 'Não encontramos rankings para os critérios de busca selecionados.' : 'Ainda não há rankings cadastrados. Seja o primeiro a criar um!'}
                     </p>
                     {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="px-6 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all">
                           Limpar Filtros
                        </button>
                     )}
                  </div>
               ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {filteredRankings.map(r => (
                        <div key={r.id} onClick={() => setSelectedRanking(r)} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group flex flex-col h-full">
                           <div className="flex items-start justify-between mb-4">
                              <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-700 transition-colors">
                                 {r.imageUrl ? <img src={r.imageUrl} className="w-full h-full object-contain p-1.5" /> : <Trophy size={20} className="text-slate-300 dark:text-slate-600" />}
                              </div>
                              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-colors ${r.keyStatus === 'official' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30'}`}>
                                 {r.keyStatus === 'official' ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                                 {r.keyStatus === 'official' ? 'Oficial' : 'Presumido'}
                              </div>
                           </div>
                           <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">{r.name}</h3>
                           <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-6">{r.institution}</p>

                           <div className="mt-auto pt-4 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between transition-colors">
                              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase">
                                 <Users size={12} /> {r.entries.length} Inscritos
                              </div>
                              <span className="text-indigo-600 dark:text-indigo-400 font-black text-[9px] uppercase tracking-widest flex items-center gap-1 group-hover:underline">Entrar <ChevronRight size={10} /></span>
                           </div>
                        </div>
                     ))}
                  </div>
               ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-700 transition-colors">
                           <tr><th className="px-6 py-4">Certame</th><th className="px-6 py-4">Banca</th><th className="px-6 py-4">Inscritos</th><th className="px-6 py-4">Gabarito</th><th className="px-6 py-4 text-right">Ação</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                           {filteredRankings.map(r => (
                              <tr key={r.id} onClick={() => setSelectedRanking(r)} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group">
                                 <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100 transition-colors">{r.name}</td>
                                 <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium uppercase transition-colors">{r.institution}</td>
                                 <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-black transition-colors">{r.entries.length}</td>
                                 <td className="px-6 py-4">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border transition-colors ${r.keyStatus === 'official' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800/30'}`}>{r.keyStatus === 'official' ? 'Oficial' : 'Presumido'}</span>
                                 </td>
                                 <td className="px-6 py-4 text-right"><ChevronRight size={16} className="ml-auto text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" /></td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )}
            </>
         ) : (
            <div className="space-y-6 animate-slide-up">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <button onClick={() => setSelectedRanking(null)} className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
                     <ArrowRight className="rotate-180" size={12} /> Voltar
                  </button>

                  <div className="flex items-center gap-3">
                     {isAdmin && (
                        <div className="flex gap-2">
                           <button onClick={() => {
                              setRankingForm({
                                 name: selectedRanking.name,
                                 institution: selectedRanking.institution,
                                 totalQuestions: selectedRanking.totalQuestions,
                                 vacanciesAc: selectedRanking.vacanciesAc || 0,
                                 vacanciesAfro: selectedRanking.vacanciesAfro || 0,
                                 vacanciesPcd: selectedRanking.vacanciesPcd || 0,
                                 officialKeyReleaseDate: selectedRanking.officialKeyReleaseDate || '',
                                 keyStatus: selectedRanking.keyStatus,
                                 hasDiscursive: selectedRanking.hasDiscursive,
                                 examTypes: selectedRanking.examTypes || [],
                                 correctKey: selectedRanking.correctKey || '',
                                 officialKeyPdfFile: null
                              });
                              setIsEditing(true);
                           }} className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all" title="Editar Ranking"><Edit3 size={16} /></button>
                           <button onClick={() => { if (confirm("Deseja excluir este ranking?")) { deleteRanking(selectedRanking.id); setSelectedRanking(null); } }} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all" title="Excluir Ranking"><Trash2 size={16} /></button>
                           {selectedRanking.status === 'pending' && (
                              <>
                                 <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2 self-center rounded-full"></div>
                                 <button onClick={() => moderateRanking(selectedRanking.id, 'approved')} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 rounded-lg text-[10px] uppercase font-black tracking-widest transition-all flex items-center gap-1"><Check size={14} /> Aprovar</button>
                                 <button onClick={() => moderateRanking(selectedRanking.id, 'rejected')} className="px-3 py-1.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 rounded-lg text-[10px] uppercase font-black tracking-widest transition-all flex items-center gap-1"><X size={14} /> Rejeitar</button>
                              </>
                           )}
                        </div>
                     )}
                     {selectedRanking.keyStatus === 'pending' && selectedRanking.officialKeyReleaseDate && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase transition-colors">
                           <Clock size={12} className="text-indigo-500 dark:text-indigo-400" /> Gabarito Oficial: {new Date(selectedRanking.officialKeyReleaseDate).toLocaleDateString()}
                        </div>
                     )}
                     {selectedRanking.keyStatus === 'official' && selectedRanking.officialKeyPdfUrl && (
                        <a href={selectedRanking.officialKeyPdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800/50 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all">
                           <FileText size={12} /> Ver Gabarito
                        </a>
                     )}
                  </div>
               </div>

               <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-8 relative overflow-hidden transition-colors">
                  <div className="flex-1 space-y-4">
                     <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-colors ${selectedRanking.keyStatus === 'official' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30'}`}>
                           {selectedRanking.keyStatus === 'official' ? <ShieldCheck size={12} /> : <AlertCircle size={12} />}
                           {selectedRanking.keyStatus === 'official' ? 'Oficial' : 'Presumido'}
                        </div>
                        <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest transition-colors">{selectedRanking.institution}</span>
                        <button onClick={() => setShowInfo(!showInfo)} className="text-slate-300 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"><Info size={16} /></button>
                     </div>

                     <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight transition-colors">{selectedRanking.name}</h1>

                     {showInfo && (
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-2 animate-slide-down transition-colors">
                           <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-black uppercase text-[9px] tracking-widest">
                              <Info size={12} /> Info
                           </div>
                           <p className="text-xs text-indigo-600 dark:text-indigo-300 leading-relaxed font-medium">
                              {selectedRanking.keyStatus === 'official'
                                 ? "Notas calculadas com base no gabarito OFICIAL."
                                 : "Gabarito Presumido via Consenso Estatístico (alternativa mais marcada)."}
                           </p>
                        </div>
                     )}

                     <div className="flex flex-wrap gap-8 pt-2">
                        <div className="space-y-0.5"><p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest transition-colors">Nota de Corte</p><p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{processedData?.entries[(selectedRanking.vacanciesAc + selectedRanking.vacanciesAfro + selectedRanking.vacanciesPcd) - 1]?.score || '--'}</p></div>
                        <div className="space-y-0.5"><p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest transition-colors">Inscritos</p><p className="text-2xl font-black text-slate-900 dark:text-slate-100 transition-colors">{selectedRanking.entries.length}</p></div>
                        <div className="space-y-0.5"><p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest transition-colors">Vagas (Total)</p><p className="text-2xl font-black text-slate-900 dark:text-slate-100 transition-colors">{selectedRanking.vacanciesAc + selectedRanking.vacanciesAfro + selectedRanking.vacanciesPcd}</p></div>
                     </div>
                  </div>
                  <div className="flex items-center md:items-end">
                     <button
                        onClick={() => participateRanking(selectedRanking)}
                        className="bg-slate-900 dark:bg-indigo-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-slate-200 dark:shadow-none hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all flex items-center gap-2"
                     >
                        {selectedRanking.entries.some(en => en.userId === currentUser?.id) ? (
                           <><Edit3 size={14} /> Editar Gabarito</>
                        ) : (
                           <><Plus size={14} /> Enviar Gabarito</>
                        )}
                     </button>
                  </div>
               </div>

               <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 transition-colors">
                     <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 transition-colors"><Trophy size={14} className="text-amber-500" /> Classificação Geral</h3>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 transition-colors">
                           <tr>
                              <th className="px-6 py-3 text-center">Pos.</th>
                              <th className="px-6 py-3">Candidato</th>
                              <th className="px-6 py-3 text-center">Nota Obj.</th>
                              {selectedRanking.hasDiscursive && <th className="px-6 py-3 text-center">Nota Disc.</th>}
                              <th className="px-6 py-3 text-center">Caderno</th>
                              <th className="px-6 py-3 text-right pr-8">Situação</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-xs">
                           {processedData?.entries.map((e, idx) => {
                              const totalVacancies = selectedRanking.vacanciesAc + selectedRanking.vacanciesAfro + selectedRanking.vacanciesPcd;
                              const inVagas = idx < totalVacancies;
                              const inCR = idx < totalVacancies + selectedRanking.reserveLimit;
                              return (
                                 <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] mx-auto transition-colors ${idx < 3 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                                          {idx + 1}º
                                       </div>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="flex flex-col">
                                          <span className="font-bold text-slate-800 dark:text-slate-100 transition-colors">{e.userName}</span>
                                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter transition-colors">{e.category}</span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-4 text-center font-black text-sm text-indigo-600 dark:text-indigo-400 transition-colors">{e.score}</td>
                                    {selectedRanking.hasDiscursive && (
                                       <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-300 transition-colors">{e.discursiveScore ?? '--'}</td>
                                    )}
                                    <td className="px-6 py-4 text-center text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">{e.examType}</td>
                                    <td className="px-6 py-4 text-right pr-8">
                                       <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-colors ${inVagas ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30' : inCR ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30' : 'text-slate-400 dark:text-slate-600'}`}>
                                          {inVagas ? 'Vagas' : inCR ? 'CR' : 'Excedente'}
                                       </span>
                                    </td>
                                 </tr>
                              );
                           })}
                           {processedData?.entries.length === 0 && (
                              <tr><td colSpan={selectedRanking.hasDiscursive ? 6 : 5} className="p-10 text-center text-slate-300 dark:text-slate-700 text-xs font-bold uppercase tracking-widest transition-colors">Aguardando envios</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}

         {/* MODAL CRIAR / EDITAR RANKING */}
         {(isCreating || isEditing) && (
            <div className="fixed inset-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6 transition-colors">
               <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto no-scrollbar transition-colors">
                  <div className="flex justify-between items-center mb-6">
                     <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">{isEditing ? 'Configurar Ranking' : 'Novo Ranking'}</h2>
                     <button onClick={() => { setIsCreating(false); setIsEditing(false); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={20} className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100" /></button>
                  </div>
                  <form onSubmit={handleCreateOrUpdate} className="space-y-5">
                     <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1 transition-colors">Título do Certame</label><input required type="text" value={rankingForm.name} onChange={e => setRankingForm({ ...rankingForm, name: e.target.value })} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all" placeholder="Ex: Analista TRF-1" /></div>
                     <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1 transition-colors">Banca Examinadora</label><input required type="text" value={rankingForm.institution} onChange={e => setRankingForm({ ...rankingForm, institution: e.target.value })} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all" /></div>

                     <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1 transition-colors">Vagas AC</label><input required type="number" min="0" value={rankingForm.vacanciesAc} onChange={e => setRankingForm({ ...rankingForm, vacanciesAc: Number(e.target.value) })} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-slate-900 dark:text-slate-100 text-xs outline-none transition-colors" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1 transition-colors">Vagas Afro</label><input required type="number" min="0" value={rankingForm.vacanciesAfro} onChange={e => setRankingForm({ ...rankingForm, vacanciesAfro: Number(e.target.value) })} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-slate-900 dark:text-slate-100 text-xs outline-none transition-colors" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1 transition-colors">Vagas PCD</label><input required type="number" min="0" value={rankingForm.vacanciesPcd} onChange={e => setRankingForm({ ...rankingForm, vacanciesPcd: Number(e.target.value) })} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-slate-900 dark:text-slate-100 text-xs outline-none transition-colors" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1 transition-colors">Qtd. Questões</label><input required type="number" min="1" value={rankingForm.totalQuestions} onChange={e => setRankingForm({ ...rankingForm, totalQuestions: Number(e.target.value) })} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-slate-900 dark:text-slate-100 text-xs outline-none transition-colors" /></div>
                     </div>

                     <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-4 transition-colors">
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Tipos de Caderno</label>
                           <div className="flex gap-2">
                              <input
                                 type="text"
                                 placeholder="Ex: Caderno Azul"
                                 value={newTypeName}
                                 onChange={e => setNewTypeName(e.target.value)}
                                 onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addExamType())}
                                 className="flex-1 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold text-slate-900 dark:text-slate-100 transition-colors"
                              />
                              <button type="button" onClick={addExamType} className="bg-slate-900 dark:bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-600 transition-colors"><Plus size={16} /></button>
                           </div>
                           <div className="flex flex-wrap gap-1.5 pt-1">
                              {rankingForm.examTypes.map((type, idx) => (
                                 <span key={idx} className="bg-white dark:bg-slate-700 border border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-colors">
                                    {type} <X size={10} className="cursor-pointer" onClick={() => setRankingForm({ ...rankingForm, examTypes: rankingForm.examTypes.filter((_, i) => i !== idx) })} />
                                 </span>
                              ))}
                              {rankingForm.examTypes.length === 0 && <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium italic transition-colors">Padrão: "Geral"</p>}
                           </div>
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer group">
                           <div className={`w-10 h-5 rounded-full relative transition-all ${rankingForm.hasDiscursive ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${rankingForm.hasDiscursive ? 'right-0.5' : 'left-0.5'}`} />
                              <input type="checkbox" className="hidden" checked={rankingForm.hasDiscursive} onChange={e => setRankingForm({ ...rankingForm, hasDiscursive: e.target.checked })} />
                           </div>
                           <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest transition-colors">Habilitar Discursiva</span>
                        </label>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1 transition-colors">Gabarito</label>
                           <select value={rankingForm.keyStatus} onChange={e => setRankingForm({ ...rankingForm, keyStatus: e.target.value as any })} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-slate-900 dark:text-slate-100 text-xs transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500/10">
                              <option value="pending">Presumido (Preliminar)</option>
                              <option value="official">Oficial Definitivo</option>
                           </select>
                        </div>

                        {rankingForm.keyStatus === 'pending' && (
                           <div className="space-y-1 animate-fade-in col-span-2">
                              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1 transition-colors">Data Prevista do Oficial</label>
                              <input
                                 required={rankingForm.keyStatus === 'pending'}
                                 type="date"
                                 value={rankingForm.officialKeyReleaseDate}
                                 onChange={e => setRankingForm({ ...rankingForm, officialKeyReleaseDate: e.target.value })}
                                 className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-slate-900 dark:text-slate-100 text-xs outline-none transition-colors"
                              />
                           </div>
                        )}

                        {rankingForm.keyStatus === 'official' && (
                           <div className="space-y-3 animate-fade-in col-span-2">
                              <div className="flex justify-between items-center mb-1">
                                 <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Gabarito Oficial (Questionário)</label>
                                 <span className="text-[9px] font-bold text-indigo-500 uppercase">{rankingForm.correctKey.replace(/ /g, '').length} / {rankingForm.totalQuestions} questões definidas</span>
                              </div>

                              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 max-h-[250px] overflow-y-auto no-scrollbar transition-colors">
                                 {Array.from({ length: rankingForm.totalQuestions }).map((_, i) => {
                                    const ans = rankingForm.correctKey[i] || ' ';
                                    return (
                                       <div key={i} className="flex flex-col items-center gap-1">
                                          <span className="text-[8px] font-black text-slate-300 dark:text-slate-600">{i + 1}</span>
                                          <input
                                             maxLength={1}
                                             value={ans === ' ' ? '' : ans}
                                             id={`key-input-${i}`}
                                             onChange={e => {
                                                const v = e.target.value.toUpperCase();
                                                if (['A', 'B', 'C', 'D', 'E', 'X', '*', ''].includes(v)) {
                                                   let newKeyArr = rankingForm.correctKey.padEnd(rankingForm.totalQuestions, ' ').split('');
                                                   newKeyArr[i] = v || ' ';
                                                   setRankingForm({ ...rankingForm, correctKey: newKeyArr.join('') });
                                                   if (v && i < rankingForm.totalQuestions - 1) {
                                                      document.getElementById(`key-input-${i + 1}`)?.focus();
                                                   }
                                                }
                                             }}
                                             className={`w-full h-8 text-center rounded-lg border font-black uppercase transition-all outline-none text-[10px] ${ans && ans !== ' ' ? 'bg-white dark:bg-slate-700 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500'}`}
                                          />
                                       </div>
                                    );
                                 })}
                              </div>
                              <p className="text-[9px] text-slate-400 dark:text-slate-500 italic mt-1 font-medium">Use A, B, C, D, E para alternativas, <span className="text-red-500">X</span> para anulada e <span className="text-amber-500">*</span> para troca de gabarito.</p>
                           </div>
                        )}
                     </div>

                     <button type="submit" className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all shadow-lg mt-2">
                        {isEditing ? 'Salvar' : 'Publicar'}
                     </button>
                  </form>
               </div>
            </div>
         )}

         {/* MODAL PARTICIPAR (ENVIAR GABARITO) */}
         {isParticipating && selectedRanking && (
            <div className="fixed inset-0 bg-slate-900/80 dark:bg-slate-950/95 backdrop-blur-sm z-[100] flex items-center justify-center p-6 transition-colors">
               <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 transition-colors">
                  <div className="bg-slate-50 dark:bg-slate-800 p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center transition-colors">
                     <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">Enviar Gabarito</h2>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5 transition-colors">Etapa {participationStep}/2</p>
                     </div>
                     <button onClick={() => setIsParticipating(false)} className="p-2 bg-white dark:bg-slate-700 text-slate-300 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-100 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 transition-all"><X size={20} /></button>
                  </div>

                  <div className="p-8 overflow-y-auto no-scrollbar transition-colors">
                     {participationStep === 1 ? (
                        <div className="space-y-6 animate-fade-in">
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                 <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><Hash size={12} className="text-indigo-500 dark:text-indigo-400" /> Inscrição</label>
                                 <input
                                    required type="text"
                                    value={partForm.registration}
                                    onChange={e => setPartForm({ ...partForm, registration: e.target.value })}
                                    className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                                    placeholder="000000"
                                 />
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><Layers size={12} className="text-indigo-500 dark:text-indigo-400" /> Caderno</label>
                                 <select
                                    value={partForm.examType}
                                    onChange={e => setPartForm({ ...partForm, examType: e.target.value })}
                                    className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                                 >
                                    <option value="">Selecione...</option>
                                    {selectedRanking.examTypes.map((type: string, i: number) => <option key={i} value={type}>{type}</option>)}
                                    {selectedRanking.examTypes.length === 0 && <option value="Geral">Geral</option>}
                                 </select>
                              </div>
                           </div>

                           <div className="space-y-3">
                              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><UserCheck size={12} className="text-indigo-500 dark:text-indigo-400" /> Categoria</label>
                              <div className="grid grid-cols-3 gap-2">
                                 {['AC', 'Afro', 'PCD'].map(cat => (
                                    <button key={cat} type="button" onClick={() => setPartForm({ ...partForm, category: cat as any })} className={`py-2.5 rounded-xl border text-[10px] font-black uppercase transition-all ${partForm.category === cat ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-indigo-200'}`}>{cat}</button>
                                 ))}
                              </div>
                           </div>

                           {selectedRanking.hasDiscursive && (
                              <div className="space-y-1">
                                 <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><FileText size={12} className="text-indigo-500 dark:text-indigo-400" /> Nota Discursiva</label>
                                 <input type="number" min="0" max="100" value={partForm.discursiveScore} onChange={e => setPartForm({ ...partForm, discursiveScore: Number(e.target.value) })} className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-colors" />
                              </div>
                           )}

                           <button onClick={() => setParticipationStep(2)} disabled={!partForm.registration || (!partForm.examType && selectedRanking.examTypes.length > 0)} className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                              Próximo <ChevronRight size={16} />
                           </button>
                        </div>
                     ) : (
                        <div className="space-y-6 animate-fade-in">
                           <div className="flex justify-between items-center">
                              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest transition-colors">Cartão Resposta</h3>
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 transition-colors">{selectedRanking.totalQuestions} Questões</span>
                           </div>

                           <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 max-h-[300px] overflow-y-auto no-scrollbar transition-colors">
                              {partForm.answers.map((ans, i) => (
                                 <div key={i} className="flex flex-col items-center gap-1">
                                    <span className="text-[8px] font-black text-slate-300 dark:text-slate-600">{i + 1}</span>
                                    <input maxLength={1} value={ans} autoFocus={i === 0} id={`ans-input-${i}`} onChange={e => { const v = e.target.value.toUpperCase(); if (['A', 'B', 'C', 'D', 'E', ''].includes(v)) { const newAns = [...partForm.answers]; newAns[i] = v; setPartForm({ ...partForm, answers: newAns }); if (v && i < partForm.answers.length - 1) document.getElementById(`ans-input-${i + 1}`)?.focus(); } }} className={`w-full h-9 text-center rounded-lg border font-black uppercase transition-all outline-none text-xs transition-colors ${ans ? 'bg-white dark:bg-slate-700 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500'}`} />
                                 </div>
                              ))}
                           </div>

                           <div className="flex gap-3">
                              <button onClick={() => setParticipationStep(1)} className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-all">Voltar</button>
                              <button onClick={handleFinishParticipation} className="flex-1 py-3 bg-indigo-600 dark:bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 transition-colors"><Check size={16} /> Finalizar</button>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         )}
         <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            title={authModalConfig.title}
            description={authModalConfig.description}
            actionSource={authModalConfig.actionSource}
         />
      </div>
   );
};

export default RankingPage;
