type WebkitFullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

type WebkitFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export const getSimulationFullscreenElement = (documentRef: Document): Element | null => {
  const webkitDocument = documentRef as WebkitFullscreenDocument;
  return documentRef.fullscreenElement || webkitDocument.webkitFullscreenElement || null;
};

export const requestSimulationFullscreen = async (documentRef: Document): Promise<boolean> => {
  const target = documentRef.documentElement as WebkitFullscreenElement;
  const request = target.requestFullscreen?.bind(target)
    || target.webkitRequestFullscreen?.bind(target);

  if (!request) {
    return false;
  }

  try {
    await request();
    return true;
  } catch {
    return false;
  }
};

export const exitSimulationFullscreen = async (documentRef: Document): Promise<boolean> => {
  if (!getSimulationFullscreenElement(documentRef)) {
    return true;
  }

  const webkitDocument = documentRef as WebkitFullscreenDocument;
  const exit = documentRef.exitFullscreen?.bind(documentRef)
    || webkitDocument.webkitExitFullscreen?.bind(webkitDocument);

  if (!exit) {
    return false;
  }

  try {
    await exit();
    return true;
  } catch {
    return false;
  }
};
