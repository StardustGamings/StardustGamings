'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ScenePreview } from '@/canvas/ScenePreview';
import { getTemplate } from '@/templates/registry';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { useFullMotion } from '@/hooks/usePreferences';
import { useClientValue } from '@/hooks/useClientValue';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/button-styles';

function greetingFor(hour: number) {
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const SHOWCASE = [
  { id: 'scrapbook-dump', rotate: -9, x: -120, y: 26, z: 1 },
  { id: 'y2k-chrome', rotate: 8, x: 118, y: 18, z: 2 },
  { id: 'big-type-drop', rotate: -1, x: 0, y: -8, z: 3 },
];

function Showcase() {
  const full = useFullMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-1, 1], [8, -8]), { stiffness: 120, damping: 16 });
  const ry = useSpring(useTransform(mx, [-1, 1], [-10, 10]), { stiffness: 120, damping: 16 });

  return (
    <div
      className="relative hidden h-[420px] items-center justify-center [perspective:1200px] lg:flex"
      onPointerMove={(e) => {
        if (!full) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
        my.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      aria-hidden
    >
      <motion.div className="relative h-[360px] w-[288px] [transform-style:preserve-3d]" style={{ rotateX: rx, rotateY: ry }}>
        {SHOWCASE.map((card, i) => {
          const template = getTemplate(card.id);
          if (!template) return null;
          return (
            <motion.div
              key={card.id}
              className="absolute inset-0 overflow-hidden rounded-[22px] border border-white/10 shadow-[var(--shadow-float)]"
              style={{ zIndex: card.z }}
              initial={{ opacity: 0, rotate: 0, x: 0, y: 40 }}
              animate={{ opacity: 1, rotate: card.rotate, x: card.x, y: card.y }}
              transition={{ delay: 0.15 + i * 0.1, type: 'spring', stiffness: 140, damping: 16 }}
            >
              <ScenePreview doc={template.doc} slide={0} eager fit="contain" className="size-full" />
            </motion.div>
          );
        })}
        <motion.span
          className="motion-decorative absolute -top-8 -right-10 z-10 flex size-16 animate-float items-center justify-center rounded-full bg-accent text-accent-fg shadow-[var(--shadow-glow)]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6, type: 'spring' }}
        >
          <Sparkles className="size-7" />
        </motion.span>
      </motion.div>
    </div>
  );
}

export function HomeHero() {
  const displayName = useSettings((s) => s.displayName);
  const openNewProject = useUi((s) => s.openNewProject);
  const greeting = useClientValue<string | null>(() => greetingFor(new Date().getHours()), null);

  return (
    <section aria-labelledby="hero-title" className="grid items-center gap-8 pt-4 pb-6 lg:grid-cols-[1.1fr_1fr] lg:pt-8">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-fg-muted">
          <span className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
          100% free · no watermarks · works offline
        </p>
        <h1
          id="hero-title"
          className="mt-5 text-[52px] leading-[0.92] font-extrabold tracking-[-0.055em] sm:text-7xl xl:text-[88px]"
        >
          Create.
          <br />
          Swipe. <span className="text-nova">Flex.</span>
        </h1>
        <p className="mt-5 max-w-md text-base text-fg-muted sm:text-lg" suppressHydrationWarning>
          {greeting ? `${greeting}${displayName ? `, ${displayName}` : ''} — ` : ''}
          carousels, stories and covers that actually stop the scroll.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button
            variant="primary"
            size="lg"
            magnetic
            onClick={() => openNewProject('carousel')}
            iconRight={<ArrowRight className="size-4" />}
          >
            New carousel
          </Button>
          <Link href="/discover/" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
            Browse templates
          </Link>
        </div>
      </div>
      <Showcase />
    </section>
  );
}
