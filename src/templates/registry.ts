import type { DesignDocument } from '@/types/document';
import type { FormatId } from '@/types/project';
import { templateSchema, type TemplateDefinition } from './schema';

import bigTypeDrop from './library/carousel/big-type-drop.json';
import softEditorial from './library/carousel/soft-editorial.json';
import filmStrip from './library/carousel/film-strip.json';
import scrapbookDump from './library/carousel/scrapbook-dump.json';
import brutalStats from './library/carousel/brutal-stats.json';
import y2kChrome from './library/post/y2k-chrome.json';
import newsprint from './library/post/newsprint.json';
import quietLuxury from './library/post/quiet-luxury.json';
import memeCaption from './library/post/meme-caption.json';
import cyberGrid from './library/thumbnail/cyber-grid.json';
import dreamyStory from './library/story/dreamy-story.json';
import reelCoverPop from './library/reel-cover/reel-cover-pop.json';
import moodboardBento from './library/moodboard/moodboard-bento.json';
import nightOutPoster from './library/poster/night-out-poster.json';
import splitCollage from './library/collage/split-collage.json';

export type Template = TemplateDefinition & { doc: DesignDocument };

/**
 * Bundled templates ship with the app so they work offline. Each JSON file is
 * validated on load — a malformed template is skipped rather than crashing the UI.
 */
const RAW: unknown[] = [
  bigTypeDrop,
  softEditorial,
  filmStrip,
  scrapbookDump,
  brutalStats,
  y2kChrome,
  newsprint,
  quietLuxury,
  memeCaption,
  cyberGrid,
  dreamyStory,
  reelCoverPop,
  moodboardBento,
  nightOutPoster,
  splitCollage,
];

function load(): Template[] {
  const out: Template[] = [];
  for (const raw of RAW) {
    const parsed = templateSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data as Template);
    else if (process.env.NODE_ENV !== 'production') console.warn('Invalid template skipped', parsed.error.issues[0]);
  }
  return out;
}

export const TEMPLATES: Template[] = load();

const byId = new Map(TEMPLATES.map((t) => [t.id, t]));

export const getTemplate = (id: string): Template | undefined => byId.get(id);

export const templatesForFormat = (format: FormatId): Template[] => TEMPLATES.filter((t) => t.format === format);
