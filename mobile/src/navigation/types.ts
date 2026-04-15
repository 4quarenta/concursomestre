import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Material } from '@/types/materials';
import type { MobileSimulationSeed } from '@/types/simulation';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type CheckoutRoutePlan = {
  id: number;
  name: string;
  description?: string;
  price: number;
  interval_count: number;
  interval_unit: 'day' | 'week' | 'month' | 'year';
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Checkout: {
    plan: CheckoutRoutePlan;
  };
  SimulationConfig: undefined;
  SimulationRun: {
    seed: MobileSimulationSeed;
  };
  SimulationDetail: {
    simulationId: string;
  };
  Notifications: undefined;
  RankingDetail: {
    rankingId: string;
  };
  PerformanceSubjects: undefined;
  MaterialDetail: {
    materialId: string;
    material?: Material;
  };
  AnnotatedLaws: undefined;
  Flashcards: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Questoes: undefined;
  Planos: undefined;
  Simulados: undefined;
  Ranking: undefined;
  Marketplace: undefined;
  Perfil: undefined;
};
