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


import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Subject, SimulationSession, SimulationConfig, Difficulty, Question } from '../../types';
import {
   PlayCircle, Clock, ChevronRight, BrainCircuit, Filter, Target, RotateCcw, LayoutGrid,
   ArrowRight, X, Search, ChevronDown, CheckCircle2, History, Timer, BarChart3, ChevronLeft, Flag, Zap, ArrowLeft,
   Calendar, Building2, Briefcase, GraduationCap, BookOpen, List, Eye
} from 'lucide-react';
import QuestionCard from '../questions/components/QuestionCard';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useToast } from '@providers/ToastProvider';
import AuthModal from '../../components/shared/overlays/AuthModal';
import UpgradeModal from '../../components/shared/overlays/UpgradeModal';
import AdBanner from '../../components/shared/feedback/AdBanner';

const SearchableMultiSelect: React.FC<{
   label: string;
   options: string[];
   selected: string[];
   onChange: (values: string[]) => void;
   placeholder?: string;
   icon: any;
}> = ({ label, options, selected, onChange, placeholder, icon: Icon }) => {
   const [isOpen, setIsOpen] = useState(false);
   const [search, setSearch] = useState('');
   const containerRef = useRef<HTMLDivElement>(null);
   const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()) && !selected.includes(opt));
   const toggleOption = (opt: string) => { onChange(selected.includes(opt) ? selected.filter(i => i !== opt) : [...selected, opt]); };

   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false); };
      document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   return (
      <div className="space-y-1.5 flex-1" ref={containerRef}>
         <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><Icon size={12} className="text-indigo-500 dark:text-indigo-400" /> {label}</label>
         <div className="relative">
            <div onClick={() => setIsOpen(!isOpen)} className="min-h-[44px] w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-1.5 flex flex-wrap gap-2 items-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-all shadow-sm">
               {selected.length === 0 ? <span className="text-slate-400 dark:text-slate-500 text-xs font-medium transition-colors">{placeholder || 'Selecionar...'}</span> : selected.map(item => (
                  <span key={item} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-800/30 animate-scale-in transition-colors">
                     {item} <X size={10} className="hover:text-indigo-900 dark:hover:text-indigo-200" onClick={(e) => { e.stopPropagation(); toggleOption(item); }} />
                  </span>
               ))}
               <ChevronDown size={14} className={`ml-auto text-slate-300 dark:text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
               <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 space-y-3 animate-slide-down transition-colors">
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={14} />
                     <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className="w-full h-9 pl-9 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/10 font-medium text-slate-900 dark:text-slate-100 transition-colors" />
                  </div>
                  <div className="max-h-40 overflow-y-auto no-scrollbar space-y-1">
                     {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                        <button key={opt} onClick={() => { toggleOption(opt); setSearch(''); }} className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors">{opt}</button>
                     )) : <p className="text-[10px] text-slate-400 dark:text-slate-600 text-center py-2 transition-colors">Nenhum resultado</p>}
                  </div>
               </div>
            )}
         </div>
      </div>
   );
};

const Simulation: React.FC = () => {
   const { currentUser, addSimulation } = useAuth();
   const { questions, submitAnswer, systemSettings, ensureTaxonomiesLoaded } = useData();
   const { addToast } = useToast();

   if (systemSettings.features.simulationsEnabled === false) {
      return (
         <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-400 mb-6">
               <GraduationCap size={40} />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Simulados IndisponÃ­veis</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm font-medium">Esta funcionalidade foi desabilitada temporariamente pela administraÃ§Ã£o da plataforma.</p>
            <button
               onClick={() => window.history.back()}
               className="mt-8 flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-indigo-600 text-white text-xs font-black uppercase rounded-xl hover:scale-105 transition-all shadow-lg"
            >
               <ArrowLeft size={16} /> Voltar
            </button>
         </div>
      );
   }
   const [activeSession, setActiveSession] = useState<SimulationSession | null>(null);
   const [step, setStep] = useState<'config' | 'active' | 'result' | 'review'>('config');
   const [currentIdx, setCurrentIdx] = useState(0);
   const [timeLeft, setTimeLeft] = useState(0);
   const [showPalette, setShowPalette] = useState(false);
   const [reviewIdx, setReviewIdx] = useState(0);
   const [showAuthModal, setShowAuthModal] = useState(false);
   const [authModalConfig, setAuthModalConfig] = useState({ title: '', description: '' });
   const [showUpgradeModal, setShowUpgradeModal] = useState(false);

   const [viewMode, setViewMode] = useState<'focus' | 'list'>('focus');

   const allAgencies = useMemo(() => Array.from(new Set(questions.flatMap(q => q.bancas?.map(b => b.sigla || b.nome) || []).filter(Boolean))).sort() as string[], [questions]);
   const allYears = useMemo(() => Array.from(new Set(questions.flatMap(q => q.anos || []).map(String))).sort().reverse(), [questions]);
   const allOrgs = useMemo(() => Array.from(new Set(questions.flatMap(q => q.orgaos || []).map(o => o.sigla || o.nome).filter(Boolean))).sort(), [questions]);
   const allRoles = useMemo(() => Array.from(new Set(questions.flatMap(q => q.cargos || []).map(c => c.descricao || (c as any).nome).filter(Boolean))).sort(), [questions]);
   const allLevels = useMemo(() => Array.from(new Set(questions.map(q => q.nivel || (q as any).level).filter(Boolean))).sort(), [questions]);

   const [config, setConfig] = useState<SimulationConfig>({
      id: '', name: 'Treino de Performance', questionCount: 10, subjects: [], difficulty: 'All',
      timerEnabled: true, timerMinutes: 20, feedbackMode: 'after_all',
      filters: { agencies: [], years: [], organizations: [], roles: [], levels: [], topics: [] }
   });

   const allTopics = useMemo(() => {
      const relevantQuestions = config.subjects.length > 0 ? questions.filter(q => q.assuntos?.some(a => config.subjects.includes(a.nome as any))) : questions;
      return Array.from(new Set(relevantQuestions.flatMap(q => q.assuntos?.map(a => a.nome) || []).filter(Boolean))).sort();
   }, [questions, config.subjects]);

   useEffect(() => {
      let timer: any;
      if (step === 'active' && timeLeft > 0) timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
      if (timeLeft === 0 && step === 'active') handleFinish();
      return () => clearInterval(timer);
   }, [step, timeLeft]);

   useEffect(() => {
      ensureTaxonomiesLoaded();
   }, [ensureTaxonomiesLoaded]);

   // Verificar se o usuÃ¡rio pode criar sim personalizado (apenas Pro ou Elite)
   const canCreateCustomSim = currentUser && (currentUser as any).plan && (currentUser as any).plan !== 'Gratuito' && (currentUser as any).plan !== 'Essencial';

   const handleCreate = () => {
      if (currentUser && !currentUser.emailVerified) {
         setAuthModalConfig({
            title: "Confirme seu E-mail",
            description: "Para realizar simulados e testar seus conhecimentos, vocÃª precisa confirmar seu e-mail."
         });
         setShowAuthModal(true);
         return;
      }
      let filtered = questions.filter(q => {
         const matchSubject = config.subjects.length === 0 || q.assuntos?.some(a => config.subjects.includes(a.nome as any));
         const matchAgency = config.filters.agencies.length === 0 || q.bancas?.some(b => config.filters.agencies.includes(b.sigla || b.nome));
         const matchYear = config.filters.years.length === 0 || (q.anos && q.anos.some(y => config.filters.years.includes(String(y))));
         const matchOrg = config.filters.organizations.length === 0 || q.orgaos?.some(o => config.filters.organizations.includes(o.sigla || o.nome));
         const matchRole = config.filters.roles.length === 0 || q.cargos?.some(c => config.filters.roles.includes(c.descricao || (c as any).nome));
         const matchLevel = config.filters.levels.length === 0 || config.filters.levels.includes(q.nivel || (q as any).level);
         const matchTopic = config.filters.topics.length === 0 || q.assuntos?.some(a => config.filters.topics.includes(a.nome as any));

         return matchSubject && matchAgency && matchYear && matchOrg && matchRole && matchLevel && matchTopic;
      });

      if (filtered.length === 0) return addToast("`Nenhuma questÃ£o encontrada com esses filtros.", "warning");
      const finalQs = filtered.sort(() => Math.random() - 0.5).slice(0, config.questionCount);
      setActiveSession({ id: `sim-${Date.now()}`, config, questions: finalQs, answers: {}, startTime: Date.now(), status: 'in_progress' });
      setTimeLeft(config.timerMinutes * 60); setCurrentIdx(0); setStep('active');
   };

   const handleFinish = () => {
      if (!activeSession) return;

      const results = activeSession.questions.map(q => {
         const selectedIndexOrObj = activeSession.answers[q.id];
         const selectedIndex = typeof selectedIndexOrObj === 'object' ? selectedIndexOrObj.index : selectedIndexOrObj;

         if (selectedIndex === undefined) return { isCorrect: false, index: undefined };

         const correctItem = (q.itens || []).find((it, idx) => Number(it.id) === Number(q.resposta) || idx === Number(q.resposta));
         const correctIndex = (q.itens || []).indexOf(correctItem as any);
         return { isCorrect: selectedIndex === correctIndex, index: selectedIndex };
      });

      const score = results.filter(r => r.isCorrect && r.index !== undefined).length;

      const enrichedAnswers: Record<string, any> = {};
      activeSession.questions.forEach((q, i) => {
         const res = results[i];
         // Ensure we capture index even if it is 0
         if (res.index !== undefined) {
            enrichedAnswers[q.id] = {
               index: res.index,
               is_correct: res.isCorrect ? 1 : 0,
               time_taken: (activeSession.answers[q.id] as any)?.time_taken || 0
            };
         }
      });

      const completed = {
         ...activeSession,
         status: 'completed' as const,
         endTime: Date.now(),
         score,
         answers: enrichedAnswers as any
      };

      setActiveSession(completed);
      addSimulation(completed);
      setStep('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
   };

   const renderModals = () => (
      <>
         <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            title={authModalConfig.title}
            description={authModalConfig.description}
         />
         <UpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            requiredPlan="Pro"
            featureName="Simulados Personalizados"
         />
      </>
   );

   // if (!currentUser) return null; // Removed to allow guest access

   if (step === 'config') {
      return (
         <div className="w-full space-y-8 animate-fade-in py-6">
            <header className="text-center space-y-2">
               <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="p-2 bg-indigo-600 dark:bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-colors"><Timer size={20} /></div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">Novo Simulado</h1>
               </div>
               <p className="text-slate-400 dark:text-slate-500 text-sm font-medium max-w-sm mx-auto transition-colors">Configure seu ambiente de treino e teste seus conhecimentos.</p>
            </header>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-8 transition-colors">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SearchableMultiSelect label="MatÃ©rias" icon={Target} options={Object.values(Subject)} selected={config.subjects} onChange={v => setConfig({ ...config, subjects: v as Subject[] })} placeholder="Todas as matÃ©rias..." />
                  <SearchableMultiSelect label="Bancas" icon={Filter} options={allAgencies} selected={config.filters.agencies} onChange={v => setConfig({ ...config, filters: { ...config.filters, agencies: v } })} placeholder="Todas as bancas..." />
                  <SearchableMultiSelect label="Anos" icon={Calendar} options={allYears} selected={config.filters.years} onChange={v => setConfig({ ...config, filters: { ...config.filters, years: v } })} placeholder="Todos os anos..." />
                  <SearchableMultiSelect label="Ã“rgÃ£os" icon={Building2} options={allOrgs} selected={config.filters.organizations} onChange={v => setConfig({ ...config, filters: { ...config.filters, organizations: v } })} placeholder="Todos os Ã³rgÃ£os..." />
                  <SearchableMultiSelect label="Cargos" icon={Briefcase} options={allRoles} selected={config.filters.roles} onChange={v => setConfig({ ...config, filters: { ...config.filters, roles: v } })} placeholder="Todos os cargos..." />
                  <SearchableMultiSelect label="NÃ­veis" icon={GraduationCap} options={allLevels} selected={config.filters.levels} onChange={v => setConfig({ ...config, filters: { ...config.filters, levels: v } })} placeholder="Todos os nÃ­veis..." />
                  <SearchableMultiSelect label="Assuntos (TÃ³picos)" icon={BookOpen} options={allTopics} selected={config.filters.topics} onChange={v => setConfig({ ...config, filters: { ...config.filters, topics: v } })} placeholder="Todos os tÃ³picos..." />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6 border-t border-slate-50 dark:border-slate-800 transition-colors">
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">QuestÃµes</label>
                     <select value={config.questionCount} onChange={e => setConfig({ ...config, questionCount: Number(e.target.value) })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 text-xs focus:ring-2 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/10 outline-none transition-all cursor-pointer">
                        {[10, 20, 30, 60, 90].map(v => <option key={v} value={v}>{v} Itens</option>)}
                     </select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Tempo (Minutos)</label>
                     <input type="number" min="1" max="300" value={config.timerMinutes} onChange={e => setConfig({ ...config, timerMinutes: Number(e.target.value) })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 text-xs focus:ring-2 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/10 outline-none transition-all transition-colors" />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Modo de Resposta</label>
                     <select value={config.feedbackMode} onChange={e => setConfig({ ...config, feedbackMode: e.target.value as any })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 text-xs focus:ring-2 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/10 outline-none transition-all cursor-pointer transition-colors">
                        <option value="after_all">Resultado no Final</option>
                        <option value="instant">Feedback InstantÃ¢neo</option>
                     </select>
                  </div>
               </div>

               <button onClick={() => {
                  if (!currentUser) {
                     setAuthModalConfig({
                        title: "Inicie seu Treino",
                        description: "Para criar simulados personalizados e acompanhar sua evoluÃ§Ã£o, acesse sua conta."
                     });
                     setShowAuthModal(true);
                     return;
                  }

                  // Feature Gating para simulados personalizados
                  const hasCustomFilters = config.subjects.length > 0 || config.filters.agencies.length > 0 || config.filters.years.length > 0;
                  if (hasCustomFilters && !canCreateCustomSim) {
                     setShowUpgradeModal(true);
                     return;
                  }

                  handleCreate();
               }} className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all shadow-xl shadow-slate-200 dark:shadow-none flex items-center justify-center gap-3 group transition-all">
                  ComeÃ§ar Agora <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
               </button>
            </div>
            {renderModals()}
         </div>
      );
   }

   if (step === 'active' && activeSession) {
      const q = activeSession.questions[currentIdx];
      return (
         <div className="w-full pb-32 animate-fade-in">
            <div className="sticky top-4 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-8 flex justify-between items-center shadow-lg transition-colors">
               <div className="flex items-center gap-4">
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                     <button
                        onClick={() => setViewMode('focus')}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${viewMode === 'focus' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Modo Foco"
                     >
                        <Eye size={18} />
                     </button>
                     <button
                        onClick={() => setViewMode('list')}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Modo Lista"
                     >
                        <List size={18} />
                     </button>
                  </div>
                  <button onClick={() => setShowPalette(!showPalette)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${showPalette ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors'}`}>
                     <LayoutGrid size={18} />
                  </button>
                  <div className="hidden sm:block">
                     <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Simulado</h2>
                     <p className="text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors">{viewMode === 'focus' ? `${currentIdx + 1} / ${activeSession.questions.length}` : 'Todos os itens'}</p>
                  </div>
               </div>
               <div className="flex items-center gap-4">
                  <div className={`px-5 py-2 rounded-xl font-mono font-black text-lg shadow-inner flex items-center gap-2 transition-colors ${timeLeft < 300 ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 animate-pulse' : 'bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100'}`}>
                     <Clock size={16} className={timeLeft < 300 ? 'text-red-500 dark:text-red-400' : 'text-indigo-400 dark:text-indigo-500'} />
                     {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </div>
                  <button onClick={() => { if (confirm("Deseja finalizar o simulado agora?")) handleFinish(); }} className="px-5 py-2 bg-indigo-600 dark:bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-emerald-600 dark:hover:bg-emerald-500 shadow-md transition-all">Finalizar</button>
               </div>
            </div>

            {showPalette && (
               <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPalette(false)}>
                  <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl p-8 w-full max-w-md animate-scale-in transition-colors" onClick={e => e.stopPropagation()}>
                     <div className="flex justify-between items-center mb-6">
                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">NavegaÃ§Ã£o da Prova</h4>
                        <button onClick={() => setShowPalette(false)} className="text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X size={20} /></button>
                     </div>
                     <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto no-scrollbar p-1">
                        {activeSession.questions.map((_, i) => (
                           <button
                              key={i}
                              onClick={() => { setCurrentIdx(i); setShowPalette(false); }}
                              className={`w-full aspect-square rounded-lg text-xs font-black transition-all border-2 transition-colors ${currentIdx === i ? 'bg-indigo-600 border-indigo-600 text-white shadow-md dark:shadow-none' : activeSession.answers[activeSession.questions[i].id] !== undefined ? 'bg-slate-900 dark:bg-slate-800 border-slate-900 dark:border-slate-700 text-white' : 'bg-white dark:bg-slate-850 border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 hover:border-indigo-200 dark:hover:border-indigo-900'}`}
                           >
                              {i + 1}
                           </button>
                        ))}
                     </div>
                  </div>
               </div>
            )}

            <div className="animate-slide-up w-full space-y-12">
               {viewMode === 'focus' ? (
                  <>
                     <QuestionCard
                        question={q}
                        indexDisplay={currentIdx + 1}
                        mode="simulation"
                        hideFeedback={config.feedbackMode === 'after_all'}
                        onAnswerSubmit={(ans) => {
                           setActiveSession({
                              ...activeSession,
                              answers: {
                                 ...activeSession.answers,
                                 [q.id]: { index: ans.selectedOptionIndex, is_correct: ans.isCorrect, time_taken: ans.timeTaken }
                              }
                           });
                           submitAnswer({ ...ans, simulationId: activeSession.id });
                        }}
                        existingAnswer={activeSession.answers[q.id] !== undefined ? {
                           questionId: q.id,
                           selectedOptionIndex: typeof activeSession.answers[q.id] === 'object' ? (activeSession.answers[q.id] as any).index : activeSession.answers[q.id],
                           isCorrect: typeof activeSession.answers[q.id] === 'object' ? (activeSession.answers[q.id] as any).is_correct : (activeSession.answers[q.id] === (q.itens || []).indexOf((q.itens || []).find((it, idx) => Number(it.id) === Number(q.resposta) || idx === Number(q.resposta)) as any)),
                           timestamp: Date.now()
                        } : undefined}
                        userPlan={(currentUser as any)?.plan || 'Gratuito'}
                     />

                     <div className="flex justify-between mt-8 px-2">
                        <button onClick={() => { setCurrentIdx(Math.max(0, currentIdx - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentIdx === 0} className="px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 transition-all flex items-center gap-2 transition-colors">
                           <ChevronLeft size={16} /> Anterior
                        </button>
                        <button onClick={() => { currentIdx === activeSession.questions.length - 1 ? handleFinish() : setCurrentIdx(currentIdx + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-10 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 dark:shadow-none hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all flex items-center gap-2">
                           {currentIdx === activeSession.questions.length - 1 ? 'Entregar Prova' : 'PrÃ³xima'} <ChevronRight size={16} />
                        </button>
                     </div>
                  </>
               ) : (
                  <div className="space-y-12">
                     {activeSession.questions.map((question, idx) => (
                        <div key={question.id} id={`q-${idx}`} className="scroll-mt-32">
                           <QuestionCard
                              question={question}
                              indexDisplay={idx + 1}
                              mode="simulation"
                              hideFeedback={config.feedbackMode === 'after_all'}
                              onAnswerSubmit={(ans) => {
                                 setActiveSession({
                                    ...activeSession,
                                    answers: {
                                       ...activeSession.answers,
                                       [question.id]: { index: ans.selectedOptionIndex, is_correct: ans.isCorrect, time_taken: ans.timeTaken }
                                    }
                                 });
                                 submitAnswer({ ...ans, simulationId: activeSession.id });
                              }}
                              existingAnswer={activeSession.answers[question.id] !== undefined ? {
                                 questionId: question.id,
                                 selectedOptionIndex: typeof activeSession.answers[question.id] === 'object' ? (activeSession.answers[question.id] as any).index : activeSession.answers[question.id],
                                 isCorrect: typeof activeSession.answers[question.id] === 'object' ? (activeSession.answers[question.id] as any).is_correct : (activeSession.answers[question.id] === (question.itens || []).indexOf((question.itens || []).find((it, idx) => Number(it.id) === Number(question.resposta) || idx === Number(question.resposta)) as any)),
                                 timestamp: Date.now()
                              } : undefined}
                              userPlan={(currentUser as any)?.plan || 'Gratuito'}
                           />
                        </div>
                     ))}
                     <div className="flex justify-center pt-8">
                        <button onClick={() => { if (confirm("Deseja finalizar o simulado agora?")) handleFinish(); }} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all transform hover:scale-105">
                           Finalizar e Ver Resultado
                        </button>
                     </div>
                  </div>
               )}
            </div>
            {renderModals()}
         </div>
      );
   }

   if (step === 'result' && activeSession) {
      const accuracy = Math.round((activeSession.score! / activeSession.questions.length) * 100);
      return (
         <div className="w-full space-y-8 animate-fade-in py-6">
            <header className="flex justify-between items-end">
               <div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">Resultado Final</h1>
                  <p className="text-slate-400 dark:text-slate-500 text-xs font-medium transition-colors">Confira seu desempenho detalhado neste simulado.</p>
               </div>
               <button onClick={() => setStep('config')} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all">
                  <RotateCcw size={14} /> Novo Treino
               </button>
            </header>

            <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-10 transition-colors">
               <div className={`w-32 h-32 rounded-full border-[8px] flex flex-col items-center justify-center relative transition-colors ${accuracy >= 70 ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-amber-500 text-amber-600 dark:text-amber-400'}`}>
                  <div className="absolute inset-0 bg-current opacity-5 rounded-full" />
                  <span className="text-3xl font-black">{accuracy}%</span>
                  <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Acertos</span>
               </div>
               <div className="flex-1 grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest transition-colors">Geral</p>
                     <p className="text-2xl font-black text-slate-800 dark:text-slate-100 transition-colors">{activeSession.score} / {activeSession.questions.length}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest transition-colors">Tempo Total</p>
                     <p className="text-2xl font-black text-slate-800 dark:text-slate-100 transition-colors">{Math.floor((activeSession.config.timerMinutes * 60 - timeLeft) / 60)}m {((activeSession.config.timerMinutes * 60 - timeLeft) % 60)}s</p>
                  </div>
                  <div className="col-span-2 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center gap-3 transition-colors">
                     <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm transition-colors"><Zap size={18} /></div>
                     <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                        {accuracy >= 70
                           ? "Excelente performance! VocÃª estÃ¡ acima da mÃ©dia para este certame."
                           : "Bom treino! Foque em revisar as questÃµes que errou para consolidar o aprendizado."}
                     </p>
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <div className="flex justify-between items-center px-1">
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">RevisÃ£o de QuestÃµes</h3>
                  <div className="flex items-center gap-2">
                     <button onClick={() => setViewMode('focus')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'focus' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Modo Foco"><List size={14} /></button>
                     <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Modo Lista"><LayoutGrid size={14} /></button>
                  </div>
               </div>
               <div className={`space-y-3 ${viewMode === 'list' ? 'grid grid-cols-1 md:grid-cols-2 gap-4 space-y-0' : ''}`}>
                  {activeSession.questions.map((q, i) => {
                     // Correctly find if answer is right
                     const selectedIndexOrObj = activeSession.answers[q.id];
                     const selectedIndex = typeof selectedIndexOrObj === 'object' ? (selectedIndexOrObj as any).index : selectedIndexOrObj;
                     const isCorrect = typeof selectedIndexOrObj === 'object' ? (selectedIndexOrObj as any).is_correct : (selectedIndex === (q.itens || []).indexOf((q.itens || []).find((it, idx) => Number(it.id) === Number(q.resposta) || idx === Number(q.resposta)) as any));

                     return (
                        <button
                           key={q.id}
                           onClick={() => { setReviewIdx(i); setStep('review'); }}
                           className="w-full bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-indigo-300 dark:hover:border-indigo-600 transition-all text-left shadow-sm transition-colors"
                        >
                           <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-colors ${selectedIndex === undefined ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : isCorrect ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>{i + 1}</div>
                              <div className="flex-1 min-w-0">
                                 <div className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" dangerouslySetInnerHTML={{ __html: q.enunciado_clean || q.enunciado || 'QuestÃ£o sem enunciado...' }} />
                                 <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium transition-colors truncate">{(q.assuntos && q.assuntos.length > 0) ? q.assuntos[0].nome : 'Geral'} â€¢ {q.topic || 'Geral'}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded transition-colors ${selectedIndex === undefined ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : isCorrect ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{selectedIndex === undefined ? 'Em Branco' : isCorrect ? 'Acerto' : 'Erro'}</span>
                              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 dark:group-hover:text-indigo-500 transition-colors" />
                           </div>
                        </button>
                     );
                  })}
               </div>
            </div>
            {renderModals()}
         </div>
      );
   }

   if (step === 'review' && activeSession) {
      const q = activeSession.questions[reviewIdx];
      return (
         <div className="w-full pb-32 animate-fade-in">
            <div className="sticky top-4 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-8 flex justify-between items-center shadow-lg transition-colors">
               <button onClick={() => setStep('result')} className="flex items-center gap-2 px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-[10px] font-black uppercase transition-all">
                  <ArrowLeft size={16} /> Voltar ao Resumo
               </button>
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest transition-colors">RevisÃ£o</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors">{reviewIdx + 1} / {activeSession.questions.length}</span>
               </div>
               <div className="flex gap-2">
                  <button onClick={() => setReviewIdx(Math.max(0, reviewIdx - 1))} disabled={reviewIdx === 0} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 transition-colors"><ChevronLeft size={18} /></button>
                  <button onClick={() => setReviewIdx(Math.min(activeSession.questions.length - 1, reviewIdx + 1))} disabled={reviewIdx === activeSession.questions.length - 1} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 transition-colors"><ChevronRight size={18} /></button>
               </div>
            </div>

            <div className="animate-slide-up w-full">
               <QuestionCard
                  question={q}
                  indexDisplay={reviewIdx + 1}
                  mode="simulation"
                  hideFeedback={false}
                  onAnswerSubmit={() => { }}
                  existingAnswer={{
                     questionId: q.id,
                     selectedOptionIndex: typeof activeSession.answers[q.id] === 'object' ? (activeSession.answers[q.id] as any).index : activeSession.answers[q.id],
                     isCorrect: typeof activeSession.answers[q.id] === 'object' ? (activeSession.answers[q.id] as any).is_correct : (activeSession.answers[q.id] === (q.itens || []).indexOf((q.itens || []).find((it, idx) => Number(it.id) === Number(q.resposta) || idx === Number(q.resposta)) as any)),
                     timestamp: Date.now()
                  }}
                  userPlan={currentUser?.billing?.plan || 'Gratuito'}
               />
            </div>

            <div className="mt-8 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl p-8 flex items-center gap-6 transition-colors">
               <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0 transition-colors"><Zap size={28} /></div>
               <div>
                  <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-100 uppercase mb-1 transition-colors">Dica de Estudo</h4>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed font-medium transition-colors">Revise os fundamentos e veja os comentÃ¡rios para consolidar o aprendizado deste tÃ³pico sem distraÃ§Ãµes.</p>
               </div>
            </div>
            {renderModals()}
         </div>
      );
   }

   return (
      <>
         <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            title={authModalConfig.title}
            description={authModalConfig.description}
         />
         <UpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            requiredPlan="Pro"
            featureName="Simulados Personalizados"
         />
      </>
   );
};

export default Simulation;
