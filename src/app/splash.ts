import { screens } from './splash-screens.json';

/**
 * iOS launch screens for the installed app, one per device size (and orientation on iPad),
 * matched by media query. The images come from `npm run icons`.
 */
export const startupImages = screens.flatMap((s) => {
  const portrait = { w: s.width * s.ratio, h: s.height * s.ratio };
  const device = `screen and (device-width: ${s.width}px) and (device-height: ${s.height}px) and (-webkit-device-pixel-ratio: ${s.ratio})`;
  const images = [{ url: `/splash/splash-${portrait.w}x${portrait.h}.png`, media: `${device} and (orientation: portrait)` }];
  if ('ipad' in s && s.ipad)
    images.push({ url: `/splash/splash-${portrait.h}x${portrait.w}.png`, media: `${device} and (orientation: landscape)` });
  return images;
});
