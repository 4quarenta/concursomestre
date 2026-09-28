import { describe, expect, it } from 'vitest';
import { isSimulationImmersivePath } from '../simulationLayout';

describe('simulation immersive navigation state', () => {
  it('hides app navigation only while a simulation route requests immersive mode', () => {
    expect(isSimulationImmersivePath('/simulation', '?immersive=1')).toBe(true);
    expect(isSimulationImmersivePath('/simulation/abc', 'immersive=1')).toBe(true);
    expect(isSimulationImmersivePath('/simulation', '?immersive=0')).toBe(false);
    expect(isSimulationImmersivePath('/questions', '?immersive=1')).toBe(false);
  });
});
