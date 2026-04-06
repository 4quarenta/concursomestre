/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React, { useState } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Crown,
  HelpCircle,
  Search,
  ShieldCheck,
  Target,
  Users,
  Zap,
} from 'lucide-react';

const FAQ_DATA = [
  {
    category: 'Gamificacao e nivel',
    icon: Award,
    questions: [
      {
        q: 'Como ganho XP e subo de nivel?',
        a: 'O XP e conquistado resolvendo questões: cada acerto concede 10 XP e cada erro 2 XP. Cada nivel exige 1000 XP para ser completado.',
      },
      {
        q: 'O que e o sistema de reputação?',
        a: 'Sua reputação cresce quando seus comentários ajudam outros usuários. Curtidas em respostas e colaboracoes relevantes aumentam esse indicador.',
      },
      {
        q: 'Qual a vantagem de ter um nivel alto?',
        a: 'Niveis mais altos refletem constancia, destravam conquistas e fortalecem sua posicao em rankings e experiencias futuras da plataforma.',
      },
    ],
  },
  {
    category: 'Assinaturas e reembolso',
    icon: Crown,
    questions: [
      {
        q: 'Como funcionam os planos e a renovação?',
        a: 'Os planos mensal, trimestral e anual podem ter renovação automática. A gestão fica disponível na area de assinatura do perfil.',
      },
      {
        q: 'Tenho direito a reembolso?',
        a: 'Sim. O pedido pode ser feito dentro da janela legal prevista para arrependimento ou conforme as regras do fluxo de estorno exibidas na plataforma.',
      },
      {
        q: 'Como cancelo minha assinatura?',
        a: 'O cancelamento da recorrencia fica disponível em Perfil > Assinatura. O acesso premium permanece ate o fim do período já pago.',
      },
    ],
  },
  {
    category: 'Ferramentas de estudo',
    icon: Zap,
    questions: [
      {
        q: 'O que e o Raio-X da banca?',
        a: 'E a análise estatistica que mostra recorrencia de temas, padrao de cobrança e dificuldade por banca examinadora.',
      },
      {
        q: 'Como funciona a mentoria por IA?',
        a: 'A IA cruza desempenho, histórico e padroes de estudo para sugerir foco, sequencia e reforco de revisao.',
      },
      {
        q: 'O que sao os simulados ineditos?',
        a: 'Sao provas montadas para replicar estilo de edital e banca, com correcao, ranking e análise de desempenho.',
      },
    ],
  },
  {
    category: 'Marketplace de materiais',
    icon: BookOpen,
    questions: [
      {
        q: 'Como acesso os materiais que comprei?',
        a: 'Os materiais ficam disponíveis na área do Marketplace e no seu histórico de compras, com acesso ao arquivo e itens relacionados.',
      },
      {
        q: 'Quem cria os materiais do Marketplace?',
        a: 'Os materiais podem ser publicados por parceiros e autores validados, com fluxo de moderação e controle administrativo.',
      },
    ],
  },
  {
    category: 'Indicacoes e bonus',
    icon: Users,
    questions: [
      {
        q: 'Como funciona o Indique e Ganhe?',
        a: 'Cada usuário possui um código ou link proprio. Quando um indicado se cadastra ou assina, a plataforma calcula os bonus previstos para a campanha ativa.',
      },
    ],
  },
  {
    category: 'Suporte e segurança',
    icon: ShieldCheck,
    questions: [
      {
        q: 'Como falar com o suporte técnico?',
        a: 'Use a tela de suporte para abrir um chamado, enviar sugestoes ou relatar problemas. O histórico fica centralizado por conversa.',
      },
      {
        q: 'Meus dados de pagamento estão seguros?',
        a: 'Sim. O processamento passa pelos gateways oficiais e a plataforma evita armazenar dados sensiveis completos de cartão.',
      },
    ],
  },
];

const Page: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  const filteredFaq = FAQ_DATA.map((category) => ({
    ...category,
    questions: category.questions.filter(
      (item) =>
        item.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.a.toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  })).filter((category) => category.questions.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-24 pb-12 px-4 transition-colors">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-black uppercase tracking-widest">
            <HelpCircle size={14} /> Dúvidas frequentes
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Tudo o que você precisa <span className="text-indigo-600">saber</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
            Explore nossa base de conhecimento e tire o máximo proveito da plataforma.
          </p>
        </div>

        <div className="relative max-w-xl mx-auto group">
          <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group-focus-within:border-indigo-500 transition-all">
            <Search className="ml-4 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Pesquise por XP, reembolso, simulados..."
              className="w-full py-4 px-4 bg-transparent outline-none text-slate-900 dark:text-white font-medium"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-10">
          {filteredFaq.length > 0 ? (
            filteredFaq.map((category, categoryIndex) => (
              <div key={category.category} className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-indigo-600">
                    <category.icon size={20} />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {category.category}
                  </h2>
                </div>

                <div className="grid gap-3">
                  {category.questions.map((item, questionIndex) => {
                    const itemId = `${categoryIndex}-${questionIndex}`;
                    const isOpen = openIndex === itemId;

                    return (
                      <div
                        key={itemId}
                        className={`group bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-300 ${
                          isOpen
                            ? 'border-indigo-500 shadow-md ring-4 ring-indigo-500/5'
                            : 'border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <button
                          onClick={() => setOpenIndex(isOpen ? null : itemId)}
                          className="w-full flex items-center justify-between p-6 text-left"
                        >
                          <span className={`text-base font-bold transition-colors ${isOpen ? 'text-indigo-600' : 'text-slate-800 dark:text-slate-200'}`}>
                            {item.q}
                          </span>
                          {isOpen ? <ChevronUp className="text-indigo-500" /> : <ChevronDown className="text-slate-400" />}
                        </button>

                        <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                          <div className="px-6 pb-6 text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-4">
                            {item.a}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Target size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum resultado encontrado</h3>
              <p className="text-slate-500">Tente buscar por termos diferentes ou navegue pelas categorias.</p>
            </div>
          )}
        </div>

        <div className="bg-indigo-600 rounded-3xl p-8 md:p-12 relative overflow-hidden text-center space-y-6 shadow-2xl shadow-indigo-500/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-24 -mb-24 blur-3xl" />
          <div className="relative space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-[10px] font-black uppercase tracking-widest">
              <AlertCircle size={14} /> Ainda com dúvidas?
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-white">Nosso suporte esta pronto para ajudar</h3>
            <p className="text-indigo-100 max-w-xl mx-auto">
              Se você não encontrou a resposta que precisava, abra um chamado pela area de suporte e acompanhe tudo pelo histórico da plataforma.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
