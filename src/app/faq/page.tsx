'use client';

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
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
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
    category: 'Questões e estudo',
    icon: Target,
    questions: [
      {
        q: 'Como encontro questões por matéria, banca, órgão, cargo e assunto?',
        a: 'Use a página de questões para filtrar por foco, matéria, banca, órgão, ano, nível, cargo, assunto e modalidade. A prova vinculada aparece no card da questão, junto dos metadados da questão.',
      },
      {
        q: 'Qual a diferença entre “Excluir questões” e “Apenas questões com”?',
        a: 'Excluir questões remove itens do treino, como anuladas, desatualizadas, resolvidas, acertei ou errei. Apenas questões com mostra somente itens que atendem ao critério escolhido, como salvas, com comentário do professor, análise detalhada, acertei ou errei.',
      },
      {
        q: 'O que aparece no card da questão?',
        a: 'O card mostra enunciado, alternativas, banca, ano, órgão, cargo, prova vinculada, assunto, status da questão, comentários, análise detalhada, estatísticas, materiais relacionados e leis relacionadas quando houver correspondência.',
      },
      {
        q: 'Comentários do professor e análise detalhada podem ser avaliados?',
        a: 'Sim. Quando disponíveis, comentário do professor e análise detalhada possuem botões de gostei e não gostei para ajudar a plataforma a medir qualidade editorial.',
      },
    ],
  },
  {
    category: 'Lei Comentada',
    icon: BookOpen,
    questions: [
      {
        q: 'Como funciona a Lei Comentada?',
        a: 'A Lei Comentada organiza leis por capítulos, seções e artigos, com comentários do professor, doutrina, jurisprudência, súmulas, macetes, questões relacionadas e ferramentas de leitura.',
      },
      {
        q: 'Como o progresso de leitura é calculado?',
        a: 'O progresso principal é calculado pelos artigos vistos ou concluídos. Quando a lei não traz artigos suficientes para esse cálculo, a plataforma usa seções e o progresso do backend como fallback.',
      },
      {
        q: 'Posso pedir comentário do professor em um trecho específico?',
        a: 'Sim. Em artigos, incisos, alíneas e parágrafos, você pode solicitar comentário do professor para aquele ponto específico da lei.',
      },
      {
        q: 'Posso marcar textos na Lei Comentada?',
        a: 'Sim. A leitura possui ferramentas para destacar, sublinhar, colorir, formatar e salvar marcações do estudante no próprio leitor.',
      },
    ],
  },
  {
    category: 'Simulados e rankings',
    icon: Zap,
    questions: [
      {
        q: 'Como funcionam os simulados?',
        a: 'Os simulados ficam em modo lista por padrão e permitem resolver blocos de questões com correção, histórico, desempenho e análise por matéria.',
      },
      {
        q: 'O ranking pós-prova é o mesmo ranking de XP?',
        a: 'Não. O ranking pós-prova classifica candidatos por pontuação em uma prova específica. O ranking de XP mede constância e avanço geral de estudo dentro da plataforma.',
      },
      {
        q: 'O que é o Raio-X da banca?',
        a: 'É uma análise da banca com recorrência de temas, dificuldade, formato provável de cobrança, características da prova e tipo de raciocínio mais cobrado.',
      },
    ],
  },
  {
    category: 'XP, nível e sequência',
    icon: Award,
    questions: [
      {
        q: 'Como ganho XP e subo de nivel?',
        a: 'Você ganha XP por estudar: acertos, erros revisados, participação em rankings e resultados oficiais podem gerar pontos. A página Níveis XP mostra as regras e o ranking por XP.',
      },
      {
        q: 'Onde vejo meu ranking de XP?',
        a: 'Acesse Níveis XP pelo menu flutuante do topo ao clicar no seu nome. Esse ranking mostra usuários por XP acumulado e não se mistura com rankings de provas específicas.',
      },
      {
        q: 'Como funciona a sequência de estudos?',
        a: 'O dashboard mostra a semana de domingo a sábado e destaca os dias em que você acessou a plataforma. Também mostra sequência atual e melhor marca.',
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
      {
        q: 'Como altero minha forma de pagamento?',
        a: 'A área de assinatura e cobrança no perfil concentra dados de plano, status de recorrência e métodos de pagamento suportados pela plataforma.',
      },
    ],
  },
  {
    category: 'Conta e privacidade',
    icon: ShieldCheck,
    questions: [
      {
        q: 'Posso escolher modo claro ou escuro como padrão?',
        a: 'Sim. Em Perfil > Privacidade e Preferências você define tema padrão, modo padrão de questões e modo padrão de simulados.',
      },
      {
        q: 'Posso controlar minha exposição em rankings?',
        a: 'Sim. Você pode definir perfil público, exibição de foto no ranking de XP, compartilhamento de dados e notificações nas preferências do perfil.',
      },
      {
        q: 'Excluir conta é funcional?',
        a: 'Sim. A exclusão pode ser solicitada em Perfil > Privacidade. A ação exige confirmação, motivo e segue as regras de segurança configuradas.',
      },
      {
        q: 'Meus dados de pagamento estão seguros?',
        a: 'Sim. O processamento usa provedores oficiais e a plataforma evita armazenar dados sensíveis completos de cartão.',
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
    category: 'Suporte, avaliações e sugestões',
    icon: HelpCircle,
    questions: [
      {
        q: 'Como falar com o suporte técnico?',
        a: 'Use a página de suporte para abrir chamado, pedir ajuda, enviar sugestão ou relatar problema. O histórico das conversas fica disponível no perfil do aluno.',
      },
      {
        q: 'O que acontece com sugestões enviadas?',
        a: 'Sugestões podem aparecer em uma área pública de votação, onde alunos podem apoiar ou rejeitar ideias com likes e dislikes.',
      },
      {
        q: 'Como avalio a plataforma?',
        a: 'No perfil, use Avaliar plataforma. O modal mostra suas avaliações anteriores e envia uma nova avaliação para revisão administrativa.',
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

        <div className="bg-indigo-600 rounded-2xl p-8 md:p-12 relative overflow-hidden text-center space-y-6 shadow-2xl shadow-indigo-500/20">
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
            <Link
              href="/support?category=info"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-indigo-700 transition-all hover:bg-indigo-50"
            >
              Abrir suporte de ajuda
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
