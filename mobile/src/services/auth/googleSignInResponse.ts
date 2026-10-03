type GoogleSignInResponse = {
  type?: string;
  data?: {
    idToken?: string | null;
    user?: {
      name?: string | null;
      email?: string | null;
    } | null;
  } | null;
};

export type GoogleIdentity = {
  credential: string;
  name: string;
  email: string;
};

/** Converte a resposta nativa em token, cancelamento esperado ou erro visível. */
export function readGoogleSignInResponse(
  response: GoogleSignInResponse,
  openedExplicitPicker: boolean,
): GoogleIdentity | null {
  if (response.type === 'cancelled') {
    // No Android, OAuth/SHA-1 incorreto também pode fechar o fluxo após
    // escolher a conta. Esse caso não deve ser confundido com o primeiro
    // diálogo One Tap, que o usuário pode dispensar normalmente.
    if (openedExplicitPicker) {
      throw new Error(
        'Não foi possível concluir a autorização do Google. Tente novamente. Se você escolheu uma conta e o seletor fechou sozinho, a configuração OAuth Android pode estar incompleta (pacote ou SHA-1 do certificado).',
      );
    }
    return null;
  }

  if (response.type !== 'success' || !response.data) {
    throw new Error('O Google não retornou uma credencial válida. Tente novamente.');
  }

  const idToken = response.data.idToken?.trim();
  if (!idToken) {
    throw new Error('O Google não retornou o ID token. Verifique a configuração OAuth do aplicativo.');
  }

  return {
    credential: idToken,
    name: response.data.user?.name?.trim() || '',
    email: response.data.user?.email?.trim() || '',
  };
}
