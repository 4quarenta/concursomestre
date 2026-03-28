import React, { useState } from 'react';
import {
    HelpCircle,
    ChevronDown,
    ChevronUp,
    Search,
    Zap,
    Crown,
    Users,
    BookOpen,
    Award,
    CreditCard,
    Target,
    ShieldCheck,
    AlertCircle,
    Clock,
    MessageSquare
} from 'lucide-react';

const FAQ_DATA = [
    {
        category: 'Gamificação e Nível',
        icon: Award,
        questions: [
            {
                q: 'Como ganho XP e subo de nível?',
                a: 'O XP é conquistado resolvendo questões: cada acerto concede 10 XP e cada erro 2 XP. Cada nível de usuário exige 1000 XP para ser completado. Subir de nível demonstra sua constância e profundidade nos estudos.'
            },
            {
                q: 'O que é o sistema de Reputação?',
                a: 'Sua reputação cresce quando você colabora com a comunidade. Toda vez que um comentário seu em uma questão recebe um "gostei" de outro usuário, sua reputação aumenta. Usuários com alta reputação ganham medalhas especiais em seus perfis.'
            },
            {
                q: 'Qual a vantagem de ter um nível alto?',
                a: 'Além do prestígio na comunidade e nos rankings, níveis mais altos liberam conquistas exclusivas e futuramente darão acesso a funcionalidades experimentais antes de outros usuários.'
            }
        ]
    },
    {
        category: 'Assinaturas e Reembolso',
        icon: Crown,
        questions: [
            {
                q: 'Como funcionam os planos e a renovação?',
                a: 'Oferecemos planos Mensal, Trimestral e Anual. Todos possuem renovação automática para garantir que você não perca o acesso. Você pode desativar a renovação a qualquer momento na aba "Faturamento" do seu Perfil.'
            },
            {
                q: 'Tenho direito a reembolso?',
                a: 'Sim! Seguimos o Código de Defesa do Consumidor (CDC). Você tem até 7 dias após a contratação (ou renovação) para solicitar o estorno integral do valor pago, sem burocracia, caso não esteja satisfeito.'
            },
            {
                q: 'Como cancelo minha assinatura?',
                a: 'O cancelamento da recorrência é feito no Perfil > Assinatura. Após cancelar, você continuará com acesso aos recursos premium até o final do período já pago.'
            }
        ]
    },
    {
        category: 'Ferramentas de Estudo',
        icon: Zap,
        questions: [
            {
                q: 'O que é o Raio-X da Banca?',
                a: 'É uma ferramenta de análise estatística profunda que mostra exatamente o que cada banca (FGV, FCC, Cebraspe, etc.) mais cobra, quais os assuntos recorrentes e o nível de dificuldade por disciplina.'
            },
            {
                q: 'Como funciona a Mentoria por IA?',
                a: 'Nossa IA analisa seu desempenho em tempo real e sugere cronogramas de estudo, identifica seus pontos fracos e explica a lógica por trás de cada alternativa nas questões, simulando um professor particular 24h.'
            },
            {
                q: 'O que são os Simulados Inéditos?',
                a: 'São provas criadas por nossa equipe de professores e pela nossa IA, seguindo fielmente o padrão dos editais mais recentes, com questões que você não encontrará em outros bancos.'
            }
        ]
    },
    {
        category: 'Marketplace de Materiais',
        icon: BookOpen,
        questions: [
            {
                q: 'Como acesso os materiais que comprei?',
                a: 'Todos os resumos, mapas mentais e leis esquematizadas adquiridos ficam disponíveis permanentemente na sua área de "Materiais" dentro do Marketplace, prontos para download em PDF.'
            },
            {
                q: 'Quem cria os materiais do Marketplace?',
                a: 'Os materiais são produzidos por professores especialistas e concurseiros aprovados. Cada material passa por uma curadoria técnica antes de ser liberado para venda.'
            }
        ]
    },
    {
        category: 'Indicações e Bônus',
        icon: Users,
        questions: [
            {
                q: 'Como funciona o "Indique e Ganhe"?',
                a: 'No seu perfil, você tem um link exclusivo. Se um amigo se cadastrar por ele, ambos ganham bônus de XP. Se o seu indicado assinar um plano Pro ou Elite, você recebe uma bonificação especial de 1000 XP diretamente na sua conta.'
            }
        ]
    },
    {
        category: 'Suporte e Segurança',
        icon: ShieldCheck,
        questions: [
            {
                q: 'Como falar com o suporte técnico?',
                a: 'Você pode abrir um chamado diretamente na aba "Suporte" do menu lateral. Respondemos a maioria das solicitações em até 24h úteis. Para casos urgentes, temos link direto para o WhatsApp de suporte no rodapé.'
            },
            {
                q: 'Meus dados de pagamento estão seguros?',
                a: 'Sim! Utilizamos criptografia de ponta a ponta e processamento via Mercado Pago. O ConcursoMestre não armazena os dados completos do seu cartão em nossos servidores.'
            }
        ]
    }
];

