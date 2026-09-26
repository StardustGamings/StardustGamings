import { defineTemplate, linear } from './kit';

const shade = { color: 'rgba(10,6,20,0.35)', blur: 28, x: 0, y: 6 };

export const carousels = [
  defineTemplate(
    {
      id: 'magazine-issue',
      name: 'The Issue',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'editorial',
      description: 'A four-page magazine: cover, contents, a feature spread and a back page.',
      tags: ['magazine', 'editorial', 'cover', 'fashion'],
      palette: ['#F3EEE6', '#16120F', '#D7342A', '#B9AE9E'],
      slides: 4,
      background: '#F3EEE6',
      slideFills: [null, null, null, '#16120F'],
    },
    ({ sx, text, rect, ellipse, line, photo }) => {
      // Cover
      photo({ x: 0, y: 0, w: 1080, h: 1350, fill: '#CFC4B4' });
      text('No. 07 — Autumn 2026 — The Swipe Issue', {
        x: 60,
        y: 44,
        w: 960,
        size: 22,
        font: 'Manrope',
        weight: 700,
        ls: 0.12,
        upper: true,
        color: '#F3EEE6',
        shadow: shade,
      });
      text('Midnight', {
        x: 50,
        y: 70,
        w: 980,
        size: 218,
        font: 'Playfair Display',
        weight: 900,
        italic: true,
        color: '#F3EEE6',
        lh: 1,
        shadow: shade,
      });
      text('The new rules\nof posting', {
        x: 60,
        y: 980,
        w: 640,
        size: 70,
        font: 'Playfair Display',
        italic: true,
        color: '#F3EEE6',
        lh: 1.02,
        shadow: shade,
      });
      ellipse({ x: 810, y: 900, w: 210, h: 210, fill: '#D7342A', rot: -8 });
      text('10\nPAGES\nINSIDE', {
        x: 810,
        y: 900,
        w: 210,
        h: 210,
        size: 30,
        font: 'Archivo',
        weight: 800,
        color: '#F3EEE6',
        align: 'center',
        valign: 'middle',
        lh: 1.02,
        rot: -8,
      });
      text('Swipe to read →', {
        x: 60,
        y: 1260,
        w: 960,
        size: 22,
        font: 'Manrope',
        weight: 800,
        ls: 0.2,
        upper: true,
        color: '#F3EEE6',
        shadow: shade,
      });

      // Contents
      const c = sx(1);
      text('Contents', { x: c + 70, y: 70, w: 940, size: 120, font: 'Playfair Display', weight: 900 });
      line(c + 70, 230, 940, '#16120F', 4);
      const items = ['Main character energy', 'Slow mornings, loud outfits', 'The group chat decides', 'Notes from the feed'];
      items.forEach((title, i) => {
        const y = 290 + i * 200;
        text(`0${i + 1}`, { x: c + 70, y, w: 120, size: 64, font: 'Archivo', weight: 800, color: '#D7342A' });
        text(title, { x: c + 200, y: y + 6, w: 380, size: 40, font: 'Playfair Display', lh: 1.08 });
        text(`page ${i * 3 + 4}`, {
          x: c + 200,
          y: y + 110,
          w: 380,
          size: 20,
          font: 'Manrope',
          weight: 700,
          ls: 0.14,
          upper: true,
          color: '#8C8272',
        });
      });
      photo({ x: c + 640, y: 290, w: 370, h: 520, fill: '#B9AE9E' });
      text('On the cover: you, obviously.', {
        x: c + 640,
        y: 830,
        w: 370,
        size: 30,
        font: 'Instrument Serif',
        italic: true,
        lh: 1.15,
      });
      text('02', { x: c + 70, y: 1250, w: 940, size: 22, font: 'Manrope', weight: 700, ls: 0.2, color: '#8C8272' });

      // Feature
      const f = sx(2);
      photo({ x: f, y: 0, w: 1080, h: 740, fill: '#CFC4B4' });
      text('Feature', {
        x: f + 70,
        y: 780,
        w: 600,
        size: 22,
        font: 'Manrope',
        weight: 800,
        ls: 0.24,
        upper: true,
        color: '#D7342A',
      });
      text('Everyone is a main\ncharacter now', {
        x: f + 70,
        y: 820,
        w: 940,
        size: 72,
        font: 'Playfair Display',
        weight: 900,
        lh: 1.02,
      });
      text(
        'Somewhere between the group chat and the grid, posting stopped being a highlight reel and became a diary. The best carousels read like a short story — a hook, a middle, and one slide you screenshot.',
        { x: f + 70, y: 1010, w: 600, size: 27, font: 'Instrument Serif', lh: 1.3 },
      );
      rect({ x: f + 700, y: 1016, w: 2, h: 250, fill: '#16120F' });
      text('“Post like no one is counting.”', {
        x: f + 730,
        y: 1010,
        w: 290,
        size: 42,
        font: 'Playfair Display',
        italic: true,
        color: '#D7342A',
        lh: 1.08,
      });

      // Back page
      const b = sx(3);
      photo({ x: b + 240, y: 150, w: 600, h: 780, clip: 'arch', fill: '#3A332D' });
      text('See you next issue', {
        x: b + 60,
        y: 990,
        w: 960,
        size: 76,
        font: 'Playfair Display',
        italic: true,
        color: '#F3EEE6',
        align: 'center',
      });
      rect({ x: b + 490, y: 1130, w: 100, h: 3, fill: '#D7342A' });
      text('Save this · send it to a friend', {
        x: b + 60,
        y: 1170,
        w: 960,
        size: 24,
        font: 'Manrope',
        weight: 700,
        ls: 0.16,
        upper: true,
        color: '#B9AE9E',
        align: 'center',
      });
    },
  ),

  defineTemplate(
    {
      id: 'five-tips',
      name: 'Five Tips',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'minimal',
      description: 'A clean educational carousel: a big-number cover, one tip per slide and a save-this ending.',
      tags: ['tips', 'educational', 'list', 'creator', 'business'],
      palette: ['#F6F3EE', '#111111', '#FF5A36', '#FFFFFF'],
      slides: 5,
      background: '#F6F3EE',
    },
    ({ sx, text, rect, ellipse, photo, sticker }) => {
      text('5', { x: 50, y: 20, w: 600, size: 600, font: 'Anton', color: '#FF5A36', lh: 1 });
      text('things I wish\nI knew before\nposting', {
        x: 70,
        y: 690,
        w: 940,
        size: 96,
        font: 'Bricolage Grotesque',
        weight: 800,
        lh: 0.98,
        ls: -0.02,
      });
      text('@yourhandle', { x: 70, y: 1240, w: 500, size: 26, font: 'Manrope', weight: 700 });
      text('Swipe →', { x: 610, y: 1240, w: 400, size: 26, font: 'Manrope', weight: 800, align: 'right', color: '#FF5A36' });

      const tips = [
        [
          'Hook them on\nslide one',
          'Lead with the payoff. A bold claim or a big number stops the scroll better than a pretty intro.',
        ],
        ['One idea\nper slide', 'Give every slide one job. If you need a second sentence, you probably need a second slide.'],
        [
          'End with a\nreason to save',
          'Close with a checklist, a recap or a question. Saves and shares tell the feed your post is worth showing.',
        ],
      ];
      tips.forEach(([title, body], i) => {
        const x = sx(i + 1);
        rect({
          x: x + 60,
          y: 60,
          w: 960,
          h: 1230,
          fill: '#FFFFFF',
          radius: 48,
          shadow: { color: 'rgba(17,17,17,0.08)', blur: 40, x: 0, y: 12 },
        });
        ellipse({ x: x + 120, y: 130, w: 130, h: 130, fill: '#FF5A36' });
        text(`0${i + 1}`, {
          x: x + 120,
          y: 130,
          w: 130,
          h: 130,
          size: 48,
          font: 'Bricolage Grotesque',
          weight: 800,
          color: '#FFFFFF',
          align: 'center',
          valign: 'middle',
        });
        text(`${i + 1}`, {
          x: x + 520,
          y: 790,
          w: 440,
          h: 480,
          size: 480,
          font: 'Anton',
          color: '#F4EFE8',
          align: 'right',
          lh: 1,
        });
        text(title!, { x: x + 120, y: 360, w: 840, size: 92, font: 'Bricolage Grotesque', weight: 800, lh: 0.98, ls: -0.02 });
        text(body!, { x: x + 120, y: 630, w: 800, size: 42, font: 'Manrope', weight: 500, lh: 1.4, color: '#3A3A3A' });
        text(`0${i + 2} / 05`, {
          x: x + 120,
          y: 1170,
          w: 840,
          size: 24,
          font: 'Manrope',
          weight: 700,
          ls: 0.1,
          color: '#9A948A',
        });
      });

      const e = sx(4);
      photo({ x: e + 390, y: 150, w: 300, h: 300, clip: 'ellipse', fill: '#E6DED3' });
      text('Save this\nfor later', {
        x: e + 70,
        y: 520,
        w: 940,
        size: 120,
        font: 'Bricolage Grotesque',
        weight: 800,
        lh: 0.95,
        align: 'center',
        ls: -0.02,
      });
      sticker('vector:bookmark', { x: e + 470, y: 840, size: 140, tint: '#FF5A36' });
      text('Follow for more small wins', {
        x: e + 70,
        y: 1060,
        w: 940,
        size: 34,
        font: 'Manrope',
        weight: 600,
        align: 'center',
        color: '#3A3A3A',
      });
      text('@yourhandle', {
        x: e + 70,
        y: 1120,
        w: 940,
        size: 30,
        font: 'Manrope',
        weight: 800,
        align: 'center',
        color: '#FF5A36',
      });
    },
  ),

  defineTemplate(
    {
      id: 'polaroid-wall',
      name: 'Polaroid Wall',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'scrapbook',
      description: 'Instant prints taped across three slides — some hang over the edge so the swipe feels continuous.',
      tags: ['polaroid', 'scrapbook', 'photo dump', 'summer', 'seamless'],
      palette: ['#EADBC4', '#2B2530', '#F4E7B8', '#E86A5A'],
      slides: 3,
      background: '#EADBC4',
    },
    ({ sx, text, polaroid, sticker }) => {
      text('summer\nlately', {
        x: 80,
        y: 80,
        w: 480,
        size: 150,
        font: 'Caveat',
        weight: 700,
        color: '#2B2530',
        lh: 0.85,
        rot: -5,
      });
      polaroid({ x: 560, y: 120, w: 420, rot: 6, caption: 'golden hour', fill: '#D8C3A6' });
      polaroid({ x: 90, y: 600, w: 460, rot: -5, caption: 'road trip!', fill: '#CDB79A' });
      polaroid({ x: 820, y: 560, w: 460, rot: 4, caption: 'best day', fill: '#D2BFA4' });
      polaroid({ x: sx(1) + 420, y: 90, w: 440, rot: -7, caption: 'the crew', fill: '#C9B394' });
      polaroid({ x: sx(1) + 470, y: 740, w: 420, rot: 5, caption: 'late swims', fill: '#D6C2A7' });
      polaroid({ x: 1910, y: 380, w: 460, rot: -3, caption: 'sunburnt', fill: '#CFB89B' });
      polaroid({ x: sx(2) + 470, y: 120, w: 430, rot: 8, caption: 'no signal', fill: '#D9C6AC' });
      text('more soon', { x: sx(2) + 100, y: 1020, w: 600, size: 120, font: 'Caveat', weight: 700, color: '#2B2530', rot: -4 });
      sticker('vector:tape', { x: 690, y: 70, size: 150, rot: 10, tint: '#F4E7B8' });
      sticker('vector:tape', { x: 250, y: 560, size: 140, rot: -12, tint: '#F4E7B8' });
      sticker('vector:tape', { x: 990, y: 505, size: 150, rot: 6, tint: '#F4E7B8' });
      sticker('vector:tape', { x: sx(1) + 560, y: 50, size: 140, rot: -8, tint: '#F4E7B8' });
      sticker('vector:tape', { x: 2060, y: 330, size: 150, rot: 4, tint: '#F4E7B8' });
      sticker('vector:tape', { x: sx(2) + 610, y: 80, size: 140, rot: 12, tint: '#F4E7B8' });
      sticker('vector:heart', { x: sx(2) + 690, y: 1000, size: 150, rot: 10, tint: '#E86A5A' });
      sticker('vector:squiggle', { x: sx(1) + 80, y: 1120, size: 180, rot: -10, tint: '#2B2530' });
      sticker('vector:sparkle', { x: 420, y: 1180, size: 110, tint: '#E86A5A' });
    },
  ),

  defineTemplate(
    {
      id: 'cinema-frames',
      name: 'Cinema Frames',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'cinematic',
      description: 'A title card and widescreen stills with yellow subtitles — your trip, but make it a film.',
      tags: ['cinematic', 'film', 'travel', 'subtitles', 'moody'],
      palette: ['#0A0A0A', '#F2EDE4', '#FFE45C', '#8A857C'],
      slides: 4,
      background: '#0A0A0A',
    },
    ({ sx, text, line, photo }) => {
      text('A film by you', {
        x: 60,
        y: 440,
        w: 960,
        size: 22,
        font: 'Manrope',
        weight: 700,
        ls: 0.4,
        upper: true,
        color: '#BDB7AC',
        align: 'center',
      });
      text('Somewhere\nWarm', {
        x: 60,
        y: 500,
        w: 960,
        size: 150,
        font: 'Playfair Display',
        italic: true,
        color: '#F2EDE4',
        align: 'center',
        lh: 0.95,
      });
      line(440, 850, 200, '#8A857C', 2);
      text('In theatres never · swipe', {
        x: 60,
        y: 890,
        w: 960,
        size: 20,
        font: 'Manrope',
        weight: 700,
        ls: 0.3,
        upper: true,
        color: '#8A857C',
        align: 'center',
      });

      const lines = ['I think we were happy here.', 'Don’t look at the camera.', 'Some summers stay with you.'];
      lines.forEach((sub, i) => {
        const x = sx(i + 1);
        text(`00:${12 + i * 9}:48:0${i + 2}`, { x: x + 40, y: 400, w: 400, size: 20, font: 'JetBrains Mono', color: '#8A857C' });
        text(`Scene 0${i + 1}`, {
          x: x + 640,
          y: 400,
          w: 400,
          size: 20,
          font: 'JetBrains Mono',
          color: '#8A857C',
          align: 'right',
          upper: true,
        });
        photo({
          x,
          y: 449,
          w: 1080,
          h: 452,
          fill: '#2A2622',
          adjust: { contrast: 12, saturation: -18, fade: 12, grain: 22, temperature: 8 },
        });
        text(sub, {
          x: x + 60,
          y: 790,
          w: 960,
          size: 36,
          font: 'Manrope',
          weight: 600,
          color: '#FFE45C',
          align: 'center',
          shadow: { color: 'rgba(0,0,0,0.85)', blur: 6, x: 0, y: 2 },
        });
      });
    },
  ),

  defineTemplate(
    {
      id: 'diagonal-drop',
      name: 'Diagonal Drop',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'streetwear',
      description: 'An acid-lime band cuts diagonally through three slides of a streetwear lookbook.',
      tags: ['streetwear', 'diagonal', 'lookbook', 'fashion', 'seamless'],
      palette: ['#101010', '#D7FF3A', '#F5F5F0', '#2A2A2A'],
      slides: 3,
      background: '#101010',
    },
    ({ sx, text, rect, photo, sticker }) => {
      photo({ x: 540, y: 60, w: 480, h: 540, fill: '#2A2A2A' });
      text('Drop\n04', { x: 60, y: 50, w: 440, size: 210, font: 'Anton', color: '#F5F5F0', upper: true, lh: 0.9 });
      photo({ x: sx(1) + 80, y: 60, w: 540, h: 420, fill: '#333333' });
      text('Built\nfor the\nblock.', { x: sx(1) + 660, y: 70, w: 360, size: 96, font: 'Anton', color: '#F5F5F0', lh: 0.95 });
      photo({ x: sx(1) + 440, y: 840, w: 580, h: 450, fill: '#333333' });
      photo({ x: sx(2) + 60, y: 700, w: 580, h: 590, fill: '#2A2A2A' });
      text('Shop\nthe\ndrop', {
        x: sx(2) + 680,
        y: 690,
        w: 360,
        size: 150,
        font: 'Anton',
        color: '#D7FF3A',
        upper: true,
        lh: 0.9,
      });
      sticker('vector:arrow-bold', { x: sx(2) + 700, y: 1170, size: 120, tint: '#D7FF3A' });

      // The band runs the whole strip; its text repeats so every slide gets a piece.
      rect({ x: -200, y: 520, w: 3640, h: 260, rot: -8, fill: '#D7FF3A' });
      text('No days off — no days off — no days off', {
        x: -200,
        y: 555,
        w: 3640,
        h: 190,
        size: 170,
        font: 'Anton',
        upper: true,
        color: '#101010',
        align: 'center',
        valign: 'middle',
        lh: 1,
        rot: -8,
      });
      text('Fall / winter capsule', {
        x: 60,
        y: 1150,
        w: 700,
        size: 26,
        font: 'Manrope',
        weight: 800,
        ls: 0.3,
        upper: true,
        color: '#F5F5F0',
      });
      text('Swipe for the lookbook →', { x: 60, y: 1200, w: 700, size: 26, font: 'Manrope', weight: 600, color: '#9A9A94' });
    },
  ),

  defineTemplate(
    {
      id: 'sticker-board',
      name: 'Sticker Board',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'playful',
      description: 'Grid paper, bubbly frames and way too many stickers — a week recapped the fun way.',
      tags: ['stickers', 'cute', 'week', 'diary', 'gen-z'],
      palette: ['#FBF7F0', '#1C1530', '#FFD84D', '#FF7AB6', '#7AD3FF'],
      slides: 3,
      background: '#FBF7F0',
    },
    ({ sx, text, rect, photo, sticker }) => {
      for (let x = 90; x < 3240; x += 90) rect({ x, y: 0, w: 2, h: 1350, fill: '#E9E2F4', locked: true, name: 'Grid' });
      for (let y = 90; y < 1350; y += 90) rect({ x: 0, y, w: 3240, h: 2, fill: '#E9E2F4', locked: true, name: 'Grid' });

      text('my week in\nstickers', {
        x: 80,
        y: 90,
        w: 760,
        size: 104,
        font: 'Bricolage Grotesque',
        weight: 800,
        lh: 1.08,
        color: '#1C1530',
        highlight: { fill: '#FFD84D', padding: 18, radius: 22 },
      });
      photo({
        x: 120,
        y: 470,
        w: 560,
        h: 640,
        radius: 44,
        rot: -4,
        stroke: { color: '#FFFFFF', width: 18 },
        fill: '#F2D4E4',
        shadow: { color: 'rgba(28,21,48,0.18)', blur: 30, x: 0, y: 10 },
      });
      text('mon — thrifted everything', {
        x: 110,
        y: 1150,
        w: 700,
        size: 56,
        font: 'Caveat',
        weight: 700,
        color: '#1C1530',
        rot: -3,
      });
      photo({
        x: 860,
        y: 300,
        w: 440,
        h: 520,
        radius: 44,
        rot: 6,
        stroke: { color: '#FFFFFF', width: 18 },
        fill: '#D3ECF7',
        shadow: { color: 'rgba(28,21,48,0.18)', blur: 30, x: 0, y: 10 },
      });
      text('wed — new playlist', {
        x: sx(1) + 300,
        y: 860,
        w: 600,
        size: 56,
        font: 'Caveat',
        weight: 700,
        color: '#1C1530',
        rot: 3,
      });
      photo({
        x: sx(1) + 420,
        y: 1000,
        w: 380,
        h: 300,
        radius: 36,
        rot: -3,
        stroke: { color: '#FFFFFF', width: 16 },
        fill: '#FFE7A8',
        shadow: { color: 'rgba(28,21,48,0.18)', blur: 30, x: 0, y: 10 },
      });
      photo({
        x: sx(2) + 200,
        y: 160,
        w: 680,
        h: 760,
        radius: 48,
        rot: 3,
        stroke: { color: '#FFFFFF', width: 20 },
        fill: '#E3D8FF',
        shadow: { color: 'rgba(28,21,48,0.18)', blur: 30, x: 0, y: 10 },
      });
      text('sat — best day ever', {
        x: sx(2) + 180,
        y: 1010,
        w: 720,
        size: 64,
        font: 'Caveat',
        weight: 700,
        color: '#1C1530',
        align: 'center',
        rot: -2,
      });

      const stickers: [string, number, number, number, number, string][] = [
        ['vector:star', 880, 110, 130, 12, '#FFD84D'],
        ['vector:heart', 560, 430, 120, -12, '#FF7AB6'],
        ['vector:smiley', 700, 1000, 130, 8, '#FFD84D'],
        ['vector:daisy', 1180, 900, 150, -6, '#FF7AB6'],
        ['vector:lightning', sx(1) + 200, 380, 140, 10, '#7AD3FF'],
        ['vector:crown', sx(1) + 700, 150, 150, -8, '#FFD84D'],
        ['vector:speech', sx(1) + 120, 700, 150, 0, '#7AD3FF'],
        ['vector:pixel-heart', sx(1) + 840, 620, 120, 6, '#FF7AB6'],
        ['vector:checkmark', 2090, 1080, 130, -4, '#1C1530'],
        ['vector:sparkle', sx(2) + 840, 90, 140, 0, '#FFD84D'],
        ['vector:globe-y2k', sx(2) + 60, 900, 150, -10, '#7AD3FF'],
        ['vector:arrow-loop', sx(2) + 820, 1110, 150, 6, '#1C1530'],
      ];
      for (const [id, x, y, size, rot, tint] of stickers) sticker(id, { x, y, size, rot, tint });
    },
  ),

  defineTemplate(
    {
      id: 'torn-notes',
      name: 'Torn Notes',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'scrapbook',
      description: 'Torn paper scraps, tape and handwriting over your weekend photos.',
      tags: ['torn paper', 'scrapbook', 'journal', 'weekend', 'aesthetic'],
      palette: ['#CDBBA0', '#F7F2E8', '#2B2622', '#F2E3C9'],
      slides: 3,
      background: '#CDBBA0',
    },
    ({ sx, text, photo, sticker, tornPaper }) => {
      tornPaper({ x: 60, y: 120, w: 960, h: 340, color: '#F7F2E8', tooth: 36 });
      text('notes from\nthe weekend', {
        x: 110,
        y: 160,
        w: 860,
        size: 108,
        font: 'Fraunces',
        weight: 700,
        italic: true,
        color: '#2B2622',
        lh: 0.98,
      });
      photo({
        x: 150,
        y: 560,
        w: 780,
        h: 660,
        rot: -2,
        fill: '#B39F84',
        shadow: { color: 'rgba(43,38,34,0.25)', blur: 24, x: 0, y: 8 },
      });
      sticker('vector:tape', { x: 450, y: 500, size: 170, rot: -4, tint: '#F2E3C9' });

      photo({
        x: sx(1) + 60,
        y: 90,
        w: 600,
        h: 760,
        rot: 2,
        fill: '#BBA78B',
        shadow: { color: 'rgba(43,38,34,0.25)', blur: 24, x: 0, y: 8 },
      });
      photo({
        x: sx(1) + 690,
        y: 200,
        w: 330,
        h: 420,
        rot: -5,
        fill: '#AE9A7F',
        shadow: { color: 'rgba(43,38,34,0.25)', blur: 24, x: 0, y: 8 },
      });
      tornPaper({ x: sx(1) + 340, y: 930, w: 680, h: 230, color: '#F2E3C9', tooth: 34 });
      text('we got lost\non purpose', {
        x: sx(1) + 380,
        y: 950,
        w: 620,
        size: 76,
        font: 'Caveat',
        weight: 700,
        color: '#2B2622',
        lh: 0.95,
      });
      sticker('vector:tape', { x: sx(1) + 780, y: 150, size: 140, rot: 14, tint: '#F7F2E8' });

      tornPaper({ x: sx(2), y: 70, w: 1080, h: 170, color: '#F7F2E8', tooth: 36 });
      text('p.s. we’re going back', {
        x: sx(2) + 80,
        y: 105,
        w: 920,
        size: 64,
        font: 'Fraunces',
        italic: true,
        weight: 600,
        color: '#2B2622',
        align: 'center',
      });
      photo({
        x: sx(2) + 170,
        y: 350,
        w: 740,
        h: 740,
        rot: 1.5,
        fill: '#B8A488',
        shadow: { color: 'rgba(43,38,34,0.25)', blur: 24, x: 0, y: 8 },
      });
      sticker('vector:heart-outline', { x: sx(2) + 820, y: 1060, size: 150, rot: 12, tint: '#2B2622' });
      sticker('vector:scribble-circle', { x: sx(2) + 60, y: 1110, size: 170, rot: -8, tint: '#2B2622' });
    },
  ),

  defineTemplate(
    {
      id: 'then-and-now',
      name: 'Then & Now',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'minimal',
      description: 'Split-screen pairs — before and after, then and now — with clean labels.',
      tags: ['split screen', 'before after', 'glow up', 'comparison'],
      palette: ['#FFFFFF', '#111111', '#E9E9E9', '#FF4D2E'],
      slides: 3,
      background: '#FFFFFF',
    },
    ({ sx, text, photo }) => {
      const pill = { fill: '#FFFFFF', padding: 14, radius: 30 };
      for (let i = 0; i < 3; i++) {
        const x = sx(i);
        photo({
          x,
          y: 0,
          w: 1080,
          h: 671,
          fill: '#DADADA',
          adjust: i === 0 ? { saturation: -60, fade: 20 } : { saturation: -40, fade: 12 },
        });
        photo({ x, y: 679, w: 1080, h: 671, fill: '#C9C9C9' });
        if (i > 0) {
          text(i === 1 ? '2019' : 'Then', {
            x: x + 60,
            y: 560,
            w: 400,
            size: 30,
            font: 'Manrope',
            weight: 800,
            ls: 0.2,
            upper: true,
            highlight: pill,
          });
          text(i === 1 ? '2026' : 'Now', {
            x: x + 60,
            y: 1240,
            w: 400,
            size: 30,
            font: 'Manrope',
            weight: 800,
            ls: 0.2,
            upper: true,
            highlight: pill,
          });
        }
      }
      text('then\n& now', {
        x: 60,
        y: 420,
        w: 960,
        size: 220,
        font: 'Instrument Serif',
        italic: true,
        color: '#FFFFFF',
        align: 'center',
        lh: 0.82,
        shadow: shade,
      });
      text('Swipe to compare', {
        x: 60,
        y: 1240,
        w: 960,
        size: 28,
        font: 'Manrope',
        weight: 800,
        ls: 0.2,
        upper: true,
        color: '#FFFFFF',
        align: 'center',
        shadow: shade,
      });
    },
  ),

  defineTemplate(
    {
      id: 'month-recap',
      name: 'Month Recap',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'soft',
      description: 'A soft, blush photo diary: seven favourite moments and a list of the month’s best bits.',
      tags: ['recap', 'photo dump', 'monthly', 'aesthetic', 'soft'],
      palette: ['#F4E9E1', '#3A2C28', '#C9826B', '#FFFFFF'],
      slides: 4,
      background: '#F4E9E1',
    },
    ({ sx, text, rect, line, photo, sticker }) => {
      text('September\nrecap', { x: 70, y: 70, w: 940, size: 150, font: 'Fraunces', italic: true, color: '#3A2C28', lh: 0.92 });
      photo({ x: 300, y: 470, w: 480, h: 660, clip: 'arch', fill: '#E3CFC3' });
      text('30 days · 7 favourites', {
        x: 70,
        y: 1200,
        w: 940,
        size: 28,
        font: 'Manrope',
        weight: 600,
        ls: 0.12,
        upper: true,
        color: '#C9826B',
        align: 'center',
      });
      sticker('vector:twin-sparkle', { x: 800, y: 440, size: 130, tint: '#C9826B' });

      const b = sx(1);
      photo({ x: b + 70, y: 110, w: 560, h: 700, radius: 28, fill: '#E7D2C6' });
      photo({ x: b + 520, y: 620, w: 490, h: 620, radius: 28, stroke: { color: '#F4E9E1', width: 16 }, fill: '#DCC3B5' });
      text('first week\nof fall', {
        x: b + 70,
        y: 870,
        w: 420,
        size: 62,
        font: 'Fraunces',
        italic: true,
        color: '#3A2C28',
        lh: 1,
      });

      const c = sx(2);
      photo({ x: c + 60, y: 60, w: 960, h: 700, radius: 28, fill: '#E7D2C6' });
      photo({ x: c + 60, y: 790, w: 470, h: 500, radius: 28, fill: '#DCC3B5' });
      photo({ x: c + 550, y: 790, w: 470, h: 500, radius: 28, fill: '#E3CFC3' });
      text('little things', {
        x: c + 90,
        y: 680,
        w: 500,
        size: 30,
        font: 'Manrope',
        weight: 700,
        color: '#3A2C28',
        highlight: { fill: '#FFFFFF', padding: 14, radius: 24 },
      });

      const d = sx(3);
      photo({ x: d + 390, y: 90, w: 300, h: 300, clip: 'ellipse', fill: '#E3CFC3' });
      rect({ x: d + 90, y: 450, w: 900, h: 620, fill: '#FFFFFF', radius: 36 });
      const favs = [
        ['Song', 'the one on repeat'],
        ['Place', 'that corner café'],
        ['Moment', 'sunset from the roof'],
      ];
      favs.forEach(([k, v], i) => {
        const y = 510 + i * 180;
        text(`Favourite ${k!.toLowerCase()}`, {
          x: d + 150,
          y,
          w: 780,
          size: 24,
          font: 'Manrope',
          weight: 800,
          ls: 0.16,
          upper: true,
          color: '#C9826B',
        });
        text(v!, { x: d + 150, y: y + 40, w: 780, size: 52, font: 'Fraunces', italic: true, color: '#3A2C28' });
        if (i < 2) line(d + 150, y + 140, 780, '#EBDDD3', 2);
      });
      text('see you, October', {
        x: d + 90,
        y: 1130,
        w: 900,
        size: 64,
        font: 'Caveat',
        weight: 700,
        color: '#3A2C28',
        align: 'center',
      });
    },
  ),

  defineTemplate(
    {
      id: 'raw-files',
      name: 'Raw Files',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'brutalist',
      description: 'Hard rules, monospace captions and a red block — a brutalist portfolio in three slides.',
      tags: ['brutalist', 'portfolio', 'grid', 'architecture', 'design'],
      palette: ['#EDEDED', '#0A0A0A', '#FF2E00', '#BDBDBD'],
      slides: 3,
      background: '#EDEDED',
    },
    ({ sx, text, rect, photo }) => {
      for (let i = 0; i < 3; i++) {
        const x = sx(i);
        rect({ x: x + 40, y: 150, w: 1000, h: 6, fill: '#0A0A0A' });
        rect({ x: x + 40, y: 1190, w: 1000, h: 6, fill: '#0A0A0A' });
        text(`Index/0${i + 1}`, { x: x + 40, y: 80, w: 480, size: 26, font: 'JetBrains Mono', weight: 700, upper: true });
        text(`${i + 1}/3`, { x: x + 560, y: 80, w: 480, size: 26, font: 'JetBrains Mono', weight: 700, align: 'right' });
      }
      text('Raw\nfiles', { x: 30, y: 190, w: 1000, size: 300, font: 'Archivo', weight: 900, lh: 0.84, upper: true, ls: -0.03 });
      photo({
        x: 540,
        y: 740,
        w: 500,
        h: 420,
        stroke: { color: '#0A0A0A', width: 6 },
        fill: '#BDBDBD',
        adjust: { saturation: -100, contrast: 25 },
      });
      rect({ x: 40, y: 1040, w: 120, h: 120, fill: '#FF2E00' });
      text('(swipe)', { x: 40, y: 1230, w: 400, size: 28, font: 'JetBrains Mono', weight: 700 });

      const b = sx(1);
      photo({
        x: b + 40,
        y: 200,
        w: 1000,
        h: 640,
        stroke: { color: '#0A0A0A', width: 6 },
        fill: '#C4C4C4',
        adjust: { saturation: -100, contrast: 25 },
      });
      text('Fig. 02 — concrete, noon', { x: b + 40, y: 870, w: 620, size: 28, font: 'JetBrains Mono', upper: true });
      text('02', {
        x: b + 600,
        y: 870,
        w: 440,
        size: 300,
        font: 'Archivo',
        weight: 900,
        color: '#FF2E00',
        align: 'right',
        lh: 1,
      });
      text('Plan · Build · Break · Repeat', {
        x: b + 40,
        y: 1230,
        w: 1000,
        size: 28,
        font: 'JetBrains Mono',
        weight: 700,
        upper: true,
      });

      const c = sx(2);
      text('01  Concept\n02  Process\n03  Result\n04  Notes', {
        x: c + 40,
        y: 220,
        w: 560,
        size: 44,
        font: 'JetBrains Mono',
        weight: 700,
        lh: 1.5,
        upper: true,
      });
      photo({
        x: c + 620,
        y: 220,
        w: 420,
        h: 560,
        stroke: { color: '#0A0A0A', width: 6 },
        fill: '#BDBDBD',
        adjust: { saturation: -100, contrast: 25 },
      });
      rect({ x: c + 40, y: 860, w: 1000, h: 300, fill: '#0A0A0A' });
      text('End of file', {
        x: c + 70,
        y: 860,
        w: 940,
        h: 300,
        valign: 'middle',
        size: 118,
        font: 'Archivo',
        weight: 900,
        color: '#EDEDED',
        upper: true,
        lh: 1,
        ls: -0.02,
      });
      text('Available for work', {
        x: c + 40,
        y: 1230,
        w: 1000,
        size: 28,
        font: 'JetBrains Mono',
        weight: 700,
        upper: true,
        color: '#FF2E00',
      });
    },
  ),

  defineTemplate(
    {
      id: 'main-character',
      name: 'Main Character',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'bold',
      description: 'One giant word runs across all three slides, with photos layered over the type.',
      tags: ['giant typography', 'seamless', 'gen-z', 'bold', 'pink'],
      palette: ['#FF4F9A', '#1A0F14', '#FFF1E6', '#FFE14D'],
      slides: 3,
      background: '#FF4F9A',
    },
    ({ sx, text, photo, sticker }) => {
      text('Main character', { x: 20, y: 360, w: 3200, size: 480, font: 'Anton', upper: true, color: '#FFF1E6', lh: 0.95 });
      photo({ x: 700, y: 140, w: 460, h: 620, rot: -4, fill: '#F6B7D2', stroke: { color: '#FFF1E6', width: 14 } });
      photo({ x: 1880, y: 640, w: 500, h: 620, rot: 5, fill: '#F6B7D2', stroke: { color: '#FFF1E6', width: 14 } });
      photo({ x: sx(2) + 560, y: 110, w: 420, h: 520, rot: -3, fill: '#F6B7D2', stroke: { color: '#FFF1E6', width: 14 } });
      text('ep. 01', { x: 60, y: 60, w: 400, size: 36, font: 'Manrope', weight: 800, ls: 0.1, upper: true, color: '#1A0F14' });
      text('a series about\ndoing it anyway', {
        x: 60,
        y: 1000,
        w: 600,
        size: 56,
        font: 'Bricolage Grotesque',
        weight: 700,
        color: '#1A0F14',
        lh: 1.02,
      });
      text('(it’s giving)', {
        x: sx(2) + 80,
        y: 1100,
        w: 900,
        size: 88,
        font: 'Instrument Serif',
        italic: true,
        color: '#1A0F14',
      });
      sticker('vector:burst', { x: 1030, y: 80, size: 180, rot: 12, tint: '#FFE14D' });
      sticker('vector:sparkle', { x: sx(1) + 240, y: 1080, size: 140, tint: '#FFE14D' });
      sticker('vector:sparkle', { x: sx(2) + 140, y: 150, size: 110, tint: '#FFF1E6' });
    },
  ),

  defineTemplate(
    {
      id: 'layers-of-us',
      name: 'Layers of Us',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'editorial',
      description: 'Overlapping photos on sage paper, with one frame crossing into the next slide.',
      tags: ['overlapping photos', 'editorial', 'couple', 'friends', 'seamless'],
      palette: ['#EEF0EA', '#1D2A22', '#6F8F72', '#D5DCCF'],
      slides: 2,
      background: '#EEF0EA',
    },
    ({ sx, text, rect, photo }) => {
      text('Vol. 3', { x: 80, y: 60, w: 300, size: 26, font: 'Syne', weight: 700, ls: 0.1, upper: true, color: '#6F8F72' });
      photo({ x: 80, y: 140, w: 600, h: 800, fill: '#D5DCCF' });
      photo({ x: 520, y: 540, w: 700, h: 700, fill: '#C3CDBC', stroke: { color: '#EEF0EA', width: 16 } });
      rect({ x: 80, y: 1000, w: 80, h: 4, fill: '#1D2A22' });
      text('Swipe', { x: 80, y: 1030, w: 380, size: 26, font: 'Syne', weight: 700, ls: 0.1, upper: true, color: '#1D2A22' });

      const b = sx(1);
      photo({ x: b + 400, y: 90, w: 580, h: 720, fill: '#D5DCCF' });
      text('Layers\nof us', {
        x: b + 180,
        y: 860,
        w: 860,
        size: 150,
        font: 'Syne',
        weight: 800,
        color: '#1D2A22',
        lh: 0.9,
        ls: -0.02,
      });
      text('Some people feel like home in every frame.', {
        x: b + 600,
        y: 1150,
        w: 420,
        size: 30,
        font: 'Instrument Serif',
        italic: true,
        color: '#1D2A22',
        lh: 1.15,
      });
    },
  ),

  defineTemplate(
    {
      id: 'y2k-era',
      name: 'Y2K Era',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'y2k',
      description: 'Iridescent gradient, chrome-outlined type and star-shaped frames that flow across the swipe.',
      tags: ['y2k', 'gradient', 'chrome', 'stars', 'seamless'],
      palette: ['#B8F3FF', '#E8C6FF', '#FFD1EC', '#2B1B5A', '#FFFFFF'],
      slides: 3,
      background: linear(90, '#B8F3FF', '#E8C6FF', '#FFD1EC'),
    },
    ({ sx, text, photo, sticker }) => {
      text('New\nera', {
        x: 60,
        y: 90,
        w: 960,
        size: 300,
        font: 'Unbounded',
        weight: 900,
        upper: true,
        lh: 0.88,
        color: linear(180, '#FFFFFF', '#CFC6FF'),
        stroke: { color: '#2B1B5A', width: 8 },
      });
      photo({ x: 380, y: 700, w: 620, h: 620, clip: 'star', fill: '#F3E2FF' });
      text('loading…', { x: 60, y: 1180, w: 400, size: 40, font: 'Silkscreen', color: '#2B1B5A' });

      photo({ x: sx(1) + 90, y: 150, w: 520, h: 620, clip: 'heart', fill: '#FFE3F3' });
      text('it’s a\nvibe', {
        x: sx(1) + 560,
        y: 780,
        w: 480,
        size: 150,
        font: 'Unbounded',
        weight: 900,
        upper: true,
        lh: 0.9,
        color: '#FFFFFF',
        stroke: { color: '#2B1B5A', width: 6 },
      });
      photo({ x: sx(2) + 160, y: 140, w: 760, h: 760, clip: 'hexagon', fill: '#DDF7FF' });
      text('save it\nforever', {
        x: sx(2) + 60,
        y: 960,
        w: 960,
        size: 110,
        font: 'Unbounded',
        weight: 800,
        upper: true,
        lh: 0.95,
        color: '#2B1B5A',
        align: 'center',
      });
      sticker('vector:y2k-star', { x: 880, y: 560, size: 170, tint: '#FFFFFF' });
      sticker('vector:globe-y2k', { x: 950, y: 120, size: 190, rot: 10, tint: '#2B1B5A' });
      sticker('vector:y2k-star', { x: sx(1) + 700, y: 180, size: 220, rot: 14, tint: '#FFFFFF' });
      sticker('vector:sparkle', { x: sx(2) + 880, y: 80, size: 140, tint: '#2B1B5A' });
      sticker('vector:pixel-heart', { x: sx(2) + 60, y: 90, size: 130, tint: '#FF6FB5' });
    },
  ),
];
