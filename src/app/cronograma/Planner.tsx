'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Info, Pencil, Play, Plus, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { plannerService, initialPlan, localDate, availabilityMinutes, withAvailabilityDefaults, type PlanConfig, type PlanSession, type PlanTemplate, type PlannerResponse, type StudyPlan, type Performance, type PlannerDiagnosis, type PlannerDiagnosisItem } from '@services/study-schedule/plannerService';
import { filtersService } from '@services/filters';
import s from './planner.module.css';

type PracticeTaxonomies = Awaited<ReturnType<typeof filtersService.listPracticeTaxonomies>>;
type TaxonomyOption = { id: string; name: string };

const kindLabels = { study: 'Estudo', questions: 'Questões', review: 'Revisão' };
const statuses: Record<string, string> = { active: 'Ativo', paused: 'Pausado', completed: 'Concluído', archived: 'Arquivado', draft: 'Rascunho', published: 'Publicado' };
const sessionLabels = { planned: 'A fazer', started: 'Em andamento', completed: 'Concluída' };
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const hours = (minutes: number) => `${Math.floor(minutes / 60)} h ${Math.round(minutes % 60)} min`;
const durationLabel = (minutes: number) => minutes < 60 ? `${minutes} min` : minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;
const clockLabel = (minutes: number) => minutes === 1440 ? '00:00' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const windowForDuration = (minutes: number) => ({ start: '19:00', end: clockLabel(Math.min(1440, 19 * 60 + minutes)) });
const dayNames = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
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
  const [quickStart, setQuickStart] = useState('19:00');
  const [quickEnd, setQuickEnd] = useState('20:00');
  const [practiceTaxonomies, setPracticeTaxonomies] = useState<PracticeTaxonomies | null>(null);
  const [taxonomiesLoading, setTaxonomiesLoading] = useState(false);
  const [taxonomiesLoadAttempted, setTaxonomiesLoadAttempted] = useState(false);
  const [diagnosis, setDiagnosis] = useState<PlannerDiagnosis | null>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState('');
  const [taxonomyQuery, setTaxonomyQuery] = useState('');
  const [taxonomyLevel, setTaxonomyLevel] = useState('all');
  const [taxonomyResults, setTaxonomyResults] = useState<PlannerDiagnosisItem[]>([]);
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<Record<string, PlannerDiagnosisItem>>({});
  const [expandedMatter, setExpandedMatter] = useState<string | null>(null);
  const [taxonomyChildren, setTaxonomyChildren] = useState<Record<string, PlannerDiagnosisItem[]>>({});
  const [childrenLoading, setChildrenLoading] = useState<string | null>(null);
  const diagnosisRequest = useRef(0);
  const searchRequest = useRef(0);
  const taxonomyRequest = useRef(false);
  const [examDateInput, setExamDateInput] = useState('');
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
  useEffect(() => {
    if (!wizard || step !== 0 || practiceTaxonomies || taxonomyRequest.current || taxonomiesLoadAttempted) return;
    taxonomyRequest.current = true;
    setTaxonomiesLoadAttempted(true);
    setTaxonomiesLoading(true);
    void filtersService.listPracticeTaxonomies().then(result => {
      setPracticeTaxonomies(result);
    }).catch(e => {
      setError(errText(e));
    }).finally(() => {
      taxonomyRequest.current = false;
      setTaxonomiesLoading(false);
    });
  }, [wizard, step, practiceTaxonomies, taxonomiesLoadAttempted]);
  useEffect(() => {
    if (!wizard || step !== 2 || !config.organizationId || !config.positionId) return;
    let active = true;
    const ticket = ++diagnosisRequest.current;
    setDiagnosis(null); setTaxonomyChildren({});
    setDiagnosisLoading(true); setDiagnosisError(''); setTaxonomyQuery(''); setTaxonomyResults([]); setExpandedMatter(null);
    void plannerService.diagnose({ organizationId: config.organizationId, positionId: config.positionId, boardId: config.boardId, areaId: config.areaId })
      .then(result => {
        if (!active || ticket !== diagnosisRequest.current) return;
        setDiagnosis(result);
        setConfig(current => {
          if (current.subjects.some(subject => subject.name.trim())) {
            const mattersByName = new Map(result.items.filter(item => item.level === 'materia').map(item => [item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), item]));
            return { ...current, subjects: current.subjects.map(subject => {
              if (subject.taxonomyId || !subject.name.trim()) return subject;
              const matter = mattersByName.get(subject.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
              return matter ? { ...subject, taxonomyId: matter.id, selectedTaxonomyIds: [...new Set([...(subject.selectedTaxonomyIds || []), matter.id])], evidence: subject.evidence || { examCount: matter.examCount, questionCount: matter.questionCount, incidence: matter.incidence } } : subject;
            }) };
          }
          const matters = result.items.filter(item => item.level === 'materia').map(item => ({
            id: `matter-${item.id}`, taxonomyId: item.id, selectedTaxonomyIds: [item.id], name: item.name, topics: [],
            questions: Math.max(1, Math.min(300, Math.round(item.questionCount / Math.max(1, item.examCount)))),
            weight: Math.max(0.1, item.incidence ?? 1), minimum: 0, selfAssessment: 'beginner' as const,
            evidence: { examCount: item.examCount, questionCount: item.questionCount, incidence: item.incidence },
          }));
          return matters.length ? { ...current, subjects: matters } : current;
        });
      }).catch(error => { if (active && ticket === diagnosisRequest.current) setDiagnosisError(errText(error)); })
      .finally(() => { if (active && ticket === diagnosisRequest.current) setDiagnosisLoading(false); });
    return () => { active = false; };
  }, [wizard, step, config.organizationId, config.positionId, config.boardId, config.areaId]);
  useEffect(() => {
    if (!wizard || step !== 2 || taxonomyQuery.trim().length < 2 || !config.organizationId || !config.positionId) { setTaxonomyResults([]); return; }
    const ticket = ++searchRequest.current;
    const timer = window.setTimeout(() => {
      setDiagnosisLoading(true);
      void plannerService.diagnose({ organizationId: config.organizationId!, positionId: config.positionId!, boardId: config.boardId, areaId: config.areaId, search: taxonomyQuery.trim(), level: taxonomyLevel, selectedIds: config.subjects.flatMap(subject => subject.selectedTaxonomyIds || []) })
        .then(result => { if (ticket === searchRequest.current) setTaxonomyResults(result.items); })
        .catch(error => { if (ticket === searchRequest.current) setDiagnosisError(errText(error)); })
        .finally(() => { if (ticket === searchRequest.current) setDiagnosisLoading(false); });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [wizard, step, taxonomyQuery, taxonomyLevel, config.organizationId, config.positionId, config.boardId, config.areaId, config.subjects]);

  async function mutate(input: Record<string, unknown>, after?: (response: PlannerResponse) => void) {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = await plannerService.write(input); if (result.plan) setPlan(result.plan); after?.(result); }
    catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  }
  function begin(model: PlanTemplate | null = null, admin = false, edit = false) {
    setTemplate(model); setTemplateMode(admin); setEditing(edit); setStep(0); setPreview([]); setError(''); setTaxonomiesLoadAttempted(false);
    const next = withAvailabilityDefaults(edit && plan ? structuredClone(plan.config) : model ? structuredClone(model.config) : initialPlan());
    if (model && !admin) {
      next.startDate = localDate();
      if (next.examDate <= next.startDate) { next.examDate = initialPlan().examDate; next.dateConfirmed = false; }
    }
    if (edit) next.startDate = localDate();
    setConfig(next); setExamDateInput(next.dateConfirmed ? next.examDate : ''); setWizard(true);
  }
  function update<K extends keyof PlanConfig>(key: K, value: PlanConfig[K]) { setConfig(c => ({ ...c, [key]: value })); setPreview([]); }
  function updateWindow(day: number, patch: Partial<PlanConfig['availabilityWindows'][string]>) {
    const key = String(day);
    const window = { ...config.availabilityWindows[key], ...patch };
    const windows = { ...config.availabilityWindows, [key]: window };
    update('availabilityWindows', windows);
    update('availability', { ...config.availability, [key]: availabilityMinutes(window) });
  }
  function setDayEnabled(day: number, enabled: boolean) {
    const key = String(day);
    const current = config.availabilityWindows[key];
    const window = enabled ? (availabilityMinutes(current) ? current : windowForDuration(120)) : { ...current, end: current.start };
    updateWindow(day, window);
  }
  function applyAvailabilityToAll() {
    const windows = Object.fromEntries(dayNames.map((_, index) => [String(index + 1), { start: quickStart, end: quickEnd }]));
    const availability = Object.fromEntries(Object.entries(windows).map(([day, window]) => [day, availabilityMinutes(window)]));
    update('availabilityWindows', windows);
    update('availability', availability);
  }
  function addTaxonomyItem(item: PlannerDiagnosisItem) {
    const rootId = item.level === 'materia' ? item.id : item.rootId;
    if (!rootId) return;
    setSelectedCatalogItems(current => ({ ...current, [item.id]: item }));
    const rootName = item.level === 'materia' ? item.name : item.path.split(' · ')[0];
    setConfig(current => {
      const root = current.subjects.find(subject => subject.taxonomyId === rootId)
        || current.subjects.find(subject => !subject.taxonomyId && subject.name.trim().toLocaleLowerCase() === rootName.trim().toLocaleLowerCase());
      if (!root) {
        return { ...current, subjects: [...current.subjects, {
          id: `matter-${rootId}`, taxonomyId: rootId, selectedTaxonomyIds: item.id === rootId ? [rootId] : [rootId, item.id],
          name: rootName, topics: item.id === rootId ? [] : [item.name], questions: item.id === rootId ? Math.max(1, Math.min(300, Math.round(item.questionCount / Math.max(1, item.examCount)))) : 1,
          weight: item.id === rootId ? Math.max(0.1, item.incidence ?? 1) : 1, minimum: 0, selfAssessment: 'beginner',
          evidence: item.id === rootId ? { examCount: item.examCount, questionCount: item.questionCount, incidence: item.incidence } : { examCount: 0, questionCount: 0, incidence: null },
        }] };
      }
      if ((root.selectedTaxonomyIds || []).includes(item.id)) return current;
      return { ...current, subjects: current.subjects.map(subject => subject.id !== root.id ? subject : {
        ...subject, taxonomyId: rootId, selectedTaxonomyIds: [...new Set([...(subject.selectedTaxonomyIds || []), rootId, item.id])],
        topics: item.id === rootId ? subject.topics : [...new Set([...subject.topics, item.name])],
      }) };
    });
  }
  function setSelfAssessment(subjectId: string, value: NonNullable<PlanConfig['subjects'][number]['selfAssessment']>) {
    const minimum = { beginner: 0, studying: 60, reinforce: 75 }[value];
    update('subjects', config.subjects.map(subject => subject.id === subjectId ? { ...subject, selfAssessment: value, minimum } : subject));
  }
  function removeTaxonomyItem(subjectId: string, taxonomyId: string) {
    setConfig(current => ({ ...current, subjects: current.subjects.flatMap(subject => {
      if (subject.id !== subjectId) return [subject];
      if (subject.taxonomyId === taxonomyId) return [];
      const item = selectedCatalogItems[taxonomyId] || [...(taxonomyChildren[subject.taxonomyId || ''] || []), ...taxonomyResults].find(entry => entry.id === taxonomyId);
      return [{ ...subject, selectedTaxonomyIds: (subject.selectedTaxonomyIds || []).filter(id => id !== taxonomyId), topics: item ? subject.topics.filter(topic => topic !== item.name) : subject.topics }];
    }) }));
  }
  async function toggleMatter(item: PlannerDiagnosisItem) {
    if (expandedMatter === item.id) { setExpandedMatter(null); return; }
    setExpandedMatter(item.id);
    if (taxonomyChildren[item.id]) return;
    setChildrenLoading(item.id); setDiagnosisError('');
    try {
      const result = await plannerService.diagnose({ organizationId: config.organizationId!, positionId: config.positionId!, boardId: config.boardId, areaId: config.areaId, parentId: item.id });
      setTaxonomyChildren(current => ({ ...current, [item.id]: result.items }));
    } catch (error) { setDiagnosisError(errText(error)); }
    finally { setChildrenLoading(null); }
  }
  async function advance() {
    if (step === 0 && (!config.organizationId || !config.positionId)) { setError('Selecione o órgão e o cargo no catálogo.'); return; }
    if (step === 0 && config.dateConfirmed && (!examDateInput || examDateInput <= config.startDate)) { setError('Informe uma data de prova futura ou selecione “Ainda não definida”.'); return; }
    if (step === 1 && Object.values(config.availabilityWindows).some(window => window.start !== window.end && (availabilityMinutes(window) < 20 || availabilityMinutes(window) > 600))) { setError('Revise os períodos: cada dia deve ter entre 20 minutos e 10 horas, dentro do mesmo dia.'); return; }
    if (step === 1 && Object.values(config.availability).every(minutes => minutes < 20)) { setError('Informe ao menos 20 minutos em um dia da semana.'); return; }
    if (step === 2 && (!config.subjects.length || config.subjects.some(x => !x.name.trim() || x.questions <= 0 || x.weight <= 0))) { setError('Selecione ao menos uma matéria válida para montar o plano.'); return; }
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
  const questionPracticeUrl = (activity: PlanSession) => `/questoes?${new URLSearchParams({ subject: activity.subject, topic: activity.topic, excludeAnswered: 'true' })}`;
  function sessionActions(activity: PlanSession) {
    if (!plan) return null;
    const payload = { action: 'session', id: plan.id, revision: plan.revision, sessionId: activity.id };
    return <div className={s.actions}>
      {activity.status === 'completed' ? <span className={s.good}><Check size={16} /> Concluída</span> : <>
        {activity.status === 'planned' ? <>
          <button className={s.primary} disabled={busy || plan.status !== 'active'} onClick={() => void mutate({ ...payload, operation: 'start' })}><Play size={15} /> Iniciar</button>
          {activity.kind === 'questions' && <Link className={s.button} href={questionPracticeUrl(activity)}>Praticar questões <ArrowRight size={15} /></Link>}
          <button className={s.link} disabled={busy || plan.status !== 'active'} onClick={() => { setReschedule(activity); setTargetDate(localDate()); }}>Reagendar</button>
        </> : <>
          {activity.kind === 'questions' && <Link className={s.button} href={questionPracticeUrl(activity)}>Praticar questões <ArrowRight size={15} /></Link>}
          {button('Concluir atividade', () => void mutate({ ...payload, operation: 'complete' }, () => void load(plan.id, days)))}
        </>}
      </>}
    </div>;
  }

  if (!currentUser) return <div className={s.page}><h1>Cronogramas</h1><p>Entre na sua conta para acessar seus planos de estudo.</p><Link href="/login" className={s.primary}>Entrar</Link></div>;

  const diagnosedMatters = diagnosis?.items.filter(item => item.level === 'materia') || [];
  const selectedOnlyMatters: PlannerDiagnosisItem[] = config.subjects
    .filter(subject => subject.taxonomyId && !diagnosedMatters.some(item => item.id === subject.taxonomyId))
    .map(subject => {
      const catalogItem = selectedCatalogItems[subject.taxonomyId!];
      return catalogItem?.level === 'materia' ? catalogItem : {
        id: subject.taxonomyId!, name: subject.name, level: 'materia' as const, parentId: null, rootId: subject.taxonomyId!,
        path: subject.name, questionCount: subject.evidence?.questionCount || 0, examCount: subject.evidence?.examCount || 0,
        incidence: subject.evidence?.incidence ?? null, performance: diagnosis?.selectedPerformance[subject.taxonomyId!] || { total: 0, correct: 0, accuracy: null },
      };
    });
  const displayedMatters = [...diagnosedMatters, ...selectedOnlyMatters];

  return <div className={s.page} aria-busy={busy || loading}>
    <CanonicalBreadcrumbs items={[{ label: 'Início', path: '/dashboard' }, { label: 'Cronograma', path: '/cronograma' }]} className="mb-5" />
    {error && <div role="alert" className={s.error}>{error} <button className={s.link} onClick={() => void load(plan?.id, days)}>Tentar novamente</button></div>}
    {loading && <p role="status">Carregando cronogramas...</p>}
    {wizard ? <>
      <header className={s.wizardHeading}><div><h1>Novo cronograma</h1><p>{template ? template.title : step === 1 ? `Órgão: ${practiceTaxonomies?.organizations.find(item => item.id === config.organizationId)?.name || 'não definido'} · Cargo: ${practiceTaxonomies?.roles.find(item => item.id === config.positionId)?.name || 'não definido'}` : 'Escolha seu órgão e cargo. A gente transforma isso em um plano de estudo possível de seguir.'}</p></div></header>
      <ol className={s.stepper} aria-label="Etapas para criar o cronograma">{['Órgão', 'Disponibilidade', 'Ponto de partida', 'Seu plano'].map((label, i) => <li key={label} className={i === step ? s.stepActive : i < step ? s.stepDone : ''} aria-current={step === i ? 'step' : undefined}><span className={s.stepNumber}>{i < step ? <Check size={14} /> : i + 1}</span><span>{label}</span></li>)}</ol>
      {step === 0 && <>
        <div className={s.setupGrid}><section className={s.formPanel} aria-labelledby="organization-step-title">
        <h2 className={s.sectionTitle} id="organization-step-title">1. Órgão</h2>
        <p className={s.sectionCopy}>Selecione o órgão e o cargo do catálogo da plataforma. Você não precisa saber a banca ou a data da prova para começar.</p>
        <div className={s.fields}>
          <div className={`${s.field} ${s.wideField}`}><label htmlFor="planner-organization">Órgão <b>*</b></label><TaxonomyPicker id="planner-organization" value={config.organizationId} options={practiceTaxonomies?.organizations || []} loading={taxonomiesLoading} placeholder="Selecione um órgão" searchPlaceholder="Buscar órgão..." onChange={id => {
            const selected = practiceTaxonomies?.organizations.find(item => item.id === id);
            update('organizationId', id);
            update('positionId', '');
            update('title', selected?.name || '');
          }} /><span className={s.hint}>Escolha um órgão cadastrado. Digite para localizar no catálogo.</span></div>
          <div className={s.field}><label htmlFor="planner-role">Cargo <b>*</b></label><TaxonomyPicker id="planner-role" value={config.positionId} options={practiceTaxonomies?.roles || []} loading={taxonomiesLoading} placeholder="Selecione um cargo" searchPlaceholder="Buscar cargo..." onChange={id => {
            const selected = practiceTaxonomies?.roles.find(item => item.id === id);
            update('positionId', id);
            update('title', [practiceTaxonomies?.organizations.find(item => item.id === config.organizationId)?.name, selected?.name].filter(Boolean).join(' · '));
          }} /><span className={s.hint}>As opções vêm do catálogo da plataforma.</span></div>
          <div className={s.field}><label htmlFor="planner-area">Área <span className={s.optionalLabel}>· opcional</span></label><TaxonomyPicker id="planner-area" value={config.areaId} options={practiceTaxonomies?.areas || []} loading={taxonomiesLoading} placeholder="Selecione uma área" searchPlaceholder="Buscar área..." onChange={id => {
            const selected = practiceTaxonomies?.areas.find(item => item.id === id);
            update('areaId', id); update('area', selected?.name || '');
          }} /><span className={s.hint}>Refine o recorte quando houver classificação disponível.</span></div>
          <div className={`${s.field} ${s.wideField}`}><label htmlFor="planner-agency">Banca <span className={s.optionalLabel}>· opcional</span></label><TaxonomyPicker id="planner-agency" value={config.boardId} options={practiceTaxonomies?.agencies || []} loading={taxonomiesLoading} placeholder="Ainda não definida" searchPlaceholder="Buscar banca..." allowEmpty onChange={id => {
            const selected = practiceTaxonomies?.agencies.find(item => item.id === id);
            update('boardId', id); update('bank', selected?.name || '');
          }} /><span className={s.hint}>Se já estiver definida, escolha uma banca do catálogo.</span></div>
        </div>
        <section className={s.optionalDate} aria-labelledby="exam-date-label">
          <div className={s.dateHeading}><h3 id="exam-date-label">Data da prova <span>· opcional</span></h3><small>Você poderá informar ou atualizar depois.</small></div>
          <div className={s.dateChoices}>
            <button type="button" className={s.choice} aria-pressed={!config.dateConfirmed} onClick={() => { update('dateConfirmed', false); setExamDateInput(''); }}><span className={s.radio} />Ainda não definida</button>
            <button type="button" className={s.choice} aria-pressed={config.dateConfirmed} onClick={() => update('dateConfirmed', true)}><span className={s.radio} />Já tenho uma data</button>
          </div>
          {config.dateConfirmed ? <div className={s.dateRow}><label className={s.field}>Data prevista<input type="date" value={examDateInput} min={config.startDate} onChange={e => { setExamDateInput(e.target.value); update('examDate', e.target.value); }} /></label><p className={s.hint}>Informe a data prevista. Você pode atualizá-la depois.</p></div>
            : <p className={s.hint}>Sem data definida, o cronograma será organizado em ciclos revisáveis, sem inventar uma data de prova.</p>}
        </section>
        <div className={s.rule}><ShieldCheck size={16} /><span>Sem banca ou data? Tudo bem. O cronograma continua possível e poderá ser ajustado quando o edital sair.</span></div>
        {!taxonomiesLoading && !practiceTaxonomies && <p role="alert" className={s.catalogError}>Não foi possível carregar o catálogo. <button type="button" className={s.link} onClick={() => setTaxonomiesLoadAttempted(false)}>Tentar novamente</button></p>}
        <div className={s.wizardActions}><button type="button" className={s.cancelButton} onClick={() => setWizard(false)}>Cancelar</button><button type="button" className={s.primary} disabled={busy || taxonomiesLoading} onClick={() => void advance()}>Continuar <ArrowRight size={15} /></button></div>
        </section><aside className={s.selectionPanel} aria-label="Como o cronograma será personalizado">
          <div className={s.selectionHeader}><span className={s.selectionIcon}><CalendarDays size={17} /></span><div><h3>Plano baseado no seu recorte</h3><p>Sem fórmula genérica</p></div></div>
          <dl><div><dt>Órgão</dt><dd>{practiceTaxonomies?.organizations.find(item => item.id === config.organizationId)?.name || 'Selecione acima'}</dd></div><div><dt>Cargo</dt><dd>{practiceTaxonomies?.roles.find(item => item.id === config.positionId)?.name || 'Selecione acima'}</dd></div><div><dt>Banca</dt><dd>{practiceTaxonomies?.agencies.find(item => item.id === config.boardId)?.name || 'A definir'}</dd></div><div><dt>Data</dt><dd>{config.dateConfirmed && examDateInput ? dateLabel(examDateInput) : 'Não definida'}</dd></div></dl>
          <div className={s.selectionAnalysis}><h4>O que acontece com essa escolha</h4><p>Na próxima etapa, cruzamos provas e questões disponíveis para este órgão e cargo. Os assuntos mais recorrentes ajudam a ordenar suas prioridades.</p></div>
          <div className={s.selectionNotice}><Info size={15} /><span>A recorrência e a cobertura do acervo serão mostradas com transparência. Sem histórico suficiente, isso será indicado antes de montar o plano.</span></div>
          <p className={s.selectionFooter}>A seleção pode ser atualizada depois; seu cronograma acompanha as mudanças.</p>
        </aside></div>
      </>}
      {step === 1 && (() => {
        const weeklyMinutes = Object.values(config.availability).reduce((sum, value) => sum + value, 0);
        const activeDays = Object.values(config.availability).filter(value => value > 0).length;
        const organization = practiceTaxonomies?.organizations.find(item => item.id === config.organizationId)?.name || 'Selecione na etapa anterior';
        const role = practiceTaxonomies?.roles.find(item => item.id === config.positionId)?.name || 'Selecione na etapa anterior';
        return <div className={s.availabilityGrid}>
          <section className={s.formPanel} aria-labelledby="availability-step-title">
            <h2 className={s.sectionTitle} id="availability-step-title">2. Disponibilidade</h2>
            <p className={s.sectionCopy}>Quanto tempo você consegue reservar para estudar em cada dia? Ajuste sua semana para um ritmo que consiga manter.</p>
            <div className={s.availabilityShortcut}>
              <div className={s.availabilityShortcutCopy}><strong>Atalho: aplicar o mesmo período</strong><span>Depois, você pode personalizar qualquer dia.</span></div>
              <div className={s.availabilityQuickControl}>
                <label>Das<input type="time" value={quickStart} onChange={event => setQuickStart(event.target.value)} /></label>
                <span>até</span>
                <label>Às<input type="time" value={quickEnd} onChange={event => setQuickEnd(event.target.value)} /></label>
                <button type="button" className={s.availabilityApply} onClick={applyAvailabilityToAll}>Aplicar a todos</button>
              </div>
            </div>
            <div className={s.availabilityDays} aria-label="Disponibilidade semanal">
              {dayNames.map((label, index) => {
                const day = index + 1;
                const key = String(day);
                const window = config.availabilityWindows[key];
                const minutes = availabilityMinutes(window, config.availability[key]);
                const enabled = window.start !== window.end;
                return <div className={s.availabilityDay} key={key}>
                  <label className={s.availabilityName}><input type="checkbox" checked={enabled} onChange={event => setDayEnabled(day, event.target.checked)} /><span>{label}</span><small>{enabled ? 'Dia de estudo' : 'Dia livre'}</small></label>
                  <div className={s.availabilityTimes}>
                    <label>Das<input aria-label={`Início do período de ${label}`} type="time" value={window.start} disabled={!enabled} onChange={event => updateWindow(day, { start: event.target.value })} /></label>
                    <span>até</span>
                    <label>Às<input aria-label={`Fim do período de ${label}`} type="time" value={window.end} disabled={!enabled} onChange={event => updateWindow(day, { end: event.target.value })} /></label>
                    <small>{enabled ? durationLabel(minutes) : 'Livre'}</small>
                  </div>
                </div>;
              })}
            </div>
            <div className={s.availabilityTotal}><span>Total semanal disponível</span><strong>{durationLabel(weeklyMinutes)}</strong></div>
            <p className={s.availabilityHint}>Você pode informar períodos como 19:00–00:00. A duração é calculada em minutos e nenhuma atividade ultrapassa o horário final.</p>
            <div className={s.availabilityParams}>{(['sessionMinutes', 'questionGoal', 'reservePercent'] as const).map((key, index) => <label className={s.field} key={key}>{['Duração da sessão (min)', 'Meta de questões por sessão', 'Reserva para imprevistos (%)'][index]}<input type="number" min={key === 'reservePercent' ? 0 : 1} value={config[key]} onChange={e => update(key, Number(e.target.value))} /></label>)}</div>
          </section>
          <aside className={s.availabilityInsight} aria-label="Resumo da sua disponibilidade">
            <div className={s.availabilityInsightHeader}><span><Clock size={17} /></span><div><h3>Sua semana de estudos</h3><p>Disponibilidade informada por você</p></div></div>
            <div className={s.availabilityHours}><strong>{durationLabel(weeklyMinutes)}</strong><span>de estudo por semana</span></div>
            <div className={s.availabilityMeter} role="img" aria-label={`${Math.min(100, Math.round(weeklyMinutes / 600 * 100))}% da referência semanal`}><span style={{ width: `${Math.min(100, Math.round(weeklyMinutes / 600 * 100))}%` }} /></div>
            <dl className={s.availabilitySummary}><div><dt>Dias disponíveis</dt><dd>{activeDays} {activeDays === 1 ? 'dia' : 'dias'}</dd></div><div><dt>Órgão</dt><dd>{organization}</dd></div><div><dt>Cargo</dt><dd>{role}</dd></div></dl>
            <div className={s.availabilityAnalysis}><h4>Um plano que cabe na rotina</h4><p>O cronograma distribuirá matérias e revisões nos horários informados, respeitando os dias que você deixou livres.</p></div>
            <div className={s.availabilityNotice}><Info size={15} /><span>Você poderá alterar sua disponibilidade depois. O plano será reorganizado sem apagar atividades concluídas.</span></div>
            <p className={s.availabilityFooter}>Defina um ritmo sustentável. Não é necessário preencher os sete dias.</p>
          </aside>
        </div>;
      })()}
      {step === 2 && <div className={s.diagnosisGrid}>
        <section className={s.formPanel} aria-labelledby="diagnosis-step-title">
          <h2 className={s.sectionTitle} id="diagnosis-step-title">3. Seu ponto de partida</h2>
          <p className={s.sectionCopy}>Identificamos matérias e conteúdos ligados às questões de provas deste órgão e cargo. Revise a seleção e inclua tópicos do catálogo, se necessário.</p>
          {diagnosisLoading && !diagnosis && <p role="status">Analisando provas e questões publicadas…</p>}
          {diagnosisError && <p role="alert" className={s.catalogError}>{diagnosisError} <button type="button" className={s.link} onClick={() => { setDiagnosis(null); }}>Tentar novamente</button></p>}
          {!diagnosisLoading && diagnosis && !diagnosis.items.some(item => item.level === 'materia') && <div className={s.empty}>Não encontramos matérias vinculadas a questões publicadas para este recorte. Busque no catálogo para incluir conteúdos disponíveis ou volte e ajuste órgão, cargo ou banca.</div>}
          {displayedMatters.map(matter => {
            const subject = config.subjects.find(entry => entry.taxonomyId === matter.id);
            const performance = diagnosis.selectedPerformance[matter.id] || { total: 0, correct: 0, accuracy: null };
            const selected = subject?.selectedTaxonomyIds || [];
            const children = taxonomyChildren[matter.id] || [];
            return <article className={`${s.diagnosisSubject} ${!subject ? s.diagnosisRemoved : ''}`} key={matter.id}>
              <div className={s.diagnosisSubjectTop}>
                <div className={s.diagnosisSubjectName}><div><strong>{matter.name}</strong><small>{matter.questionCount} questões catalogadas</small></div>
                  {subject && <button type="button" className={s.icon} aria-label={`Remover ${matter.name}`} onClick={() => removeTaxonomyItem(subject.id, matter.id)}><Trash2 size={15} /></button>}
                  {!subject && <button type="button" className={s.button} onClick={() => addTaxonomyItem(matter)}>Incluir</button>}
                </div>
                <div className={s.diagnosisIncidence}><div><span>Incidência nas provas</span><b>{matter.incidence === null ? 'Sem dados' : `${matter.incidence}%`}</b></div><div className={s.diagnosisMeter}><span style={{ width: `${Math.min(100, matter.incidence || 0)}%` }} /></div><small>{matter.examCount} de {diagnosis.examCount} provas com questões vinculadas</small></div>
                <div className={s.diagnosisAccuracy}><b>{performance.accuracy === null ? (performance.total ? 'Amostra inicial' : 'Sem dados') : `${performance.accuracy}%`}</b><small>{performance.total ? `${performance.total} questões respondidas` : 'Nenhuma resposta registrada'}</small></div>
              </div>
              {subject && <>
                <div className={s.selfAssessment}><span>Como você se avalia?</span>{([['beginner', 'Começando'], ['studying', 'Em estudo'], ['reinforce', 'Preciso reforçar']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={(subject.selfAssessment || 'beginner') === value} onClick={() => setSelfAssessment(subject.id, value)}>{label}</button>)}</div>
                <div className={s.selectedTopics}>
                  {selected.filter(id => id !== matter.id).map(id => {
                    const entry = selectedCatalogItems[id] || children.find(child => child.id === id);
                    return <span className={s.selectedTopic} key={id}>{entry?.name || `Item ${id}`}<button type="button" aria-label={`Remover ${entry?.name || 'conteúdo'}`} onClick={() => removeTaxonomyItem(subject.id, id)}>×</button></span>;
                  })}
                  <button type="button" className={s.expandTopics} aria-expanded={expandedMatter === matter.id} onClick={() => void toggleMatter(matter)}><ChevronDown size={14} />{expandedMatter === matter.id ? 'Ocultar conteúdos da matéria' : 'Ver tópicos e assuntos'}{childrenLoading === matter.id && ' · Carregando'}</button>
                </div>
                {expandedMatter === matter.id && <div className={s.taxonomyChildrenList}>{children.map(child => <div className={s.taxonomyChild} key={child.id}><div><small>{child.level === 'topico' ? 'Tópico' : child.level === 'subtopico' ? 'Subtópico' : 'Assunto'}</small><strong>{child.name}</strong><span>{child.examCount ? `${child.examCount} provas` : 'Sem vínculo em provas'}</span></div><button type="button" aria-pressed={selected.includes(child.id)} onClick={() => selected.includes(child.id) ? removeTaxonomyItem(subject.id, child.id) : addTaxonomyItem(child)}>{selected.includes(child.id) ? 'Remover' : 'Incluir'}</button></div>)}{!children.length && childrenLoading !== matter.id && <p className={s.hint}>Não há tópicos publicados para esta matéria neste recorte.</p>}</div>}
              </>}
            </article>;
          })}
          <section className={s.taxonomyCatalog} aria-label="Buscar matérias e assuntos no catálogo">
            <h3>Adicionar do catálogo</h3><p>Busque matérias, tópicos, subtópicos e assuntos relacionados ao recorte selecionado.</p>
            <div className={s.taxonomySearch}><label className={s.field}>Buscar conteúdo<input type="search" value={taxonomyQuery} onChange={event => setTaxonomyQuery(event.target.value)} placeholder="Digite pelo menos 2 caracteres" /></label><label className={s.field}>Nível<select value={taxonomyLevel} onChange={event => setTaxonomyLevel(event.target.value)}><option value="all">Todos</option><option value="materia">Matéria</option><option value="topico">Tópico</option><option value="subtopico">Subtópico</option><option value="assunto">Assunto</option></select></label></div>
            {taxonomyQuery.trim().length >= 2 && <div className={s.taxonomyResults} aria-live="polite">{taxonomyResults.map(item => {
              const isSelected = config.subjects.some(subject => (subject.selectedTaxonomyIds || []).includes(item.id));
              return <div className={s.taxonomyResult} key={item.id}><div><strong>{item.name}</strong><small>{item.level} · {item.path} · {item.examCount} provas</small></div><button type="button" disabled={isSelected} onClick={() => addTaxonomyItem(item)}>{isSelected ? 'Adicionado' : 'Incluir'}</button></div>;
            })}{!taxonomyResults.length && <p className={s.hint}>{diagnosisLoading ? 'Buscando no catálogo…' : 'Nenhum conteúdo encontrado para este recorte.'}</p>}</div>}
          </section>
          <div className={s.footnote}><Info size={15} /><span>A incidência é a proporção de provas do recorte com questões vinculadas à matéria, não um peso oficial do edital. O desempenho só exibe percentual com pelo menos 20 respostas; amostras menores ficam identificadas como iniciais.</span></div>
        </section>
        <aside className={s.diagnosisInsight} aria-label="Resumo do diagnóstico">
          <div className={s.selectionHeader}><span className={s.selectionIcon}><Search size={17} /></span><div><h3>O que encontramos</h3><p>Órgão, cargo e banca selecionados</p></div></div>
          <dl><div><dt>Provas publicadas</dt><dd>{diagnosis?.examCount ?? '—'}</dd></div><div><dt>Matérias identificadas</dt><dd>{diagnosis?.items.filter(item => item.level === 'materia').length ?? '—'}</dd></div><div><dt>Matérias no plano</dt><dd>{config.subjects.filter(subject => subject.name.trim()).length}</dd></div></dl>
          <div className={s.selectionAnalysis}><h4>{diagnosis?.sample === 'adequate' ? 'Recorte com base mais ampla' : diagnosis?.sample === 'limited' ? 'Amostra limitada' : 'Sem provas vinculadas'}</h4><p>{diagnosis?.sample === 'adequate' ? 'Há pelo menos cinco provas publicadas no recorte. A recorrência ajuda a ordenar o estudo, mas não prevê o conteúdo da próxima prova.' : diagnosis?.sample === 'limited' ? 'Poucas provas têm questões vinculadas a este recorte. Use a recorrência com cautela e complemente o conteúdo pelo catálogo.' : 'Não há provas publicadas com questões vinculadas a este recorte. Você ainda pode buscar e incluir conteúdos do catálogo.'}</p></div>
          <div className={s.selectionNotice}><Info size={15} /><span>Os dados cobrem apenas questões públicas vinculadas ao órgão e cargo. Editais podem ter pesos ou conteúdos não representados no acervo.</span></div>
        </aside>
      </div>}
      {step === 3 && <><h2>{config.dateConfirmed ? `Seu plano até ${dateLabel(config.examDate)}` : 'Seu primeiro ciclo de estudos'}</h2><div className={s.metrics}><Metric label="Atividades" value={String(preview.length)} /><Metric label="Tempo planejado" value={hours(preview.reduce((a, x) => a + x.minutes, 0))} /><Metric label="Matérias" value={String(config.subjects.length)} /><Metric label="Reserva semanal" value={`${config.reservePercent}%`} /></div><div className={s.notice}>A distribuição considera os pontos da prova e seu histórico recente. Ao ajustar o plano, atividades concluídas e em andamento são preservadas.</div><SessionTable sessions={preview.slice(0, 10)} actions={activity => activity.kind === 'questions' ? <Link className={s.button} href={questionPracticeUrl(activity)}>Praticar questões <ArrowRight size={15} /></Link> : null} /><p>Prévia das primeiras {Math.min(10, preview.length)} atividades. {config.dateConfirmed ? 'O ciclo termina na véspera da prova.' : 'Este ciclo poderá ser revisto e ampliado quando houver nova data.'}</p></>}
      {step > 0 && <div className={s.toolbar}><button className={s.button} onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Voltar</button><div className={s.actions}>{!templateMode && button('Salvar rascunho neste dispositivo', saveDraft)}{step < 3 ? button('Continuar', () => void advance(), true) : templateMode ? <>{button('Salvar modelo em rascunho', () => void save('draft'))}{button('Publicar modelo', () => void save('published'), true)}</> : button(editing ? 'Salvar ajustes' : 'Gerar meu cronograma', () => void save(), true)}</div></div>}
    </> : plan ? <>
      <div className={s.row}><div><h1>Meu cronograma</h1><p>{plan.title}</p></div><div className={s.actions}><button className={s.button} onClick={() => begin(null, false, true)}><Pencil size={15} /> Editar plano</button>{button(plan.status === 'active' ? 'Pausar' : 'Retomar', () => void mutate({ action: 'status', id: plan.id, revision: plan.revision, status: plan.status === 'active' ? 'paused' : 'active' }))}{plan.status !== 'archived' && button('Arquivar', () => { if (window.confirm('Arquivar este cronograma? Seu histórico será preservado.')) void mutate({ action: 'status', id: plan.id, revision: plan.revision, status: 'archived' }); })}</div></div>
      <PlanSummary plan={plan} />
      {plan.status !== 'active' && <div className={s.notice}>Plano {statuses[plan.status]?.toLowerCase()}. Retome para iniciar atividades.</div>}
      <div className={s.tabs} role="tablist" aria-label="Visualização do cronograma">{[['today', 'Hoje'], ['week', 'Semana'], ['progress', 'Evolução']].map(([key, label]) => <button role="tab" aria-selected={tab === key} key={key} onClick={() => setTab(key)}>{label}</button>)}</div>
      {tab === 'progress' ? <Progress plan={plan} performance={performance} days={days} onDays={n => { setDays(n); void load(plan.id, n); }} /> : <>
        <div className={s.toolbar}><div className={s.actions}><button className={s.icon} title="Período anterior" onClick={() => setDate(shift(date, tab === 'week' ? -7 : -1))}><ChevronLeft size={18} /></button><button className={s.icon} title="Próximo período" onClick={() => setDate(shift(date, tab === 'week' ? 7 : 1))}><ChevronRight size={18} /></button><strong>{tab === 'week' ? `${dateLabel(date)} a ${dateLabel(shift(date, 6))}` : new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>{button('Hoje', () => setDate(localDate()))}</div><button className={s.button} onClick={() => void load(plan.id, days)}><RefreshCw size={15} /> Atualizar</button></div>
        {tab === 'today' ? <><h2>Atividades do dia</h2>{plan.sessions.filter(x => x.date === date).length === 0 && <div className={s.empty}>Nenhuma atividade para este dia.</div>}{plan.sessions.filter(x => x.date === date).map(activity => <article className={s.activity} key={activity.id}><div><small>{kindLabels[activity.kind]}</small><h3>{activity.subject}</h3><p>{activity.topic}</p><p><Clock size={14} style={{ display: 'inline' }} /> {activity.startTime && activity.endTime ? `${activity.startTime}–${activity.endTime} · ` : ''}{activity.minutes} min {activity.questionGoal > 0 && `• ${activity.questionGoal} questões`}</p><small>{sessionLabels[activity.status]}</small></div>{sessionActions(activity)}</article>)}</> : <SessionTable sessions={plan.sessions.filter(x => x.date >= date && x.date <= shift(date, 6))} actions={sessionActions} />}
        {plan.sessions.some(x => x.date < localDate() && x.status !== 'completed') && <><h2>Pendências anteriores</h2><p>Reagende em um dia com tempo disponível.</p><SessionTable sessions={plan.sessions.filter(x => x.date < localDate() && x.status !== 'completed')} actions={sessionActions} /></>}
      </>}
      {reschedule && <div className={s.dialog} role="dialog" aria-modal="true" aria-label="Reagendar atividade"><div className={s.dialogContent}><h2>Reagendar atividade</h2><p>{reschedule.subject} • {reschedule.minutes} min</p><label className={s.field}>Nova data<input autoFocus type="date" min={localDate()} max={shift(plan.config.examDate, -1)} value={targetDate} onChange={e => setTargetDate(e.target.value)} /></label><div className={s.toolbar}>{button('Cancelar', () => setReschedule(null))}{button('Reagendar', () => void mutate({ action: 'session', id: plan.id, revision: plan.revision, sessionId: reschedule.id, operation: 'reschedule', date: targetDate }, () => setReschedule(null)), true)}</div>{error && <p role="alert">{error}</p>}</div></div>}
    </> : <>
      <div className={s.row}><div><h1>Cronogramas</h1><p>Escolha um modelo ou prepare seu plano de estudos.</p></div><button className={s.primary} onClick={() => begin()}><Plus size={16} /> Criar cronograma</button></div>
      <div className={s.tabs} role="tablist" aria-label="Acervo e planos pessoais">{[['library', 'Acervo de modelos'], ['mine', 'Meus cronogramas'], ...(data.canManageTemplates ? [['manage', 'Gerenciar modelos']] : [])].map(([key, label]) => <button role="tab" key={key} aria-selected={view === key} onClick={() => setView(key as typeof view)}>{label}</button>)}</div>
      {view === 'mine' ? <><div className={s.toolbar}>{button('Recuperar rascunho deste dispositivo', () => { try { const raw = localStorage.getItem(draftKey); if (!raw) { setError('Nenhum rascunho encontrado neste dispositivo.'); return; } begin(); setConfig(withAvailabilityDefaults(JSON.parse(raw))); } catch { setError('Rascunho inválido. Crie um novo plano.'); } })}</div>{data.legacy && <div className={s.notice}>Seu cronograma anterior foi preservado. <button className={s.link} onClick={() => { begin(); const old = data.legacy?.form; setConfig(c => ({ ...c, title: String(old?.objective || ''), subjects: Array.isArray(old?.subjects) ? old.subjects.map((x: Record<string, unknown>, i: number) => ({ id: `s${i}`, name: String(x.name || ''), topics: String(x.topics || '').split(/[\n,]/).filter(Boolean), questions: 10, weight: 1, minimum: 0 })) : c.subjects })); }}>Usar matérias do plano anterior</button></div>}<div className={s.grid}>{data.plans?.map(p => <article className={s.card} key={p.id}><CalendarDays size={24} /><h2>{p.title}</h2><span className={s.badge}>{statuses[p.status]}</span><div>{button('Abrir cronograma', () => void load(p.id, days), true)}</div></article>)}</div>{!loading && !data.plans?.length && <div className={s.empty}>Você ainda não criou um cronograma.</div>}</> : <>
        <div className={s.toolbar}><label className={s.field} style={{ flex: 1 }}>Concurso, cargo ou área<input value={query} placeholder="Buscar modelos" onChange={e => setQuery(e.target.value)} /></label>{view === 'manage' && button('Novo modelo', () => begin(null, true), true)}</div>
        {!loading && !data.templates?.length && <div className={s.empty}><CalendarDays size={30} style={{ margin: '0 auto 12px' }} /><h3>Modelos em preparação</h3><p>Você pode criar seu plano personalizado com os dados do edital.</p>{button('Criar meu cronograma', () => begin(), true)}</div>}
        <div className={s.grid}>{data.templates?.filter(t => (view === 'manage' || t.status === 'published') && `${t.title} ${t.config.area}`.toLowerCase().includes(query.toLowerCase())).map(t => <article className={s.card} key={t.id}><CalendarDays size={28} color="#2563eb" /><h2>{t.title}</h2><p>{t.config.bank || 'Banca a confirmar'} • {t.config.subjects.length} disciplinas</p><small>Versão {t.version} • {statuses[t.status]}</small><p>{t.config.dateConfirmed ? 'Data de referência no modelo' : 'Pré-edital • data-alvo personalizada'}</p><button className={s.link} onClick={() => setExpanded(expanded === t.id ? null : t.id)}>Ver disciplinas e pesos</button>{expanded === t.id && <><ul>{t.config.subjects.map(x => <li key={x.id}><p>{x.name}: {x.questions} questões × peso {x.weight}</p></li>)}</ul>{t.config.sourceUrl && <a className={s.link} href={t.config.sourceUrl} target="_blank" rel="noopener noreferrer">Consultar edital</a>}</>}<div>{button(view === 'manage' ? 'Editar modelo' : 'Usar este modelo', () => begin(t, view === 'manage'), true)}</div></article>)}</div>
      </>}
    </>}
  </div>;
}

function TaxonomyPicker({
  id,
  value,
  options,
  loading,
  placeholder,
  searchPlaceholder,
  onChange,
  allowEmpty = false,
}: {
  id: string;
  value: string;
  options: TaxonomyOption[];
  loading: boolean;
  placeholder: string;
  searchPlaceholder: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find(option => option.id === value);
  const normalizedQuery = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const filtered = options.filter(option => option.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalizedQuery));

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setQuery('');
    setOpen(false);
  }

  return <div className={s.picker} ref={rootRef}>
    <button id={id} type="button" role="combobox" aria-expanded={open} aria-controls={`${id}-options`} aria-haspopup="listbox" aria-busy={loading} disabled={loading} className={s.pickerButton} onClick={() => setOpen(current => !current)}>
      <span>{loading ? 'Carregando opções...' : selected?.name || placeholder}</span><ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && <div className={s.pickerPopover}>
      <div className={s.pickerSearch}><Search size={16} aria-hidden="true" /><input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /></div>
      <div id={`${id}-options`} className={s.pickerOptions} role="listbox" aria-label={searchPlaceholder}>
        {allowEmpty && <button type="button" role="option" aria-selected={!value} onClick={() => choose('')}>{placeholder}</button>}
        {filtered.map(option => <button type="button" role="option" aria-selected={value === option.id} key={option.id} onClick={() => choose(option.id)}>{option.name}</button>)}
        {!filtered.length && <p className={s.pickerEmpty}>{options.length ? 'Nenhuma opção encontrada.' : 'Nenhuma opção disponível no catálogo.'}</p>}
      </div>
    </div>}
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className={s.metric}><small>{label}</small><strong>{value}</strong>{detail && <small>{detail}</small>}</div>; }
function SessionTable({ sessions, actions }: { sessions: PlanSession[]; actions?: (session: PlanSession) => React.ReactNode }) {
  return <div className={s.scroll}><table className={s.table}><thead><tr><th>Dia</th><th>Atividade</th><th>Meta</th><th>Situação</th>{actions && <th>Ação</th>}</tr></thead><tbody>{sessions.map(a => <tr key={a.id}><td>{dateLabel(a.date)}</td><td><strong>{a.subject}</strong><small>{a.startTime && a.endTime ? `${a.startTime}–${a.endTime} · ` : ''}{a.topic} • {kindLabels[a.kind]}</small></td><td>{a.minutes} min{a.questionGoal > 0 && <small>{a.questionGoal} questões</small>}</td><td>{sessionLabels[a.status]}</td>{actions && <td>{actions(a)}</td>}</tr>)}{sessions.length === 0 && <tr><td colSpan={actions ? 5 : 4}>Nenhuma atividade neste período.</td></tr>}</tbody></table></div>;
}
function PlanSummary({ plan }: { plan: StudyPlan }) {
  const today = localDate(); const monday = new Date(`${today}T12:00:00`); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = plan.sessions.filter(x => x.date >= localDate(monday) && x.date <= shift(localDate(monday), 6));
  const covered = new Set(plan.sessions.filter(x => x.status === 'completed').map(x => `${x.subject}|${x.topic}`)).size;
  const projected = new Set(plan.sessions.map(x => `${x.subject}|${x.topic}`)).size;
  const topics = plan.config.subjects.reduce((sum, x) => sum + x.topics.length, 0);
  return <><div className={s.metrics}><Metric label="Data da prova" value={plan.config.dateConfirmed ? dateLabel(plan.config.examDate) : 'Não definida'} detail={plan.config.dateConfirmed ? 'Data informada por você' : 'Plano organizado em ciclos'} /><Metric label="Disponibilidade" value={hours(Object.values(plan.config.availability).reduce((a, x) => a + x, 0))} detail="por semana" /><Metric label="Nesta semana" value={hours(week.reduce((a, x) => a + x.actualMinutes, 0))} detail={`de ${hours(week.reduce((a, x) => a + x.minutes, 0))} planejados`} /><Metric label="Cobertura do edital" value={`${covered} de ${topics} assuntos`} detail="Com atividade concluída" /></div>{projected < topics && <div className={s.notice}>Projeção de cobertura: {projected} de {topics} assuntos no ciclo atual. Ajuste sua rotina ou prioridades para cobrir o restante.</div>}</>;
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