const FAQPage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [openIndex, setOpenIndex] = useState<string | null>(null);

    const toggleQuestion = (id: string) => {
        setOpenIndex(openIndex === id ? null : id);
    };

    const filteredFaq = FAQ_DATA.map(cat => ({
        ...cat,
        questions: cat.questions.filter(q =>
            q.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.a.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(cat => cat.questions.length > 0);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-24 pb-12 px-4 transition-colors">
            <div className="max-w-4xl mx-auto space-y-12">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-black uppercase tracking-widest">
                        <HelpCircle size={14} /> Dúvidas Frequentes
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                        Tudo o que você precisa <span className="text-indigo-600">saber</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                        Explore nossa base de conhecimento e tire o máximo proveito da plataforma.
                    </p>
                </div>

                {/* Search */}
                <div className="relative max-w-xl mx-auto group">
                    <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative flex items-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group-focus-within:border-indigo-500 transition-all">
                        <Search className="ml-4 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Pesquise por XP, Reembolso, Simulados..."
                            className="w-full py-4 px-4 bg-transparent outline-none text-slate-900 dark:text-white font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* FAQ Grid */}
                <div className="space-y-10">
                    {filteredFaq.length > 0 ? filteredFaq.map((category, catIdx) => (
                        <div key={catIdx} className="space-y-4">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-indigo-600">
                                    <category.icon size={20} />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{category.category}</h2>
                            </div>

                            <div className="grid gap-3">
                                {category.questions.map((item, qIdx) => {
                                    const id = `${catIdx}-${qIdx}`;
                                    const isOpen = openIndex === id;
                                    return (
                                        <div
                                            key={id}
                                            className={`group bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-300 ${isOpen
                                                    ? 'border-indigo-500 shadow-md ring-4 ring-indigo-500/5'
                                                    : 'border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'
                                                }`}
                                        >
                                            <button
                                                onClick={() => toggleQuestion(id)}
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
                    )) : (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                                <Target size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum resultado encontrado</h3>
                            <p className="text-slate-500">Tente buscar por termos diferentes ou navegue pelas categorias.</p>
                        </div>
                    )}
                </div>

                {/* CTA */}
                <div className="bg-indigo-600 rounded-3xl p-8 md:p-12 relative overflow-hidden text-center space-y-6 shadow-2xl shadow-indigo-500/20">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-24 -mb-24 blur-3xl"></div>

                    <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight relative z-10">Ainda tem dúvidas?</h3>
                    <p className="text-indigo-100 text-lg relative z-10 max-w-xl mx-auto font-medium">
                        Se não encontrou o que procurava, nossa equipe está pronta para te ajudar.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4 relative z-10 pt-4">
                        <button className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl hover:scale-105 transition-all active:scale-95 flex items-center gap-2">
                            <MessageSquare size={18} /> Central de Suporte
                        </button>
                        <button className="px-8 py-4 bg-indigo-500 text-white border border-indigo-400 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-indigo-400 transition-all flex items-center gap-2">
                            <Clock size={18} /> Histórico de Chamados
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FAQPage;
