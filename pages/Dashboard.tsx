
import React, { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  AreaChart, Area
} from 'recharts';
import { Subject } from '../types';
import { Trophy, Target, MessageSquare, Zap, Calendar, BarChart3, TrendingUp } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { AdPlaceholder } from '../src/components/ads/AdPlaceholder';

const COLORS = ['#10b981', '#ef4444'];
type TimeRange = 'today' | 'week' | 'month' | 'year' | 'all';

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { userAnswers: answers, questions, userComments, systemSettings, ensureUserProgressLoaded } = useData();
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  React.useEffect(() => {
    ensureUserProgressLoaded();
  }, [ensureUserProgressLoaded]);

  // Filtrar respostas com base no período selecionado
  const filteredAnswers = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return answers.filter(a => {
      const ansTime = a.timestamp;

      switch (timeRange) {
        case 'today': return ansTime >= startOfDay;
        case 'week':
          const weekDate = new Date(now);
          const startOfWeek = new Date(weekDate.setDate(weekDate.getDate() - weekDate.getDay())).getTime();
          return ansTime >= startOfWeek;
        case 'month':
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          return ansTime >= startOfMonth;
        case 'year':
          const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
          return ansTime >= startOfYear;
        case 'all': default: return true;
      }
    });
  }, [answers, timeRange]);

  const totalQuestions = filteredAnswers.length;
  const correctCount = filteredAnswers.filter(a => a.isCorrect).length;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const pieData = [
    { name: 'Acertos', value: correctCount },
    { name: 'Erros', value: totalQuestions - correctCount },
  ];

  // Cálculo real por matéria
  const subjectData = useMemo(() => {
    const stats: Record<string, { total: number, acertos: number }> = {};

    Object.values(Subject).forEach(sub => { stats[sub] = { total: 0, acertos: 0 }; });

    filteredAnswers.forEach(ans => {
      const question = questions.find(q => q.id === ans.questionId);
      if (question) {
        // Find the main subject from the question's filters (assuntos where materia is true)
        const subjectName = (question.assuntos as any[])?.find(a => a.materia)?.nome || 'Outros';

        if (!stats[subjectName]) stats[subjectName] = { total: 0, acertos: 0 };
        stats[subjectName].total += 1;
        if (ans.isCorrect) stats[subjectName].acertos += 1;
      }
    });

    return Object.keys(stats)
      .filter(key => stats[key].total > 0)
      .map(key => ({ name: key, acertos: stats[key].acertos, total: stats[key].total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredAnswers, questions]);

  // Cálculo de comentários feitos pelo usuário no período
  const userCommentsCount = useMemo(() => {
    if (!currentUser) return 0;
    if (timeRange === 'all') return currentUser.commentsCount || 0;

    const getTimeRangeLimit = () => {
      const now = new Date();
      switch (timeRange) {
        case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        case 'week': return new Date(now.setDate(now.getDate() - now.getDay())).getTime();
        case 'month': return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        case 'year': return new Date(now.getFullYear(), 0, 1).getTime();
        default: return 0;
      }
    };

    const limit = getTimeRangeLimit();

    // We can just filter the userComments list which is already global
    return (userComments || []).filter(c => {
      const commentTime = new Date(c.date).getTime();
      return commentTime >= limit;
    }).length;
  }, [timeRange, currentUser, userComments]);

  // Cálculo da evolução temporal
  const timelineData = useMemo(() => {
    const data: Record<string, { date: string, accuracy: number, total: number, timestamp: number }> = {};
    const now = new Date();
    let steps = 7;
    let format: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };

    if (timeRange === 'today') {
      steps = now.getHours() + 1;
      format = { hour: '2-digit', minute: '2-digit' }; // Usar HH:00 para as horas
    } else if (timeRange === 'week') {
      steps = 7;
    } else if (timeRange === 'month') {
      steps = 30;
    } else if (timeRange === 'year') {
      steps = 12;
      format = { month: 'short' };
    }

    // Gerar slots vazios
    for (let i = steps - 1; i >= 0; i--) {
      const d = new Date(now);
      if (timeRange === 'today') {
        d.setHours(d.getHours() - i, 0, 0, 0);
      } else if (timeRange === 'year') {
        d.setMonth(d.getMonth() - i, 1);
        d.setHours(0, 0, 0, 0);
      } else {
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
      }

      const label = timeRange === 'today'
        ? `${d.getHours().toString().padStart(2, '0')}:00`
        : d.toLocaleDateString('pt-BR', format);

      data[label] = { date: label, accuracy: 0, total: 0, timestamp: d.getTime() };
    }

    // Preencher dados de forma eficiente
    filteredAnswers.forEach(ans => {
      const d = new Date(ans.timestamp);
      let label = "";

      if (timeRange === 'today') {
        label = `${d.getHours().toString().padStart(2, '0')}:00`;
      } else {
        label = d.toLocaleDateString('pt-BR', format);
      }

      if (data[label]) {
        data[label].total++;
        // Re-calcular média incremental (não o melhor, mas ok para o volume)
        // No entanto, para precisão real no período, vamos armazenar os acertos
      }
    });

    // Segunda passada para calcular acertos reais por label
    Object.keys(data).forEach(label => {
      const periodAns = filteredAnswers.filter(ans => {
        const d = new Date(ans.timestamp);
        const l = timeRange === 'today' ? `${d.getHours().toString().padStart(2, '0')}:00` : d.toLocaleDateString('pt-BR', format);
        return l === label;
      });
      if (periodAns.length > 0) {
        const correct = periodAns.filter(a => a.isCorrect).length;
        data[label].accuracy = Math.round((correct / periodAns.length) * 100);
        data[label].total = periodAns.length;
      }
    });

    return Object.values(data);
  }, [filteredAnswers, timeRange]);

  const StatCard = ({ title, value, subtext, icon: Icon, color }: any) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-start justify-between transition-colors duration-300">
      <div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{value}</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{subtext}</p>
      </div>
      <div className={`p-3 rounded-xl ${color} text-white`}>
        <Icon size={24} />
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Visão Geral</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Acompanhe sua evolução e identifique pontos de melhoria.</p>
        </div>

        {/* Filtro de Período */}
        <div className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex gap-1 shadow-sm overflow-x-auto no-scrollbar max-w-full transition-colors duration-300">
          {[
            { id: 'today', label: 'Hoje' },
            { id: 'week', label: 'Semana' },
            { id: 'month', label: 'Mês' },
            { id: 'year', label: 'Ano' },
            { id: 'all', label: 'Tudo' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTimeRange(t.id as TimeRange)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${timeRange === t.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Taxa de Acerto" value={`${accuracy}%`} subtext="No período selecionado" icon={Target} color="bg-indigo-500" />
        <StatCard title="Questões Feitas" value={totalQuestions} subtext="No período selecionado" icon={Zap} color="bg-blue-500" />
        <StatCard title="Comentários" value={userCommentsCount} subtext="Participação ativa" icon={MessageSquare} color="bg-amber-500" />
        <StatCard title="Nível Atual" value={currentUser?.level || 1} subtext="Sua progressão" icon={Trophy} color="bg-purple-500" />
      </div>

      {/* Ad Banner Central Dashboard */}
      {systemSettings.adsEnabled && (
        <div className="animate-fade-in group">
          <AdPlaceholder type="banner" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Evolution Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm min-h-[350px] transition-colors duration-300 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-500" /> Evolução do Desempenho
            </h3>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-indigo-500" /> Precisão (%)
            </div>
          </div>
          <div className="h-64 w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#818cf8' }}
                />
                <Area type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" name="Questões" />
                <Area type="monotone" dataKey="accuracy" stroke="#6366f1" strokeWidth={2} fillOpacity={0.1} fill="url(#colorAcc)" name="Precisão (%)" />
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Accuracy Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm min-h-[300px] transition-colors duration-300">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
            <Calendar size={18} className="text-slate-400 dark:text-slate-500" /> Desempenho Geral
          </h3>
          <div className="h-64 w-full min-w-0 overflow-hidden relative">
            {totalQuestions > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Porcentagem Centralizada */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                  <span className="text-3xl font-black text-slate-800 dark:text-slate-100">{accuracy}%</span>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <p>Nenhuma questão respondida neste período.</p>
              </div>
            )}
          </div>
        </div>

        {/* Subject Breakdown */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm min-h-[300px] transition-colors duration-300">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
            <BarChart3 size={18} className="text-slate-400 dark:text-slate-500" /> Desempenho por Matéria
          </h3>
          <div className="h-64 w-full min-w-0 overflow-hidden">
            {subjectData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={subjectData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="acertos" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={20} name="Acertos" />
                  <Bar dataKey="total" stackId="a" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={20} name="Total" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400"><p>Dados insuficientes.</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
