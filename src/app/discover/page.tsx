import type { Metadata } from 'next';
import { DiscoverView } from '@/components/discover/DiscoverView';

export const metadata: Metadata = { title: 'Discover' };

export default function DiscoverPage() {
  return (
    <div className="pt-4">
      <DiscoverView />
    </div>
  );
}
