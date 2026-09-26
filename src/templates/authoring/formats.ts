import { defineTemplate, linear } from './kit';

/**
 * Meme formats and social formats — the shapes people post in, redrawn as
 * original Stardeck layouts (no platform branding, no borrowed artwork). Trend
 * drops point at these from their "Meme formats" and "Social formats" rows.
 */

const INK = '#0B0A12';
const lift = { color: 'rgba(11,10,18,0.18)', blur: 24, x: 0, y: 8 };

export const formats = [
  /* ───────────── Meme formats ───────────── */
  defineTemplate(
    {
      id: 'nah-yeah',
      name: 'Nah / Yeah',
      format: 'post',
      sizeId: 'ig-square',
      style: 'playful',
      description: 'Two reaction pics: the thing you’re meant to do, and the thing you actually do.',
      tags: ['meme', 'meme format', 'reaction', 'two panel', 'funny'],
      palette: ['#FFF8E7', INK, '#E8432E', '#C6FF3D', '#E7DDC8'],
      background: '#FFF8E7',
    },
    ({ text, rect, photo }) => {
      const rows = [
        { y: 0, tag: 'NAH', fill: '#E8432E', ink: '#FFFFFF', caption: 'sleeping eight hours like a well-adjusted person' },
        { y: 540, tag: 'YEAH', fill: '#C6FF3D', ink: INK, caption: 'one more episode, then one more swipe, then sunrise' },
      ];
      for (const r of rows) {
        photo({ x: 0, y: r.y, w: 520, h: 540, fill: '#E7DDC8', label: 'Reaction pic' });
        rect({ x: 28, y: r.y + 28, w: 150, h: 64, fill: r.fill, radius: 32 });
        text(r.tag, {
          x: 28,
          y: r.y + 28,
          w: 150,
          h: 64,
          size: 40,
          font: 'Anton',
          color: r.ink,
          align: 'center',
          valign: 'middle',
          lh: 1,
        });
        text(r.caption, { x: 570, y: r.y + 150, w: 460, size: 52, font: 'Manrope', weight: 800, color: INK, lh: 1.12 });
      }
      rect({ x: 0, y: 536, w: 1080, h: 8, fill: INK });
    },
  ),

  defineTemplate(
    {
      id: 'level-up',
      animate: 'playful',
      name: 'Level Up',
      format: 'post',
      sizeId: 'ig-portrait',
      style: 'y2k',
      description: 'Four escalating levels, each one glowing a little more unhinged than the last.',
      tags: ['meme', 'meme format', 'escalating', 'levels', 'y2k', 'glow'],
      palette: ['#16131F', '#2C2640', '#7A5CFF', '#3CF0C8', '#C6FF3D', '#FFFFFF'],
      background: '#16131F',
    },
    ({ text, rect, photo }) => {
      const levels = [
        { caption: 'coffee', fill: '#2C2640', ink: '#B8B2CC' },
        { caption: 'iced coffee', fill: linear(90, '#2C2640', '#4B3A8C'), ink: '#FFFFFF' },
        { caption: 'iced oat latte, extra shot, no ice', fill: linear(90, '#4B3A8C', '#7A5CFF'), ink: '#FFFFFF' },
        { caption: 'a drink with a longer name than this caption', fill: linear(90, '#7A5CFF', '#3CF0C8', '#C6FF3D'), ink: INK },
      ];
      levels.forEach((l, i) => {
        const y = i * 337.5;
        rect({ x: 0, y, w: 640, h: 337.5, fill: l.fill });
        text(`LV.${i + 1}`, { x: 40, y: y + 34, w: 200, size: 34, font: 'Silkscreen', color: l.ink, opacity: 0.8 });
        text(l.caption, {
          x: 40,
          y: y + 100,
          w: 560,
          size: i === 3 ? 44 : 52,
          font: 'Unbounded',
          weight: 800,
          color: l.ink,
          lh: 1.08,
        });
        photo({ x: 640, y, w: 440, h: 337.5, fill: ['#3A3350', '#4A3F6B', '#6A55B8', '#8FE8D0'][i]!, label: `Level ${i + 1}` });
      });
    },
  ),

  defineTemplate(
    {
      id: 'nobody-me',
      name: 'Nobody / Me',
      format: 'post',
      sizeId: 'ig-square',
      style: 'playful',
      description: 'Nobody asked. You did it anyway. The two-line setup and one perfect pic.',
      tags: ['meme', 'meme format', 'text meme', 'relatable', 'funny'],
      palette: ['#FFFFFF', INK, '#D9D4E4', '#7A5CFF'],
      background: '#FFFFFF',
    },
    ({ text, photo }) => {
      text('Nobody:', { x: 60, y: 50, w: 960, size: 54, font: 'Manrope', weight: 800, color: INK });
      text('Me at 2am:', { x: 60, y: 150, w: 960, size: 54, font: 'Manrope', weight: 800, color: INK });
      text('rearranging my whole feed by colour', {
        x: 60,
        y: 226,
        w: 960,
        size: 46,
        font: 'Manrope',
        weight: 500,
        color: '#4A4658',
      });
      photo({ x: 60, y: 330, w: 960, h: 700, fill: '#D9D4E4', radius: 28, label: 'You, at 2am' });
    },
  ),

  defineTemplate(
    {
      id: 'pov-caption',
      animate: 'smooth',
      name: 'POV',
      format: 'story',
      sizeId: 'story',
      style: 'bold',
      description: 'Full-bleed photo, a giant POV and the scenario underneath. Story-sized.',
      tags: ['meme', 'meme format', 'pov', 'story', 'full bleed'],
      palette: ['#3B3450', '#FFFFFF', '#C6FF3D', INK],
      background: '#3B3450',
    },
    ({ text, rect, photo, sticker }) => {
      photo({ x: 0, y: 0, w: 1080, h: 1920, fill: '#3B3450', label: 'Your scene' });
      rect({ x: 0, y: 1020, w: 1080, h: 900, fill: linear(180, 'rgba(11,10,18,0)', 'rgba(11,10,18,0.82)') });
      text('POV:', { x: 80, y: 1250, w: 920, size: 220, font: 'Anton', color: '#FFFFFF', lh: 1 });
      text('you finally posted the photo dump you’ve been drafting since June', {
        x: 80,
        y: 1500,
        w: 900,
        size: 64,
        font: 'Manrope',
        weight: 800,
        color: '#FFFFFF',
        lh: 1.12,
      });
      sticker('vector:sparkle', { x: 820, y: 1220, size: 150, tint: '#C6FF3D', rot: 12 });
    },
  ),

  defineTemplate(
    {
      id: 'top-bottom',
      name: 'Top & Bottom',
      format: 'post',
      sizeId: 'ig-square',
      style: 'bold',
      description: 'The classic: one pic, a setup on top and the punchline underneath, outlined.',
      tags: ['meme', 'meme format', 'classic', 'caption', 'impact'],
      palette: ['#5A5470', '#FFFFFF', INK],
      background: '#5A5470',
    },
    ({ text, photo }) => {
      photo({ x: 0, y: 0, w: 1080, h: 1080, fill: '#5A5470', label: 'The pic' });
      const outline = { color: INK, width: 10 };
      text('when the carousel', {
        x: 40,
        y: 36,
        w: 1000,
        size: 112,
        font: 'Anton',
        color: '#FFFFFF',
        align: 'center',
        upper: true,
        stroke: outline,
        lh: 1,
      });
      text('hits slide ten', {
        x: 40,
        y: 920,
        w: 1000,
        size: 112,
        font: 'Anton',
        color: '#FFFFFF',
        align: 'center',
        upper: true,
        stroke: outline,
        lh: 1,
      });
    },
  ),

  defineTemplate(
    {
      id: 'tier-list',
      name: 'Tier List',
      format: 'post',
      sizeId: 'ig-portrait',
      style: 'playful',
      description: 'Rank anything: four tiers, three spots each, one very strong opinion.',
      tags: ['meme', 'meme format', 'tier list', 'ranking', 'grid'],
      palette: [INK, '#FFFFFF', '#FF5E7E', '#FFB23E', '#F6E94A', '#7EE08A', '#2A2638'],
      background: INK,
    },
    ({ text, rect, photo }) => {
      text('my tier list:', { x: 40, y: 40, w: 520, size: 60, font: 'Unbounded', weight: 800, color: '#FFFFFF' });
      text('snacks', { x: 520, y: 40, w: 520, size: 60, font: 'Caveat', weight: 700, color: '#F6E94A', align: 'right' });
      const tiers = [
        ['S', '#FF5E7E'],
        ['A', '#FFB23E'],
        ['B', '#F6E94A'],
        ['C', '#7EE08A'],
      ] as const;
      tiers.forEach(([tier, color], i) => {
        const y = 170 + i * 292;
        rect({ x: 20, y, w: 170, h: 280, fill: color, radius: 16 });
        text(tier, { x: 20, y, w: 170, h: 280, size: 120, font: 'Anton', color: INK, align: 'center', valign: 'middle', lh: 1 });
        for (let j = 0; j < 3; j++) photo({ x: 205 + j * 288, y, w: 276, h: 280, fill: '#2A2638', radius: 16 });
      });
    },
  ),

  defineTemplate(
    {
      id: 'starter-pack',
      name: 'Starter Pack',
      format: 'post',
      sizeId: 'ig-square',
      style: 'minimal',
      description: 'Six pics that sum up a whole personality, each with a tiny deadpan label.',
      tags: ['meme', 'meme format', 'starter pack', 'grid', 'labels'],
      palette: ['#FFFFFF', INK, '#ECE9F2', '#7A5CFF'],
      background: '#FFFFFF',
    },
    ({ text, photo }) => {
      text('the photo dump starter pack', {
        x: 30,
        y: 44,
        w: 1020,
        size: 56,
        font: 'Manrope',
        weight: 800,
        color: INK,
        align: 'center',
      });
      const labels = [
        'blurry concert pic',
        'coffee, from above',
        'mirror selfie',
        'sunset (×14)',
        'a funny sign',
        'the group pic',
      ];
      labels.forEach((label, i) => {
        const x = 30 + (i % 3) * 350;
        const y = 150 + Math.floor(i / 3) * 460;
        photo({ x, y, w: 320, h: 390, fill: '#ECE9F2', radius: 12 });
        text(label, { x, y: y + 400, w: 320, size: 28, font: 'Manrope', weight: 600, color: '#4A4658', align: 'center' });
      });
    },
  ),

  defineTemplate(
    {
      id: 'vibe-chart',
      name: 'Vibe Chart',
      format: 'post',
      sizeId: 'ig-square',
      style: 'playful',
      description: 'Nine pics on two axes — organised to chaotic, soft to loud. Tag your friends.',
      tags: ['meme', 'meme format', 'chart', 'grid', 'tag your friends'],
      palette: ['#F4F1EA', INK, '#7A5CFF', '#E0DAF0'],
      background: '#F4F1EA',
    },
    ({ text, photo }) => {
      ['organised', 'a bit of both', 'chaotic'].forEach((label, i) =>
        text(label, {
          x: 130 + i * 315,
          y: 44,
          w: 300,
          size: 30,
          font: 'Space Grotesk',
          weight: 700,
          color: '#7A5CFF',
          align: 'center',
          upper: true,
          ls: 0.06,
        }),
      );
      ['soft', 'mid', 'loud'].forEach((label, j) => {
        text(label, {
          x: 10,
          y: 110 + j * 320 + 130,
          w: 110,
          size: 30,
          font: 'Space Grotesk',
          weight: 700,
          color: '#7A5CFF',
          align: 'center',
          upper: true,
        });
        for (let i = 0; i < 3; i++) photo({ x: 130 + i * 315, y: 110 + j * 320, w: 300, h: 300, fill: '#E0DAF0', radius: 20 });
      });
    },
  ),

  /* ───────────── Social formats ───────────── */
  defineTemplate(
    {
      id: 'text-post',
      name: 'Text Post Card',
      format: 'post',
      sizeId: 'ig-square',
      style: 'minimal',
      description: 'A short opinion on a clean card — avatar, name, the take and a row of reactions.',
      tags: ['social format', 'text post', 'opinion', 'card', 'minimal'],
      palette: ['#C6FF3D', '#3CF0C8', '#FFFFFF', INK, '#8E8A9C'],
      background: linear(135, '#C6FF3D', '#3CF0C8'),
    },
    ({ text, rect, photo, sticker }) => {
      rect({ x: 90, y: 230, w: 900, h: 620, fill: '#FFFFFF', radius: 40, shadow: lift });
      photo({ x: 140, y: 280, w: 110, h: 110, clip: 'ellipse', fill: '#D9D4E4', label: 'You' });
      text('Your Name', { x: 275, y: 290, w: 660, size: 40, font: 'Manrope', weight: 800, color: INK });
      text('@yourhandle · 2h', { x: 275, y: 345, w: 660, size: 30, font: 'Manrope', weight: 500, color: '#8E8A9C' });
      text('hot take: the best camera is the one you actually take out of your pocket', {
        x: 140,
        y: 440,
        w: 800,
        size: 52,
        font: 'Manrope',
        weight: 700,
        color: INK,
        lh: 1.16,
      });
      const reactions: [string, string][] = [
        ['vector:comment', '48'],
        ['vector:share', '112'],
        ['vector:like', '2.4k'],
      ];
      reactions.forEach(([id, count], i) => {
        sticker(id, { x: 140 + i * 230, y: 752, size: 50, tint: '#8E8A9C' });
        text(count, { x: 200 + i * 230, y: 758, w: 140, size: 32, font: 'Manrope', weight: 700, color: '#8E8A9C' });
      });
    },
  ),

  defineTemplate(
    {
      id: 'thread-carousel',
      animate: 'smooth',
      name: 'Thread',
      format: 'carousel',
      sizeId: 'ig-portrait',
      style: 'editorial',
      description: 'A hook, three numbered points and a save-this ending — a thread you swipe through.',
      tags: ['social format', 'thread', 'tips', 'educational', 'numbered', 'text'],
      palette: ['#F4F1EA', INK, '#7A5CFF', '#C6FF3D', '#8E8A9C'],
      slides: 5,
      background: '#F4F1EA',
      slideFills: [INK, null, null, null, '#7A5CFF'],
    },
    ({ text, rect, sticker, sx }) => {
      // Hook
      text('1/5', { x: sx(0) + 80, y: 80, w: 200, size: 34, font: 'JetBrains Mono', weight: 600, color: '#C6FF3D' });
      text('things I wish I knew before posting every day', {
        x: sx(0) + 80,
        y: 300,
        w: 920,
        h: 560,
        size: 90,
        font: 'Syne',
        weight: 800,
        color: '#FFFFFF',
        lh: 1.02,
      });
      text('a thread — swipe', { x: sx(0) + 80, y: 1150, w: 700, size: 36, font: 'Manrope', weight: 700, color: '#C6FF3D' });
      sticker('vector:arrow-bold', { x: sx(0) + 820, y: 1120, size: 140, tint: '#C6FF3D' });
      // Points
      const points = [
        ['Batch it', 'Shoot on Sunday, post all week. Future you says thanks.'],
        ['Hook first', 'The first slide does the work. Say the good bit up front.'],
        ['Be a person', 'Nobody follows a brand voice. They follow you.'],
      ];
      points.forEach(([title, body], i) => {
        const x = sx(i + 1);
        text(`${i + 2}/5`, { x: x + 80, y: 80, w: 200, size: 34, font: 'JetBrains Mono', weight: 600, color: '#7A5CFF' });
        text(String(i + 1).padStart(2, '0'), {
          x: x + 70,
          y: 240,
          w: 800,
          size: 300,
          font: 'Syne',
          weight: 800,
          color: '#7A5CFF',
          lh: 1,
        });
        rect({ x: x + 80, y: 610, w: 120, h: 8, fill: INK });
        text(title!, { x: x + 80, y: 660, w: 920, size: 88, font: 'Syne', weight: 800, color: INK });
        text(body!, { x: x + 80, y: 800, w: 900, size: 50, font: 'Manrope', weight: 500, color: '#4A4658', lh: 1.25 });
      });
      // Ending
      text('5/5', { x: sx(4) + 80, y: 80, w: 200, size: 34, font: 'JetBrains Mono', weight: 600, color: '#FFFFFF' });
      text('save this for later', {
        x: sx(4) + 80,
        y: 420,
        w: 920,
        size: 110,
        font: 'Syne',
        weight: 800,
        color: '#FFFFFF',
        lh: 1.02,
      });
      text('and send it to the friend who needs it', {
        x: sx(4) + 80,
        y: 720,
        w: 900,
        size: 48,
        font: 'Manrope',
        weight: 600,
        color: '#FFFFFF',
      });
      sticker('vector:bookmark', { x: sx(4) + 800, y: 1080, size: 170, tint: '#C6FF3D', rot: -8 });
    },
  ),

  defineTemplate(
    {
      id: 'hot-take',
      animate: 'glitchy',
      name: 'Hot Take',
      format: 'post',
      sizeId: 'ig-portrait',
      style: 'bold',
      description: 'A stamped HOT TAKE, one unpopular opinion and an agree / fight-me poll.',
      tags: ['social format', 'opinion', 'poll', 'hot take', 'bold'],
      palette: [INK, '#FFFFFF', '#FF4D2E', '#C6FF3D', '#2A2638'],
      background: INK,
    },
    ({ text, rect, sticker }) => {
      rect({ x: 80, y: 120, w: 560, h: 150, fill: '#FF4D2E', rot: -4, radius: 10 });
      text('hot take', {
        x: 80,
        y: 120,
        w: 560,
        h: 150,
        size: 70,
        font: 'Rubik Mono One',
        color: '#FFFFFF',
        align: 'center',
        valign: 'middle',
        upper: true,
        rot: -4,
        lh: 1,
      });
      sticker('emoji:🔥', { x: 660, y: 110, size: 140, rot: 10 });
      text('pineapple belongs on literally everything', {
        x: 80,
        y: 400,
        w: 920,
        size: 118,
        font: 'Archivo',
        weight: 900,
        color: '#FFFFFF',
        lh: 1.02,
      });
      const pills: [string, string, string][] = [
        ['agree', '#C6FF3D', INK],
        ['fight me', '#2A2638', '#FFFFFF'],
      ];
      pills.forEach(([label, fill, ink], i) => {
        const y = 1010 + i * 150;
        rect({ x: 80, y, w: 920, h: 120, fill, radius: 60 });
        text(label, { x: 130, y, w: 820, h: 120, size: 50, font: 'Manrope', weight: 800, color: ink, valign: 'middle', lh: 1 });
      });
      sticker('emoji:💀', { x: 880, y: 1170, size: 90 });
    },
  ),

  defineTemplate(
    {
      id: 'rate-my',
      name: 'Rate My…',
      format: 'story',
      sizeId: 'story',
      style: 'playful',
      description: 'A story that asks for a score out of ten — outfit, desk, dinner, anything.',
      tags: ['social format', 'story', 'rate', 'poll', 'interactive'],
      palette: ['#FFE3F1', INK, '#FF5EA8', '#FFFFFF', '#F2C6DB'],
      background: '#FFE3F1',
    },
    ({ text, rect, photo, sticker }) => {
      photo({ x: 90, y: 150, w: 900, h: 1150, fill: '#F2C6DB', radius: 48, label: 'The fit' });
      text('rate my fit', { x: 90, y: 1340, w: 900, size: 120, font: 'Pacifico', color: '#FF5EA8', align: 'center', lh: 1.2 });
      rect({ x: 90, y: 1560, w: 900, h: 130, fill: '#FFFFFF', radius: 65, shadow: lift });
      text('1 2 3 4 5 6 7 8 9 10', {
        x: 90,
        y: 1560,
        w: 900,
        h: 130,
        size: 48,
        font: 'JetBrains Mono',
        weight: 700,
        color: INK,
        align: 'center',
        valign: 'middle',
        lh: 1,
      });
      text('reply with a number ✦', {
        x: 90,
        y: 1730,
        w: 900,
        size: 36,
        font: 'Manrope',
        weight: 700,
        color: '#A04A77',
        align: 'center',
      });
      sticker('vector:heart', { x: 850, y: 100, size: 170, tint: '#FF5EA8', rot: 14 });
    },
  ),
];
