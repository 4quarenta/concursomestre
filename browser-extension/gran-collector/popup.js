const openGranButton = document.getElementById('open-gran');
const refreshButton = document.getElementById('refresh');
const disconnectButton = document.getElementById('disconnect');
const statusBox = document.getElementById('status');
const feedback = document.getElementById('feedback');
const versionLabel = document.getElementById('version');
versionLabel.textContent = `Versao ${chrome.runtime.getManifest().version}`;

const send = (message) => new Promise((resolve, reject) => {
  chrome.runtime.sendMessage(message, (response) => {
    const runtimeError = chrome.runtime.lastError;
    if (runtimeError) {
      reject(new Error(runtimeError.message));
      return;
    }
    if (!response?.success) {
      reject(new Error(response?.message || 'Falha na extensao.'));
      return;
    }
    resolve(response.data);
  });
});

const renderStatus = (status) => {
  const connected = status?.connected === true;
  statusBox.className = `status ${connected ? 'status--ready' : 'status--missing'}`;
  if (!connected) {
    const captureMessages = {
      waiting: 'Aguardando uma requisicao autenticada da pagina da Gran.',
      origin_rejected: 'A consulta foi vista, mas partiu de uma origem nao autorizada.',
      authorization_missing: 'A consulta foi vista, mas o header Authorization nao estava acessivel.',
      client_mismatch: 'A consulta foi vista, mas a sessao apresentou identificadores divergentes.',
      invalid_credential: 'A consulta foi vista, mas a credencial encontrada era invalida ou expirou.',
    };
    statusBox.textContent = captureMessages[status?.captureState]
      || 'Nenhuma sessao Gran conectada.';
    return;
  }
  const expiresAt = Number(status.expiresAt || 0);
  const formatted = expiresAt > 0
    ? new Date(expiresAt * 1000).toLocaleString('pt-BR')
    : 'nao informado';
  statusBox.textContent = `Sessao conectada. Expira em ${formatted}.`;
};

const refresh = async () => {
  try {
    renderStatus(await send({ action: 'GET_STATUS' }));
  } catch (error) {
    statusBox.className = 'status status--missing';
    statusBox.textContent = 'Nao foi possivel verificar a sessao.';
    feedback.textContent = error.message;
  }
};

openGranButton.addEventListener('click', () => {
  void chrome.tabs.create({ url: 'https://questoes.grancursosonline.com.br/' });
});

refreshButton.addEventListener('click', () => {
  feedback.textContent = '';
  void refresh();
});

disconnectButton.addEventListener('click', async () => {
  feedback.textContent = '';
  try {
    renderStatus(await send({ action: 'CLEAR_SESSION' }));
  } catch (error) {
    feedback.textContent = error.message;
  }
});

void refresh();
const statusTimer = setInterval(() => {
  void refresh();
}, 1500);

window.addEventListener('unload', () => {
  clearInterval(statusTimer);
});
