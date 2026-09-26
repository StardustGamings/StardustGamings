/// Decodes and downscales imported photos off the main thread.
import { serveWorker } from '@/utils/worker-rpc';
import { offscreenFactory, processImage, type ProcessInput, type ProcessOutput } from './process-core';

serveWorker<ProcessInput, ProcessOutput>(async (input) => ({ value: await processImage(input, offscreenFactory) }));
