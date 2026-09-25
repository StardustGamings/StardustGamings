import { Circle, Image as ImageIcon, Minus, MoveRight, Smile, Square, Star, Triangle, Type, Hexagon } from 'lucide-react';
import type { DesignElement } from '@/types/document';

export function ElementIcon({ el, className }: { el: DesignElement; className?: string }) {
  switch (el.type) {
    case 'text':
      return <Type className={className} aria-hidden />;
    case 'image':
      return <ImageIcon className={className} aria-hidden />;
    case 'sticker':
      return <Smile className={className} aria-hidden />;
    case 'shape': {
      const Icon = {
        rect: Square,
        ellipse: Circle,
        triangle: Triangle,
        star: Star,
        polygon: Hexagon,
        line: Minus,
        arrow: MoveRight,
      }[el.shape];
      return <Icon className={className} aria-hidden />;
    }
  }
}
