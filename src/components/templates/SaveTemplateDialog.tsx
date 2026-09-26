'use client';

import { ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { DesignDocument } from '@/types/document';
import type { ProjectMeta } from '@/types/project';
import { useAssets } from '@/assets/store';
import { useEditor } from '@/editor/store';
import { getProject } from '@/projects/repository';
import { useUi, type SaveTemplateRequest } from '@/settings/ui-store';
import { TEMPLATE_CATALOG } from '@/templates/registry';
import { STYLE_LABELS, TEMPLATE_STYLES, type TemplateStyle } from '@/templates/schema';
import { useTemplateLibrary } from '@/templates/store';
import { buildUserTemplate, stripPhotos } from '@/templates/user';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/components/ui/toast-store';
import { cn } from '@/utils/cn';
import { stickerAssetIds } from './template-files';
import { TemplatePreview } from './TemplatePreviewDialog';

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-bold tracking-[0.12em] text-fg-subtle uppercase">
      {children}
    </label>
  );
}

function Form({ meta, doc, onClose }: { meta: ProjectMeta; doc: DesignDocument; onClose: () => void }) {
  const router = useRouter();
  const saveUser = useTemplateLibrary((s) => s.saveUser);
  const assets = useAssets((s) => s.assets);
  const loadAssets = useAssets((s) => s.load);
  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const startedFrom = TEMPLATE_CATALOG.find((t) => t.id === meta.templateId);
  const [name, setName] = useState(meta.name);
  const [style, setStyle] = useState<TemplateStyle>(startedFrom?.style ?? 'editorial');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [keepPhotos, setKeepPhotos] = useState(false);
  const [busy, setBusy] = useState(false);

  const stickers = useMemo(() => new Set(assets.filter((a) => a.kind === 'sticker').map((a) => a.id)), [assets]);
  const photoCount = doc.elements.filter((e) => e.type === 'image' && e.assetId && !stickers.has(e.assetId)).length;
  const preview = useMemo(() => (keepPhotos ? doc : stripPhotos(doc, { keep: stickers })), [doc, keepPhotos, stickers]);

  const save = async () => {
    setBusy(true);
    try {
      const template = buildUserTemplate({
        name,
        description,
        style,
        tags: tags.split(','),
        format: meta.format,
        sizeId: meta.sizeId,
        doc,
        keepPhotos,
        stickerAssetIds: stickerAssetIds(),
      });
      await saveUser(template);
      onClose();
      toast({
        title: `Saved “${template.name}” to your templates`,
        description: 'Find it under Templates → Yours, or in the editor’s Templates panel.',
        tone: 'success',
        action: { label: 'View', onClick: () => router.push('/templates/?tab=yours') },
      });
    } catch {
      toast({
        title: 'Couldn’t save that template',
        description: 'Your browser storage might be full. Free up space in Settings → Storage and try again.',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="xl"
      title="Save as template"
      description="Reuse this design any time — it’s saved on this device with your other templates."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!name.trim()}
            onClick={() => void save()}
            data-testid="save-template"
          >
            Save template
          </Button>
        </>
      }
    >
      <form
        className="grid gap-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void save();
        }}
      >
        <div className="mx-auto w-full max-w-[300px]">
          <TemplatePreview doc={preview} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <TextField label="Template name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <div>
            <Label>Style</Label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Style">
              {TEMPLATE_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={style === s}
                  onClick={() => setStyle(s)}
                  className={cn(
                    'h-8 rounded-full border px-3 text-[12px] font-semibold transition-colors',
                    style === s
                      ? 'border-transparent bg-fg text-bg'
                      : 'border-line text-fg-muted hover:border-accent hover:text-fg',
                  )}
                >
                  {STYLE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <TextField
            label="Tags"
            placeholder="travel, summer, photo dump"
            value={tags}
            maxLength={200}
            onChange={(e) => setTags(e.target.value)}
            hint="Optional — separate with commas. They help search."
          />
          <TextField
            label="Description"
            placeholder="What’s it for?"
            value={description}
            maxLength={240}
            onChange={(e) => setDescription(e.target.value)}
          />
          {photoCount > 0 && (
            <div className="flex items-start gap-3 rounded-[16px] border border-line p-3">
              <Switch id="keep-photos" checked={keepPhotos} onCheckedChange={setKeepPhotos} aria-describedby="keep-photos-hint" />
              <div>
                <label htmlFor="keep-photos" className="text-[13.5px] font-semibold">
                  Keep my photos in the template
                </label>
                <p id="keep-photos-hint" className="mt-0.5 text-[12px] leading-snug text-fg-muted">
                  {keepPhotos
                    ? `The ${photoCount} photo${photoCount === 1 ? '' : 's'} stay in the template. They never leave this device and are left out if you export the template file.`
                    : `Off: the ${photoCount} photo${photoCount === 1 ? '' : 's'} become empty frames — same shape, border and look — ready for new photos.`}
                </p>
              </div>
            </div>
          )}
          <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-fg-subtle">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-success" />
            Templates are stored in this browser, like your projects. Nothing is uploaded.
          </p>
        </div>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

function ProjectLoader({
  request,
  onClose,
}: {
  request: Extract<SaveTemplateRequest, { source: 'project' }>;
  onClose: () => void;
}) {
  const [project, setProject] = useState<{ meta: ProjectMeta; doc: DesignDocument } | null | 'missing'>(null);
  useEffect(() => {
    let alive = true;
    void getProject(request.projectId).then((p) => alive && setProject(p ?? 'missing'));
    return () => {
      alive = false;
    };
  }, [request.projectId]);
  if (project && project !== 'missing') return <Form meta={project.meta} doc={project.doc} onClose={onClose} />;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Save as template" size="sm">
      {project === 'missing' ? (
        <p className="text-sm text-fg-muted">That project couldn’t be found.</p>
      ) : (
        <div className="flex justify-center py-8">
          <Spinner label="Loading project" />
        </div>
      )}
    </Dialog>
  );
}

function EditorSource({ onClose }: { onClose: () => void }) {
  const meta = useEditor((s) => s.meta);
  // Snapshot the design when the dialog opens.
  const [doc] = useState(() => useEditor.getState().history?.present ?? null);
  if (!meta || !doc) return null;
  return <Form meta={meta} doc={doc} onClose={onClose} />;
}

/** "Save as template" — from the editor, a project card or the command palette. */
export function SaveTemplateDialog() {
  const request = useUi((s) => s.saveTemplate);
  const close = useUi((s) => s.closeSaveTemplate);
  if (!request) return null;
  return request.source === 'editor' ? <EditorSource onClose={close} /> : <ProjectLoader request={request} onClose={close} />;
}
