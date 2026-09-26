'use client';

import { ArrowLeft, Check, Copy, Download, ImagePlus, PenLine, Replace, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { ScenePreview } from '@/canvas/ScenePreview';
import { CarouselPreview } from '@/components/carousel/CarouselPreview';
import { PhotoChooser } from '@/components/magic/PhotoChooser';
import { useCreateProject } from '@/components/projects/useCreateProject';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/components/ui/toast-store';
import { useEditor } from '@/editor/store';
import { addTemplateToDesign, isBlank, replaceDesign } from '@/editor/template-actions';
import { FORMATS } from '@/projects/formats';
import { useSettings } from '@/settings/store';
import { useUi, type TemplatePreviewRequest } from '@/settings/ui-store';
import { describeTemplate } from '@/templates/describe';
import { instantiateTemplate } from '@/templates/instantiate';
import type { Template } from '@/templates/registry';
import { STYLE_LABELS } from '@/templates/schema';
import { restoreUserTemplate, useTemplateLibrary, useTemplates } from '@/templates/store';
import { useTrends } from '@/trends/store';
import { cn } from '@/utils/cn';
import { exportTemplate } from './template-files';

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-bold tracking-[0.12em] text-fg-subtle uppercase">{children}</p>;
}

function Swatches({ colors, className }: { colors: string[]; className?: string }) {
  return (
    <span className={cn('flex overflow-hidden rounded-full border border-line', className)} aria-hidden>
      {colors.slice(0, 6).map((c, i) => (
        <span key={`${c}-${i}`} className="h-full flex-1" style={{ background: c }} />
      ))}
    </span>
  );
}

export function TemplatePreview({ doc, className }: { doc: Template['doc']; className?: string }) {
  const name = useSettings((s) => s.displayName);
  const handle = name?.trim() ? name.trim().toLowerCase().replace(/\s+/g, '.') : 'you';
  return doc.slides.length > 1 ? (
    <CarouselPreview doc={doc} handle={handle} className={className} />
  ) : (
    <div
      className={cn('overflow-hidden rounded-[18px] border border-line shadow-[var(--shadow-lift)]', className)}
      data-testid="template-preview"
    >
      <ScenePreview doc={doc} slide={0} eager label="Template preview" />
    </div>
  );
}

