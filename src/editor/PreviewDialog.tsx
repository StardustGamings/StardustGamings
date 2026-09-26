'use client';

import { CarouselPreview } from '@/components/carousel/CarouselPreview';
import { Dialog } from '@/components/ui/Dialog';
import { useUi } from '@/settings/ui-store';
import { useSettings } from '@/settings/store';
import { selectDoc, useEditor } from './store';

/** Full-screen swipe preview of the design being edited. */
export function PreviewDialog() {
  const open = useUi((s) => s.carouselPreview);
  const setOpen = useUi((s) => s.setCarouselPreview);
  const doc = useEditor(selectDoc);
  const name = useSettings((s) => s.displayName);
  if (!doc) return null;
  const aspect = doc.slideWidth / doc.slideHeight;
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="md"
      title="Swipe preview"
      description="Swipe, drag or use the arrow keys — this is how the carousel flows in a feed."
    >
      <div className="mx-auto" style={{ width: `min(100%, calc((72dvh - 110px) * ${aspect}))` }}>
        {open && <CarouselPreview doc={doc} handle={name?.trim() ? name.trim().toLowerCase().replace(/\s+/g, '.') : 'you'} />}
      </div>
    </Dialog>
  );
}
