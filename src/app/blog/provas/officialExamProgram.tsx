import { ChevronDown, ExternalLink } from 'lucide-react';

type OfficialProgramSubject = {
  name: string;
  questionCount: number;
  weight: string;
  topics: string[];
  expanded?: boolean;
};

type OfficialExamProgram = {
  sourceUrl: string;
  sourceLabel: string;
  subjects: OfficialProgramSubject[];
};

const IFC_BIOLOGY_2023_SLUG = 'fundatec-ifc-professor-do-ensino-basico-tecnico-e-tecnologico-area-biologia-2023';

const officialPrograms: Record<string, OfficialExamProgram> = {
  [IFC_BIOLOGY_2023_SLUG]: {
    sourceUrl: 'https://concursomestre.com/uploads/exams/gran/107456/edital-d9c5a901b3a1be9b20e6.pdf#page=47',
    sourceLabel: 'Edital de Abertura nº 10/2023 · composição e pesos: página 35 · programa (Anexos VI e VII): páginas 47–51',
    subjects: [
      {
        name: 'Língua Portuguesa',
        questionCount: 10,
        weight: '1,60 ponto por questão',
        topics: [
          'Leitura e compreensão de textos: assunto, estrutura, ideias principais e secundárias, relações entre ideias e efeitos de sentido.',
          'Figuras de linguagem, recursos de argumentação e informações implícitas: pressupostos e subentendidos.',
          'Coesão e coerência textuais.',
          'Léxico: significação e substituição de palavras e expressões no texto; estrutura e formação de palavras.',
          'Relações morfossintáticas; relações entre fonemas e grafias.',
          'Ortografia oficial vigente e acentuação gráfica, incluindo o Acordo Ortográfico.',
          'Flexões e emprego das classes gramaticais; vozes verbais e sua conversão.',
          'Concordância nominal e verbal; regência nominal e verbal, incluindo o emprego da crase.',
          'Coordenação e subordinação: conjunções, locuções conjuntivas e pronomes relativos.',
          'Pontuação.',
        ],
      },
      {
        name: 'Legislação',
        questionCount: 10,
        weight: '1,60 ponto por questão',
        topics: [
          'Constituição Federal de 1988: arts. 1º a 9º, 37 a 41 e 205 a 214.',
          'Lei nº 8.112/1990: regime jurídico dos servidores públicos civis da União, autarquias e fundações públicas federais.',
          'Decreto nº 1.171/1994: Código de Ética Profissional do Servidor Público Civil do Poder Executivo Federal.',
          'Lei nº 8.429/1992: sanções aplicáveis a agentes públicos por atos de improbidade administrativa.',
          'Lei nº 11.892/2008: Rede Federal de Educação Profissional, Científica e Tecnológica e Institutos Federais.',
          'Lei nº 9.394/1996 (LDB) e alterações; Base Nacional Comum Curricular (BNCC).',
          'Lei nº 8.069/1990: Estatuto da Criança e do Adolescente.',
          'Lei nº 10.861/2004: Sistema Nacional de Avaliação da Educação Superior (SINAES).',
          'Lei nº 12.527/2011: Lei de Acesso à Informação.',
          'Lei nº 12.772/2012: Plano de Carreiras e Cargos de Magistério Federal.',
          'Lei nº 13.709/2018: Lei Geral de Proteção de Dados Pessoais (LGPD).',
          'Diretrizes Curriculares Nacionais do Ensino Médio e do Ensino Técnico; Planos Nacionais de Educação e diretrizes do CNE.',
          'Decreto nº 5.154/2004 e Decreto nº 5.840/2006 (PROEJA).',
          'Resolução CNE/CEB nº 1/2000: diretrizes curriculares da Educação de Jovens e Adultos.',
          'Resolução CNE/CP nº 1/2020: formação continuada de professores e BNC-Formação Continuada.',
          'Resolução CNE/CP nº 1/2021: diretrizes da Educação Profissional e Tecnológica e da Educação Superior.',
          'Plano de Desenvolvimento Institucional do IFC 2019–2023 (revisão 2021) e Regimento Geral do IFC.',
          'Resolução IFC nº 010 CONSUPER/2021: Organização Didática dos cursos do Instituto Federal Catarinense.',
        ],
      },
      {
        name: 'Conhecimentos Específicos · Biologia',
        questionCount: 40,
        weight: '1,70 ponto por questão',
        expanded: true,
        topics: [
          'Bioquímica: compostos inorgânicos e orgânicos.',
          'Biologia celular: teoria celular, microscopia, membrana plasmática, metabolismo energético, organelas, núcleo, síntese de proteínas e divisão celular.',
          'Histologia animal e vegetal: tipos e funções dos tecidos.',
          'Anatomia e fisiologia humanas.',
          'Classificação biológica: três Domínios e cinco Reinos; noções de sistemática e filogenia.',
          'Reprodução, gametogênese, tipos de ovos, fecundação, desenvolvimento embrionário e anexos embrionários.',
          'Zoologia: sistemática, filogenia, anatomia e fisiologia comparada.',
          'Botânica: sistemática, filogenia, organologia e fisiologia vegetal.',
          'Biologia e Saúde: plantas venenosas, animais venenosos e peçonhentos, doenças contagiosas emergentes, vacinas, ISTs e métodos contraceptivos.',
          'Vírus.',
          'Genética clássica e mendeliana: primeira e segunda leis de Mendel.',
          'Genética moderna e pós-mendeliana: variações das leis de Mendel, lei de Morgan, mapeamento cromossômico e herança multifatorial.',
          'Biotecnologia, engenharia genética, técnica do DNA recombinante e Bioética.',
          'Evolução biológica: origem e evolução da vida, origem das espécies, evidências evolutivas e genética de populações.',
          'Ecologia: conceitos básicos, componentes dos ecossistemas, fluxo de energia e matéria, cadeias e teias alimentares e pirâmides ecológicas.',
          'Ciclos biogeoquímicos, sucessão ecológica, relações ecológicas, desequilíbrios ambientais e conservação ambiental.',
          'Gestão dos processos educativos: planejamento e avaliação institucional e das aprendizagens.',
        ],
      },
    ],
  },
};

