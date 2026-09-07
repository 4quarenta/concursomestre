'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Gift, Loader2, Plus, ShieldCheck } from 'lucide-react';
import { adminBenefitsService, type AdminBenefitDefinition, type AdminBenefitCreateCodeResult } from '@services/admin/adminBenefitsService';
import { readApiErrorMessage } from '@services/api';
import { AdminButton, AdminDataTable, AdminFeedback, AdminFormField, AdminTable, AdminTableBody, AdminTableCell, AdminTableColumn, AdminTableEmptyRow, AdminTableHead, AdminTableRow, AdminStatusBadge } from '../shared/AdminDesignSystem';
import { ADMIN_FIELD_CLASS, ADMIN_SURFACE_CLASS, ADMIN_SURFACE_HEADER_CLASS } from '../shared/adminPanelStyles';

type DefinitionDraft = {
  definition_key: string;
  name: string;
  benefit_mode: 'ACCESS_ONLY' | 'BILLING_EXTENSION_ONLY' | 'ACCESS_AND_BILLING_EXTENSION';
  access_plan: string;
  access_duration_days: string;
  billing_extension_days: string;
  stacking_policy: 'DENY' | 'EXTEND' | 'REPLACE_IF_BETTER' | 'PARALLEL';
};

const EMPTY_DEFINITION: DefinitionDraft = {
  definition_key: '',
  name: '',
  benefit_mode: 'ACCESS_ONLY',
  access_plan: 'Pro',
  access_duration_days: '30',
  billing_extension_days: '0',
  stacking_policy: 'DENY',
};

const statusTone = (active: number): 'success' | 'neutral' => (Number(active) === 1 ? 'success' : 'neutral');

