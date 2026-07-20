/**
 * Evita que a mesma acao de autenticacao dispare duas requisicoes antes de o
 * React atualizar o estado visual do formulario.
 */
export type SubmissionGate = {
  tryStart: () => boolean;
  finish: () => void;
  isPending: () => boolean;
};

export const createSubmissionGate = (): SubmissionGate => {
  let pending = false;

  return {
    tryStart: () => {
      if (pending) return false;
      pending = true;
      return true;
    },
    finish: () => {
      pending = false;
    },
    isPending: () => pending,
  };
};
