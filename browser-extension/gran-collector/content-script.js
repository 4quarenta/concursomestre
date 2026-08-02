(() => {
  const PAGE_SOURCE = 'concursomestre-gran-page';
  const EXTENSION_SOURCE = 'concursomestre-gran-extension';
  const ALLOWED_TYPES = new Set([
    'PING',
    'COLLECT',
    'COLLECT_TAXONOMY_PAGE',
    'COLLECT_TAXONOMY_BATCH',
    'CHECK_TAXONOMY_UPDATES',
  ]);
  const CRAWLER_PATH = '/admin/operation/gran-crawler';
  const EXTENSION_READY_EVENT = 'concursomestre:gran-collector-ready';
  const EXTENSION_DISCOVER_EVENT = 'concursomestre:gran-collector-discover';
  const EXTENSION_MARKER_ATTRIBUTE = 'data-concursomestre-gran-collector';
  const BRIDGE_KEY = '__CONCURSOMESTRE_GRAN_COLLECTOR_BRIDGE__';
  const extensionVersion = chrome.runtime.getManifest().version;

  const previousBridge = globalThis[BRIDGE_KEY];
  if (previousBridge && typeof previousBridge.cleanup === 'function') {
    previousBridge.cleanup();
  }

  const isAllowedCrawlerPage = () => (
    (window.location.origin === 'https://concursomestre.com'
      || window.location.origin === 'http://localhost:3000')
    && (window.location.pathname === CRAWLER_PATH
      || window.location.pathname.startsWith(`${CRAWLER_PATH}/`))
  );

  const onMessage = (event) => {
    if (
      !isAllowedCrawlerPage()
      || event.source !== window
      || event.origin !== window.location.origin
      || event.data?.source !== PAGE_SOURCE
      || !ALLOWED_TYPES.has(event.data?.type)
      || typeof event.data?.requestId !== 'string'
    ) {
      return;
    }
    // O listener em capture substitui bridges de versoes antigas ainda vivos na aba.
    event.stopImmediatePropagation();
    const requestId = event.data.requestId;
    const action = event.data.type;
    const sendResult = (response, message = null) => {
      window.postMessage({
        source: EXTENSION_SOURCE,
        requestId,
        type: `${action}_RESULT`,
        success: message === null && response?.success === true,
        data: response?.data,
        message: message || response?.message || null,
        version: extensionVersion,
      }, window.location.origin);
    };

    try {
      chrome.runtime.sendMessage({
        action,
        url: action === 'COLLECT' ? String(event.data.url || '') : undefined,
        kind: action === 'COLLECT_TAXONOMY_PAGE' || action === 'COLLECT_TAXONOMY_BATCH'
          ? String(event.data.kind || '')
          : undefined,
        page: action === 'COLLECT_TAXONOMY_PAGE' ? Number(event.data.page || 1) : undefined,
        rootExternalIds: action === 'COLLECT_TAXONOMY_PAGE' || action === 'COLLECT_TAXONOMY_BATCH'
          ? event.data.rootExternalIds
          : undefined,
      }, (response) => {
        const runtimeError = chrome.runtime.lastError;
        sendResult(response, runtimeError?.message || null);
      });
    } catch (error) {
      sendResult(null, error instanceof Error ? error.message : 'O contexto da extensao foi invalidado.');
    }
  };

  const announceReady = () => {
    if (!isAllowedCrawlerPage()) return;
    document.documentElement?.setAttribute(EXTENSION_MARKER_ATTRIBUTE, extensionVersion);
    window.postMessage({
      source: EXTENSION_SOURCE,
      type: 'EXTENSION_READY',
      version: extensionVersion,
    }, window.location.origin);
    window.dispatchEvent(new CustomEvent(EXTENSION_READY_EVENT, {
      detail: { version: extensionVersion },
    }));
  };

  window.addEventListener('message', onMessage, { capture: true });
  window.addEventListener(EXTENSION_DISCOVER_EVENT, announceReady);
  window.addEventListener('pageshow', announceReady);
  globalThis[BRIDGE_KEY] = {
    version: extensionVersion,
    cleanup: () => {
      window.removeEventListener('message', onMessage, { capture: true });
      window.removeEventListener(EXTENSION_DISCOVER_EVENT, announceReady);
      window.removeEventListener('pageshow', announceReady);
    },
  };
  announceReady();
})();
