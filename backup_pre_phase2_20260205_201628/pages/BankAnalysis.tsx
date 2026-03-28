
import React, { useState, useMemo, useEffect } from 'react';
import {
   Building2, Lock, PieChart as PieIcon, BarChart3,
   FileText, Zap, Crown, Check, Search, Briefcase, Target, Calendar,
   BrainCircuit, Database, Loader2
} from 'lucide-react';
import {
   BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
   PieChart, Pie, Cell
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { CHART_COLORS } from '../constants';
import AuthModal from '../components/AuthModal';
import UpgradeModal from '../components/UpgradeModal';

const BankAnalysis: React.FC = () => {
   const { currentUser } = useAuth();
   const { questions } = useData();

   const [selectedAgency, setSelectedAgency] = useState<string>('');
   const [selectedRole, setSelectedRole] = useState<string>('');
   const [selectedYear, setSelectedYear] = useState<string>('All');
   const [showAuthModal, setShowAuthModal] = useState(false);
   const [showUpgradeModal, setShowUpgradeModal] = useState(false);

   // Estados para animação de análise
   const [isAnalyzing, setIsAnalyzing] = useState(false);
   const [loadingText, setLoadingText] = useState('');
   const [progress, setProgress] = useState(0);

   const isElite = currentUser?.billing?.plan === 'Elite';

   const agencies = useMemo(() => Array.from(new Set(questions.map(q => q.agency).filter(Boolean) as string[])).sort(), [questions]);
   const roles = useMemo(() => !selectedAgency ? [] : Array.from(new Set(questions.filter(q => q.agency === selectedAgency && q.role).map(q => q.role) as string[])).sort(), [questions, selectedAgency]);
   const years = useMemo(() => !selectedAgency ? [] : Array.from(new Set(questions.filter(q => q.agency === selectedAgency && q.year).map(q => q.year) as string[])).sort().reverse(), [questions, selectedAgency]);

   const filteredQuestions = useMemo(() => {
      if (!selectedAgency) return [];
      let q = questions.filter(q => q.agency === selectedAgency);
      if (selectedRole) q = q.filter(item => item.role === selectedRole);
      if (selectedYear !== 'All') q = q.filter(item => item.year === selectedYear);
      return q;
   }, [questions, selectedAgency, selectedRole, selectedYear]);

   // Efeito para simular análise quando os filtros mudam
   useEffect(() => {
      if (selectedAgency && isElite) {
         setIsAnalyzing(true);
         setProgress(0);
         setLoadingText('Conectando à base neural...');

         const steps = [
            { pct: 20, text: 'Varrendo banco de questões...' },
            { pct: 45, text: 'Identificando padrões da banca...' },
            { pct: 70, text: 'Calculando incidência por tópico...' },
            { pct: 90, text: 'Gerando insights estratégicos...' },
            { pct: 100, text: 'Concluído!' }
         ];

         let currentStep = 0;

         const interval = setInterval(() => {
            if (currentStep < steps.length) {
               setProgress(steps[currentStep].pct);
               setLoadingText(steps[currentStep].text);
               currentStep++;
            } else {
               clearInterval(interval);
               setTimeout(() => setIsAnalyzing(false), 400);
            }
         }, 450);

         return () => clearInterval(interval);
      }
   }, [selectedAgency, selectedRole, selectedYear, isElite]);

   const stats = useMemo(() => {
      if (filteredQuestions.length === 0) return null;
      const subjectDetails: Record<string, { total: number, topics: Record<string, number> }> = {};
      filteredQuestions.forEach(q => {
         if (!subjectDetails[q.subject]) subjectDetails[q.subject] = { total: 0, topics: {} };
         subjectDetails[q.subject].total += 1;
         const topic = q.topic || 'Assuntos Gerais';
         subjectDetails[q.subject].topics[topic] = (subjectDetails[q.subject].topics[topic] || 0) + 1;
      });

      const subjectData = Object.entries(subjectDetails).map(([name, data]) => ({ name, value: data.total })).sort((a, b) => b.value - a.value).slice(0, 5);
      const detailedBreakdown = Object.entries(subjectDetails).map(([subject, data]) => {
         const sortedTopics = Object.entries(data.topics).map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count);
         return { subject, total: data.total, topics: sortedTopics };
      }).sort((a, b) => b.total - a.total);

      const difficultyCount: Record<string, number> = {};
      filteredQuestions.forEach(q => { difficultyCount[q.difficulty] = (difficultyCount[q.difficulty] || 0) + 1; });
      const difficultyData = Object.entries(difficultyCount).map(([name, value]) => ({ name, value }));

      let totalTextLen = 0;
      let hasIntroTextCount = 0;
      filteredQuestions.forEach(q => { totalTextLen += q.text.length; if (q.introText) hasIntroTextCount++; });
      const avgLen = Math.round(totalTextLen / filteredQuestions.length);
      const textStyle = avgLen > 300 ? 'Textos Longos e Complexos' : avgLen > 100 ? 'Tamanho Médio' : 'Objetiva e Direta';
      const contextUsage = Math.round((hasIntroTextCount / filteredQuestions.length) * 100);

      return { subjectData, difficultyData, textStyle, contextUsage, total: filteredQuestions.length, detailedBreakdown };
   }, [filteredQuestions]);

   // if (!currentUser) return null; // Removed to allow guest access

   if (!isElite) {
      return (
         <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
            <header>
               <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors">
                  <Zap className="text-amber-500 dark:text-amber-400" size={24} /> Raio-X da Banca
               </h1>
               <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium transition-colors">Descubra os segredos da sua banca examinadora.</p>
            </header>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative min-h-[350px] flex items-center justify-center p-8 transition-colors">
               <div className="relative z-20 text-center max-w-md space-y-5">
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200/50 transition-colors"><Lock size={32} /></div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight transition-colors">Recurso Exclusivo Elite</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-relaxed transition-colors">O Raio-X da Banca utiliza IA para analisar milhares de questões e te entregar o mapa da mina: o que cai, como cai e onde focar.</p>
                  <button
                     onClick={() => {
                        if (!currentUser) setShowAuthModal(true);
                        else setShowUpgradeModal(true);
                     }}
                     className="w-full py-3 bg-amber-500 dark:bg-amber-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-amber-600 dark:hover:bg-amber-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-100 dark:shadow-none transition-all"
                  >
                     <Crown size={16} /> Quero ser Elite
                  </button>
               </div>
               <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 opacity-40 transition-colors" />
            </div>
            <AuthModal
               isOpen={showAuthModal}
               onClose={() => setShowAuthModal(false)}
               title="Desbloqueie o Raio-X"
               description="Acesse análises estratégicas e saia na frente da concorrência com o plano Elite."
            />
            <UpgradeModal
               isOpen={showUpgradeModal}
               onClose={() => setShowUpgradeModal(false)}
               requiredPlan="Elite"
               featureName="Raio-X da Banca"
            />
         </div>
      );
   }

   return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-20">
         <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
               <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors"><Zap className="text-amber-500 dark:text-amber-400" size={24} /> Raio-X da Banca</h1>
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest rounded-md border border-amber-200 dark:border-amber-800/50 transition-colors">Elite</span>
               </div>
               <p className="text-slate-500 dark:text-slate-400 text-sm font-medium transition-colors">Inteligência de dados aplicada para hackear a sua aprovação.</p>
            </div>
         </header>

         <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 transition-colors">
            <div className="md:col-span-1 space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><Search size={12} /> Selecione a Banca</label>
               <select value={selectedAgency} onChange={e => { setSelectedAgency(e.target.value); setSelectedRole(''); setSelectedYear('All'); }} className="w-full h-11 px-3 text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer transition-all">
                  <option value="">Selecione...</option>
                  {agencies.map(a => <option key={a} value={a}>{a}</option>)}
               </select>
            </div>
            <div className="md:col-span-1 space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><Briefcase size={12} /> Cargo (Opcional)</label>
               <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} disabled={!selectedAgency} className="w-full h-11 px-3 text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 cursor-pointer transition-all">
                  <option value="">Geral (Todos os Cargos)</option>
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
               </select>
            </div>
            <div className="md:col-span-1 space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><Calendar size={12} /> Período</label>
               <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} disabled={!selectedAgency} className="w-full h-11 px-3 text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 cursor-pointer transition-all">
                  <option value="All">Todo o Período</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
               </select>
            </div>
         </div>

         {selectedAgency ? (
            isAnalyzing ? (
               <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px] animate-fade-in shadow-xl transition-colors">
                  <div className="relative">
                     <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center animate-pulse transition-colors">
                        <BrainCircuit size={48} className="text-indigo-600 dark:text-indigo-400" />
                     </div>
                     <div className="absolute top-0 left-0 w-24 h-24 border-4 border-indigo-100 dark:border-indigo-900/30 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin"></div>
                  </div>

                  <div className="w-full max-w-xs space-y-2">
                     <h3 className="text-lg font-black text-slate-900 dark:text-white animate-pulse transition-colors">{loadingText}</h3>
                     <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden transition-colors">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                     </div>
                     <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right transition-colors">{progress}%</p>
                  </div>

                  <div className="flex gap-4 opacity-50">
                     <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase transition-colors"><Database size={12} /> Base Atualizada</div>
                     <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase transition-colors"><Zap size={12} /> Processamento IA</div>
                  </div>
               </div>
            ) : (
               stats && (
                  <div className="space-y-6 animate-slide-up">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-full hover:border-indigo-200 dark:hover:border-indigo-600 transition-all">
                           <div>
                              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase mb-2"><FileText size={14} /> Estilo da Prova</div>
                              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-tight transition-colors">{stats.textStyle}</h3>
                           </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-full hover:border-emerald-200 dark:hover:border-emerald-600 transition-all">
                           <div>
                              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase mb-2"><Building2 size={14} /> Contextualização</div>
                              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{stats.contextUsage}%</h3>
                           </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-full hover:border-amber-200 dark:hover:border-amber-600 transition-all">
                           <div>
                              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-[10px] uppercase mb-2"><BarChart3 size={14} /> Total Analisado</div>
                              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{stats.total}</h3>
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm min-h-[300px] transition-colors">
                           <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2 uppercase tracking-wide transition-colors"><PieIcon size={16} className="text-slate-400 dark:text-slate-500" /> Distribuição Geral</h3>
                           <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.subjectData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{stats.subjectData.map((entry, index) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}</Pie><Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', fontSize: '12px' }} /></PieChart></ResponsiveContainer></div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm min-h-[300px] transition-colors">
                           <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2 uppercase tracking-wide transition-colors"><BarChart3 size={16} className="text-slate-400 dark:text-slate-500" /> Nível de Dificuldade</h3>
                           <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.difficultyData}><XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', fontSize: '12px' }} /><Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} /></BarChart></ResponsiveContainer></div>
                        </div>
                     </div>

                     <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 transition-colors">
                           <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wide transition-colors"><Target size={16} className="text-red-500 dark:text-red-400" /> Raio-X Temático: O que mais cai?</h3>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                           {stats.detailedBreakdown.map((item, index) => (
                              <div key={item.subject} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                 <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2 transition-colors">
                                       <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />{item.subject}
                                    </h4>
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded transition-colors">{item.total} Questões</span>
                                 </div>
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {item.topics.map((topic, tIdx) => (
                                       <div key={topic.topic} className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-lg shadow-sm group hover:border-indigo-200 dark:hover:border-indigo-600 transition-all">
                                          <div className="flex items-center gap-2 overflow-hidden flex-1">
                                             <span className="text-[10px] font-bold text-slate-400 dark:text-slate-600 w-3 transition-colors">{tIdx + 1}.</span>
                                             <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate transition-colors" title={topic.topic}>{topic.topic}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                             <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/40 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{topic.count}</span>
                                             <div className="h-1 w-8 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex-shrink-0">
                                                <div className="h-full rounded-full" style={{ width: `${(topic.count / item.total) * 100}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                                             </div>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               )
            )
         ) : (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 border-dashed transition-colors">
               <Search className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
               <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest transition-colors">Selecione uma banca acima para iniciar.</p>
            </div>
         )}
      </div>
   );
};

export default BankAnalysis;
