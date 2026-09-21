export type FlashcardDeck = {
  id: string;
  title: string;
  subject: string;
  premium?: boolean;
  cards: { front: string; back: string }[];
};

export const flashcardDecks: FlashcardDeck[] = [
  { id: 'constitucional-direitos', title: 'Direitos Fundamentais', subject: 'Direito Constitucional', cards: [
    { front: 'Quem pode impetrar habeas corpus?', back: 'Qualquer pessoa, em favor próprio ou de terceiro, inclusive o Ministério Público. Não exige advogado.' },
    { front: 'Prazo do mandado de segurança', back: '120 dias contados da ciência do ato impugnado (decadencial).' },
    { front: 'Direitos sociais estão em qual artigo?', back: 'Art. 6º da CF/88.' },
  ] },
  { id: 'adm-atos', title: 'Atos Administrativos', subject: 'Direito Administrativo', cards: [
    { front: 'Atributos do ato administrativo', back: 'Presunção de legitimidade, imperatividade, autoexecutoriedade e tipicidade.' },
    { front: 'Requisitos do ato', back: 'Competência, finalidade, forma, motivo e objeto (COM-FI-FO-MO-OB).' },
    { front: 'Convalidação é possível em quais elementos?', back: 'Competência não exclusiva e forma não essencial.' },
  ] },
  { id: 'portugues-crase', title: 'Crase sem erro', subject: 'Língua Portuguesa', cards: [
    { front: 'Usa-se crase antes de palavra masculina?', back: "Em regra não, salvo em expressões com 'à moda de' subentendida." },
    { front: 'Crase antes de pronomes de tratamento?', back: 'Não se usa, exceto senhora, senhorita e dona.' },
  ] },
  { id: 'previdenciario-beneficios', title: 'Benefícios Previdenciários', subject: 'Direito Previdenciário', premium: true, cards: [
    { front: 'Carência da aposentadoria por idade', back: '180 contribuições mensais.' },
    { front: 'Salário-maternidade: duração', back: '120 dias, prorrogáveis nos casos legais.' },
  ] },
];

export type BlogPost = {
  slug: string;
  title: string;
  category: string;
  date: string;
  readTime: string;
  excerpt: string;
  author: string;
  content: string[];
};

export const blogCategories = ['Todos', 'Editais', 'Dicas de estudo', 'Carreiras', 'Legislação'];
export const blogPosts: BlogPost[] = [
  { slug: 'edital-inss-2026-publicado', title: 'Edital do INSS 2026 é publicado com 3.000 vagas', category: 'Editais', date: '05 set 2026', readTime: '4 min', excerpt: 'As inscrições abrem na próxima semana e o salário inicial passa de R$ 6 mil. Veja o conteúdo programático completo.', author: 'Redação', content: ['O edital do concurso do INSS 2026 foi publicado no Diário Oficial da União, com 3.000 vagas para o cargo de Técnico do Seguro Social.', 'As inscrições poderão ser feitas pelo site da banca organizadora, com taxa de R$ 78,00. A prova objetiva está prevista para dezembro.', 'O conteúdo programático mantém as disciplinas tradicionais: Língua Portuguesa, Raciocínio Lógico, Direito Constitucional, Direito Administrativo, Ética no Serviço Público e Direito Previdenciário.', 'Recomendamos iniciar os estudos pelas disciplinas de maior peso e resolver questões da banca desde o primeiro dia.'] },
  { slug: 'como-estudar-3-horas-por-dia', title: 'Como render mais estudando apenas 3 horas por dia', category: 'Dicas de estudo', date: '02 set 2026', readTime: '6 min', excerpt: 'Método de blocos, revisão espaçada e resolução de questões: um roteiro realista para quem concilia trabalho e estudo.', author: 'Prof. Ana Prado', content: ['Estudar muitas horas não garante aprovação. O que separa aprovados de reprovados é a qualidade das sessões e a constância.', 'Divida suas 3 horas em blocos: 60 minutos de teoria, 90 minutos de questões e 30 minutos de revisão espaçada dos erros.', 'Use flashcards para memorizar prazos, competências e percentuais — conteúdos que caem em prova de forma literal.', 'Ao final da semana, faça um simulado curto para medir evolução e ajustar o plano.'] },
  { slug: 'novas-sumulas-stf-concursos', title: 'Novas súmulas do STF que podem cair na sua prova', category: 'Legislação', date: '28 ago 2026', readTime: '5 min', excerpt: 'Selecionamos os entendimentos recentes com maior chance de cobrança em Direito Constitucional e Administrativo.', author: 'Prof. Carlos Menezes', content: ['As bancas costumam cobrar jurisprudência recente já no primeiro concurso após a publicação.', 'Fique atento aos temas de controle de constitucionalidade, improbidade administrativa e direitos fundamentais.', 'Cadastre cada entendimento como um flashcard e revise semanalmente.'] },
  { slug: 'carreiras-tribunais-vale-a-pena', title: 'Carreiras de tribunais: vale a pena em 2026?', category: 'Carreiras', date: '21 ago 2026', readTime: '7 min', excerpt: 'Comparamos salários, estabilidade e concorrência das principais carreiras do Judiciário.', author: 'Redação', content: ['As carreiras de tribunais seguem entre as mais procuradas por unir bons salários e qualidade de vida.', 'A concorrência é alta, mas o conteúdo é repetitivo entre os certames, o que favorece quem estuda de forma contínua.', 'Analista Judiciário e Técnico Judiciário continuam sendo as portas de entrada mais comuns.'] },
];

