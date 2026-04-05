
import React from 'react';
import { Lock, Eye, Database, UserCheck, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold text-xs uppercase tracking-widest mb-8 transition-colors"
        >
          <ChevronLeft size={16} /> Voltar
        </button>

        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
          <div className="bg-indigo-600 dark:bg-indigo-700 p-10 text-white transition-colors">
            <h1 className="text-4xl font-black tracking-tight mb-2">Política de Privacidade</h1>
            <p className="text-indigo-100 dark:text-indigo-200 text-sm font-medium transition-colors">Conformidade com a LGPD (Lei 13.709/2018)</p>
          </div>

          <div className="p-8 md:p-12">
            <div className="prose prose-slate dark:prose-invert max-w-none space-y-10 text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">

              <section className="space-y-4 transition-colors">
                <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
                  <Database className="text-indigo-600 dark:text-indigo-400" size={24} />
                  <h2 className="text-2xl font-black m-0">1. Coleta de Dados</h2>
                </div>
                <p>
                  Coletamos informações necessárias para a prestação de nossos serviços, divididas em:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Dados Cadastrais:</strong> Nome completo, e-mail e senha.</li>
                  <li><strong>Dados Fiscais (Diferidos):</strong> CPF e Endereço, solicitados apenas no momento de transações financeiras ou cadastro de parceiro.</li>
                  <li><strong>Dados de Uso:</strong> Estatísticas de erros/acertos, tempo de estudo e interações com a IA para personalização do algoritmo.</li>
                </ul>
              </section>

              <section className="space-y-4 transition-colors">
                <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
                  <Lock className="text-indigo-600 dark:text-indigo-400" size={24} />
                  <h2 className="text-2xl font-black m-0">2. Segurança da Informação</h2>
                </div>
                <p>
                  Empregamos medidas técnicas de segurança, como criptografia de ponta a ponta (SSL) e firewalls robustos. Seus dados de pagamento (cartão de crédito) nunca são armazenados em nossos servidores, sendo processados diretamente por gateways certificados (Stripe/Pagar.me).
                </p>
              </section>

              <section className="space-y-4 transition-colors">
                <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
                  <Eye className="text-indigo-600 dark:text-indigo-400" size={24} />
                  <h2 className="text-2xl font-black m-0">3. Compartilhamento de Dados</h2>
                </div>
                <p>
                  A ConcursoMestre AI não vende ou aluga seus dados pessoais. O compartilhamento ocorre apenas com:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Processadores de pagamento para viabilizar sua assinatura.</li>
                  <li>Serviços de IA (Google Gemini) de forma anonimizada para processamento de explicações.</li>
                  <li>Órgãos judiciais, quando legalmente obrigatório.</li>
                </ul>
              </section>

              <section className="space-y-4 transition-colors">
                <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
                  <UserCheck className="text-indigo-600 dark:text-indigo-400" size={24} />
                  <h2 className="text-2xl font-black m-0">4. Seus Direitos (LGPD)</h2>
                </div>
                <p>
                  Você, como titular dos dados, possui o direito de:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Solicitar a correção de dados incompletos ou inexatos.</li>
                  <li>Solicitar a exclusão definitiva de sua conta e dados associados.</li>
                  <li>Revogar o consentimento de comunicações de marketing.</li>
                  <li>Solicitar a portabilidade dos dados em formato estruturado.</li>
                </ul>
              </section>

              <div className="pt-10 border-t border-slate-100 dark:border-slate-800 text-center transition-colors">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">
                  Dúvidas sobre privacidade? dpo@concursomestre.ai
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
