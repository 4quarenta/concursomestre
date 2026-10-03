import { Platform } from 'react-native';
import { readGoogleSignInResponse, type GoogleIdentity } from '@/services/auth/googleSignInResponse';

type GoogleSignInSdk = typeof import('react-native-nitro-google-signin');

let configured = false;

/** Obtém um ID token do Google para ser validado exclusivamente pela API. */
export async function requestGoogleIdentity(webClientId?: string): Promise<GoogleIdentity | null> {
  if (Platform.OS !== 'android') {
    throw new Error('O login nativo com Google ainda está configurado somente para Android.');
  }

  const clientId = String(webClientId || '').trim();
  if (!/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(clientId)) {
    throw new Error('O login com Google não está configurado no servidor. Tente novamente mais tarde.');
  }

  const sdk = require('react-native-nitro-google-signin') as GoogleSignInSdk;
  try {
    if (!configured) {
      sdk.GoogleOneTapSignIn.configure({ webClientId: clientId });
      configured = true;
    }

    await sdk.GoogleOneTapSignIn.checkPlayServices();
    let result = await sdk.GoogleOneTapSignIn.signIn();
    let openedExplicitPicker = false;

    if (sdk.isNoSavedCredentialFoundResponse(result)) {
      openedExplicitPicker = true;
      result = await sdk.GoogleOneTapSignIn.presentExplicitSignIn();
    }

    return readGoogleSignInResponse(result, openedExplicitPicker);
  } catch (error) {
    if (sdk.isErrorWithCode(error)) {
      if (error.code === sdk.statusCodes.DEVELOPER_ERROR) {
        throw new Error(
          'Configuração OAuth do Google incompleta. Confira o nome do pacote, o SHA-1 Android e o OAuth Client ID Web no Firebase/Google Cloud.',
        );
      }
      if (error.code === sdk.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Atualize ou ative o Google Play Services e tente novamente.');
      }
    }
    throw error;
  }
}
