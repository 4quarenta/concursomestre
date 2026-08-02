import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectGranCollector } from '../granExtensionBridge';

const MARKER_ATTRIBUTE = 'data-concursomestre-gran-collector';
const READY_EVENT = 'concursomestre:gran-collector-ready';
const DISCOVER_EVENT = 'concursomestre:gran-collector-discover';

const attributes = new Map<string, string>();

class TestCustomEvent<T> extends Event {
  detail: T;

  constructor(type: string, init?: CustomEventInit<T>) {
    super(type);
    this.detail = init?.detail as T;
  }
}

beforeEach(() => {
  attributes.clear();
  const browserWindow = new EventTarget() as EventTarget & {
    setTimeout: typeof window.setTimeout;
    clearTimeout: typeof window.clearTimeout;
  };
  browserWindow.setTimeout = ((handler: TimerHandler, timeout?: number) => (
    globalThis.setTimeout(handler as (...args: unknown[]) => void, timeout) as unknown as number
  )) as typeof window.setTimeout;
  browserWindow.clearTimeout = ((timer?: number) => {
    globalThis.clearTimeout(timer);
  }) as typeof window.clearTimeout;

  vi.stubGlobal('window', browserWindow);
  vi.stubGlobal('document', {
    documentElement: {
      getAttribute: (name: string) => attributes.get(name) || null,
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
    },
  });
  vi.stubGlobal('CustomEvent', TestCustomEvent);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Gran extension discovery bridge', () => {
  it('detects an extension that announced itself before React mounted', async () => {
    attributes.set(MARKER_ATTRIBUTE, '1.0.13');

    await expect(detectGranCollector(20)).resolves.toEqual({
      detected: true,
      version: '1.0.13',
    });
  });

  it('actively asks a loaded content script to announce itself again', async () => {
    const announce = () => {
      window.dispatchEvent(new CustomEvent(READY_EVENT, {
        detail: { version: '1.0.13' },
      }));
    };
    window.addEventListener(DISCOVER_EVENT, announce, { once: true });

    await expect(detectGranCollector(100)).resolves.toEqual({
      detected: true,
      version: '1.0.13',
    });
  });

  it('reports absence only after discovery and marker checks fail', async () => {
    await expect(detectGranCollector(10)).resolves.toEqual({
      detected: false,
      version: '',
    });
  });
});
