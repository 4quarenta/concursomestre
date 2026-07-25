const PAGE_SOURCE = 'concursomestre-gran-page';
const EXTENSION_SOURCE = 'concursomestre-gran-extension';
const ALLOWED_TYPES = new Set(['PING', 'COLLECT']);

window.addEventListener('message', (event) => {
  if (
    event.source !== window
    || event.origin !== window.location.origin
    || event.data?.source !== PAGE_SOURCE
    || !ALLOWED_TYPES.has(event.data?.type)
    || typeof event.data?.requestId !== 'string'
  ) {
    return;
  }
  const requestId = event.data.requestId;
  const action = event.data.type;
  chrome.runtime.sendMessage({
    action,
    url: action === 'COLLECT' ? String(event.data.url || '') : undefined,
  }, (response) => {
    const runtimeError = chrome.runtime.lastError;
    window.postMessage({
      source: EXTENSION_SOURCE,
      requestId,
      type: `${action}_RESULT`,
      success: !runtimeError && response?.success === true,
      data: response?.data,
      message: runtimeError?.message || response?.message || null,
    }, window.location.origin);
  });
});

window.postMessage({
  source: EXTENSION_SOURCE,
  type: 'EXTENSION_READY',
  version: chrome.runtime.getManifest().version,
}, window.location.origin);
