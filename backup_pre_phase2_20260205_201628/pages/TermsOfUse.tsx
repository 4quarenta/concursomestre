
import React from 'react';
import { ShieldCheck, FileText, Scale, AlertCircle, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsOfUse: React.FC = () => {
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
          <div className="bg-slate-900 dark:bg-black p-10 text-white transition-colors">
            <h1 className="text-4xl font-black tracking-tight mb-2">Termos de Uso</h1>
            <p className="text-slate-400 dark:text-slate-500 text-sm font-medium transition-colors">Última atualização: 24 de Maio de 2024</p>
          </div>

          <div className="p-8 md:p-12">
            <div className="prose prose-slate dark:prose-invert max-w-none space-y-10 text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">

              <section id="aceite" className="space-y-4">
                <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100 transition-colors">
                  <ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={24} />
                  <h2 className="text-2xl font-black m-0">1. Aceite dos Termos</h2>
                </div>
                <p>
                  Ao acessar e utilizar a plataforma <strong>ConcursoMestre AI</strong>, você concorda em cumprir e estar vinculado aos seguintes Termos de Uso. Este documento é um contrato legal entre você (Usuário) e a ConcursoMestre AI. Se você não concorda com qualquer parte destes termos, não deve utilizar nossos serviços.
                </p>
              </section>

              <section id="servicos" className="space-y-4">
                <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100 transition-colors">
                  <FileText className="text-indigo-600 dark:text-indigo-400" size={24} />
                  <h2 className="text-2xl font-black m-0">2. Descrição dos Serviços</h2>
                </div>
                <p>
                  A ConcursoMestre AI provê uma ferramenta de auxílio ao estudo baseada em inteligência artificial, que inclui, mas não se limita a: banco de questões, simulados, análise de desempenho e marketplace de materiais pedagógicos.
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Conteúdo Gerado por IA:</strong> O usuário reconhece que as explicações e mentorias são geradas por algoritmos e podem conter imprecisões. O uso deste conteúdo é de responsabilidade exclusiva do aluno.</li>
                  <li><strong>Marketplace:</strong> Atuamos como intermediários entre autores de materiais e compradores. Não garantimos a aprovação do aluno em concursos públicos.</li>
                </ul>
              </section>

              <section id="assinaturas" className="space-y-4">
                <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100 transition-colors">
                  <Scale className="text-indigo-600 dark:text-indigo-400" size={24} />
                  <h2 className="text-2xl font-black m-0">3. Assinaturas e Pagamentos</h2>
                </div>
                <p>
                  A plataforma oferece planos gratuitos e pagos. Ao contratar um plano pago:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>As renovações são automáticas conforme o ciclo escolhido (mensal, trimestral ou anual).</li>
                  <li>O cancelamento pode ser feito a qualquer momento através do perfil, interrompendo a renovação para o próximo ciclo.</li>
                  <li><strong>Reembolso:</strong> Conforme o Código de Defesa do Consumidor, o usuário tem 7 dias para solicitar o estorno integral caso não esteja satisfeito.</li>
                </ul>
              </section>

              <section id="responsabilidade" className="space-y-4">
                <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100 transition-colors">
                  <AlertCircle className="text-indigo-600 dark:text-indigo-400" size={24} />
                  <h2 className="text-2xl font-black m-0">4. Limitação de Responsabilidade</h2>
                </div>
                <p>
                  A ConcursoMestre AI não se responsabiliza por:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Indisponibilidade técnica temporária da plataforma.</li>
                  <li>Erros em editais ou gabaritos oficiais das bancas examinadoras.</li>
                  <li>Decisões tomadas pelo usuário com base nas estatísticas e previsões da IA.</li>
                </ul>
              </section>

              <div className="pt-10 border-t border-slate-100 dark:border-slate-800 text-center transition-colors">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">
                  Para dúvidas jurídicas, entre em contato: juridico@concursomestre.ai
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfUse;
