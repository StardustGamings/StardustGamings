import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EditorScreen } from '@/editor/EditorScreen';

export const metadata: Metadata = { title: 'Editor' };

export default function EditorPage() {
  return (
    <Suspense>
      <EditorScreen />
    </Suspense>
  );
}