export const getOfficialExamProgram = (slug: string): OfficialExamProgram | null => officialPrograms[slug] ?? null;

export function OfficialExamProgramSection({ slug, platformShell = false }: { slug: string; platformShell?: boolean }) {
  const program = getOfficialExamProgram(slug);
  if (!program) return null;
  const cardSurfaceClass = platformShell ? 'dark:bg-slate-900' : 'dark:bg-slate-950';

  return (
    <section className={`rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 ${cardSurfaceClass}`} aria-labelledby="official-program-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="official-program-title" className="text-xl font-black text-slate-950 dark:text-white">Conteúdo programático</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Matérias e assuntos previstos no edital para este cargo.</p>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{program.subjects.length} matérias</span>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
        A prova objetiva prevê 60 questões: 10 de Língua Portuguesa, 10 de Legislação e 40 de Conhecimentos Específicos. Os pesos por questão variam conforme a matéria.
      </p>

      <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
        {program.subjects.map((subject) => (
          <details key={subject.name} open={subject.expanded} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none flex-col items-start justify-center gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 [&::-webkit-details-marker]:hidden">
              <span className="font-bold text-slate-900 dark:text-slate-100">{subject.name}</span>
              <span className="flex w-full items-center gap-2 text-left text-xs text-slate-500 dark:text-slate-400 sm:w-auto sm:shrink-0 sm:text-right">
                <span><strong className="text-slate-700 dark:text-slate-200">{subject.questionCount}</strong> questões · {subject.weight}</span>
                <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>
            <ul className="grid gap-x-7 border-t border-slate-200 py-2 sm:grid-cols-2 dark:border-slate-800">
              {subject.topics.map((topic) => (
                <li key={topic} className="relative border-b border-slate-100 py-2.5 pl-4 text-sm leading-6 text-slate-600 before:absolute before:left-1 before:top-[19px] before:h-1 before:w-1 before:rounded-full before:bg-indigo-500 dark:border-slate-800 dark:text-slate-300">
                  {topic}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      <p className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Conteúdo reorganizado para facilitar a leitura; consulte o edital para conferir a redação integral e eventuais retificações. Esta página não afirma que há questões deste caderno vinculadas no acervo.
      </p>
      <a href={program.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:underline dark:text-indigo-400">
        {program.sourceLabel}<ExternalLink size={14} aria-hidden="true" />
      </a>
    </section>
  );
}
