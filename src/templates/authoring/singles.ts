import { defineTemplate, linear, radial } from './kit';

const shade = { color: 'rgba(10,6,20,0.4)', blur: 30, x: 0, y: 6 };

/** Posts, stories and reel covers. */
export const singles = [
  /* ───────────── Posts ───────────── */
  defineTemplate(
    {
      id: 'quote-card',
      name: 'Quote Card',
      format: 'post',
      sizeId: 'ig-portrait',
      style: 'minimal',
      description: 'An oversized quote mark and a serif line worth screenshotting.',
      tags: ['quote', 'minimal', 'text post', 'motivation'],
      palette: ['#F2EFE9', '#1B1916', '#E0573C', '#CFC8BC'],
      background: '#F2EFE9',
    },
    ({ text, line }) => {
      text('“', { x: 60, y: 0, w: 400, h: 450, size: 480, font: 'Playfair Display', weight: 900, color: '#E0573C', lh: 0.9 });
      text('Make the thing you wish existed. Then post it before you talk yourself out of it.', {
        x: 90,
        y: 380,
        w: 900,
        size: 100,
        font: 'Instrument Serif',
        lh: 1.08,
        color: '#1B1916',
      });
      line(90, 1060, 120, '#E0573C', 4);
      text('Note to self', {
        x: 90,
        y: 1100,
        w: 600,
        size: 28,
        font: 'Manrope',
        weight: 700,
        ls: 0.16,
        upper: true,
        color: '#1B1916',
      });
      text('@yourhandle', { x: 90, y: 1150, w: 600, size: 28, font: 'Manrope', weight: 500, color: '#8C857A' });
    },
  ),

  defineTemplate(
    {
      id: 'new-drop',
      name: 'New Drop',
      format: 'post',
      sizeId: 'ig-portrait',
      style: 'bold',
      description: 'A loud launch post: huge headline, a product in a circle and a date burst.',
      tags: ['announcement', 'launch', 'product', 'sale', 'bold'],
      palette: ['#1B1B1F', '#F6FF6B', '#FFFFFF', '#FF5DA2'],
      background: '#1B1B1F',
    },
    ({ text, photo, sticker }) => {
      text('New\ndrop', { x: 50, y: 40, w: 980, size: 290, font: 'Anton', upper: true, color: '#F6FF6B', lh: 0.86 });
      photo({ x: 330, y: 560, w: 680, h: 680, clip: 'ellipse', fill: '#34343A' });
      sticker('vector:burst', { x: 60, y: 700, size: 320, rot: -10, tint: '#FF5DA2' });
      text('09.26', {
        x: 60,
        y: 700,
        w: 320,
        h: 320,
        size: 64,
        font: 'Anton',
        color: '#1B1B1F',
        align: 'center',
        valign: 'middle',
        rot: -10,
      });
      text('Link in bio', {
        x: 60,
        y: 1230,
        w: 400,
        size: 30,
        font: 'Manrope',
        weight: 800,
        color: '#1B1B1F',
        upper: true,
        ls: 0.1,
        highlight: { fill: '#FFFFFF', padding: 16, radius: 30 },
      });
    },
  ),

  defineTemplate(
    {
      id: 'gilded-frame',
      name: 'Gilded Frame',
      format: 'post',
      sizeId: 'ig-portrait',
      style: 'luxury',
      description: 'A portrait in an arch, framed with a fine gold rule and quiet serif type.',
      tags: ['luxury', 'frame', 'portrait', 'elegant', 'dark'],
      palette: ['#1E1A17', '#C9A86A', '#F3EBDD', '#3A332D'],
      background: '#1E1A17',
    },
    ({ text, rect, photo }) => {
      rect({ x: 40, y: 40, w: 1000, h: 1270, fill: null, stroke: { color: '#C9A86A', width: 3 } });
      rect({ x: 58, y: 58, w: 964, h: 1234, fill: null, stroke: { color: '#C9A86A', width: 1 } });
      photo({ x: 240, y: 150, w: 600, h: 780, clip: 'arch', fill: '#3A332D', adjust: { contrast: 8, fade: 8, temperature: 10 } });
      text('Portrait of\na Sunday', {
        x: 90,
        y: 970,
        w: 900,
        size: 84,
        font: 'Playfair Display',
        italic: true,
        color: '#F3EBDD',
        align: 'center',
        lh: 1,
      });
      text('Collection no. 12', {
        x: 90,
        y: 1190,
        w: 900,
        size: 22,
        font: 'Manrope',
        weight: 600,
        ls: 0.4,
        upper: true,
        color: '#C9A86A',
        align: 'center',
      });
    },
  ),

  defineTemplate(
    {
      id: 'breaking-news',
      name: 'Breaking News',
      format: 'post',
      sizeId: 'ig-portrait',
      style: 'retro',
      description: 'A cut-and-paste ransom-note headline over a photo — for very important updates.',
      tags: ['newspaper', 'cut out letters', 'meme', 'retro', 'announcement'],
      palette: ['#F4F0E6', '#161412', '#E8432E', '#F6D34A', '#FFFFFF'],
      background: '#F4F0E6',
    },
    ({ text, rect, photo }) => {
      photo({ x: 60, y: 420, w: 960, h: 760, fill: '#D9D2C2' });
      const letters = 'BREAKING'.split('');
      const fonts = [
        'Anton',
        'Playfair Display',
        'Archivo',
        'DM Serif Display',
        'Rubik Mono One',
        'Fraunces',
        'Anton',
        'Unbounded',
      ];
      const papers = ['#FFFFFF', '#161412', '#F6D34A', '#FFFFFF', '#E8432E', '#FFFFFF', '#161412', '#F6D34A'];
      letters.forEach((ch, i) => {
        const x = 70 + i * 118;
        const rot = [-6, 4, -3, 7, -5, 3, -7, 5][i]!;
        const y = 90 + (i % 2) * 26;
        rect({ x, y, w: 108, h: 150, fill: papers[i]!, rot, shadow: { color: 'rgba(22,20,18,0.2)', blur: 8, x: 2, y: 4 } });
        const dark = papers[i] === '#161412' || papers[i] === '#E8432E';
        text(ch, {
          x,
          y,
          w: 108,
          h: 150,
          size: 100,
          font: fonts[i]!,
          weight: fonts[i] === 'Archivo' ? 900 : 400,
          color: dark ? '#FFFFFF' : '#161412',
          align: 'center',
          valign: 'middle',
          rot,
          lh: 1,
        });
      });
      text('news: i’m officially on holiday', {
        x: 60,
        y: 300,
        w: 960,
        size: 52,
        font: 'DM Serif Display',
        italic: true,
        color: '#161412',
        align: 'center',
      });
      text('More at 11 · or never', {
        x: 60,
        y: 1230,
        w: 960,
        size: 26,
        font: 'Manrope',
        weight: 800,
        ls: 0.2,
        upper: true,
        color: '#E8432E',
        align: 'center',
      });
    },
  ),

  defineTemplate(
    {
      id: 'date-stamp',
      name: 'Date Stamp',
      format: 'post',
      sizeId: 'ig-portrait',
      style: 'retro',
      description: 'One big instant print on peach, with an orange film-camera date stamp.',
      tags: ['polaroid', 'film', 'retro', 'nostalgia', 'date'],
      palette: ['#F5C8A8', '#2B2530', '#FF7A1A', '#FBFAF7'],
      background: '#F5C8A8',
    },
    ({ text, polaroid, sticker }) => {
      polaroid({ x: 190, y: 240, w: 700, rot: -3, caption: 'the one that got away', fill: '#E7B797' });
      text('’26 09 26', {
        x: 620,
        y: 760,
        w: 260,
        size: 34,
        font: 'JetBrains Mono',
        weight: 700,
        color: '#FF7A1A',
        rot: -3,
        shadow: { color: 'rgba(255,122,26,0.6)', blur: 8, x: 0, y: 0 },
      });
      sticker('vector:daisy', { x: 820, y: 90, size: 170, rot: 12, tint: '#FBFAF7' });
      sticker('vector:heart', { x: 90, y: 1140, size: 140, rot: -10, tint: '#FF7A1A' });
    },
  ),

  /* ───────────── Stories ───────────── */
  defineTemplate(
    {
      id: 'this-or-that',
      name: 'This or That',
      format: 'story',
      sizeId: 'story',
      style: 'playful',
      description: 'Two photos, one choice. Built for polls and hot takes.',
      tags: ['this or that', 'poll', 'story', 'interactive', 'fun'],
      palette: ['#7B61FF', '#FFFFFF', '#FFE14D', '#1A1233'],
      background: '#7B61FF',
    },
    ({ text, ellipse, photo }) => {
      text('pick one', {
        x: 60,
        y: 150,
        w: 960,
        size: 120,
        font: 'Bricolage Grotesque',
        weight: 800,
        color: '#FFFFFF',
        align: 'center',
      });
      photo({ x: 90, y: 330, w: 900, h: 640, radius: 48, fill: '#9C88FF' });
      photo({ x: 90, y: 1030, w: 900, h: 640, radius: 48, fill: '#9C88FF' });
      text('This', {
        x: 130,
        y: 880,
        w: 400,
        size: 44,
        font: 'Bricolage Grotesque',
        weight: 800,
        color: '#1A1233',
        upper: true,
        highlight: { fill: '#FFFFFF', padding: 16, radius: 28 },
      });
      text('That', {
        x: 130,
        y: 1580,
        w: 400,
        size: 44,
        font: 'Bricolage Grotesque',
        weight: 800,
        color: '#1A1233',
        upper: true,
        highlight: { fill: '#FFFFFF', padding: 16, radius: 28 },
      });
      ellipse({ x: 440, y: 900, w: 200, h: 200, fill: '#FFE14D', stroke: { color: '#7B61FF', width: 12 } });
      text('or', {
        x: 440,
        y: 900,
        w: 200,
        h: 200,
        size: 80,
        font: 'Bricolage Grotesque',
        weight: 800,
        color: '#1A1233',
        align: 'center',
        valign: 'middle',
      });
      text('reply with your pick', {
        x: 60,
        y: 1740,
        w: 960,
        size: 36,
        font: 'Manrope',
        weight: 700,
        color: '#FFFFFF',
        align: 'center',
      });
    },
  ),

  defineTemplate(
    {
      id: 'ask-me',
      name: 'Ask Me Anything',
      format: 'story',
      sizeId: 'story',
      style: 'soft',
      description: 'A soft question card with your photo — answer your followers in style.',
      tags: ['q&a', 'questions', 'story', 'soft', 'pastel'],
      palette: ['#FDE6EF', '#E4E1FF', '#3B2A4A', '#FFFFFF'],
      background: linear(180, '#FDE6EF', '#E4E1FF'),
    },
    ({ text, rect, photo, sticker }) => {
      rect({
        x: 110,
        y: 640,
        w: 860,
        h: 640,
        fill: '#FFFFFF',
        radius: 56,
        shadow: { color: 'rgba(59,42,74,0.12)', blur: 50, x: 0, y: 16 },
      });
      // The avatar overlaps the card's top edge.
      photo({ x: 390, y: 480, w: 280, h: 280, clip: 'ellipse', fill: '#F3D3E1', stroke: { color: '#FFFFFF', width: 12 } });
      text('ask me\nanything', {
        x: 150,
        y: 800,
        w: 780,
        size: 110,
        font: 'Fraunces',
        italic: true,
        weight: 600,
        color: '#3B2A4A',
        align: 'center',
        lh: 0.95,
      });
      rect({ x: 190, y: 1080, w: 700, h: 110, fill: '#F4F0F8', radius: 32 });
      text('type something…', {
        x: 230,
        y: 1080,
        w: 620,
        h: 110,
        size: 36,
        font: 'Manrope',
        weight: 500,
        color: '#A597B3',
        valign: 'middle',
      });
      sticker('vector:twin-sparkle', { x: 820, y: 560, size: 150, tint: '#B79CFF' });
      sticker('vector:heart', { x: 120, y: 1320, size: 120, rot: -12, tint: '#FF8FB8' });
      text('Reply to this story ↑', {
        x: 60,
        y: 1560,
        w: 960,
        size: 34,
        font: 'Manrope',
        weight: 700,
        color: '#3B2A4A',
        align: 'center',
      });
    },
  ),

  defineTemplate(
    {
      id: 'countdown',
      name: 'Countdown',
      format: 'story',
      sizeId: 'story',
      style: 'y2k',
      description: 'A glowing chrome number counting down to something big.',
      tags: ['countdown', 'launch', 'event', 'y2k', 'night'],
      palette: ['#0D0B1F', '#3A1C71', '#FFFFFF', '#7CF7FF', '#FF6FD8'],
      background: radial(0.5, 0.4, 0.8, '#3A1C71', '#0D0B1F'),
    },
    ({ text, photo, sticker }) => {
      text('in', { x: 60, y: 200, w: 960, size: 80, font: 'Unbounded', weight: 400, color: '#7CF7FF', align: 'center' });
      text('3', {
        x: 60,
        y: 280,
        w: 960,
        h: 760,
        size: 760,
        font: 'Unbounded',
        weight: 900,
        align: 'center',
        lh: 1,
        color: linear(180, '#FFFFFF', '#7CF7FF', '#FF6FD8'),
        shadow: { color: 'rgba(124,247,255,0.55)', blur: 60, x: 0, y: 0 },
      });
      text('days', {
        x: 60,
        y: 1030,
        w: 960,
        size: 120,
        font: 'Unbounded',
        weight: 800,
        upper: true,
        color: '#FFFFFF',
        align: 'center',
      });
      photo({ x: 340, y: 1240, w: 400, h: 400, clip: 'star', fill: '#2A1A55' });
      text('set a reminder ✓', { x: 60, y: 1720, w: 960, size: 36, font: 'Silkscreen', color: '#7CF7FF', align: 'center' });
      sticker('vector:y2k-star', { x: 820, y: 180, size: 160, tint: '#FF6FD8' });
      sticker('vector:y2k-star', { x: 120, y: 1080, size: 110, tint: '#7CF7FF' });
      sticker('vector:sparkle', { x: 150, y: 260, size: 100, tint: '#FFFFFF' });
    },
  ),

  defineTemplate(
    {
      id: 'story-still',
      name: 'Story Still',
      format: 'story',
      sizeId: 'story',
      style: 'cinematic',
      description: 'A full-screen photo with letterbox bars and a single subtitle.',
      tags: ['cinematic', 'film', 'subtitles', 'moody', 'story'],
      palette: ['#000000', '#FFE45C', '#E9E4DA', '#2A2622'],
      background: '#000000',
    },
    ({ text, rect, photo }) => {
      photo({
        x: 0,
        y: 0,
        w: 1080,
        h: 1920,
        fill: '#2A2622',
        adjust: { contrast: 14, saturation: -20, fade: 10, grain: 25, vignette: 30 },
      });
      rect({ x: 0, y: 0, w: 1080, h: 300, fill: '#000000' });
      rect({ x: 0, y: 1620, w: 1080, h: 300, fill: '#000000' });
      text('Chapter one', {
        x: 60,
        y: 200,
        w: 960,
        size: 26,
        font: 'Manrope',
        weight: 700,
        ls: 0.4,
        upper: true,
        color: '#E9E4DA',
        align: 'center',
      });
      text('We said we’d only stay a week.', {
        x: 60,
        y: 1500,
        w: 960,
        size: 44,
        font: 'Manrope',
        weight: 600,
        color: '#FFE45C',
        align: 'center',
        shadow: { color: 'rgba(0,0,0,0.9)', blur: 6, x: 0, y: 2 },
      });
    },
  ),

  defineTemplate(
    {
      id: 'film-roll',
      name: 'Film Roll',
      format: 'story',
      sizeId: 'story',
      style: 'retro',
      description: 'A vertical strip of film with sprocket holes, three frames and edge markings.',
      tags: ['film', 'analog', 'retro', 'photo dump', 'story'],
      palette: ['#1A1A1A', '#0F0F0F', '#E3A857', '#F2EDE4'],
      background: '#1A1A1A',
    },
    ({ text, rect, photo }) => {
      rect({ x: 170, y: 0, w: 740, h: 1920, fill: '#0F0F0F' });
      for (let y = 24; y < 1920; y += 84) {
        rect({ x: 196, y, w: 34, h: 48, radius: 8, fill: '#2A2A2A' });
        rect({ x: 850, y, w: 34, h: 48, radius: 8, fill: '#2A2A2A' });
      }
      [150, 730, 1310].forEach((y, i) => {
        photo({ x: 264, y, w: 552, h: 520, fill: '#3A3530', adjust: { fade: 14, grain: 30, temperature: 12 } });
        text(`${String(i * 12 + 12).padStart(2, '0')}A`, {
          x: 40,
          y: y + 240,
          w: 110,
          size: 28,
          font: 'JetBrains Mono',
          weight: 700,
          color: '#E3A857',
        });
      });
      text('roll 36 · iso 400', {
        x: 60,
        y: 1830,
        w: 960,
        size: 30,
        font: 'JetBrains Mono',
        weight: 700,
        color: '#E3A857',
        align: 'center',
      });
    },
  ),

  /* ───────────── Reel covers ───────────── */
  defineTemplate(
    {
      id: 'episode-cover',
      name: 'Episode Cover',
      format: 'reel-cover',
      sizeId: 'tiktok',
      style: 'bold',
      description: 'A series cover with a giant episode number — kept inside the grid-safe area.',
      tags: ['series', 'episode', 'reels', 'tiktok', 'bold'],
      palette: ['#FFE14D', '#141414', '#FFFFFF', '#FF6A3D'],
      background: '#FFE14D',
    },
    ({ text, photo }) => {
      text('Ep.', { x: 80, y: 400, w: 500, size: 140, font: 'Anton', upper: true, color: '#141414' });
      text('04', { x: 60, y: 500, w: 700, h: 560, size: 560, font: 'Anton', color: '#141414', lh: 1 });
      photo({ x: 620, y: 460, w: 400, h: 400, clip: 'ellipse', fill: '#F2C94C', stroke: { color: '#141414', width: 10 } });
      text('Thrift flip\nchallenge', {
        x: 80,
        y: 1160,
        w: 920,
        size: 124,
        font: 'Bricolage Grotesque',
        weight: 800,
        color: '#141414',
        lh: 0.95,
        ls: -0.02,
      });
      text('$20 · 3 stores · 1 fit', {
        x: 80,
        y: 1460,
        w: 920,
        size: 44,
        font: 'Manrope',
        weight: 800,
        color: '#FFFFFF',
        highlight: { fill: '#FF6A3D', padding: 18, radius: 30 },
      });
    },
  ),

  defineTemplate(
    {
      id: 'quiet-cover',
      name: 'Quiet Cover',
      format: 'reel-cover',
      sizeId: 'tiktok',
      style: 'minimal',
      description: 'A full-bleed photo and a soft serif title, centred where the grid crop keeps it.',
      tags: ['minimal', 'routine', 'vlog', 'reels', 'aesthetic'],
      palette: ['#1C1A18', '#FFFFFF', '#D8CFC4'],
      background: '#1C1A18',
    },
    ({ text, rect, photo }) => {
      photo({ x: 0, y: 0, w: 1080, h: 1920, fill: '#8C8278', adjust: { fade: 8, temperature: 6 } });
      rect({ x: 0, y: 1000, w: 1080, h: 920, fill: linear(180, 'rgba(28,26,24,0)', 'rgba(28,26,24,0.7)') });
      text('morning\nroutine', {
        x: 60,
        y: 1180,
        w: 960,
        size: 150,
        font: 'Instrument Serif',
        italic: true,
        color: '#FFFFFF',
        align: 'center',
        lh: 0.9,
        shadow: shade,
      });
      text('Vol. 2', {
        x: 60,
        y: 1480,
        w: 960,
        size: 30,
        font: 'Manrope',
        weight: 700,
        ls: 0.3,
        upper: true,
        color: '#D8CFC4',
        align: 'center',
      });
    },
  ),

  defineTemplate(
    {
      id: 'grwm-cover',
      name: 'GRWM',
      format: 'reel-cover',
      sizeId: 'tiktok',
      style: 'soft',
      description: 'Get-ready-with-me cover: rosy arch photo, big letters and a handwritten subtitle.',
      tags: ['grwm', 'beauty', 'reels', 'soft', 'pink'],
      palette: ['#F7D9E3', '#8C2F5A', '#FFFFFF', '#E9A6BF'],
      background: '#F7D9E3',
    },
    ({ text, photo, sticker }) => {
      photo({ x: 190, y: 560, w: 700, h: 900, clip: 'arch', fill: '#E9A6BF', stroke: { color: '#FFFFFF', width: 14 } });
      text('GRWM', { x: 40, y: 330, w: 1000, size: 160, font: 'Syne', weight: 800, color: '#8C2F5A', align: 'center', lh: 1 });
      text('for a first date', {
        x: 60,
        y: 1480,
        w: 960,
        size: 96,
        font: 'Caveat',
        weight: 700,
        color: '#8C2F5A',
        align: 'center',
        rot: -3,
      });
      sticker('vector:heart', { x: 810, y: 520, size: 150, rot: 14, tint: '#8C2F5A' });
      sticker('vector:sparkle', { x: 150, y: 600, size: 120, tint: '#FFFFFF' });
    },
  ),
];
