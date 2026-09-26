/// Develops photos on the CPU for browsers without WebGL.
import { serveWorker } from '@/utils/worker-rpc';
import { developCpu, type CpuDevelopInput, type Pixels } from './develop-cpu';

serveWorker<CpuDevelopInput, Pixels>(async (input) => {
  const out = developCpu(input);
  return { value: out, transfer: [out.data.buffer] };
});