export type Law = { id: string; sigla: string; nome: string; ano: string; descricao: string; totalArtigos: number; artigosComentados: number; artigos: { numero: string; titulo?: string; texto: string; comentario: string; macete?: string }[] };
export type LawArea = { id: string; nome: string; leis: Law[] };
export const lawAreas: LawArea[] = [
  { id: 'constitucional', nome: 'Direito Constitucional', leis: [{ id: 'cf-1988', sigla: 'CF/88', nome: 'Constituição Federal', ano: '1988', descricao: 'Constituição da República Federativa do Brasil', totalArtigos: 250, artigosComentados: 180, artigos: [
    { numero: '1º', titulo: 'Dos Princípios Fundamentais', texto: 'A República Federativa do Brasil, formada pela união indissolúvel dos Estados e Municípios e do Distrito Federal, constitui-se em Estado Democrático de Direito e tem como fundamentos:', comentario: "Este artigo é considerado o pilar do Estado brasileiro. Memorize o mnemônico 'SO-CI-DI-VA-PLU' para os fundamentos.", macete: '🧠 SO-CI-DI-VA-PLU → soberania, cidadania, dignidade, valores sociais e pluralismo político.' },
    { numero: '2º', texto: 'São Poderes da União, independentes e harmônicos entre si, o Legislativo, o Executivo e o Judiciário.', comentario: "Princípio da separação dos Poderes. A banca costuma trocar 'e' por 'ou' para induzir ao erro.", macete: '⚖️ Independentes E harmônicos.' },
    { numero: '5º', titulo: 'Direitos e Garantias Fundamentais', texto: 'Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se o direito à vida, à liberdade, à igualdade, à segurança e à propriedade.', comentario: 'O caput menciona cinco direitos invioláveis e é um dos trechos mais cobrados em concursos.', macete: '🎯 VI-LI-IG-SE-PRO → vida, liberdade, igualdade, segurança e propriedade.' },
  ] }] },
  { id: 'penal', nome: 'Direito Penal', leis: [{ id: 'cp', sigla: 'CP', nome: 'Código Penal', ano: '1940', descricao: 'Código Penal Brasileiro', totalArtigos: 361, artigosComentados: 220, artigos: [{ numero: '1º', titulo: 'Anterioridade da Lei', texto: 'Não há crime sem lei anterior que o defina. Não há pena sem prévia cominação legal.', comentario: 'Princípio da legalidade ou reserva legal (nullum crimen, nulla poena sine lege).', macete: '📜 Não há crime sem lei anterior = legalidade.' }] }] },
  { id: 'administrativo', nome: 'Direito Administrativo', leis: [{ id: 'lei-8112', sigla: 'Lei 8.112/90', nome: 'Regime Jurídico dos Servidores Federais', ano: '1990', descricao: 'Estatuto dos Servidores Públicos Civis da União', totalArtigos: 253, artigosComentados: 150, artigos: [{ numero: '1º', texto: 'Esta Lei institui o Regime Jurídico dos Servidores Públicos Civis da União, das autarquias e das fundações públicas federais.', comentario: 'A Lei 8.112/90 não se aplica a empregados públicos de empresas públicas e sociedades de economia mista, regidos pela CLT.' }] }] },
  { id: 'civil', nome: 'Direito Civil', leis: [{ id: 'cc', sigla: 'CC', nome: 'Código Civil', ano: '2002', descricao: 'Código Civil Brasileiro', totalArtigos: 2046, artigosComentados: 320, artigos: [] }] },
  { id: 'tributario', nome: 'Direito Tributário', leis: [{ id: 'ctn', sigla: 'CTN', nome: 'Código Tributário Nacional', ano: '1966', descricao: 'Código Tributário Nacional', totalArtigos: 218, artigosComentados: 110, artigos: [] }] },
  { id: 'processual', nome: 'Direito Processual', leis: [{ id: 'cpc', sigla: 'CPC', nome: 'Código de Processo Civil', ano: '2015', descricao: 'Lei nº 13.105, de 16 de março de 2015.', totalArtigos: 1072, artigosComentados: 180, artigos: [] }] },
];

export const findLaw = (id: string) => lawAreas.flatMap((area) => area.leis).find((law) => law.id === id);
export const findPost = (slug: string) => blogPosts.find((post) => post.slug === slug);
export const findDeck = (id: string) => flashcardDecks.find((deck) => deck.id === id);
