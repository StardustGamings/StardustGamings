'use client';

import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { Dialog as D } from 'radix-ui';
import { ArrowLeft, ArrowRight, Download, Heart, MessageCircle, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FORMAT_ORDER, FORMATS } from '@/projects/formats';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { loadFont } from '@/typography/fonts';
import { Button } from '@/components/ui/Button';
import { LogoMark } from '@/components/ui/Logo';
import { FormatIcon } from '@/components/home/FormatIcon';
import { cn } from '@/utils/cn';

/* ───────────── Visuals for each step: quiet diagrams, one accent (no image assets) ───────────── */

function CreateVisual() {
  return (
    <div className="grid w-full max-w-[320px] grid-cols-4 gap-2">
      {FORMAT_ORDER.map((id, i) => (
        <motion.div
          key={id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 * i, duration: 0.24, ease: [0.2, 0, 0, 1] }}
          className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md border border-line bg-surface text-fg-muted"
        >
          <FormatIcon format={id} className={cn('size-5', i === 0 && 'text-accent-text')} />
          <span className="text-[10.5px] font-medium">{FORMATS[id].label}</span>
        </motion.div>
      ))}
    </div>
  );
}

function CarouselVisual() {
  return (
    <div className="relative mx-auto w-[220px]">
      <div className="relative overflow-hidden rounded-lg border border-line-strong bg-bg-sunken">
        <motion.div
          className="flex"
          animate={{ x: ['0%', '0%', '-100%', '-100%', '-200%', '-200%', '0%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: [0.65, 0, 0.35, 1] }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative aspect-[4/5] w-full shrink-0 border-r border-dashed border-line-strong">
              <span className="absolute top-3 left-3 font-mono text-[11px] text-fg-subtle">0{i + 1}</span>
              <svg viewBox="0 0 100 125" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
                <path
                  d={['M0 90 C30 70 60 100 100 60', 'M0 60 C40 20 70 80 100 50', 'M0 50 C35 80 65 40 100 70'][i]}
                  fill="none"
                  stroke="var(--accent-text)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          ))}
        </motion.div>
      </div>
      <p className="mt-3 text-center text-meta">One design, flowing across every swipe</p>
    </div>
  );
}

const FONT_CYCLE = [
  { family: 'Unbounded', weight: 900, style: 'normal' },
  { family: 'Instrument Serif', weight: 400, style: 'italic' },
  { family: 'Anton', weight: 400, style: 'normal' },
  { family: 'Caveat', weight: 700, style: 'normal' },
  { family: 'UnifrakturMaguntia', weight: 400, style: 'normal' },
  { family: 'Silkscreen', weight: 700, style: 'normal' },
];

function YoursVisual() {
  const [i, setI] = useState(0);
  useEffect(() => {
    FONT_CYCLE.forEach((f) => void loadFont(f.family, f.weight, f.style));
    const t = window.setInterval(() => setI((n) => (n + 1) % FONT_CYCLE.length), 1400);
    return () => window.clearInterval(t);
  }, []);
  const f = FONT_CYCLE[i]!;
  const swatches = ['#C6FF3D', '#EDEDEA', '#8E8E88', '#2B2B30', '#E9DCC9', '#D2583F'];
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex h-24 items-center">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={f.family}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="text-6xl leading-none text-fg"
            style={{ fontFamily: `"${f.family}"`, fontWeight: f.weight, fontStyle: f.style }}
          >
            yours
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="flex gap-1.5">
        {swatches.map((c, n) => (
          <span
            key={c}
            className={cn(
              'size-7 rounded-sm border border-line-strong transition-shadow duration-200',
              n === i % swatches.length && 'ring-2 ring-fg ring-offset-2 ring-offset-bg',
            )}
            style={{ background: c }}
          />
        ))}
      </div>
      <p className="text-meta">{f.family} · one of 18 fonts that work offline</p>
    </div>
  );
}

function ExportVisual() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative h-36 w-28">
        {[0, 1, 2].map((n) => (
          <motion.div
            key={n}
            className="absolute inset-0 rounded-md border border-line-strong bg-surface"
            initial={{ rotate: 0, x: 0 }}
            animate={{ rotate: (n - 1) * 7, x: (n - 1) * 22 }}
            transition={{ delay: 0.1 + n * 0.05, duration: 0.3, ease: [0.2, 0, 0, 1] }}
          />
        ))}
        <div className="absolute -bottom-3 left-1/2 flex size-10 -translate-x-1/2 items-center justify-center rounded-md bg-accent text-accent-fg">
          <Download className="size-5" />
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        {['PNG', 'JPG', 'WebP', 'PDF', 'MP4'].map((f) => (
          <span key={f} className="rounded-xs border border-line px-2 py-0.5 font-mono text-[11px] text-fg-muted">
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

function ShareVisual() {
  return (
    <div className="relative mx-auto w-[200px]">
      <div className="overflow-hidden rounded-lg border border-line-strong bg-bg-elevated">
        <div className="flex items-center gap-2 p-2.5">
          <LogoMark className="size-5" />
          <span className="text-xs font-semibold">you</span>
        </div>
        <div className="flex aspect-[4/5] items-end bg-bg-sunken p-3">
          <span className="h-1 w-2/3 rounded-full bg-accent" />
        </div>
        <div className="flex gap-3 p-2.5 text-fg-muted">
          <Heart className="size-[18px]" />
          <MessageCircle className="size-[18px]" />
          <Send className="size-[18px]" />
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    title: 'Create anything.',
    body: 'Carousels, stories, covers, thumbnails, collages, posters and moodboards — all in one studio.',
    Visual: CreateVisual,
  },
  {
    title: 'Design your carousel.',
    body: 'Slides live on one continuous canvas, so designs can flow seamlessly from swipe to swipe.',
    Visual: CarouselVisual,
  },
  {
    title: 'Make it yours.',
    body: 'Fonts, colours, stickers and templates that look like you — not like everyone else.',
    Visual: YoursVisual,
  },
  { title: 'Export.', body: 'Full-quality files. No watermarks. No paywall. Not now, not ever.', Visual: ExportVisual },
  { title: 'Share.', body: 'Your photos stay on your device. Post wherever you want, whenever you want.', Visual: ShareVisual },
];

export function Onboarding() {
  const hydrated = useSettings((s) => s.hasHydrated);
  const onboarded = useSettings((s) => s.onboarded);
  const update = useSettings((s) => s.update);
  const replay = useUi((s) => s.onboardingReplay);
  const setReplay = useUi((s) => s.setOnboardingReplay);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const open = hydrated && (!onboarded || replay);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStep(0);
  }

  const finish = () => {
    update({ onboarded: true });
    setReplay(false);
  };

  const go = (next: number) => {
    if (next < 0 || next >= STEPS.length) return;
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60) go(step + 1);
    else if (info.offset.x > 60) go(step - 1);
  };

  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  return (
    <D.Root open={open} onOpenChange={(v) => !v && finish()}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Content
              asChild
              forceMount
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') go(step + 1);
                if (e.key === 'ArrowLeft') go(step - 1);
              }}
            >
              <motion.div
                className="fixed inset-0 z-[95] flex flex-col bg-bg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <header className="relative flex items-center justify-between px-5 pt-[max(20px,env(safe-area-inset-top))]">
                  <span className="flex items-center gap-2">
                    <LogoMark className="size-7" />
                    <span className="font-display text-lg font-bold tracking-[-0.04em]">stardeck</span>
                  </span>
                  {!last && (
                    <Button variant="ghost" size="sm" onClick={finish}>
                      Skip
                    </Button>
                  )}
                </header>

                <motion.main
                  className="relative mx-auto flex w-full max-w-md flex-1 touch-pan-y flex-col items-center justify-center px-6"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.18}
                  onDragEnd={onDragEnd}
                >
                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.section
                      key={step}
                      custom={direction}
                      initial={{ opacity: 0, x: direction * 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction * -24 }}
                      transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
                      className="flex w-full flex-col items-center text-center"
                      aria-roledescription="slide"
                      aria-label={`Step ${step + 1} of ${STEPS.length}`}
                    >
                      <div className="flex min-h-[280px] w-full items-center justify-center">
                        <current.Visual />
                      </div>
                      <D.Title className="mt-8 text-display">{current.title}</D.Title>
                      <D.Description className="mt-2 max-w-sm text-[15px] leading-relaxed text-fg-muted">
                        {current.body}
                      </D.Description>
                    </motion.section>
                  </AnimatePresence>
                </motion.main>

                <footer className="relative mx-auto flex w-full max-w-md items-center justify-between gap-4 px-6 pb-[max(28px,env(safe-area-inset-bottom))]">
                  <div className="flex gap-1.5" role="tablist" aria-label="Intro steps">
                    {STEPS.map((s, i) => (
                      <button
                        key={s.title}
                        type="button"
                        role="tab"
                        aria-selected={i === step}
                        aria-label={`Go to step ${i + 1}: ${s.title}`}
                        onClick={() => go(i)}
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-200',
                          i === step ? 'w-6 bg-fg' : 'w-1.5 bg-line-strong hover:bg-fg-subtle',
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {step > 0 && !last && (
                      <Button
                        variant="ghost"
                        size="lg"
                        aria-label="Previous step"
                        onClick={() => go(step - 1)}
                        icon={<ArrowLeft className="size-4" />}
                      />
                    )}
                    {last ? (
                      <Button variant="primary" size="lg" onClick={finish} iconRight={<ArrowRight className="size-4" />}>
                        Start Creating
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={() => go(step + 1)}
                        iconRight={<ArrowRight className="size-4" />}
                      >
                        Next
                      </Button>
                    )}
                  </div>
                </footer>
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
