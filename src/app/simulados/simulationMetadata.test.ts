import { describe, expect, it } from 'vitest';
import { buildSimulationMetadata, buildSimulationsDirectoryMetadata } from './simulationMetadata';
import type { PublicSimulationDetail } from './simulationServerData';

const item = { id:1,slug:'simulado-publico',title:'Simulado Público',description:null,durationMinutes:60,questionCount:1,availabilityStatus:'available',path:'/simulados/simulado-publico',updatedAt:null,canonicalPath:'/simulados/simulado-publico',instructions:null,isAttemptAvailable:true,practicePath:'/simulation',questions:[],taxonomies:[],contests:[],exams:[],breadcrumbs:[],readiness:{status:'READY',reasonCodes:[]} } satisfies PublicSimulationDetail;

describe('public simulation metadata', () => {
  it('uses persisted canonical identity', () => {
    expect(buildSimulationMetadata(item).alternates?.canonical).toBe('/simulados/simulado-publico');
  });

  it('keeps NOT_READY details noindex even in production', () => {
    process.env.SEO_LAUNCH_MODE = 'PRODUCTION';
    const metadata = buildSimulationMetadata({ ...item, readiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.invalid_definition'] } });
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    delete process.env.SEO_LAUNCH_MODE;
  });

  it('cleans filtered hub canonicals and marks them noindex', () => {
    const metadata = buildSimulationsDirectoryMetadata({ busca: 'fiscal', foo: 'bar' });
    expect(metadata.alternates?.canonical).toBe('/simulados');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it('keeps pagination variants noindex with the clean hub canonical', () => {
    process.env.SEO_LAUNCH_MODE = 'PRODUCTION';
    const metadata = buildSimulationsDirectoryMetadata({ pagina: '2' });
    expect(metadata.alternates?.canonical).toBe('/simulados');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    delete process.env.SEO_LAUNCH_MODE;
  });
});
