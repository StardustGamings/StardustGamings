'use client';

import { TextPanel, ShapesPanel, StickersPanel } from './panels/AddPanels';
import { AnimatePanel, FiltersPanel, LayoutsPanel, MagicPanel, PhotosPanel, TemplatesPanel, TrendsPanel } from './lazy';
import { BackgroundPanel } from './panels/DocumentPanels';
import { LayersPanel } from './panels/LayersPanel';
import { PropertiesPanel } from './panels/PropertiesPanel';
import type { PanelId } from './store';

export const PANEL_TITLES: Record<PanelId, string> = {
  templates: 'Templates',
  text: 'Text',
  shapes: 'Shapes',
  stickers: 'Stickers',
  photos: 'Photos',
  filters: 'Filters',
  layouts: 'Layouts',
  animate: 'Animate',
  trends: 'Trends',
  magic: 'Magic',
  design: 'Background',
  layers: 'Layers',
  properties: 'Edit',
};

/** The body of a tool panel, shared by the desktop flyout and the phone sheet. */
export function PanelContent({ panel }: { panel: PanelId }) {
  switch (panel) {
    case 'templates':
      return <TemplatesPanel />;
    case 'text':
      return <TextPanel />;
    case 'shapes':
      return <ShapesPanel />;
    case 'stickers':
      return <StickersPanel />;
    case 'photos':
      return <PhotosPanel />;
    case 'filters':
      return <FiltersPanel />;
    case 'layouts':
      return <LayoutsPanel />;
    case 'animate':
      return <AnimatePanel />;
    case 'trends':
      return <TrendsPanel />;
    case 'magic':
      return <MagicPanel />;
    case 'design':
      return <BackgroundPanel />;
    case 'layers':
      return <LayersPanel />;
    case 'properties':
      return <PropertiesPanel />;
  }
}
