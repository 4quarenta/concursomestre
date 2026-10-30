'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@services/api/client';
import { useAuth } from '@providers/AuthProvider';
import { canAccessAdminPanel } from '@services/auth';

type Exam = { externalKey: string; title: string; year: number; questions: number; path: string };
type Run = { runId: string; inventory: { batchId: string; filesVerified: number; exams: Exam[] } };
type ApiEnvelope<T> = { success: boolean; data: T };
type Result = { status: 'done' | 'error'; externalKey: string; message?: string; existingQuestions?: number; sentToCanonical?: number; exam?: {id: number; programDisciplines: number; programThemes: number}; links?: {linked: number; created: number}; warnings?: string[] };
type PreviewFile = {fileName:string;path?:string;declaredType?:string;verifiedType?:boolean;resolvedType?:string|null;visibility?:string;sizeBytes?:number;sha256Valid:boolean;state:string;storageState?:string;linkState?:string;reason:string;questionExternalId?:string|null;scope?:string};
type Preview = {
  status:'ready'|'blocked';externalKey:string;title:string;year:number;expectedQuestions:number;existingQuestions:number;missingQuestions:number;examExists:boolean;existingExamYear:number|null;
  duplicateExamRecords:number;duplicateQuestionIds:string[];programDisciplines:number;programThemes:number;documentEntries:number;assetEntries:number;existingMetadataKeys:number;message:string;planHash:string;
  programmaticContentPresentation?:{sourceUrl?:string|null;sourceLabel?:string|null;summary?:string|null;totalQuestions?:number|null;subjects:Array<{name:string;questionCount?:number|null;weight?:string;topics:string[]}>};
  proof:{state:string;id:number|null;year:number|null;metadata:{willAdd:string[];willPreserve:string[];emptyInZip:string[]};dates:{willAdd:string[];willPreserve:string[];emptyInZip:string[]}};
  questionMetadata:{total:number;willAdd:number;alreadyPresent:number;skipped:number;items:Array<{externalId:string|null;status:string}>};
  taxonomy:{booklet:{state:string;id:number|null};disciplines:Array<{name:string;state:string;id?:number;canonicalMatches?:number}>;topics:Array<{name:string;discipline:string;state:string;id?:number;canonicalMatches?:number}>;links:{wanted:number;existing:number;willCreate:number};ambiguous:string[]};
  documents:PreviewFile[];documentActions:{willLink:number;alreadyLinked:number;willSkip:number;assetOnly:number;internal:number;verifiedOfficial:number};assets:PreviewFile[];assetActions:{willLink:number;alreadyLinked:number;willSkip:number};
};
const ENDPOINT = 'admin/zip_import.php';

const fieldLabels:Record<string,string>={
  conteudoProgramatico:'Disciplinas',programmaticContent:'Disciplinas (formato compatível)',conteudoProgramaticoDetalhado:'Programa detalhado',
  programmaticContentDetailed:'Programa no formato do editor',programmaticContentStatus:'Situação do programa',programmaticContentFonte:'Fonte do programa',
  programmaticContentIntegralVerificado:'Verificação integral do programa',valorInscricao:'Valor da inscrição',nivel:'Nível',tipoCaderno:'Tipo do caderno',
  programmaticContentPresentation:'Estrutura do programa, questões e pesos',
  corCaderno:'Cor do caderno',orgaos:'Órgãos',cargos:'Cargos',focos:'Focos',requisitosDetalhados:'Requisitos',remuneracoesDetalhadas:'Remunerações',
  vagasDetalhadas:'Vagas',etapas:'Etapas',zipProgramEvidence:'Evidência de extração do programa',zipSource:'Proveniência e evidências do ZIP',
  data_prova:'Data da prova',inscricoes_inicio:'Início das inscrições',inscricoes_fim:'Fim das inscrições',
};

function previewLabel(state:string):string{
  const labels:Record<string,string>={exists:'já existe',exists_by_import_slug:'já existe pelo identificador do importador',create:'será criada',
    create_with_discipline:'será criado junto da matéria',ambiguous:'ambíguo: múltiplas correspondências',blocked_by_ambiguous_discipline:'bloqueado pela matéria ambígua',
    already_linked:'vínculo já existe',will_link:'será vinculado',will_skip:'será ignorado',asset_only:'tratado na seção de imagens',already_in_storage:'já está no armazenamento',
    will_upload:'será enviado ao armazenamento',remote_storage_not_checked:'presença remota não consultada',not_applicable:'não se aplica',
    internal:'interno',public:'público após validação documental',
    not_needed:'não é necessário',create_after_exam:'será criado após a prova',create_if_missing_questions:'será criado se houver questões novas',create_draft:'será criada como rascunho interno',
    already_present:'metadado já existe',will_add:'será adicionado',question_missing:'questão não encontrada',no_mapping:'sem vínculo de identidade',
    existing_json_invalid:'JSON existente inválido; será preservado',invalid:'registro inválido'};
  return labels[state]||state;
}

