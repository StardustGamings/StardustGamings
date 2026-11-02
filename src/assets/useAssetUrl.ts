'use client';

import { useEffect, useState } from 'react';
import { getAssetBlob } from './repository';
import type { AssetVariant } from './types';

/** Object URL for a stored asset variant (revoked on unmount). */
export function useAssetUrl(id: string | null | undefined, variant: AssetVariant = 'thumb'): string | null {
  const [state, setState] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let url: string | null = null;
    void getAssetBlob(id, variant).then((blob) => {
      if (!alive || !blob) return;
      url = URL.createObjectURL(blob);
      setState({ id, url });
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, variant]);
  return state && state.id === id ? state.url : null;
}