export default function AdminBenefitsPanel(): React.JSX.Element {
  const [definitions, setDefinitions] = useState<AdminBenefitDefinition[]>([]);
  const [definition, setDefinition] = useState<DefinitionDraft>(EMPTY_DEFINITION);
  const [code, setCode] = useState({ benefit_definition_id: '', value: '', code_scope: 'PUBLIC', assigned_user_id: '' });
  const [grant, setGrant] = useState({ benefit_definition_id: '', user_id: '', reason: '' });
  const [createdCode, setCreatedCode] = useState<AdminBenefitCreateCodeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);

  const loadDefinitions = async () => {
    setLoading(true);
    try {
      setDefinitions(await adminBenefitsService.listDefinitions());
    } catch (error) {
      setFeedback({ message: readApiErrorMessage(error, 'Não foi possível carregar os benefícios.'), tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    adminBenefitsService.listDefinitions()
      .then((items) => { if (!cancelled) setDefinitions(items); })
      .catch((error) => { if (!cancelled) setFeedback({ message: readApiErrorMessage(error, 'Não foi possível carregar os benefícios.'), tone: 'danger' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const definitionOptions = useMemo(() => definitions.filter((item) => Number(item.active) === 1), [definitions]);

  const saveDefinition = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await adminBenefitsService.createDefinition({
        ...definition,
        access_plan: definition.benefit_mode === 'BILLING_EXTENSION_ONLY' ? '' : definition.access_plan,
        access_duration_days: definition.benefit_mode === 'BILLING_EXTENSION_ONLY' ? 0 : Number(definition.access_duration_days || 0),
        billing_extension_days: Number(definition.billing_extension_days || 0),
      });
      setDefinition(EMPTY_DEFINITION);
      setFeedback({ message: 'Definição criada na autoridade de Benefits.', tone: 'success' });
      await loadDefinitions();
    } catch (error) {
      setFeedback({ message: readApiErrorMessage(error, 'Não foi possível criar a definição.'), tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const saveCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const result = await adminBenefitsService.createCode({
        benefit_definition_id: code.benefit_definition_id,
        code: code.value,
        code_scope: code.code_scope,
        assigned_user_id: code.assigned_user_id || undefined,
      });
      setCreatedCode(result);
      setCode({ benefit_definition_id: '', value: '', code_scope: 'PUBLIC', assigned_user_id: '' });
      setFeedback({ message: 'Código criado. Copie-o agora: ele não será exibido novamente.', tone: 'success' });
    } catch (error) {
      setFeedback({ message: readApiErrorMessage(error, 'Não foi possível criar o código.'), tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const saveGrant = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const result = await adminBenefitsService.grant({
        benefit_definition_id: grant.benefit_definition_id,
        user_id: grant.user_id,
        reason: grant.reason,
        idempotency_key: `admin-benefit-${grant.user_id}-${grant.benefit_definition_id}-${Date.now()}`,
        source_type: 'ADMIN_MANUAL',
      });
      setGrant({ benefit_definition_id: '', user_id: '', reason: '' });
      setFeedback({ message: `Grant criado com estado ${String(result.status || 'PENDING_PROVIDER')}. Extensões de cobrança só ficam ativas após confirmação do provedor.`, tone: 'success' });
    } catch (error) {
      setFeedback({ message: readApiErrorMessage(error, 'Não foi possível criar o grant.'), tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
        <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-start gap-3"><Gift className="mt-0.5 text-violet-600" size={20} /><div><h1 className="text-xl font-black text-slate-900 dark:text-slate-100">Benefícios</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Acesso efetivo e extensões de cobrança passam por uma única autoridade.</p></div></div>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><ShieldCheck size={15} /> Sem alterar plano pago</span>
        </div>
      </header>

      {feedback ? <AdminFeedback tone={feedback.tone}>{feedback.message}</AdminFeedback> : null}
      {createdCode ? <AdminFeedback tone="success"><strong>Código exibido uma única vez:</strong> <code className="ml-2 select-all font-black">{createdCode.code}</code></AdminFeedback> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <form className={`${ADMIN_SURFACE_CLASS} space-y-4 p-5`} onSubmit={saveDefinition}>
          <div><h2 className="text-sm font-black text-slate-900 dark:text-slate-100">Nova definição</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Duração e modo são validados pelo backend central.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminFormField label="Chave" controlId="benefit-definition-key" required><input value={definition.definition_key} onChange={(event) => setDefinition({ ...definition, definition_key: event.target.value })} className={ADMIN_FIELD_CLASS} /></AdminFormField>
            <AdminFormField label="Nome" controlId="benefit-definition-name" required><input value={definition.name} onChange={(event) => setDefinition({ ...definition, name: event.target.value })} className={ADMIN_FIELD_CLASS} /></AdminFormField>
            <AdminFormField label="Modo" controlId="benefit-definition-mode" required><select value={definition.benefit_mode} onChange={(event) => setDefinition({ ...definition, benefit_mode: event.target.value as DefinitionDraft['benefit_mode'] })} className={ADMIN_FIELD_CLASS}><option value="ACCESS_ONLY">Acesso temporário</option><option value="BILLING_EXTENSION_ONLY">Extensão de cobrança</option><option value="ACCESS_AND_BILLING_EXTENSION">Acesso + extensão</option></select></AdminFormField>
            <AdminFormField label="Plano temporário" controlId="benefit-definition-plan"><select value={definition.access_plan} disabled={definition.benefit_mode === 'BILLING_EXTENSION_ONLY'} onChange={(event) => setDefinition({ ...definition, access_plan: event.target.value })} className={ADMIN_FIELD_CLASS}><option>Essencial</option><option>Pro</option><option>Elite</option></select></AdminFormField>
            <AdminFormField label="Dias de acesso" controlId="benefit-definition-access-days" helpText="Obrigatório quando o benefício concede acesso temporário; limite operacional de 3660 dias."><input type="number" min="0" max="3660" value={definition.access_duration_days} onChange={(event) => setDefinition({ ...definition, access_duration_days: event.target.value })} className={ADMIN_FIELD_CLASS} /></AdminFormField>
            <AdminFormField label="Dias de cobrança" controlId="benefit-definition-days" helpText="Obrigatório para extensões; limite operacional de 366 dias."><input type="number" min="0" max="366" value={definition.billing_extension_days} onChange={(event) => setDefinition({ ...definition, billing_extension_days: event.target.value })} className={ADMIN_FIELD_CLASS} /></AdminFormField>
            <AdminFormField label="Stacking" controlId="benefit-definition-stacking"><select value={definition.stacking_policy} onChange={(event) => setDefinition({ ...definition, stacking_policy: event.target.value as DefinitionDraft['stacking_policy'] })} className={ADMIN_FIELD_CLASS}><option value="DENY">Recusar duplicado</option><option value="EXTEND">Estender</option><option value="REPLACE_IF_BETTER">Substituir se melhor</option><option value="PARALLEL">Paralelo</option></select></AdminFormField>
          </div>
          <AdminButton type="submit" variant="primary" icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} disabled={saving}>Criar definição</AdminButton>
        </form>

        <form className={`${ADMIN_SURFACE_CLASS} space-y-4 p-5`} onSubmit={saveCode}>
          <div><h2 className="text-sm font-black text-slate-900 dark:text-slate-100">Novo Benefit Code</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">O segredo é armazenado apenas como hash.</p></div>
          <AdminFormField label="Definição" controlId="benefit-code-definition" required><select value={code.benefit_definition_id} onChange={(event) => setCode({ ...code, benefit_definition_id: event.target.value })} className={ADMIN_FIELD_CLASS}><option value="">Selecione</option>{definitionOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></AdminFormField>
          <div className="grid gap-4 sm:grid-cols-2"><AdminFormField label="Código" controlId="benefit-code-value" required><input value={code.value} onChange={(event) => setCode({ ...code, value: event.target.value })} className={ADMIN_FIELD_CLASS} autoComplete="off" /></AdminFormField><AdminFormField label="Escopo" controlId="benefit-code-scope"><select value={code.code_scope} onChange={(event) => setCode({ ...code, code_scope: event.target.value })} className={ADMIN_FIELD_CLASS}><option value="PUBLIC">Público</option><option value="USER_EXCLUSIVE">Usuário exclusivo</option><option value="SEGMENT">Segmento</option><option value="SINGLE_USE">Uso único</option></select></AdminFormField></div>
          {code.code_scope === 'USER_EXCLUSIVE' ? <AdminFormField label="ID do usuário" controlId="benefit-code-user" required><input value={code.assigned_user_id} onChange={(event) => setCode({ ...code, assigned_user_id: event.target.value })} className={ADMIN_FIELD_CLASS} /></AdminFormField> : null}
          <AdminButton type="submit" variant="secondary" disabled={saving || !code.benefit_definition_id} icon={saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}>Criar código</AdminButton>
        </form>
      </div>

      <form className={`${ADMIN_SURFACE_CLASS} space-y-4 p-5`} onSubmit={saveGrant}>
        <div><h2 className="text-sm font-black text-slate-900 dark:text-slate-100">Conceder benefício manual</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use o ID da conta e registre o motivo. O estado de cobrança permanece pendente até o provedor confirmar.</p></div>
        <div className="grid gap-4 md:grid-cols-3"><AdminFormField label="Definição" controlId="benefit-grant-definition" required><select value={grant.benefit_definition_id} onChange={(event) => setGrant({ ...grant, benefit_definition_id: event.target.value })} className={ADMIN_FIELD_CLASS}><option value="">Selecione</option>{definitionOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></AdminFormField><AdminFormField label="ID do usuário" controlId="benefit-grant-user" required><input value={grant.user_id} onChange={(event) => setGrant({ ...grant, user_id: event.target.value })} className={ADMIN_FIELD_CLASS} /></AdminFormField><AdminFormField label="Motivo" controlId="benefit-grant-reason" required><input value={grant.reason} onChange={(event) => setGrant({ ...grant, reason: event.target.value })} className={ADMIN_FIELD_CLASS} /></AdminFormField></div>
        <AdminButton type="submit" variant="primary" disabled={saving || !grant.benefit_definition_id || !grant.user_id || !grant.reason} icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}>Conceder</AdminButton>
      </form>

      <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
        <div className={ADMIN_SURFACE_HEADER_CLASS}><h2 className="text-sm font-black text-slate-900 dark:text-slate-100">Definições cadastradas</h2></div>
        <AdminDataTable label="Definições de benefícios"><AdminTable><AdminTableHead><AdminTableRow><AdminTableColumn>Nome</AdminTableColumn><AdminTableColumn>Modo</AdminTableColumn><AdminTableColumn>Acesso</AdminTableColumn><AdminTableColumn>Dias</AdminTableColumn><AdminTableColumn>Status</AdminTableColumn></AdminTableRow></AdminTableHead><AdminTableBody>{loading ? <AdminTableEmptyRow colSpan={5} label="Carregando definições..." /> : definitions.length === 0 ? <AdminTableEmptyRow colSpan={5} label="Nenhuma definição cadastrada." /> : definitions.map((item) => <AdminTableRow key={item.id}><AdminTableCell><strong>{item.name}</strong><span className="block text-xs text-slate-500">{item.definition_key}</span></AdminTableCell><AdminTableCell>{item.benefit_mode}</AdminTableCell><AdminTableCell>{item.access_plan || 'Não altera acesso'}</AdminTableCell><AdminTableCell>{item.access_duration_days || item.billing_extension_days}</AdminTableCell><AdminTableCell><AdminStatusBadge label={Number(item.active) === 1 ? 'Ativa' : 'Inativa'} tone={statusTone(item.active)} /></AdminTableCell></AdminTableRow>)}</AdminTableBody></AdminTable></AdminDataTable>
      </section>
    </div>
  );
}
