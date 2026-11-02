'use client';

import { useSettings } from '@/settings/store';
import { findBundledFont } from '@/typography/fonts';
import { localBackgrounds } from './backgrounds';
import { localCaptions } from './captions';
import { AI_ENDPOINT, AiServerError, callAiServer } from './cloud';
import { suggestPairings } from './fonts';
import { planCarousel, validPlan } from './layout';
import type {
  BackgroundConcept,
  BackgroundRequest,
  CaptionRequest,
  CaptionResult,
  FontPairing,
  FontRequest,
  LayoutPlan,
  LayoutRequest,
} from './schemas';

/**
 * One entry point per AI tool. Every tool works on the device; when an AI
 * server is set up for this site and turned on in Settings, it's asked first
 * and the device version answers if it can't. Results say where they came
 * from, so the UI can label them honestly.
 */

export type AiSource = 'device' | 'server';

export interface AiAnswer<T> {
  result: T;
  source: AiSource;
  /** Why the server wasn't used, when it was supposed to be. */
  notice?: string;
}

/** The AI server exists for this build. */
export const aiServerConfigured = () => AI_ENDPOINT !== '';

/** The AI server exists and the person turned it on. */
export const aiServerEnabled = () => aiServerConfigured() && useSettings.getState().privacy.cloudFeatures;

async function withServer<T>(ask: () => Promise<T>, local: () => T, useServer: boolean): Promise<AiAnswer<T>> {
  if (!useServer || !aiServerEnabled()) return { result: local(), source: 'device' };
  try {
    return { result: await ask(), source: 'server' };
  } catch (e) {
    const notice =
      e instanceof AiServerError ? `${e.message} Used the on-device version instead.` : 'Used the on-device version instead.';
    return { result: local(), source: 'device', notice };
  }
}

export const writeCaptions = (request: CaptionRequest, seed: number, useServer = true) =>
  withServer<CaptionResult>(
    () => callAiServer('caption', request),
    () => localCaptions(request, seed),
    useServer,
  );

export const pairFonts = (request: FontRequest, useServer = true) =>
  withServer<FontPairing[]>(
    async () => {
      const { pairings } = await callAiServer('fonts', request);
      // Only fonts this app bundles (so designs render offline and export the same).
      const ok = pairings.filter((p) => findBundledFont(p.heading) && findBundledFont(p.body));
      if (!ok.length) throw new AiServerError('invalid');
      return ok;
    },
    () => suggestPairings(request),
    useServer,
  );

export const backgroundIdeas = (request: BackgroundRequest, seed: number, useServer = true) =>
  withServer<BackgroundConcept[]>(
    async () => (await callAiServer('background', request)).concepts,
    () => localBackgrounds(request, seed),
    useServer,
  );

export const planLayout = (request: LayoutRequest, useServer = true) =>
  withServer<LayoutPlan>(
    async () => {
      const plan = validPlan(await callAiServer('layout', request), request);
      if (!plan) throw new AiServerError('invalid');
      return plan;
    },
    () => planCarousel(request),
    useServer,
  );
