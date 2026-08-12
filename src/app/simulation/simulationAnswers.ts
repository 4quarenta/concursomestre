import type { SimulationSession } from '@types';

export const mergeSimulationAnswer = (
  session: SimulationSession | null,
  questionId: string | number,
  answer: SimulationSession['answers'][string],
): SimulationSession | null => {
  if (!session) return null;

  return {
    ...session,
    answers: {
      ...session.answers,
      [String(questionId)]: answer,
    },
  };
};