function PreviewDetails({preview:p}:{preview:Preview}){
  const names=(keys:string[])=>keys.length?keys.map(k=>fieldLabels[k]||k).join(', '):'nenhum';
  return <details className="mt-3 rounded-md border border-slate-200 p-3 text-xs dark:border-slate-700">
    <summary className="cursor-pointer font-semibold">Detalhar ações previstas</summary>
    <div className="mt-3 space-y-4">
      <section><strong>Prova e metadados</strong><p>Prova {previewLabel(p.proof.state)}{p.proof.id?` (ID ${p.proof.id})`:''}. Metadados a completar: {names(p.proof.metadata.willAdd)}. Campos existentes que serão preservados: {names(p.proof.metadata.willPreserve)}. Datas a preencher: {names(p.proof.dates.willAdd)}; datas já definidas serão preservadas: {names(p.proof.dates.willPreserve)}.</p></section>
      <section><strong>Conteúdo programático estruturado</strong>{p.programmaticContentPresentation?.subjects?.length?<><p>{p.programmaticContentPresentation.totalQuestions?`${p.programmaticContentPresentation.totalQuestions} questões na composição · `:''}{p.programmaticContentPresentation.subjects.length} matérias. O pacote pode informar assuntos, quantidades e pesos; os campos existentes serão preservados.</p>{p.programmaticContentPresentation.summary&&<p className="mt-1">{p.programmaticContentPresentation.summary}</p>}<ul className="mt-1 list-disc space-y-1 pl-5">{p.programmaticContentPresentation.subjects.map((subject,index)=><li key={`${subject.name}-${index}`}><strong>{subject.name}</strong>{subject.questionCount!==null&&subject.questionCount!==undefined?` · ${subject.questionCount} questões`:''}{subject.weight?` · ${subject.weight}`:''}<ul className="list-disc pl-5">{subject.topics.map((topic,topicIndex)=><li key={`${topic}-${topicIndex}`}>{topic}</li>)}</ul></li>)}</ul>{p.programmaticContentPresentation.sourceLabel&&<p className="mt-1 text-slate-500">Fonte declarada: {p.programmaticContentPresentation.sourceLabel}</p>}</>:<p>O pacote não contém matérias e assuntos em formato estruturado. Assuntos inferidos das questões permanecem separados.</p>}</section>
      <section><strong>Questões e metadados das questões</strong><p>{p.existingQuestions} questões encontradas; {p.missingQuestions} serão criadas se houver confirmação. O conteúdo das questões existentes não será sobrescrito. Enriquecimentos: {p.questionMetadata.willAdd} a adicionar, {p.questionMetadata.alreadyPresent} já presentes e {p.questionMetadata.skipped} sem aplicação.</p></section>
      <section><strong>Taxonomias e caderno</strong><p>Caderno: {previewLabel(p.taxonomy.booklet.state)}. Vínculos de filtros: {p.taxonomy.links.existing} já existentes, {p.taxonomy.links.willCreate} a criar. Matérias:</p><ul className="mt-1 list-disc pl-5">{p.taxonomy.disciplines.map((item,i)=><li key={`${item.name}-${i}`}>{item.name}: {previewLabel(item.state)}{item.canonicalMatches?` (${item.canonicalMatches} nomes iguais)`:''}</li>)}</ul><p className="mt-2">Tópicos:</p><ul className="mt-1 list-disc pl-5">{p.taxonomy.topics.map((item,i)=><li key={`${item.discipline}-${item.name}-${i}`}>{item.discipline} / {item.name}: {previewLabel(item.state)}{item.canonicalMatches?` (${item.canonicalMatches} nomes iguais)`:''}</li>)}</ul>{p.taxonomy.ambiguous.length>0&&<p className="mt-2 font-semibold text-red-700">Revisão necessária: {p.taxonomy.ambiguous.join('; ')}</p>}</section>
      <section><strong>Arquivos de prova, gabarito e edital</strong><p>{p.documentActions.verifiedOfficial} com tipo validado, {p.documentActions.internal} serão mantidos como internos, {p.documentActions.assetOnly} serão tratados como imagens e {p.documentActions.willSkip} ignorados.</p><ul className="mt-1 list-disc space-y-1 pl-5">{p.documents.map((item,i)=><li key={`${item.path}-${i}`}><span className="font-medium">{item.fileName}</span> — tipo informado: {item.declaredType}; tipo efetivo: {item.resolvedType||'nenhum'}; visibilidade: {previewLabel(item.visibility||'not_applicable')}; ação: {previewLabel(item.state)}; arquivo: {previewLabel(item.storageState||'not_applicable')}; SHA-256 {item.sha256Valid?'válido':'não confirmado'}. {item.reason}</li>)}</ul></section>
      <section><strong>Imagens vinculadas às questões</strong><ul className="mt-1 list-disc space-y-1 pl-5">{p.assets.map((item,i)=><li key={`${item.fileName}-${i}`}><span className="font-medium">{item.fileName||'arquivo sem caminho'}</span>{item.questionExternalId?` → questão ${item.questionExternalId}`:''} — vínculo: {previewLabel(item.state)}; arquivo: {previewLabel(item.storageState||'not_applicable')}; SHA-256 {item.sha256Valid?'válido':'não confirmado'}. {item.reason}</li>)}</ul></section>
    </div>
  </details>;
}

