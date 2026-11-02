import type { SizePresetId } from '@/types/project';

export interface SafeZone {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

/**
 * Regions (in slide units) that platform UI typically covers. Approximate by
 * design — platforms change their chrome — but good enough to keep text clear.
 */
export function safeZones(sizeId: SizePresetId, width: number, height: number): SafeZone[] {
  switch (sizeId) {
    case 'story':
    case 'tiktok':
      return [
        { x: 0, y: 0, width, height: height * 0.13, label: 'Profile & close buttons' },
        { x: 0, y: height * 0.8, width, height: height * 0.2, label: 'Caption & reply bar' },
        ...(sizeId === 'tiktok'
          ? [{ x: width * 0.84, y: height * 0.36, width: width * 0.16, height: height * 0.44, label: 'Action buttons' }]
          : []),
      ];
    case 'ig-portrait': {
      // Profile grids show a centred 3:4 crop of 4:5 posts.
      const cropW = (height * 3) / 4;
      const side = Math.max(0, (width - cropW) / 2);
      return side > 1
        ? [
            { x: 0, y: 0, width: side, height, label: 'Cropped in grid' },
            { x: width - side, y: 0, width: side, height, label: '' },
          ]
        : [];
    }
    case 'yt-thumbnail':
      return [{ x: width * 0.84, y: height * 0.86, width: width * 0.14, height: height * 0.1, label: 'Timestamp' }];
    default:
      return [];
  }
}
