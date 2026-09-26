import { defineTemplate, linear } from './kit';

/** Thumbnails, collages, posters and moodboards. */
export const wide = [
  /* ───────────── Thumbnails (1280×720) ───────────── */
  defineTemplate(
    {
      id: 'versus',
      animate: 'playful',
      name: 'Versus',
      format: 'thumbnail',
      sizeId: 'yt-thumbnail',
      style: 'bold',
      description: 'Two sides, a diagonal split and a VS badge — built for comparison videos.',
      tags: ['versus', 'comparison', 'youtube', 'challenge', 'bold'],
      palette: ['#FF3B3B', '#2F6BFF', '#FFFFFF', '#111111', '#FFE14D'],
      background: '#2F6BFF',
    },
    ({ text, rect, ellipse, photo }) => {
      rect({ x: -200, y: -300, w: 1040, h: 1400, rot: 12, fill: '#FF3B3B' });
      photo({ x: 60, y: 150, w: 480, h: 520, radius: 28, rot: -3, fill: '#FF8080', stroke: { color: '#FFFFFF', width: 10 } });
      photo({ x: 740, y: 150, w: 480, h: 520, radius: 28, rot: 3, fill: '#7FA3FF', stroke: { color: '#FFFFFF', width: 10 } });
      text('$10 vs $100', {
        x: 40,
        y: 20,
        w: 1200,
        size: 120,
        font: 'Anton',
        color: '#FFFFFF',
        align: 'center',
        upper: true,
        stroke: { color: '#111111', width: 10 },
      });
      ellipse({ x: 540, y: 330, w: 200, h: 200, fill: '#FFE14D', stroke: { color: '#111111', width: 8 } });
      text('VS', {
        x: 540,
        y: 330,
        w: 200,
        h: 200,
        size: 96,
        font: 'Anton',
        color: '#111111',
        align: 'center',
        valign: 'middle',
      });
    },
  ),

  defineTemplate(
    {
      id: 'tried-it',
      name: 'I Tried It',
      format: 'thumbnail',
      sizeId: 'yt-thumbnail',
      style: 'playful',
      description: 'Loud yellow, a huge claim and an arrow pointing at your face.',
      tags: ['challenge', 'reaction', 'youtube', 'experiment', 'yellow'],
      palette: ['#FFD400', '#111111', '#FFFFFF', '#FF3B3B'],
      background: '#FFD400',
    },
    ({ text, photo, sticker }) => {
      photo({ x: 720, y: 40, w: 520, h: 640, radius: 36, fill: '#F2B800', stroke: { color: '#111111', width: 10 } });
      text('I tried it\nfor 30\ndays', {
        x: 50,
        y: 50,
        w: 640,
        size: 150,
        font: 'Anton',
        upper: true,
        color: '#111111',
        lh: 0.9,
      });
      sticker('vector:arrow-bold', { x: 520, y: 470, size: 200, rot: -20, tint: '#FF3B3B' });
      text('(it changed everything)', { x: 50, y: 610, w: 640, size: 40, font: 'Permanent Marker', color: '#FF3B3B' });
    },
  ),

  defineTemplate(
    {
      id: 'slow-vlog',
      name: 'Slow Vlog',
      format: 'thumbnail',
      sizeId: 'yt-thumbnail',
      style: 'cinematic',
      description: 'A quiet full-frame thumbnail: soft gradient, italic serif title, small episode tag.',
      tags: ['vlog', 'travel', 'slow living', 'youtube', 'cinematic'],
      palette: ['#1A1714', '#FFFFFF', '#E9DCC8', '#7D6B58'],
      background: '#1A1714',
    },
    ({ text, rect, photo }) => {
      photo({ x: 0, y: 0, w: 1280, h: 720, fill: '#7D6B58', look: 'film', intensity: 70 });
      rect({ x: 0, y: 0, w: 760, h: 720, fill: linear(90, 'rgba(26,23,20,0.75)', 'rgba(26,23,20,0)') });
      text('Vlog 12', { x: 70, y: 200, w: 400, size: 26, font: 'Manrope', weight: 700, ls: 0.3, upper: true, color: '#E9DCC8' });
      text('a slow week\nin lisbon', {
        x: 64,
        y: 250,
        w: 700,
        size: 120,
        font: 'Instrument Serif',
        italic: true,
        color: '#FFFFFF',
        lh: 0.92,
      });
    },
  ),

  /* ───────────── Collages (1080×1080) ───────────── */
  defineTemplate(
    {
      id: 'nine-grid',
      name: 'Nine Grid',
      format: 'collage',
      sizeId: 'ig-square',
      style: 'minimal',
      description: 'Nine photos in a tidy three-by-three grid with hairline gutters.',
      tags: ['grid', 'collage', 'photo dump', 'minimal', 'nine'],
      palette: ['#FFFFFF', '#E6E3DE', '#DAD6CF', '#111111'],
      background: '#FFFFFF',
    },
    ({ photo }) => {
      const g = 12;
      const cell = (1080 - g * 4) / 3;
      const tones = ['#E6E3DE', '#DAD6CF', '#E1DDD6'];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++)
          photo({ x: g + c * (cell + g), y: g + r * (cell + g), w: cell, h: cell, fill: tones[(r + c) % 3]! });
      }
    },
  ),

  defineTemplate(
    {
      id: 'taped-strips',
      name: 'Taped Strips',
      format: 'collage',
      sizeId: 'ig-square',
      style: 'scrapbook',
      description: 'Tall photo strips taped side by side under a torn-paper title.',
      tags: ['scrapbook', 'tape', 'collage', 'journal', 'torn paper'],
      palette: ['#E8E1D3', '#2B2622', '#F7F2E8', '#C7B79C'],
      background: '#E8E1D3',
    },
    ({ text, photo, sticker, tornPaper }) => {
      const rots = [-3, 2, -1.5, 3];
      rots.forEach((rot, i) => {
        photo({
          x: 60 + i * 245,
          y: 260,
          w: 225,
          h: 740,
          rot,
          fill: i % 2 ? '#C7B79C' : '#D3C4A8',
          shadow: { color: 'rgba(43,38,34,0.2)', blur: 18, x: 0, y: 6 },
        });
        sticker('vector:tape', { x: 110 + i * 245, y: 215, size: 120, rot: rot * 3, tint: '#F7F2E8' });
      });
      tornPaper({ x: 140, y: 50, w: 800, h: 150, color: '#F7F2E8', tooth: 34 });
      text('field notes', { x: 160, y: 62, w: 760, size: 100, font: 'Caveat', weight: 700, color: '#2B2622', align: 'center' });
    },
  ),

  /* ───────────── Posters (1240×1754) ───────────── */
  defineTemplate(
    {
      id: 'swiss-poster',
      name: 'Swiss Poster',
      format: 'poster',
      sizeId: 'poster',
      style: 'brutalist',
      description: 'A strict grid, a red circle and stacked grotesk type — international style, remixed.',
      tags: ['swiss', 'poster', 'grid', 'typography', 'event'],
      palette: ['#E9E4DA', '#111111', '#E63A26', '#BDB6A8'],
      background: '#E9E4DA',
    },
    ({ text, rect, ellipse, photo }) => {
      ellipse({ x: 520, y: 180, w: 640, h: 640, fill: '#E63A26' });
      photo({ x: 640, y: 300, w: 400, h: 400, clip: 'ellipse', fill: '#C94A38', look: 'monochrome' });
      text('Form\nfollows\nfeed', {
        x: 60,
        y: 820,
        w: 1120,
        size: 212,
        font: 'Archivo',
        weight: 900,
        upper: true,
        lh: 0.86,
        ls: -0.03,
      });
      rect({ x: 60, y: 1560, w: 1120, h: 4, fill: '#111111' });
      text('Talks\nWorkshops\nParty', { x: 60, y: 1590, w: 360, size: 30, font: 'Archivo', weight: 700, lh: 1.2 });
      text('Hall 4\nFri 17 Oct\n19:00', { x: 440, y: 1590, w: 360, size: 30, font: 'Archivo', weight: 700, lh: 1.2 });
      text('Free\nentry', { x: 820, y: 1590, w: 360, size: 30, font: 'Archivo', weight: 700, lh: 1.2, color: '#E63A26' });
      text('Design week 26', { x: 60, y: 80, w: 460, size: 30, font: 'Archivo', weight: 700, upper: true });
    },
  ),

  defineTemplate(
    {
      id: 'loud-hours',
      animate: 'glitchy',
      name: 'Loud Hours',
      format: 'poster',
      sizeId: 'poster',
      style: 'streetwear',
      description: 'A gig poster: high-contrast photo, blackletter headline and a tour list.',
      tags: ['gig', 'concert', 'poster', 'music', 'tour'],
      palette: ['#0E0E0E', '#F1F1F1', '#FF2D2D', '#3A3A3A'],
      background: '#0E0E0E',
    },
    ({ text, rect, photo }) => {
      photo({
        x: 0,
        y: 0,
        w: 1240,
        h: 1000,
        fill: '#3A3A3A',
        look: 'monochrome',
        intensity: 100,
        adjust: { contrast: 20, grain: 20 },
      });
      rect({ x: 0, y: 700, w: 1240, h: 300, fill: linear(180, 'rgba(14,14,14,0)', '#0E0E0E') });
      text('Loud Hours', { x: 40, y: 830, w: 1160, size: 220, font: 'UnifrakturMaguntia', color: '#F1F1F1', align: 'center' });
      rect({ x: 60, y: 1110, w: 1120, h: 12, fill: '#FF2D2D' });
      const dates = ['10.02  Lisbon', '10.05  Berlin', '10.09  London', '10.12  Paris', '10.16  Your city?'];
      dates.forEach((d, i) =>
        text(d, {
          x: 60,
          y: 1160 + i * 88,
          w: 1120,
          size: 58,
          font: 'Archivo',
          weight: 800,
          upper: true,
          color: i === 4 ? '#FF2D2D' : '#F1F1F1',
        }),
      );
      text('World tour 2026', {
        x: 60,
        y: 1620,
        w: 1120,
        size: 30,
        font: 'Archivo',
        weight: 700,
        ls: 0.4,
        upper: true,
        color: '#8A8A8A',
        align: 'center',
      });
    },
  ),

  defineTemplate(
    {
      id: 'still-life',
      name: 'Still Life',
      format: 'poster',
      sizeId: 'poster',
      style: 'luxury',
      description: 'A gallery exhibition poster: arch photo, fine rules and an italic serif title.',
      tags: ['exhibition', 'gallery', 'art', 'poster', 'elegant'],
      palette: ['#F1ECE3', '#1F1B16', '#A8875A', '#DCD3C4'],
      background: '#F1ECE3',
    },
    ({ text, rect, photo }) => {
      rect({ x: 50, y: 50, w: 1140, h: 1654, fill: null, stroke: { color: '#1F1B16', width: 2 } });
      text('Galerie Nord — Autumn exhibition', {
        x: 100,
        y: 110,
        w: 1040,
        size: 26,
        font: 'Manrope',
        weight: 600,
        ls: 0.3,
        upper: true,
        color: '#A8875A',
        align: 'center',
      });
      photo({ x: 320, y: 220, w: 600, h: 820, clip: 'arch', fill: '#DCD3C4' });
      text('Still Life,\nMoving', {
        x: 100,
        y: 1110,
        w: 1040,
        size: 150,
        font: 'Playfair Display',
        italic: true,
        color: '#1F1B16',
        align: 'center',
        lh: 0.95,
      });
      rect({ x: 570, y: 1440, w: 100, h: 2, fill: '#A8875A' });
      text('12 September — 30 November', {
        x: 100,
        y: 1480,
        w: 1040,
        size: 34,
        font: 'Playfair Display',
        color: '#1F1B16',
        align: 'center',
      });
      text('Open daily · free entry', {
        x: 100,
        y: 1560,
        w: 1040,
        size: 24,
        font: 'Manrope',
        weight: 600,
        ls: 0.3,
        upper: true,
        color: '#1F1B16',
        align: 'center',
      });
    },
  ),

  /* ───────────── Moodboards (1600×1200) ───────────── */
  defineTemplate(
    {
      id: 'coastal-mood',
      name: 'Coastal Mood',
      format: 'moodboard',
      sizeId: 'moodboard',
      style: 'editorial',
      description: 'An asymmetric board with photos, colour swatches with HEX codes and a type pairing.',
      tags: ['moodboard', 'palette', 'branding', 'coastal', 'editorial'],
      palette: ['#F4F1EC', '#1F2A30', '#8FB3C2', '#D9C6A8', '#C46A4E'],
      background: '#F4F1EC',
    },
    ({ text, ellipse, photo }) => {
      text('Moodboard — Coastal autumn', {
        x: 60,
        y: 50,
        w: 900,
        size: 34,
        font: 'Playfair Display',
        italic: true,
        color: '#1F2A30',
      });
      photo({ x: 60, y: 120, w: 520, h: 680, fill: '#CAD8DE' });
      photo({ x: 600, y: 120, w: 440, h: 330, fill: '#E3D6C1' });
      photo({ x: 600, y: 470, w: 210, h: 330, fill: '#D3B8A9' });
      photo({ x: 830, y: 470, w: 210, h: 330, fill: '#BFD0D6' });
      photo({ x: 1060, y: 120, w: 480, h: 560, fill: '#D9C6A8' });
      const swatches = ['#1F2A30', '#8FB3C2', '#D9C6A8', '#C46A4E'];
      swatches.forEach((c, i) => {
        ellipse({ x: 60 + i * 150, y: 850, w: 120, h: 120, fill: c, stroke: { color: '#FFFFFF', width: 4 } });
        text(c, {
          x: 50 + i * 150,
          y: 990,
          w: 140,
          size: 20,
          font: 'JetBrains Mono',
          weight: 600,
          color: '#1F2A30',
          align: 'center',
        });
      });
      text('Aa', { x: 700, y: 820, w: 220, size: 170, font: 'Playfair Display', italic: true, color: '#1F2A30', lh: 1 });
      text('Playfair Display\nitalic headlines', {
        x: 700,
        y: 1030,
        w: 300,
        size: 22,
        font: 'Manrope',
        weight: 600,
        color: '#5B6870',
        lh: 1.3,
      });
      text('Aa', { x: 1060, y: 820, w: 220, size: 170, font: 'Manrope', weight: 700, color: '#C46A4E', lh: 1 });
      text('Manrope\nfor everything else', {
        x: 1060,
        y: 1030,
        w: 300,
        size: 22,
        font: 'Manrope',
        weight: 600,
        color: '#5B6870',
        lh: 1.3,
      });
      text('salt · linen · rust', {
        x: 1060,
        y: 700,
        w: 480,
        size: 44,
        font: 'Caveat',
        weight: 700,
        color: '#1F2A30',
        align: 'right',
      });
    },
  ),

  defineTemplate(
    {
      id: 'pinned-board',
      name: 'Pinned Board',
      format: 'moodboard',
      sizeId: 'moodboard',
      style: 'scrapbook',
      description: 'A cork board of pinned prints and sticky notes for planning trips, outfits or shoots.',
      tags: ['moodboard', 'cork', 'planning', 'sticky notes', 'scrapbook'],
      palette: ['#C9A27E', '#FBFAF7', '#FFE680', '#2B2530', '#E4574B'],
      background: '#C9A27E',
    },
    ({ text, rect, ellipse, polaroid }) => {
      polaroid({ x: 80, y: 90, w: 360, rot: -6, caption: 'the spot', fill: '#D9C1A6' });
      polaroid({ x: 520, y: 150, w: 330, rot: 4, caption: 'outfit idea', fill: '#CDB297' });
      polaroid({ x: 1160, y: 80, w: 360, rot: 7, caption: 'golden hour', fill: '#D4BCA0' });
      polaroid({ x: 900, y: 600, w: 330, rot: -4, caption: 'must eat here', fill: '#D9C1A6' });
      const note = (x: number, y: number, rot: number, body: string, color: string) => {
        rect({ x, y, w: 300, h: 300, rot, fill: color, shadow: { color: 'rgba(43,37,48,0.25)', blur: 16, x: 0, y: 8 } });
        text(body, { x: x + 24, y: y + 30, w: 252, h: 250, size: 44, font: 'Caveat', weight: 700, color: '#2B2530', rot, lh: 1 });
      };
      note(160, 680, 3, 'pack:\n- film\n- linen shirt\n- sunscreen', '#FFE680');
      note(560, 700, -5, 'leave at 6am\n(for real)', '#FFC2D1');
      note(1280, 620, 5, 'budget:\nvibes', '#BFE7FF');
      for (const [x, y] of [
        [250, 100],
        [680, 160],
        [1330, 90],
        [1060, 610],
        [300, 690],
        [700, 710],
        [1420, 630],
      ] as const) {
        ellipse({ x, y, w: 30, h: 30, fill: '#E4574B', shadow: { color: 'rgba(0,0,0,0.3)', blur: 6, x: 2, y: 3 } });
      }
    },
  ),
];