function message(error: unknown): string {
  const maybe = error as { response?: {data?: {message?: string}}; message?: string };
  return maybe?.response?.data?.message || maybe?.message || 'Falha desconhecida.';
}

function apiEnvelope<T>(response: unknown): ApiEnvelope<T> {
  const isEnvelope = (value: unknown): value is ApiEnvelope<T> =>
    Boolean(value && typeof value === 'object' && 'success' in value && 'data' in value);
  if (isEnvelope(response)) return response;
  if (response && typeof response === 'object' && 'data' in response) {
    const payload = (response as {data: unknown}).data;
    if (isEnvelope(payload)) return payload;
  }
  throw new Error('Resposta inesperada do backend.');
}

export default function ImportadorZipPage() {
  const router=useRouter();
  const {currentUser,isLoading:isAuthLoading}=useAuth();
  const isAdmin=canAccessAdminPanel(currentUser)&&currentUser?.role==='admin';
  const [archive, setArchive] = React.useState<File | null>(null);
  const [run, setRun] = React.useState<Run | null>(null);
  const [results, setResults] = React.useState<Record<string, Result>>({});
  const [previews, setPreviews] = React.useState<Record<string, Preview>>({});
  const [busy, setBusy] = React.useState(false);
  const [position, setPosition] = React.useState(0);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [allow, setAllow] = React.useState(false);
  const [resumeId, setResumeId] = React.useState('');
  const stop = React.useRef(false);

  React.useEffect(()=>{if(!isAuthLoading&&!isAdmin)router.replace('/');},[isAdmin,isAuthLoading,router]);

  const upload = async () => {
    if (!isAdmin || !archive || busy) return;
    setBusy(true); setErrors([]); setResults({}); setPreviews({}); setRun(null); setPosition(0);
    try {
      const payload = new FormData();
      payload.append('action','upload');
      payload.append('archive',archive);
      const response = apiEnvelope<Run>(await apiClient.post<ApiEnvelope<Run>>(ENDPOINT, payload, {
        timeout: 240000,
        headers: {'Content-Type': undefined},
      }));
      if (!response.success) throw new Error('O backend nao aceitou o ZIP.');
      setRun(response.data);
    } catch (err) {setErrors([message(err)]);} finally {setBusy(false);}
  };

  const resume = async () => {
    if (!isAdmin || busy || !/^[a-f0-9]{32}$/.test(resumeId)) return;
    setBusy(true); setErrors([]);
    try {
      const response = apiEnvelope<{runId:string;inventory:Run['inventory'];results:Record<string,Result>;previews:Record<string,Preview>}>(await apiClient.get<ApiEnvelope<{runId:string;inventory:Run['inventory'];results:Record<string,Result>;previews:Record<string,Preview>}>>(ENDPOINT,{params:{runId:resumeId}}));
      if (!response.success) throw new Error('Execucao nao encontrada.');
      setRun({runId:response.data.runId,inventory:response.data.inventory});
      setResults(response.data.results || {});
      setPreviews(response.data.previews || {});
      setPosition(0);
    } catch (error) {setErrors([message(error)]);} finally {setBusy(false);}
  };

  const generatePreview = async () => {
    if (!isAdmin || !run || busy) return;
    setBusy(true); setErrors([]); setPreviews({});
    for (let i=0;i<run.inventory.exams.length;i++) {
      const exam=run.inventory.exams[i];
      try {
        const response=apiEnvelope<Preview>(await apiClient.post<ApiEnvelope<Preview>>(ENDPOINT,{action:'preview',runId:run.runId,examKey:exam.externalKey},{timeout:240000}));
        if(!response.success) throw new Error('Falha ao gerar prévia.');
        setPreviews(prev=>({...prev,[exam.externalKey]:response.data}));
      } catch(err) {
        setErrors(prev=>[...prev,`${exam.externalKey}: ${message(err)}`]);
      }
      setPosition(i+1);
    }
    setBusy(false);
  };

  const process = async () => {
    if (!isAdmin || !run || busy || !allPreviewed || previewsBlocked) return;
    setBusy(true); setErrors([]); stop.current=false;
    let idx=0;
    for (const exam of run.inventory.exams) {
      if (stop.current) break;
      if (results[exam.externalKey]?.status==='done') {idx++;setPosition(idx);continue;}
      try {
        const response = apiEnvelope<Result>(await apiClient.post<ApiEnvelope<Result>>(ENDPOINT,{
          action:'process',runId:run.runId,examKey:exam.externalKey,
          allowUnverifiedPublication: allow,
        },{timeout:260000}));
        if (!response.success) throw new Error('Falha na importacao desta prova.');
        setResults(prev=>({...prev,[exam.externalKey]:response.data}));
      } catch (err) {
        const reason=message(err);
        setResults(prev=>({...prev,[exam.externalKey]:{status:'error',externalKey:exam.externalKey,message:reason}}));
        setErrors(prev=>[...prev,`${exam.externalKey}: ${reason}`]);
      }
      idx++; setPosition(idx);
    }
    setBusy(false);
  };

  const completed=Object.values(results).filter(r=>r.status==='done').length;
  const allPreviewed=!!run && run.inventory.exams.every(e=>previews[e.externalKey]?.status==='ready');
  const previewsBlocked=!!run && run.inventory.exams.some(e=>previews[e.externalKey]?.status==='blocked');
  if(isAuthLoading)return <main className="mx-auto max-w-5xl px-5 py-12 text-sm text-slate-500">Verificando acesso administrativo...</main>;
  if(!isAdmin)return null;
  return <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
    <header>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ferramenta administrativa temporaria</p>
      <h1 className="mt-2 text-2xl font-bold">Importador ZIP — ConcursoMestre</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-500">Envia um pacote <code>cm-batch.v1</code>, confere o manifesto SHA-256 e permite gerar uma prévia de leitura antes de qualquer gravação. Acesso restrito a administradores; nenhum ZIP é publicado na web.</p>
    </header>
    <section className="rounded-xl border border-slate-300 p-5 dark:border-slate-700">
      <h2 className="font-semibold">1. Selecionar e verificar ZIP</h2>
      <input aria-label="Arquivo ZIP" accept=".zip,application/zip" type="file" className="mt-4 block w-full text-sm" onChange={e=>setArchive(e.currentTarget.files?.[0]||null)}/>
      <button type="button" onClick={upload} disabled={!archive || busy} className="mt-4 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busy&&!run?'Verificando...':'Validar ZIP'}</button>
      <p className="mt-2 text-xs text-slate-500">Limite do serviço: 150 MiB compactados. Nesta VPS, o Nginx aceita até 120 MiB por requisição; arquivos acima disso precisam de ajuste no proxy.</p>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <input aria-label="ID da execução anterior" placeholder="ID da execução para retomar" value={resumeId} onChange={e=>setResumeId(e.target.value.trim())} className="min-w-[280px] flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
        <button type="button" onClick={resume} disabled={busy || !/^[a-f0-9]{32}$/.test(resumeId)} className="rounded-lg border border-slate-400 px-4 py-2 text-sm disabled:opacity-50">Retomar execução</button>
      </div>
    </section>
    {run && <section className="space-y-4 rounded-xl border border-slate-300 p-5 dark:border-slate-700">
      <h2 className="font-semibold">2. Prévia sem gravação e importação</h2>
      <p className="text-sm text-slate-500">Lote: {run.inventory.batchId||run.runId} · ID para retomar: <code className="select-all">{run.runId}</code> · {run.inventory.exams.length} provas · {run.inventory.exams.reduce((n,e)=>n+e.questions,0)} questões · {run.inventory.filesVerified} arquivos com hash validado.</p>
      <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">A prévia consulta somente o banco e registra o resultado em armazenamento temporário privado. Ela não grava provas, questões, metadados, taxonomias ou arquivos.</p>
      <button type="button" disabled={busy} onClick={generatePreview} className="rounded-lg border border-blue-700 px-5 py-2.5 text-sm font-semibold text-blue-800 disabled:opacity-50 dark:text-blue-300">{busy&&!allPreviewed?'Gerando prévia...':'Gerar prévia sem gravar'}</button>
      <label className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <input type="checkbox" className="mt-1" checked={allow} onChange={e=>setAllow(e.target.checked)} disabled={busy}/>
        <span><strong>Permitir publicação de questões ainda não cadastradas.</strong> O serviço canônico atual publica as questões ao importá-las, inclusive quando o gabarito de origem está marcado como não verificado. Deixe desmarcado para apenas complementar provas já cadastradas sem novas questões.</span>
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy || !allPreviewed || previewsBlocked} onClick={process} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{completed?'Retomar pendências':'Processar provas'}</button>
        {busy && <button type="button" onClick={()=>{stop.current=true;}} className="rounded-lg border border-slate-400 px-5 py-2.5 text-sm">Parar após prova atual</button>}
      </div>
      <p className="text-sm text-slate-500" role="status">{completed} prova(s) concluída(s) · {position}/{run.inventory.exams.length} processada(s) nesta sessão</p>
      <div className="max-h-[500px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"><tr><th className="p-3">Prova</th><th className="p-3">Ano</th><th className="p-3">Questões</th><th className="p-3">Prévia / resultado</th></tr></thead>
          <tbody>{run.inventory.exams.map(exam=>{
            const r=results[exam.externalKey];const p=previews[exam.externalKey];
            return <tr key={exam.externalKey} className="border-t border-slate-200 align-top dark:border-slate-800">
              <td className="p-3"><div className="font-medium">{exam.externalKey}</div><div className="max-w-[400px] truncate text-xs text-slate-500" title={exam.title}>{exam.title}</div></td>
              <td className="p-3">{exam.year}</td><td className="p-3">{exam.questions}</td>
              <td className="p-3">{r?.status==='done'?<div className="text-emerald-700 dark:text-emerald-400">Concluída · {r.existingQuestions||0} existentes · {r.sentToCanonical||0} enviadas · {r.exam?.programDisciplines||0} disciplinas</div>:r?.status==='error'?<span className="text-red-600">Falhou: {r.message}</span>:!p?'Prévia pendente':<div className={p.status==='blocked'?'text-red-700 dark:text-red-300':'text-slate-700 dark:text-slate-300'}>
                <strong>{p.status==='blocked'?'Bloqueada':'Prévia pronta'}</strong> · {p.existingQuestions}/{p.expectedQuestions} questões existentes · {p.missingQuestions} ausentes · prova {p.examExists?'encontrada':'será criada se necessário'}
                <div className="text-xs">Programa: {p.programDisciplines} disciplinas / {p.programThemes} temas · metadados da prova: {p.proof.metadata.willAdd.length} a completar / {p.proof.metadata.willPreserve.length} preservar · taxonomias: {p.taxonomy.disciplines.filter(x=>x.state==='create').length} matérias e {p.taxonomy.topics.filter(x=>x.state.startsWith('create')).length} tópicos a criar · metadados de questões: {p.questionMetadata.willAdd} a adicionar · arquivos: {p.documentActions.verifiedOfficial} oficiais verificados, {p.documentActions.internal} internos, {p.documentActions.assetOnly} imagens, {p.documentActions.willSkip} ignorados · imagens: {p.assetActions.willLink} a vincular, {p.assetActions.willSkip} ignoradas. {p.message}</div>
                <PreviewDetails preview={p}/>
              </div>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>}
    {!!errors.length && <section role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200"><h2 className="font-semibold">Pendências de execução</h2><ul className="mt-2 list-disc space-y-1 pl-5">{errors.map((e,i)=><li key={i}>{e}</li>)}</ul></section>}
    <p className="text-xs text-slate-500">Os registros com comentários e gabaritos existentes não são atualizados silenciosamente. O pacote de origem mantém provas de 2017 no ano correto.</p>
  </main>;
}
