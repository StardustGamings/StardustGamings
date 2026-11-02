import {
  Clapperboard,
  GalleryHorizontalEnd,
  LayoutDashboard,
  LayoutGrid,
  MonitorPlay,
  Smartphone,
  Square,
  StickyNote,
  type LucideProps,
} from 'lucide-react';
import type { FormatId } from '@/types/project';

const ICONS: Record<FormatId, React.ComponentType<LucideProps>> = {
  carousel: GalleryHorizontalEnd,
  story: Smartphone,
  post: Square,
  'reel-cover': Clapperboard,
  thumbnail: MonitorPlay,
  collage: LayoutGrid,
  poster: StickyNote,
  moodboard: LayoutDashboard,
};

export function FormatIcon({ format, ...props }: { format: FormatId } & LucideProps) {
  const Icon = ICONS[format];
  return <Icon aria-hidden {...props} />;
}
