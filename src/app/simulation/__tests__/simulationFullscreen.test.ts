import { describe, expect, it, vi } from 'vitest';
import {
  exitSimulationFullscreen,
  getSimulationFullscreenElement,
  requestSimulationFullscreen,
} from '../simulationFullscreen';

const createDocument = () => {
  const root = {} as HTMLElement;
  const documentRef = {
    documentElement: root,
    fullscreenElement: null,
  } as unknown as Document;

  return { documentRef, root };
};

describe('simulationFullscreen', () => {
  it('requests native fullscreen when the browser supports it', async () => {
    const { documentRef, root } = createDocument();
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.assign(root, { requestFullscreen });

    await expect(requestSimulationFullscreen(documentRef)).resolves.toBe(true);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('falls back cleanly when native fullscreen is unavailable', async () => {
    const { documentRef } = createDocument();

    await expect(requestSimulationFullscreen(documentRef)).resolves.toBe(false);
  });

  it('supports webkit fullscreen implementations', async () => {
    const { documentRef, root } = createDocument();
    const webkitRequestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.assign(root, { webkitRequestFullscreen });

    await expect(requestSimulationFullscreen(documentRef)).resolves.toBe(true);
    expect(webkitRequestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('exits the active native fullscreen session', async () => {
    const { documentRef, root } = createDocument();
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.assign(documentRef, { fullscreenElement: root, exitFullscreen });

    expect(getSimulationFullscreenElement(documentRef)).toBe(root);
    await expect(exitSimulationFullscreen(documentRef)).resolves.toBe(true);
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });
});
