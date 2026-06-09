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

import React from 'react';
import Image from 'next/image';
import {
  Award,
  BookOpenCheck,
  BookmarkCheck,
  CalendarCheck2,
  CheckCircle2,
  Crown,
  Flame,
  Loader2,
  Medal,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { getAssetUrl } from '@services/api';
import { profileService, type XpLeaderboardEntry } from '@services/profile';
import { clientLog } from '@services/monitoring/clientLog';

const XP_PER_LEVEL = 1000;

type XpRuleTone = 'emerald' | 'amber' | 'sky' | 'indigo' | 'rose' | 'violet';

type XpRule = {
  category: string;
  title: string;
  value: string;
  helper: string;
  tone: XpRuleTone;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const XP_RULES: XpRule[] = [
  { category: 'Pratica', title: 'Acerto em questao', value: '+10 XP', helper: 'Recompensa principal da pratica diaria.', tone: 'emerald', icon: CheckCircle2 },
  { category: 'Pratica', title: 'Erro revisado', value: '+2 XP', helper: 'Errar tambem conta como estudo real.', tone: 'sky', icon: BookOpenCheck },
  { category: 'Pratica', title: 'Questao salva', value: '+3 XP', helper: 'Uma vez por questao salva para revisao.', tone: 'indigo', icon: BookmarkCheck },
  { category: 'Constancia', title: 'Estudo do dia', value: '+5 XP', helper: 'Ao manter atividade diaria registrada.', tone: 'amber', icon: CalendarCheck2 },
  { category: 'Constancia', title: 'Sequencias', value: '+15 a +250 XP', helper: 'Marcos de 3, 7, 15 e 30 dias.', tone: 'rose', icon: Flame },
  { category: 'Marcos', title: 'Questoes respondidas', value: '+25 a +100 XP', helper: 'Bonus nos marcos de 25, 50 e 100 respostas.', tone: 'violet', icon: Target },
  { category: 'Marcos', title: 'Acertos acumulados', value: '+75 a +150 XP', helper: 'Bonus nos marcos de 50 e 100 acertos.', tone: 'emerald', icon: Star },
  { category: 'Simulados', title: 'Simulado concluido', value: 'ate +85 XP', helper: 'Conta conclusao, volume respondido e acertos.', tone: 'sky', icon: Zap },
  { category: 'Comunidade', title: 'Comentario aprovado', value: '+5 a +10 XP', helper: 'Contribuicoes boas tambem evoluem o perfil.', tone: 'indigo', icon: MessageSquare },
  { category: 'Comunidade', title: 'Curtida recebida', value: '+2 XP', helper: 'Quando outro aluno valoriza seu comentario.', tone: 'amber', icon: Users },
  { category: 'Comunidade', title: 'Denuncia enviada', value: '+2 XP', helper: 'Sinalizacao inicial; se proceder, recebe bonus maior.', tone: 'rose', icon: ShieldCheck },
  { category: 'Comunidade', title: 'Denuncia aceita', value: '+15 XP', helper: 'Quando a moderacao confirma que sua denuncia ajudou.', tone: 'emerald', icon: ShieldCheck },
  { category: 'Suporte', title: 'Sugestao enviada', value: '+8 XP', helper: 'Ideias publicas entram no mural e contam como contribuicao.', tone: 'sky', icon: Sparkles },
  { category: 'Suporte', title: 'Avaliacao da plataforma', value: '+20 XP', helper: 'Feedback estruturado ajuda o produto a melhorar.', tone: 'violet', icon: Star },
  { category: 'Perfil', title: 'Foto e perfil completo', value: '+10 a +40 XP', helper: 'Personalizacao e dados completos liberam recompensas unicas.', tone: 'amber', icon: Crown },
  { category: 'Lei comentada', title: 'Artigos lidos', value: '+2 XP', helper: 'Cada artigo novo lido conta uma vez no progresso.', tone: 'indigo', icon: BookOpenCheck },
  { category: 'Lei comentada', title: 'Marcos de leitura', value: '+10 a +50 XP', helper: 'Bonus em 25%, 50%, 75% e 100% de leitura da lei.', tone: 'emerald', icon: Target },
  { category: 'Lei comentada', title: 'Favorito/comentario', value: '+3 a +4 XP', helper: 'Organizar revisao e participar da discussao tambem contam.', tone: 'sky', icon: MessageSquare },
  { category: 'Ranking pos-prova', title: 'Participacao', value: '+20 XP', helper: 'Registrado uma vez por ranking enviado.', tone: 'violet', icon: Trophy },
  { category: 'Ranking pos-prova', title: 'Resultado oficial', value: '+10 a +60 XP', helper: 'Varia conforme colocacao apos o gabarito oficial.', tone: 'rose', icon: Medal },
];

const TONE_CLASSES: Record<XpRuleTone, { icon: string; badge: string; bar: string }> = {
  emerald: {
    icon: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  sky: {
    icon: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    badge: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    bar: 'bg-sky-500',
  },
  indigo: {
    icon: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
    badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
    bar: 'bg-indigo-500',
  },
  rose: {
    icon: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    bar: 'bg-rose-500',
  },
  violet: {
    icon: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
    badge: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
    bar: 'bg-violet-500',
  },
};

const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(Math.max(0, Math.round(value || 0)));

const calculateLevelProgress = (xp: number) => {
  const currentLevelXp = Math.max(0, Number(xp || 0) % XP_PER_LEVEL);
  return Math.round((currentLevelXp / XP_PER_LEVEL) * 100);
};

const getXpToNextLevel = (xp: number) => {
  const remainder = Math.max(0, Number(xp || 0) % XP_PER_LEVEL);
  return remainder === 0 ? XP_PER_LEVEL : XP_PER_LEVEL - remainder;
};

const getUserPosition = (entries: XpLeaderboardEntry[], userId?: string) => {
  if (!userId) return 0;
  const entry = entries.find((item) => String(item.id) === String(userId));
  if (entry?.rank) return entry.rank;
  const index = entries.findIndex((item) => String(item.id) === String(userId));
  return index >= 0 ? index + 1 : 0;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || 'A') + (parts[1]?.[0] || '');
};

const LeaderboardAvatar = ({ entry, size = 44 }: { entry: XpLeaderboardEntry; size?: number }) => {
  const [hasImageError, setHasImageError] = React.useState(false);
  const photoUrl = !hasImageError ? getAssetUrl(entry.photoUrl || '') : '';

  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-sm font-black uppercase text-white ring-1 ring-slate-200 dark:bg-indigo-600 dark:ring-slate-700"
      style={{ height: size, width: size }}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={entry.name}
          fill
          sizes={`${size}px`}
          unoptimized
          className="object-cover"
          onError={() => setHasImageError(true)}
        />
      ) : (
        getInitials(entry.name)
      )}
    </div>
  );
};

