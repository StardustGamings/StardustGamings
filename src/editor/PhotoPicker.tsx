'use client';

import { useEffect, useRef } from 'react';
import { usePicker, type PickerRequest } from './file-picker';
import { importAndPlace, importStickers } from './photo-actions';

/** Hidden file input behind every "Add photo" / "Replace" button in the editor. */
export function PhotoPicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const request = useRef<PickerRequest>({});
  const register = usePicker((s) => s.register);

  useEffect(() => {
    register((r) => {
      const input = inputRef.current;
      if (!input) return;
      request.current = r;
      input.multiple = !r.single;
      input.accept = r.kind === 'sticker' ? 'image/png,image/webp,image/gif,image/svg+xml' : 'image/*';
      input.value = '';
      input.click();
    });
    return () => register(null);
  }, [register]);

  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      hidden
      data-testid="photo-input"
      onChange={(e) => {
        const files = [...(e.currentTarget.files ?? [])];
        e.currentTarget.value = '';
        if (files.length === 0) return;
        const r = request.current;
        if (r.kind === 'sticker') void importStickers(files);
        else void importAndPlace(files, { targetId: r.targetId ?? null });
      }}
    />
  );
}
