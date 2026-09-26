import type { Metadata } from 'next';
import { TemplateBrowser } from '@/components/templates/TemplateBrowser';
import { TEMPLATE_CATALOG } from '@/templates/registry';

export const metadata: Metadata = { title: 'Templates' };

export default function TemplatesPage() {
  return (
    <>
      <header className="pt-4 pb-8">
        <p className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-accent-text uppercase">Original · free · offline</p>
        <h1 className="text-4xl font-extrabold sm:text-5xl">Templates</h1>
        <p className="mt-2 max-w-xl text-sm text-fg-muted">
          {TEMPLATE_CATALOG.length} original templates ship with the app, so they work offline. Preview any of them as a swipe,
          try another colourway, drop your photos in — and save your own designs as templates too.
        </p>
      </header>
      <TemplateBrowser />
    </>
  );
}
