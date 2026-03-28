
import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from 'recharts';
import {
  TrendingUp, Calendar, Zap, Target, BookOpen,
  ChevronDown, Filter, Info, Download, ArrowUpRight
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { Subject } from '../types';

const Evolution: React.FC = () => {
  const { userAnswers, questions } = useData();
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');

  // Dados Mock para Linha do Tempo (Acertos por dia)
  const timelineData = useMemo(() => {
    const days: Record<string, { date: string, acertos: number, total: number }> = {};
    const count = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const lastDays = Array.from({ length: count }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }).reverse();

    lastDays.forEach(day => {
      days[day] = { date: day, acertos: 0, total: 0 };
    });

    userAnswers.forEach(ans => {
      const day = new Date(ans.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (days[day]) {
        days[day].total++;
        if (ans.isCorrect) days[day].acertos++;
      }
    });

    return Object.values(days).map(d => ({
      ...d,
      taxa: d.total > 0 ? Math.round((d.acertos / d.total) * 100) : 0
    }));
  }, [userAnswers, period]);

  // Dados para o Radar de Competências (Assuntos)
  const radarData = useMemo(() => {
    const stats: Record<string, { total: number, correct: number }> = {};

    userAnswers.forEach(ans => {
      const q = questions.find(item => item.id === ans.questionId);
      if (q) {
        if (!stats[q.subject]) stats[q.subject] = { total: 0, correct: 0 };
        stats[q.subject].total++;
        if (ans.isCorrect) stats[q.subject].correct++;
      }
    });

    return Object.values(Subject).map(s => {
      const data = stats[s] || { total: 0, correct: 0 };
      return {
        subject: s,
        fullMark: 100,
        score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
      };
    });
  }, [userAnswers, questions]);

  const stats = useMemo(() => {
    const total = userAnswers.length;
    const correct = userAnswers.filter(a => a.isCorrect).length;
    return {
      total,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      xp: total * 10,
      currentStreak: 5
    };
  }, [userAnswers]);

  const StatBox = ({ label, value, icon: Icon, color, trend }: any) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 group hover:border-indigo-200 dark:hover:border-indigo-600 transition-all">
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-2xl ${color} text-white shadow-sm`}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black text-[10px] bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg transition-colors">
            <ArrowUpRight size={10} /> {trend}%
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">{value}</p>
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors">
            <TrendingUp className="text-indigo-600 dark:text-indigo-400" /> Evolução do Aluno
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium transition-colors">Métricas precisas sobre sua jornada rumo à aprovação.</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex gap-1 transition-colors">
          {(['week', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${period === p ? 'bg-indigo-600 dark:bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              {p === 'week' ? '7 dias' : p === 'month' ? '30 dias' : 'Ano'}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatBox label="Taxa de Precisão" value={`${stats.accuracy}%`} icon={Target} color="bg-indigo-600" trend={3.2} />
        <StatBox label="Questões Feitas" value={stats.total} icon={BookOpen} color="bg-emerald-500" trend={12} />
        <StatBox label="XP Acumulado" value={stats.xp.toLocaleString()} icon={Zap} color="bg-amber-500" />
        <StatBox label="Ofensiva (Dias)" value={stats.currentStreak} icon={Calendar} color="bg-rose-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Curva de Aprendizado */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm min-h-[400px] transition-colors">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors">
              <TrendingUp size={20} className="text-indigo-600 dark:text-indigo-400" /> Curva de Aproveitamento (%)
            </h3>
            <button className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-2 transition-colors">
              <Download size={14} /> Exportar PDF
            </button>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorTaxa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800 transition-colors" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', fontSize: '12px' }}
                  itemStyle={{ fontWeight: 'black', fontSize: '12px', color: '#fff' }}
                  cursor={{ stroke: '#6366f1', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="taxa" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTaxa)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar de Força */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-[400px] transition-colors">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-2 transition-colors">Equilíbrio de Matérias</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-6 transition-colors">Veja onde você está mais forte.</p>
          <div className="flex-1 h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="currentColor" className="text-slate-200 dark:text-slate-700 transition-colors" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Aproveitamento" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', fontSize: '10px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 transition-colors">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-medium transition-colors">
              <Info size={14} />
              Dica: Foque em matérias abaixo de 60% para subir seu nível.
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Insights */}
      <div className="bg-slate-900 dark:bg-slate-950 rounded-[2.5rem] p-10 text-white flex flex-col md:flex-row gap-10 items-center overflow-hidden relative transition-colors border border-slate-800/50">
        <div className="relative z-10 flex-1 space-y-4">
          <h2 className="text-3xl font-black tracking-tight">Parece que você está dominando Direito!</h2>
          <p className="text-slate-400 dark:text-slate-500 font-medium leading-relaxed transition-colors">Seu aproveitamento em temas jurídicos subiu 15% esta semana. Recomendamos revisar agora os temas de <strong>Contabilidade</strong> para equilibrar seu Raio-X.</p>
          <button className="px-8 py-3 bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white font-black uppercase text-xs tracking-widest rounded-xl shadow-xl hover:bg-slate-50 dark:hover:bg-indigo-700 transition-all">Ver Plano de Estudos</button>
        </div>
        <div className="relative z-10 w-48 h-48 bg-indigo-500/20 rounded-full flex items-center justify-center border border-indigo-500/30 animate-pulse transition-colors">
          <div className="w-32 h-32 bg-indigo-500/40 rounded-full flex items-center justify-center">
            <Zap size={64} className="text-white drop-shadow-lg" />
          </div>
        </div>
        {/* Decor */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 dark:bg-indigo-600/5 rounded-full blur-3xl -mr-20 -mt-20 transition-colors"></div>
      </div>
    </div>
  );
};

export default Evolution;
