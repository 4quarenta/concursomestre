export type NavigationSkeletonVariant =
  | 'dashboard'
  | 'questions'
  | 'exams'
  | 'simulations'
  | 'xray'
  | 'schedule'
  | 'profile'
  | 'notifications'
  | 'support'
  | 'editorial'
  | 'ranking'
  | 'marketplace'
  | 'flashcards'
  | 'directory';

export const resolveNavigationSkeletonVariant = (pathname: string): NavigationSkeletonVariant | null => {
  if (pathname === '/dashboard' || pathname === '/') return 'dashboard';
  if (pathname === '/questoes' || pathname === '/questions' || pathname.startsWith('/questoes/')) return 'questions';
  if (pathname === '/provas' || pathname.startsWith('/provas/')) return 'exams';
  if (pathname === '/simulation' || pathname === '/simulados' || pathname.startsWith('/simulados/')) return 'simulations';
  if (pathname === '/x-ray') return 'xray';
  if (pathname === '/cronograma') return 'schedule';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname === '/notifications') return 'notifications';
  if (pathname === '/support') return 'support';
  if (pathname.startsWith('/blog') || pathname === '/novidades') return 'editorial';
  if (pathname.startsWith('/ranking')) return 'ranking';
  if (pathname === '/marketplace' || pathname.startsWith('/materiais')) return 'marketplace';
  if (pathname === '/flashcards') return 'flashcards';
  if (/^\/(bancas|disciplinas|cargos|carreiras|concursos|orgaos|assuntos|topicos)(\/|$)/.test(pathname)) return 'directory';
  return null;
};
