'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { plannerService, initialPlan, localDate, type PlanConfig, type PlanSession, type PlanTemplate, type PlannerResponse, type StudyPlan, type Performance } from '@services/study-schedule/plannerService';
import s from './planner.module.css';

const kindLabels = { study: 'Estudo', questions: 'Questões', review: 'Revisão' };
const statuses: Record<string, string> = { active: 'Ativo', paused: 'Pausado', completed: 'Concluído', archived: 'Arquivado', draft: 'Rascunho', published: 'Publicado' };
const sessionLabels = { planned: 'A fazer', started: 'Em andamento', completed: 'Concluída' };
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const hours = (minutes: number) => `${Math.floor(minutes / 60)} h ${Math.round(minutes % 60)} min`;
const errText = (error: unknown) => {
  const e = error as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || 'Não foi possível concluir. Tente novamente.';
};
const shift = (date: string, days: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return localDate(d); };

export default function Planner() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<PlannerResponse>({});
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [performance, setPerformance] = useState<Performance>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'library' | 'mine' | 'manage'>('library');
  const [query, setQuery] = useState('');
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<PlanConfig>(initialPlan);
  const [template, setTemplate] = useState<PlanTemplate | null>(null);
  const [templateMode, setTemplateMode] = useState(false);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<PlanSession[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState('today');
  const [date, setDate] = useState(localDate);
  const [days, setDays] = useState(30);
  const [reschedule, setReschedule] = useState<PlanSession | null>(null);
  const [targetDate, setTargetDate] = useState(localDate);
  const request = useRef(0);

  const load = useCallback(async (id?: string, period = 30) => {
    const ticket = ++request.current;
    setLoading(true); setError('');
    try {
      const result = await plannerService.read(id, period);
      if (ticket !== request.current) return;
      if (id) { setPlan(result.plan || null); setPerformance(result.performance || {}); }
      else { setData(result); setPlan(null); }
    } catch (e) { if (ticket === request.current) setError(errText(e)); }
    finally { if (ticket === request.current) setLoading(false); }
  }, []);
  useEffect(() => {
    setData({}); setPlan(null); setPerformance({});
    if (currentUser?.id) void load(); else setLoading(false);
    return () => { request.current++; };
  }, [currentUser?.id, load]);

  async function mutate(input: Record<string, unknown>, after?: (response: PlannerResponse) => void) {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = await plannerService.write(input); if (result.plan) setPlan(result.plan); after?.(result); }
    catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  }
  function begin(model: PlanTemplate | null = null, admin = false, edit = false) {
    setTemplate(model); setTemplateMode(admin); setEditing(edit); setStep(0); setPreview([]); setError('');
    const next = edit && plan ? structuredClone(plan.config) : model ? structuredClone(model.config) : initialPlan();
    if (model && !admin) {
      next.startDate = localDate();
      if (next.examDate <= next.startDate) { next.examDate = initialPlan().examDate; next.dateConfirmed = false; }
    }
    if (edit) next.startDate = localDate();
    setConfig(next); setWizard(true);
  }
  function update<K extends keyof PlanConfig>(key: K, value: PlanConfig[K]) { setConfig(c => ({ ...c, [key]: value })); setPreview([]); }
  async function advance() {
    if (step === 0 && !config.title.trim()) { setError('Informe o concurso e cargo.'); return; }
    if (step === 1 && config.subjects.some(x => !x.name.trim() || !x.topics.length || x.questions <= 0 || x.weight <= 0)) { setError('Complete as matérias, assuntos, quantidade e pesos.'); return; }
    setError('');
    if (step === 2) await mutate({ action: 'preview', config }, result => { setPreview(result.sessions || []); setStep(3); });
    else setStep(step + 1);
  }
  async function save(templateStatus = 'draft') {
    await mutate({ action: templateMode ? 'template' : editing ? 'revise' : 'create', config,
      ...(templateMode ? { id: template?.id, status: templateStatus } : editing ? { id: plan?.id, revision: plan?.revision } : { templateId: template?.id }) }, result => {
      setWizard(false); if (result.plan) { setTab('today'); void load(result.plan.id, days); } else void load();
    });
  }
  const draftKey = `cm:planner-draft:${currentUser?.id}`;
  function saveDraft() { try { localStorage.setItem(draftKey, JSON.stringify(config)); setWizard(false); setView('mine'); } catch { setError('Não foi possível salvar o rascunho neste dispositivo.'); } }

  const button = (label: string, onClick: () => void, primary = false) => <button type="button" className={primary ? s.primary : s.button} disabled={busy} onClick={onClick}>{label}</button>;
  const field = (label: string, key: 'title' | 'bank' | 'area' | 'sourceUrl' | 'startDate' | 'examDate', type = 'text') => <label className={s.field}>{label}<input type={type} value={config[key]} onChange={e => update(key, e.target.value)} /></label>;

  function sessionActions(activity: PlanSession) {
    if (!plan) return null;
    const payload = { action: 'session', id: plan.id, revision: plan.revision, sessionId: activity.id };
    const questionUrl = `/questoes?${new URLSearchParams({ subject: activity.subject, keyword: activity.topic, excludeAnswered: activity.kind === 'questions' ? 'true' : 'false' })}`;
    return <div className={s.actions}>
      {activity.status === 'completed' ? <span className={s.good}><Check size={16} /> Concluída</span> : <>
        {activity.status === 'planned' ? <button className={s.primary} disabled={busy || plan.status !== 'active'} onClick={() => void mutate({ ...payload, operation: 'start' })}><Play size={15} /> Iniciar</button> : <>
          <Link className={s.button} href={questionUrl}>Abrir questões <ArrowRight size={15} /></Link>
          {button('Concluir atividade', () => void mutate({ ...payload, operation: 'complete' }, () => void load(plan.id, days)))}
        </>}
        {activity.status === 'planned' && <button className={s.link} disabled={busy || plan.status !== 'active'} onClick={() => { setReschedule(activity); setTargetDate(localDate()); }}>Reagendar</button>}
      </>}
    </div>;
  }

  if (!currentUser) return <div className={s.page}><h1>Cronogramas</h1><p>Entre na sua conta para acessar seus planos de estudo.</p><Link href="/login" className={s.primary}>Entrar</Link></div>;

  return <div className={s.page} aria-busy={busy || loading}>
    <nav aria-label="Navegação estrutural"><small><Link href="/dashboard">Início</Link> / <button onClick={() => { setWizard(false); void load(); }}>Cronograma</button>{wizard ? ' / Criar' : plan ? ` / ${plan.title}` : ''}</small></nav>
    {error && <div role="alert" className={s.error}>{error} <button className={s.link} onClick={() => void load(plan?.id, days)}>Tentar novamente</button></div>}
    {loading && <p role="status">Carregando cronogramas...</p>}
    {wizard ? <>
      <h1>{templateMode ? 'Modelo da equipe' : editing ? 'Ajustar cronograma' : 'Criar cronograma'}</h1>
      <p>{template ? template.title : 'Organize sua preparação até a prova.'}</p>
      <ol className={s.stepper}>{['Concurso', 'Edital e pesos', 'Sua rotina', 'Revisar plano'].map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined}>{step === i ? <strong>{i + 1}. {label}</strong> : `${i < step ? '✓' : i + 1}. ${label}`}</li>)}</ol>
      {step === 0 && <><h2>Para qual concurso você vai estudar?</h2><div className={s.fields}>{field('Concurso e cargo', 'title')}{field('Banca', 'bank')}{field('Área', 'area')}{field('Link do edital', 'sourceUrl', 'url')}{field('Início dos estudos', 'startDate', 'date')}{field('Data da prova ou data-alvo', 'examDate', 'date')}</div><label className={s.actions}><input type="checkbox" checked={config.dateConfirmed} onChange={e => update('dateConfirmed', e.target.checked)} /> Data da prova confirmada no edital</label><p>{config.dateConfirmed ? 'Confira a data e o edital antes de continuar.' : 'O plano usará uma data-alvo estimada. Você poderá ajustá-la depois.'}</p></>}
      {step === 1 && <><h2>Confira o que será cobrado</h2>{config.subjects.map((subject, index) => <section className={s.subject} key={subject.id}>
        <div className={s.row}><h3>Matéria {index + 1}</h3><button title="Remover matéria" aria-label="Remover matéria" className={s.icon} disabled={config.subjects.length === 1} onClick={() => update('subjects', config.subjects.filter((_, i) => i !== index))}><Trash2 size={16} /></button></div>
        <div className={s.fields}><label className={s.field}>Matéria<input value={subject.name} onChange={e => update('subjects', config.subjects.map((x, i) => i === index ? { ...x, name: e.target.value } : x))} /></label>
        {(['questions', 'weight', 'minimum'] as const).map((key, k) => <label className={s.field} key={key}>{['Questões na prova', 'Peso por questão', 'Mínimo de acertos (%)'][k]}<input type="number" min={key === 'minimum' ? 0 : 0.1} step={key === 'weight' ? 0.1 : 1} value={subject[key]} onChange={e => update('subjects', config.subjects.map((x, i) => i === index ? { ...x, [key]: Number(e.target.value) } : x))} /></label>)}</div>
        <label className={s.field}>Assuntos do edital (um por linha)<textarea value={subject.topics.join('\n')} onChange={e => update('subjects', config.subjects.map((x, i) => i === index ? { ...x, topics: e.target.value.split('\n') } : x))} /></label>
      </section>)}<button className={s.button} onClick={() => update('subjects', [...config.subjects, { id: crypto.randomUUID(), name: '', topics: [], questions: 10, weight: 1, minimum: 0 }])}><Plus size={16} /> Adicionar matéria</button><div className={s.fields}><label className={s.field}>Desconto por resposta errada (em pontos)<input type="number" min="0" step="0.1" value={config.wrongPenalty} onChange={e => update('wrongPenalty', Number(e.target.value))} /></label><p>Total: {config.subjects.reduce((a, x) => a + x.questions, 0)} questões • {config.subjects.reduce((a, x) => a + x.questions * x.weight, 0)} pontos</p></div></>}
      {step === 2 && <><h2>Quanto tempo cabe na sua semana?</h2><div className={s.weekdays}>{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((label, index) => <label key={label} className={s.field}>{label} (min)<input type="number" min="0" max="600" step="10" value={config.availability[String(index + 1)]} onChange={e => update('availability', { ...config.availability, [index + 1]: Number(e.target.value) })} /></label>)}</div>
        <div className={s.fields}>{(['sessionMinutes', 'questionGoal', 'reservePercent'] as const).map((key, index) => <label className={s.field} key={key}>{['Duração da sessão (min)', 'Meta de questões por sessão', 'Reserva para imprevistos (%)'][index]}<input type="number" min={key === 'reservePercent' ? 0 : 1} value={config[key]} onChange={e => update(key, Number(e.target.value))} /></label>)}</div><p>{hours(Object.values(config.availability).reduce((a, n) => a + n, 0))} por semana. Pausas de 5 minutos entre sessões.</p></>}
      {step === 3 && <><h2>Seu plano até {dateLabel(config.examDate)}</h2><div className={s.metrics}><Metric label="Atividades" value={String(preview.length)} /><Metric label="Tempo planejado" value={hours(preview.reduce((a, x) => a + x.minutes, 0))} /><Metric label="Matérias" value={String(config.subjects.length)} /><Metric label="Reserva semanal" value={`${config.reservePercent}%`} /></div><div className={s.notice}>A distribuição considera os pontos da prova e seu histórico recente. Ao ajustar o plano, atividades concluídas e em andamento são preservadas.</div><SessionTable sessions={preview.slice(0, 10)} /><p>Prévia das primeiras {Math.min(10, preview.length)} atividades. Todas serão salvas até a véspera da prova.</p></>}
      <div className={s.toolbar}><button className={s.button} onClick={() => step ? setStep(step - 1) : setWizard(false)}><ArrowLeft size={16} /> Voltar</button><div className={s.actions}>{!templateMode && button('Salvar rascunho neste dispositivo', saveDraft)}{step < 3 ? button('Continuar', () => void advance(), true) : templateMode ? <>{button('Salvar modelo em rascunho', () => void save('draft'))}{button('Publicar modelo', () => void save('published'), true)}</> : button(editing ? 'Salvar ajustes' : 'Gerar meu cronograma', () => void save(), true)}</div></div>
    </> : plan ? <>
      <div className={s.row}><div><h1>Meu cronograma</h1><p>{plan.title}</p></div><div className={s.actions}><button className={s.button} onClick={() => begin(null, false, true)}><Pencil size={15} /> Editar plano</button>{button(plan.status === 'active' ? 'Pausar' : 'Retomar', () => void mutate({ action: 'status', id: plan.id, revision: plan.revision, status: plan.status === 'active' ? 'paused' : 'active' }))}{plan.status !== 'archived' && button('Arquivar', () => { if (window.confirm('Arquivar este cronograma? Seu histórico será preservado.')) void mutate({ action: 'status', id: plan.id, revision: plan.revision, status: 'archived' }); })}</div></div>
      <PlanSummary plan={plan} />
      {plan.status !== 'active' && <div className={s.notice}>Plano {statuses[plan.status]?.toLowerCase()}. Retome para iniciar atividades.</div>}
      <div className={s.tabs} role="tablist" aria-label="Visualização do cronograma">{[['today', 'Hoje'], ['week', 'Semana'], ['progress', 'Evolução']].map(([key, label]) => <button role="tab" aria-selected={tab === key} key={key} onClick={() => setTab(key)}>{label}</button>)}</div>
      {tab === 'progress' ? <Progress plan={plan} performance={performance} days={days} onDays={n => { setDays(n); void load(plan.id, n); }} /> : <>
        <div className={s.toolbar}><div className={s.actions}><button className={s.icon} title="Período anterior" onClick={() => setDate(shift(date, tab === 'week' ? -7 : -1))}><ChevronLeft size={18} /></button><button className={s.icon} title="Próximo período" onClick={() => setDate(shift(date, tab === 'week' ? 7 : 1))}><ChevronRight size={18} /></button><strong>{tab === 'week' ? `${dateLabel(date)} a ${dateLabel(shift(date, 6))}` : new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>{button('Hoje', () => setDate(localDate()))}</div><button className={s.button} onClick={() => void load(plan.id, days)}><RefreshCw size={15} /> Atualizar</button></div>
        {tab === 'today' ? <><h2>Atividades do dia</h2>{plan.sessions.filter(x => x.date === date).length === 0 && <div className={s.empty}>Nenhuma atividade para este dia.</div>}{plan.sessions.filter(x => x.date === date).map(activity => <article className={s.activity} key={activity.id}><div><small>{kindLabels[activity.kind]}</small><h3>{activity.subject}</h3><p>{activity.topic}</p><p><Clock size={14} style={{ display: 'inline' }} /> {activity.minutes} min {activity.questionGoal > 0 && `• ${activity.questionGoal} questões`}</p><small>{sessionLabels[activity.status]}</small></div>{sessionActions(activity)}</article>)}</> : <SessionTable sessions={plan.sessions.filter(x => x.date >= date && x.date <= shift(date, 6))} actions={sessionActions} />}
        {plan.sessions.some(x => x.date < localDate() && x.status !== 'completed') && <><h2>Pendências anteriores</h2><p>Reagende em um dia com tempo disponível.</p><SessionTable sessions={plan.sessions.filter(x => x.date < localDate() && x.status !== 'completed')} actions={sessionActions} /></>}
      </>}
      {reschedule && <div className={s.dialog} role="dialog" aria-modal="true" aria-label="Reagendar atividade"><div className={s.dialogContent}><h2>Reagendar atividade</h2><p>{reschedule.subject} • {reschedule.minutes} min</p><label className={s.field}>Nova data<input autoFocus type="date" min={localDate()} max={shift(plan.config.examDate, -1)} value={targetDate} onChange={e => setTargetDate(e.target.value)} /></label><div className={s.toolbar}>{button('Cancelar', () => setReschedule(null))}{button('Reagendar', () => void mutate({ action: 'session', id: plan.id, revision: plan.revision, sessionId: reschedule.id, operation: 'reschedule', date: targetDate }, () => setReschedule(null)), true)}</div>{error && <p role="alert">{error}</p>}</div></div>}
    </> : <>
      <div className={s.row}><div><h1>Cronogramas</h1><p>Escolha um modelo ou prepare seu plano de estudos.</p></div><button className={s.primary} onClick={() => begin()}><Plus size={16} /> Criar cronograma</button></div>
      <div className={s.tabs} role="tablist" aria-label="Acervo e planos pessoais">{[['library', 'Acervo de modelos'], ['mine', 'Meus cronogramas'], ...(data.canManageTemplates ? [['manage', 'Gerenciar modelos']] : [])].map(([key, label]) => <button role="tab" key={key} aria-selected={view === key} onClick={() => setView(key as typeof view)}>{label}</button>)}</div>
      {view === 'mine' ? <><div className={s.toolbar}>{button('Recuperar rascunho deste dispositivo', () => { try { const raw = localStorage.getItem(draftKey); if (!raw) { setError('Nenhum rascunho encontrado neste dispositivo.'); return; } begin(); setConfig(JSON.parse(raw)); } catch { setError('Rascunho inválido. Crie um novo plano.'); } })}</div>{data.legacy && <div className={s.notice}>Seu cronograma anterior foi preservado. <button className={s.link} onClick={() => { begin(); const old = data.legacy?.form; setConfig(c => ({ ...c, title: String(old?.objective || ''), subjects: Array.isArray(old?.subjects) ? old.subjects.map((x: Record<string, unknown>, i: number) => ({ id: `s${i}`, name: String(x.name || ''), topics: String(x.topics || '').split(/[\n,]/).filter(Boolean), questions: 10, weight: 1, minimum: 0 })) : c.subjects })); }}>Usar matérias do plano anterior</button></div>}<div className={s.grid}>{data.plans?.map(p => <article className={s.card} key={p.id}><CalendarDays size={24} /><h2>{p.title}</h2><span className={s.badge}>{statuses[p.status]}</span><div>{button('Abrir cronograma', () => void load(p.id, days), true)}</div></article>)}</div>{!loading && !data.plans?.length && <div className={s.empty}>Você ainda não criou um cronograma.</div>}</> : <>
        <div className={s.toolbar}><label className={s.field} style={{ flex: 1 }}>Concurso, cargo ou área<input value={query} placeholder="Buscar modelos" onChange={e => setQuery(e.target.value)} /></label>{view === 'manage' && button('Novo modelo', () => begin(null, true), true)}</div>
        {!loading && !data.templates?.length && <div className={s.empty}><CalendarDays size={30} style={{ margin: '0 auto 12px' }} /><h3>Modelos em preparação</h3><p>Você pode criar seu plano personalizado com os dados do edital.</p>{button('Criar meu cronograma', () => begin(), true)}</div>}
        <div className={s.grid}>{data.templates?.filter(t => (view === 'manage' || t.status === 'published') && `${t.title} ${t.config.area}`.toLowerCase().includes(query.toLowerCase())).map(t => <article className={s.card} key={t.id}><CalendarDays size={28} color="#2563eb" /><h2>{t.title}</h2><p>{t.config.bank || 'Banca a confirmar'} • {t.config.subjects.length} disciplinas</p><small>Versão {t.version} • {statuses[t.status]}</small><p>{t.config.dateConfirmed ? 'Data de referência no modelo' : 'Pré-edital • data-alvo personalizada'}</p><button className={s.link} onClick={() => setExpanded(expanded === t.id ? null : t.id)}>Ver disciplinas e pesos</button>{expanded === t.id && <><ul>{t.config.subjects.map(x => <li key={x.id}><p>{x.name}: {x.questions} questões × peso {x.weight}</p></li>)}</ul>{t.config.sourceUrl && <a className={s.link} href={t.config.sourceUrl} target="_blank" rel="noopener noreferrer">Consultar edital</a>}</>}<div>{button(view === 'manage' ? 'Editar modelo' : 'Usar este modelo', () => begin(t, view === 'manage'), true)}</div></article>)}</div>
      </>}
    </>}
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className={s.metric}><small>{label}</small><strong>{value}</strong>{detail && <small>{detail}</small>}</div>; }
function SessionTable({ sessions, actions }: { sessions: PlanSession[]; actions?: (session: PlanSession) => React.ReactNode }) {
  return <div className={s.scroll}><table className={s.table}><thead><tr><th>Dia</th><th>Atividade</th><th>Meta</th><th>Situação</th>{actions && <th>Ação</th>}</tr></thead><tbody>{sessions.map(a => <tr key={a.id}><td>{dateLabel(a.date)}</td><td><strong>{a.subject}</strong><small>{a.topic} • {kindLabels[a.kind]}</small></td><td>{a.minutes} min{a.questionGoal > 0 && <small>{a.questionGoal} questões</small>}</td><td>{sessionLabels[a.status]}</td>{actions && <td>{actions(a)}</td>}</tr>)}{sessions.length === 0 && <tr><td colSpan={actions ? 5 : 4}>Nenhuma atividade neste período.</td></tr>}</tbody></table></div>;
}
function PlanSummary({ plan }: { plan: StudyPlan }) {
  const today = localDate(); const monday = new Date(`${today}T12:00:00`); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = plan.sessions.filter(x => x.date >= localDate(monday) && x.date <= shift(localDate(monday), 6));
  const covered = new Set(plan.sessions.filter(x => x.status === 'completed').map(x => `${x.subject}|${x.topic}`)).size;
  const projected = new Set(plan.sessions.map(x => `${x.subject}|${x.topic}`)).size;
  const topics = plan.config.subjects.reduce((sum, x) => sum + x.topics.length, 0);
  return <><div className={s.metrics}><Metric label="Prova / data-alvo" value={dateLabel(plan.config.examDate)} detail={plan.config.dateConfirmed ? 'Data confirmada por você' : 'Data estimada'} /><Metric label="Disponibilidade" value={hours(Object.values(plan.config.availability).reduce((a, x) => a + x, 0))} detail="por semana" /><Metric label="Nesta semana" value={hours(week.reduce((a, x) => a + x.actualMinutes, 0))} detail={`de ${hours(week.reduce((a, x) => a + x.minutes, 0))} planejados`} /><Metric label="Cobertura do edital" value={`${covered} de ${topics} assuntos`} detail="Com atividade concluída" /></div>{projected < topics && <div className={s.notice}>Projeção de cobertura: {projected} de {topics} assuntos até a prova. Ajuste sua rotina ou prioridades para cobrir o restante.</div>}</>;
}
function Progress({ plan, performance, days, onDays }: { plan: StudyPlan; performance: Performance; days: number; onDays: (days: number) => void }) {
  const since = days ? shift(localDate(), -days) : plan.config.startDate;
  const sessions = plan.sessions.filter(x => x.date >= since && x.date <= localDate());
  const actual = sessions.reduce((a, x) => a + x.actualMinutes, 0); const expected = sessions.reduce((a, x) => a + x.minutes, 0);
  const total = Object.values(performance).reduce((a, x) => a + x.total, 0); const correct = Object.values(performance).reduce((a, x) => a + x.correct, 0);
  const points = plan.config.subjects.reduce((a, x) => a + x.questions * x.weight, 0);
  const buckets = Array.from({ length: 4 }, (_, i) => { const end = shift(localDate(), -(3 - i) * 7); const start = shift(end, -6); const part = sessions.filter(x => x.date >= start && x.date <= end); return { label: dateLabel(end), planned: part.reduce((a, x) => a + x.minutes, 0), actual: part.reduce((a, x) => a + x.actualMinutes, 0) }; });
  const max = Math.max(1, ...buckets.map(x => x.planned));
  return <><div className={s.toolbar}><h2>Sua evolução</h2><label className={s.field}>Período<select value={days} onChange={e => onDays(Number(e.target.value))}><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={0}>Todo o plano</option></select></label></div><div className={s.metrics}><Metric label="Tempo registrado" value={hours(actual)} detail={`de ${hours(expected)} planejados`} /><Metric label="Questões novas por matéria" value={String(total)} detail="Primeira resposta por questão" /><Metric label="Acertos" value={total ? `${Math.round(correct / total * 100)}%` : 'Sem dados'} detail={total ? `${correct} acertos` : 'Responda questões para acompanhar'} /></div>
    <h2>Tempo de estudo por semana</h2><p>Planejado (cinza) e registrado (azul) • últimas quatro semanas no período selecionado</p><div className={s.chart} role="img" aria-label="Tempo planejado e registrado por semana">{buckets.map(b => <div className={s.barGroup} key={b.label}><div className={`${s.bar} ${s.barPlanned}`} style={{ height: `${b.planned / max * 100}%` }} title={`Planejado: ${hours(b.planned)}`} /><div className={s.bar} style={{ height: `${b.actual / max * 100}%` }} title={`Registrado: ${hours(b.actual)}`} /><small>{b.label}</small></div>)}</div>
    <h2>Desempenho por matéria</h2><div className={s.scroll}><table className={s.table}><thead><tr><th>Matéria</th><th>Peso na prova</th><th>Questões novas</th><th>Acertos</th><th>Assuntos estudados</th></tr></thead><tbody>{plan.config.subjects.map(subject => { const p = performance[subject.name]; const covered = new Set(sessions.filter(x => x.subject === subject.name && x.status === 'completed').map(x => x.topic)).size; return <tr key={subject.id}><td>{subject.name}</td><td>{(100 * subject.questions * subject.weight / points).toFixed(1)}%</td><td>{p?.total || 0}</td><td>{p?.accuracy == null ? 'Sem dados' : `${p.accuracy}%`}{p && p.total > 0 && p.total < 20 && <small>Amostra pequena</small>}</td><td>{covered} de {subject.topics.length}</td></tr>; })}</tbody></table></div><p>Resultados globais nas matérias do plano. Uma questão pode pertencer a mais de uma matéria. Atividade concluída não significa domínio do assunto.</p></>;
}
