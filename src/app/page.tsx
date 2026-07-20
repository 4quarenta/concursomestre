import LandingPage from './landing/LandingPage';

/**
 * Rota raiz da plataforma.
 * A landing publica deve ser materializada no servidor para preservar SEO,
 * performance inicial e hidratacao igual ao restante das paginas publicas.
 *
 * @since 1.0.0
 */
export default function HomePage() {
  return <LandingPage />;
}
