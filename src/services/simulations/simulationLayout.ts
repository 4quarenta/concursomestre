export const SIMULATION_IMMERSIVE_EVENT = 'simulation-immersive-change';

export const isSimulationImmersivePath = (pathname: string, search: string): boolean => (
  pathname.startsWith('/simulation')
  && new URLSearchParams(search).get('immersive') === '1'
);
