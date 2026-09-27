import type { TemplateDefinition } from '../schema';
export { authoringWarnings } from './kit';
import { carousels } from './carousels';
import { formats } from './formats';
import { singles } from './singles';
import { wide } from './wide';

/** Every template written with the authoring kit (see scripts/build-templates.mjs). */
export function buildAuthoredTemplates(): TemplateDefinition[] {
  return [...carousels, ...singles, ...wide, ...formats];
}
