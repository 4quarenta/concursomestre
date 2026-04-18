import type { Metadata } from 'next';
import CheckoutAdhesionTermsClient from './CheckoutAdhesionTermsClient';

export const metadata: Metadata = {
  title: {
    absolute: 'Termos de adesao do checkout | ConcursoMestre',
  },
  description: 'Condicoes aplicaveis a contratacao de planos pagos, renovacao automatica, cancelamento, reembolso e acesso premium no ConcursoMestre.',
  alternates: {
    canonical: '/checkout/termos-de-adesao',
  },
};

export default function CheckoutAdhesionTermsPage() {
  return <CheckoutAdhesionTermsClient />;
}