const LevelProgressBar = ({ xp, tone = 'indigo' }: { xp: number; tone?: XpRuleTone }) => (
  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
    <div className={`h-full rounded-full ${TONE_CLASSES[tone].bar}`} style={{ width: `${calculateLevelProgress(xp)}%` }} />
  </div>
);

const RankBadge = ({ rank }: { rank: number }) => {
  const rankStyle = rank === 1
    ? 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/20'
    : rank === 2
      ? 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600'
      : rank === 3
        ? 'bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-200 dark:ring-orange-500/20'
        : 'bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';

  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black ring-1 ${rankStyle}`}>
      #{rank}
    </span>
  );
};

/**
 * Pagina publica de nivel e XP.
 * Mantem o ranking de progresso separado do ranking pos-prova.
 *
 * @since 1.0.0
 */
const LevelsPage = () => {
  const { currentUser } = useAuth();
  const [entries, setEntries] = React.useState<XpLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState('');
  const currentUserId = currentUser?.id ? String(currentUser.id) : '';

  React.useEffect(() => {
    let isMounted = true;

    profileService.listXpLeaderboard()
      .then((leaderboard) => {
        if (isMounted) {
          setEntries(leaderboard);
        }
      })
      .catch((error) => {
        clientLog.warn('Failed to load XP leaderboard', error);
        if (isMounted) {
          setErrorMessage('Nao foi possivel carregar o ranking de XP agora.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const currentEntry = React.useMemo(() => {
    if (!currentUserId) return null;
    return entries.find((entry) => String(entry.id) === currentUserId) || null;
  }, [currentUserId, entries]);

  const userXp = Number(currentEntry?.xp ?? currentUser?.xp ?? 0);
  const userLevel = Math.max(1, Number(currentEntry?.level ?? currentUser?.level ?? Math.floor(userXp / XP_PER_LEVEL) + 1));
  const progress = calculateLevelProgress(userXp);
  const userPosition = getUserPosition(entries, currentUser?.id);
  const topThree = entries.slice(0, 3);
  const totalAnswered = entries.reduce((total, entry) => total + Number(entry.answeredQuestions || 0), 0);
  const totalCorrect = entries.reduce((total, entry) => total + Number(entry.correctAnswers || 0), 0);
  const topXp = entries[0]?.xp || 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr,360px]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Nivel do usuario</p>
            <h1 className="mt-2 flex items-center gap-3 text-2xl font-black text-slate-900 dark:text-slate-100">
              <Crown className="text-amber-500" size={28} /> XP, missoes e ranking de estudo
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
              Este ranking mede progresso, constancia e contribuicao por XP. Ele e separado do ranking pos-prova, que classifica candidatos por pontuacao em uma prova especifica.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alunos no ranking</p>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{formatNumber(entries.length)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Questoes registradas</p>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{formatNumber(totalAnswered)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Acertos somados</p>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{formatNumber(totalCorrect)}</p>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-amber-100 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-200">Seu progresso</span>
              <Sparkles size={20} className="text-amber-600 dark:text-amber-300" />
            </div>
            <div className="mt-5 grid grid-cols-[auto,1fr] items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-amber-700 shadow-sm dark:bg-slate-950 dark:text-amber-300">
                {currentUser ? userLevel : '-'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{currentUser?.name || 'Entre para acompanhar seu nivel'}</p>
                <p className="mt-1 text-xs font-bold text-amber-800 dark:text-amber-200">
                  {currentUser ? `${formatNumber(userXp)} XP acumulados` : 'Ranking publico disponivel'}
                </p>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs font-black text-amber-800 dark:text-amber-200">
                <span>{progress}% do nivel</span>
                <span>{currentUser ? `${formatNumber(getXpToNextLevel(userXp))} XP para o proximo` : '0 XP'}</span>
              </div>
              <LevelProgressBar xp={userXp} tone="amber" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-950/60">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Posicao</p>
                <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{userPosition ? `#${userPosition}` : '-'}</p>
              </div>
              <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-950/60">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Topo atual</p>
                <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{formatNumber(topXp)} XP</p>
              </div>
            </div>
          </aside>
        </div>
      </header>

      {topThree.length > 0 && (
        <section className="grid gap-4 lg:grid-cols-3">
          {topThree.map((entry) => {
            const rank = entry.rank || entries.indexOf(entry) + 1;
            return (
              <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <LeaderboardAvatar entry={entry} size={52} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{entry.name}</p>
                      <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{entry.targetExam || 'Foco nao informado'}</p>
                    </div>
                  </div>
                  <RankBadge rank={rank} />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">XP</p>
                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{formatNumber(entry.xp)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nivel</p>
                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{entry.level}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Streak</p>
                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{entry.streakDays || 0}d</p>
                  </div>
                </div>
                <div className="mt-4">
                  <LevelProgressBar xp={entry.xp} tone={rank === 1 ? 'amber' : rank === 2 ? 'sky' : 'rose'} />
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ranking por XP</p>
            <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">Alunos com maior progresso</h2>
          </div>
          <Award className="text-amber-500" size={24} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-10">
            <Loader2 className="animate-spin text-indigo-500" size={26} />
          </div>
        ) : errorMessage ? (
          <div className="p-8 text-center text-sm font-semibold text-rose-600 dark:text-rose-300">{errorMessage}</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">Ainda nao ha usuarios publicos no ranking de XP.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {entries.slice(0, 50).map((entry, index) => {
              const rank = entry.rank || index + 1;
              const isCurrentUser = currentUser?.id && String(currentUser.id) === String(entry.id);
              const accuracy = entry.answeredQuestions
                ? Math.round((Number(entry.correctAnswers || 0) / Number(entry.answeredQuestions)) * 100)
                : 0;

              return (
                <div
                  key={entry.id}
                  className={`grid gap-4 p-4 md:grid-cols-[auto,1fr,320px] md:items-center ${isCurrentUser ? 'bg-indigo-50/80 dark:bg-indigo-500/10' : ''}`}
                >
                  <RankBadge rank={rank} />
                  <div className="flex min-w-0 items-center gap-3">
                    <LeaderboardAvatar entry={entry} />
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{entry.name}</p>
                        {isCurrentUser && (
                          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                            Voce
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{entry.targetExam || 'Foco nao informado'}</p>
                      {entry.badges && entry.badges.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {entry.badges.slice(0, 2).map((badge) => (
                            <span key={`${entry.id}-${badge.key}`} className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                              {badge.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">XP</p>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{formatNumber(entry.xp)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nivel</p>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{entry.level}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Streak</p>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{entry.streakDays || 0}d</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Acerto</p>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{accuracy || 0}%</p>
                      </div>
                    </div>
                    <LevelProgressBar xp={entry.xp} tone={isCurrentUser ? 'indigo' : 'emerald'} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {XP_RULES.map((rule) => {
          const tone = TONE_CLASSES[rule.tone];
          return (
            <article key={`${rule.category}-${rule.title}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <span className={`rounded-xl p-2 ${tone.icon}`}>
                  <rule.icon size={18} />
                </span>
                <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest ${tone.badge}`}>
                  {rule.category}
                </span>
              </div>
              <p className="mt-4 text-sm font-black text-slate-900 dark:text-slate-100">{rule.title}</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{rule.value}</p>
              <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{rule.helper}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: 'Nivel', text: 'Cada 1000 XP avanca um nivel. A barra mostra o progresso dentro do nivel atual.', icon: Target },
          { title: 'Reputacao', text: 'A reputacao mede confiabilidade comunitaria e pode crescer com contribuicoes aprovadas.', icon: ShieldCheck },
          { title: 'Privacidade', text: 'O aluno pode ocultar perfil ou foto no ranking pelas preferencias do perfil.', icon: Zap },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <item.icon className="text-slate-500 dark:text-slate-300" size={20} />
            <h3 className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">{item.title}</h3>
            <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{item.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
};

export default LevelsPage;
