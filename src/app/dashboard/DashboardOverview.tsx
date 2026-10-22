'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Flame, Timer } from 'lucide-react';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import StableResponsiveContainer from '@/components/shared/charts/StableResponsiveContainer';
import AdBanner from '@/components/shared/feedback/AdBanner';
import PlatformPageHeader from '@/components/shared/layout/PlatformPageHeader';
import { formatStudyDuration } from '@/services/statistics/studyTimeFormatting';
import type { StudyStreakSnapshot } from '@/services/dashboard/studyStreakService';
import type { buildAccuracyInsight, buildQuestionTimelineData, calculateLevelProgress, DashboardTimeRange } from '@/services/dashboard/dashboardInsightsService';
import ui from '@/components/shared/ui/PlatformUI.module.css';
import styles from './DashboardOverview.module.css';

export interface DashboardOverviewProps {
  name: string;
  range: DashboardTimeRange;
  onRangeChange: (range: DashboardTimeRange) => void;
  loading: boolean;
  summary: { totalQuestions: number; correctAnswers: number; wrongAnswers: number; accuracyRate: number };
  timeline: ReturnType<typeof buildQuestionTimelineData>;
  subjects: Array<{ name: string; total: number; correct: number; wrong: number; accuracy: number }>;
  level: ReturnType<typeof calculateLevelProgress>;
  streak: StudyStreakSnapshot;
  totals: { totalSeconds: number; readingSeconds: number; questionSeconds: number };
  studyLoading: boolean;
  averageSeconds: number;
  comments: number;
  motivation: string;
  date: string;
  insight: ReturnType<typeof buildAccuracyInsight>;
}

const ranges: Array<{ id: DashboardTimeRange; label: string }> = [
  { id: 'today', label: 'Hoje' }, { id: 'week', label: '7 dias' },
  { id: 'month', label: '30 dias' }, { id: 'year', label: '12 meses' }, { id: 'all', label: 'Tudo' },
];

function StudyCalendar({ streak }: { streak: StudyStreakSnapshot }) {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const visited = new Set(streak.visitedDateKeys);
  return <>
    <div className={styles.calendarNav}>
      <button type="button" title="Mês anterior" aria-label="Mês anterior" onClick={() => setOffset(offset - 1)}><ChevronLeft size={16} /></button>
      <span aria-live="polite">{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
      <button type="button" title="Próximo mês" aria-label="Próximo mês" disabled={offset === 0} onClick={() => setOffset(offset + 1)}><ChevronRight size={16} /></button>
    </div>
    <div className={styles.calendar} aria-label="Calendário de visitas ao painel">
      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => <span className={styles.weekday} key={day}>{day}</span>)}
      {Array.from({ length: month.getDay() }, (_, index) => <span key={`blank-${index}`} />)}
      {Array.from({ length: lastDay }, (_, index) => {
        const day = index + 1;
        const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const today = offset === 0 && day === now.getDate();
        return <span key={key} aria-current={today ? 'date' : undefined} title={`${day}: ${visited.has(key) ? 'visita registrada' : 'sem visita registrada'}`} className={`${styles.day} ${visited.has(key) ? styles.visited : ''} ${today ? styles.today : ''}`}>{day}</span>;
      })}
    </div>
    <p className={`${ui.muted} mt-2`}>Visitas neste navegador · melhor sequência: {streak.best} dias</p>
  </>;
}