function Body({ request, template, onClose }: { request: TemplatePreviewRequest; template: Template; onClose: () => void }) {
  const createProject = useCreateProject();
  const pack = useTrends((s) => s.pack);
  const editorDoc = useEditor((s) => s.history?.present ?? null);
  const updateUser = useTemplateLibrary((s) => s.updateUser);
  const duplicateUser = useTemplateLibrary((s) => s.duplicateUser);
  const removeUser = useTemplateLibrary((s) => s.removeUser);
  const openTemplate = useUi((s) => s.openTemplate);

  const [step, setStep] = useState<'preview' | 'photos'>('preview');
  const [photos, setPhotos] = useState<string[]>([]);
  const [paletteId, setPaletteId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(template.name);
  const [busy, setBusy] = useState(false);

  const facts = useMemo(() => describeTemplate(template.doc), [template]);
  const colourways = pack.palettes.slice(0, 8);
  const palette = colourways.find((p) => p.id === paletteId)?.colors;
  const preview = useMemo(
    () => instantiateTemplate(template, { palette: pack.palettes.find((p) => p.id === paletteId)?.colors, photos }),
    [template, pack.palettes, paletteId, photos],
  );
  const inEditor = request.target === 'editor' && editorDoc !== null;
  const blank = editorDoc ? isBlank(editorDoc) : true;
  const mine = template.source === 'user';
  const format = FORMATS[template.format];
  const slidesLabel = `${facts.slides} slide${facts.slides === 1 ? '' : 's'}`;

  const use = async () => {
    const options = { palette, photos };
    if (inEditor) {
      if (addTemplateToDesign(template, options)) {
        toast({
          title: blank ? `Started from “${template.name}”` : `Added ${slidesLabel} from “${template.name}”`,
          tone: 'success',
          duration: 2600,
        });
        onClose();
      }
      return;
    }
    setBusy(true);
    try {
      const meta = await createProject({
        name: template.name,
        format: template.format,
        sizeId: template.sizeId,
        doc: preview,
        ...(mine ? {} : { templateId: template.id }),
      });
      if (meta) onClose();
    } finally {
      setBusy(false);
    }
  };

  const replace = () => {
    if (replaceDesign(template, { palette, photos })) {
      toast({
        title: `Replaced with “${template.name}”`,
        description: 'Undo brings your design back.',
        tone: 'success',
        duration: 3000,
      });
      onClose();
    }
  };

  const remove = async () => {
    const removed = await removeUser(template.id);
    onClose();
    if (removed) {
      toast({
        title: `Deleted “${removed.name}”`,
        action: { label: 'Undo', onClick: () => void restoreUserTemplate(removed) },
      });
    }
  };

  const primaryLabel = inEditor ? (blank ? 'Use template' : `Add ${slidesLabel}`) : 'Use template';
  const withPhotosLabel = photos.length
    ? `${primaryLabel} · ${photos.length} photo${photos.length === 1 ? '' : 's'}`
    : primaryLabel;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="xl"
      title={template.name}
      description={
        step === 'photos'
          ? `Pick up to ${facts.photoSlots} photos — they fill the frames in order.`
          : template.description || undefined
      }
      footer={
        step === 'photos' ? (
          <>
            <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => setStep('preview')}>
              Back
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={photos.length === 0}
              onClick={() => void use()}
              data-testid="template-use"
            >
              {photos.length ? withPhotosLabel : 'Pick photos'}
            </Button>
          </>
        ) : (
          <>
            {inEditor && !blank && (
              <Button variant="ghost" icon={<Replace className="size-4" />} onClick={replace}>
                Replace design
              </Button>
            )}
            {facts.photoSlots > 0 && (
              <Button
                icon={<ImagePlus className="size-4" />}
                onClick={() => setStep('photos')}
                data-testid="template-with-photos"
              >
                {photos.length ? 'Change photos' : 'Use with my photos'}
              </Button>
            )}
            <Button variant="primary" loading={busy} onClick={() => void use()} data-testid="template-use">
              {photos.length ? withPhotosLabel : primaryLabel}
            </Button>
          </>
        )
      }
    >
      {step === 'photos' ? (
        <PhotoChooser selected={photos} onChange={setPhotos} max={facts.photoSlots} />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[360px]">
            <TemplatePreview doc={preview} />
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-wrap gap-1.5">
              <Badge>{format.label}</Badge>
              <Badge>
                {facts.width}×{facts.height}
              </Badge>
              <Badge>{slidesLabel}</Badge>
              {facts.photoSlots > 0 && (
                <Badge>
                  {facts.photoSlots} photo frame{facts.photoSlots === 1 ? '' : 's'}
                </Badge>
              )}
              <Badge tone="accent">{STYLE_LABELS[template.style]}</Badge>
              {mine && <Badge tone="accent">Yours</Badge>}
            </div>

            {mine && (
              <div className="flex flex-col gap-2 rounded-[16px] border border-line p-3">
                {renaming ? (
                  <form
                    className="flex items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void updateUser(template.id, { name });
                      setRenaming(false);
                    }}
                  >
                    <TextField
                      label="Template name"
                      value={name}
                      maxLength={60}
                      autoFocus
                      onChange={(e) => setName(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="submit" variant="primary" icon={<Check className="size-4" />}>
                      Save
                    </Button>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="ghost" icon={<PenLine className="size-4" />} onClick={() => setRenaming(true)}>
                      Rename
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Copy className="size-4" />}
                      onClick={async () => {
                        const copy = await duplicateUser(template.id);
                        if (copy) openTemplate(copy.id, request.target);
                      }}
                    >
                      Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Download className="size-4" />}
                      onClick={() => void exportTemplate(template)}
                    >
                      Export file
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => void remove()}>
                      Delete
                    </Button>
                  </div>
                )}
                {template.keepsPhotos && (
                  <p className="flex items-center gap-1.5 text-[11.5px] text-fg-subtle">
                    <ShieldCheck className="size-3.5 shrink-0 text-success" />
                    Includes your photos. They stay on this device and are left out of exported files.
                  </p>
                )}
              </div>
            )}

            {template.palette.length > 1 && (
              <div>
                <Label>Colourway</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Colourway">
                  {[{ id: null, name: 'Original', colors: template.palette }, ...colourways].map((p) => (
                    <button
                      key={p.id ?? 'original'}
                      type="button"
                      role="radio"
                      aria-checked={paletteId === p.id}
                      onClick={() => setPaletteId(p.id)}
                      className={cn(
                        'flex flex-col gap-1.5 rounded-[12px] border p-2 text-left transition-colors',
                        paletteId === p.id ? 'border-accent bg-accent/10' : 'border-line hover:border-line-strong',
                      )}
                    >
                      <Swatches colors={p.colors} className="h-4" />
                      <span className="truncate text-[12px] font-semibold">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Fonts</Label>
              <p className="text-[13px] text-fg-muted">{facts.fonts.length ? facts.fonts.join(' · ') : 'No text'}</p>
            </div>
            {facts.looks.length > 0 && (
              <div>
                <Label>Photo filters</Label>
                <p className="text-[13px] text-fg-muted">
                  {facts.looks.join(' · ')} — your photos get the look automatically; change it any time.
                </p>
              </div>
            )}

            <p className="text-[12px] leading-relaxed text-fg-subtle">
              {inEditor
                ? blank
                  ? 'Your design is empty, so the template takes its place — scaled to your canvas.'
                  : 'Slides go in after the one you’re on, scaled to your canvas. One undo takes them out again.'
                : 'Everything stays editable: swap photos, change text, move things around.'}
            </p>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Preview a template, pick a colourway and optional photos, then use it. */
export function TemplatePreviewDialog() {
  const request = useUi((s) => s.templatePreview);
  const close = useUi((s) => s.closeTemplate);
  if (!request) return null;
  return <Loader request={request} onClose={close} />;
}

function Loader({ request, onClose }: { request: TemplatePreviewRequest; onClose: () => void }) {
  const { bundled, user, status, userStatus } = useTemplates();
  const template = user.find((t) => t.id === request.id) ?? bundled.find((t) => t.id === request.id);
  if (template) return <Body key={`${template.id}-${request.target}`} request={request} template={template} onClose={onClose} />;
  const loading = status === 'loading' || status === 'idle' || userStatus === 'loading' || userStatus === 'idle';
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={loading ? 'Loading template' : 'Template not found'}
      size="sm"
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner label="Loading template" />
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          It may have been deleted, or the template library couldn’t load. Try again in a moment.
        </p>
      )}
    </Dialog>
  );
}
