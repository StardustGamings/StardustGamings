import type { Metadata } from 'next';
import { TemplateBrowser } from '@/components/templates/TemplateBrowser';
import { TEMPLATE_CATALOG } from '@/templates/registry';

export const metadata: Metadata = { title: 'Templates' };

export default function TemplatesPage() {
  return (
    <>
      <header className="pb-6">
        <h1 className="text-display">Templates</h1>
        <p className="mt-2 max-w-xl text-caption">
          {TEMPLATE_CATALOG.length} originals, all offline. Preview one as a swipe, try another colourway, drop your photos in.
        </p>
      </header>
      <TemplateBrowser />
    </>
  );
}