export default function DashboardOverview(props: DashboardOverviewProps) {
  const { summary, level, totals, loading } = props;
  const [showCorrect, setShowCorrect] = useState(true);
  const metrics = [
    { title: 'Taxa de acerto', value: loading ? '—' : `${summary.accuracyRate}%`, detail: 'No período selecionado' },
    { title: 'Questões respondidas', value: loading ? '—' : summary.totalQuestions.toLocaleString('pt-BR'), detail: loading ? 'Carregando respostas…' : `${summary.correctAnswers} acertos · ${summary.wrongAnswers} erros` },
    { title: 'Tempo de estudo', value: props.studyLoading ? '—' : formatStudyDuration(totals.totalSeconds), detail: 'Acumulado, incluindo a sessão atual' },
    { title: 'Nível atual', value: level.currentLevel, detail: `${level.currentXp.toLocaleString('pt-BR')} XP acumulados` },
  ];
  return <div className={ui.scope}>
    <PlatformPageHeader
      title="Seu painel de estudos"
      description={`Olá${props.name ? `, ${props.name}` : ''}. Vamos continuar?`}
      actions={<Link href="/questoes" className={ui.action}><BookOpen size={18} />Resolver questões</Link>}
      className="mb-5"
    />
    <div className={styles.ranges}>
      <div className={styles.segments} role="group" aria-label="Período do desempenho">
        {ranges.map(range => <button key={range.id} type="button" aria-pressed={range.id === props.range} onClick={() => props.onRangeChange(range.id)}>{range.label}</button>)}
      </div>
      <span className={ui.muted}>{props.date}</span>
    </div>
    <dl className={styles.metrics} aria-busy={loading}>
      {metrics.map(metric => <div className={styles.metric} key={metric.title}><dt>{metric.title}</dt><dd>{metric.value}</dd><p className={ui.muted}>{metric.detail}</p></div>)}
    </dl>
    <div className={styles.main}>
      <section className={styles.chart} aria-labelledby="evolution-title">
        <div className={styles.sectionHeader}>
          <h2 id="evolution-title" className={ui.heading}>Evolução do desempenho</h2>
          <div className={styles.legend}><span><i className={styles.dot} />Questões</span><label><input type="checkbox" checked={showCorrect} onChange={event => setShowCorrect(event.target.checked)} />Acertos</label></div>
        </div>
        <div className={styles.chartCanvas}>
          {!loading && props.timeline.some(point => point.questions > 0) ? <StableResponsiveContainer height={270}>
            <LineChart data={props.timeline} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--ui-border)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--ui-muted)' }} minTickGap={30} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--ui-muted)' }} />
              <Tooltip contentStyle={{ borderRadius: 6, background: 'var(--ui-surface)', border: '1px solid var(--ui-border)', color: 'var(--ui-text)' }} />
              <Line type="linear" dataKey="questions" name="Questões" stroke="var(--ui-primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              {showCorrect && <Line type="linear" dataKey="correct" name="Acertos" stroke="var(--ui-success)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
            </LineChart>
          </StableResponsiveContainer> : <div className={styles.empty} role="status"><BookOpen size={24} /><p>{loading ? 'Carregando seu desempenho…' : 'Nenhuma resposta neste período.'}</p>{!loading && <Link className={ui.textLink} href="/questoes">Começar a praticar <ArrowRight size={16} /></Link>}</div>}
        </div>
        <p className={ui.muted}>Gráfico e matérias: amostra das respostas recentes do período.</p>
      </section>
      <section className={styles.streak} aria-labelledby="streak-title">
        <div className={styles.sectionHeader}><h2 id="streak-title" className={ui.heading}>Sua constância</h2><span className={styles.flame}><Flame size={16} />{props.streak.current} {props.streak.current === 1 ? 'dia seguido' : 'dias seguidos'}</span></div>
        <StudyCalendar streak={props.streak} />
        <div className={styles.level}><div className="flex justify-between gap-3"><span>Próximo nível</span><span className={ui.muted}>Faltam {level.xpToNextLevel} XP</span></div><div className={ui.progress} role="progressbar" aria-label="Progresso para o próximo nível" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level.levelProgressPercent}><span style={{ width: `${level.levelProgressPercent}%` }} /></div></div>
      </section>
    </div>
    <section className={styles.section} aria-labelledby="subjects-title">
      <div className={styles.sectionHeader}><h2 id="subjects-title" className={ui.heading}>Desempenho por matéria</h2><Link className={ui.textLink} href="/performance/subjects">Ver desempenho <ArrowRight size={16} /></Link></div>
      {props.subjects.length && !loading ? <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th scope="col">Matéria</th><th scope="col">Questões</th><th scope="col">Acertos</th><th scope="col"><span className={styles.desktopLabel}>Aproveitamento</span><span className={styles.mobileLabel}>Acerto (%)</span></th></tr></thead>
        <tbody>{props.subjects.map(subject => <tr key={subject.name}><td>{subject.name}</td><td>{subject.total}</td><td>{subject.correct}</td><td><div className={styles.accuracy}><span>{subject.accuracy}%</span><div className={ui.progress} aria-hidden="true"><span style={{ width: `${subject.accuracy}%`, background: subject.accuracy >= 80 ? 'var(--ui-success)' : undefined }} /></div></div></td></tr>)}</tbody>
      </table></div> : <p className={ui.muted}>{loading ? 'Carregando matérias…' : 'Suas matérias aparecerão aqui após responder questões.'}</p>}
    </section>
    <section className={styles.section} aria-labelledby="continue-title">
      <h2 id="continue-title" className={`${ui.heading} mb-4`}>Continue seus estudos</h2>
      <div className={styles.continue}><Link href="/questoes"><BookOpen size={22} />Praticar questões<ChevronRight size={16} /></Link><Link href="/simulation"><Timer size={22} />Seus simulados<ChevronRight size={16} /></Link></div>
    </section>
    <AdBanner type="top" />
    <section className={`${styles.section} ${styles.details}`}>
      <div><h2 className={ui.heading}>Seu tempo de estudo</h2><dl className={styles.studyTimes}><div><dt className={ui.muted}>Leitura</dt><dd>{formatStudyDuration(totals.readingSeconds)}</dd></div><div><dt className={ui.muted}>Questões</dt><dd>{formatStudyDuration(totals.questionSeconds)}</dd></div><div><dt className={ui.muted}>Média diária acumulada</dt><dd>{formatStudyDuration(props.averageSeconds)}</dd></div></dl><p className={ui.muted}>{props.comments} comentários no período</p></div>
      <div><h2 className={ui.heading}>{props.insight.title}</h2><p className={ui.muted}>{props.insight.description}</p></div>
    </section>
    <aside className={styles.section}><h2 className={ui.heading}>Motivação diária</h2><p className={`${ui.muted} mt-2`}>{props.motivation}</p></aside>
  </div>;
}
