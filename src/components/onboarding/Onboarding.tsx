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

/* ───────────── Visuals for each step (pure CSS/SVG, no image assets) ───────────── */

function CreateVisual() {
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {FORMAT_ORDER.map((id, i) => {
        const [a, b] = FORMATS[id].accent;
        return (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 30, rotate: (i % 2 ? 1 : -1) * 12, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
            transition={{ delay: 0.05 * i, type: 'spring', stiffness: 260, damping: 20 }}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[18px] text-ink shadow-[var(--shadow-lift)]"
            style={{ background: `linear-gradient(140deg, ${a}, ${b})` }}
          >
            <FormatIcon format={id} className="size-6" />
            <span className="text-[10px] font-bold">{FORMATS[id].label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

function CarouselVisual() {
  const colors = ['#C6FF3D', '#3CF0C8', '#7CC4FF', '#A06BFF', '#FF5CAA'];
  return (
    <div className="relative mx-auto w-[220px]">
      <div className="relative z-10 overflow-hidden rounded-[30px] border-[6px] border-ink bg-ink shadow-[var(--shadow-float)]">
        <motion.div
          className="flex"
          animate={{ x: ['0%', '0%', '-100%', '-100%', '-200%', '-200%', '-300%', '-300%', '0%'] }}
          transition={{ duration: 7, repeat: Infinity, ease: [0.65, 0, 0.35, 1] }}
        >
          {colors.slice(0, 4).map((c, i) => (
            <div
              key={c}
              className="relative aspect-[4/5] w-full shrink-0"
              style={{ background: `linear-gradient(90deg, ${c}, ${colors[i + 1]})` }}
            >
              <span className="absolute top-3 left-3 font-display text-3xl font-extrabold text-ink/80">0{i + 1}</span>
              {i === 0 && <span className="absolute top-1/2 -right-8 size-16 -translate-y-1/2 rounded-full bg-ink" />}
              {i === 1 && <span className="absolute top-1/2 -left-8 size-16 -translate-y-1/2 rounded-full bg-ink" />}
            </div>
          ))}
        </motion.div>
      </div>
      <div className="mt-4 flex justify-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="size-1.5 rounded-full bg-fg-subtle" />
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-fg-muted">Designs flow across every swipe</p>
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
    const t = window.setInterval(() => setI((n) => (n + 1) % FONT_CYCLE.length), 1100);
    return () => window.clearInterval(t);
  }, []);
  const f = FONT_CYCLE[i]!;
  const swatches = ['#C6FF3D', '#FF5CAA', '#A06BFF', '#3CF0FF', '#FFD23D', '#F4F1EA'];
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex h-28 items-center">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={f.family}
            initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
            transition={{ duration: 0.35 }}
            className="text-nova text-7xl leading-none"
            style={{ fontFamily: `"${f.family}"`, fontWeight: f.weight, fontStyle: f.style }}
          >
            yours
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="flex gap-2">
        {swatches.map((c, n) => (
          <motion.span
            key={c}
            className="size-9 rounded-full border-2 border-bg shadow-[var(--shadow-soft)]"
            style={{ background: c }}
            animate={{ y: n === i % swatches.length ? -8 : 0, scale: n === i % swatches.length ? 1.12 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          />
        ))}
      </div>
      <p className="text-xs text-fg-muted">{f.family} · one of 18 fonts that work offline</p>
    </div>
  );
}

function ExportVisual() {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-40 w-32">
        {[0, 1, 2].map((n) => (
          <motion.div
            key={n}
            className="absolute inset-0 rounded-[18px] border border-line-strong shadow-[var(--shadow-lift)]"
            style={{ background: ['#A06BFF', '#3CF0C8', '#C6FF3D'][n] }}
            initial={{ rotate: 0, x: 0 }}
            animate={{ rotate: (n - 1) * 9, x: (n - 1) * 26 }}
            transition={{ delay: 0.15 + n * 0.08, type: 'spring', stiffness: 220, damping: 16 }}
          />
        ))}
        <motion.div
          className="absolute -bottom-4 left-1/2 flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-ink text-lime shadow-[var(--shadow-lift)]"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          <Download className="size-5" />
        </motion.div>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {['PNG', 'JPG', 'WebP', 'PDF', 'MP4'].map((f) => (
          <span key={f} className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-fg-muted">
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
      <div className="overflow-hidden rounded-[26px] border border-line-strong bg-bg-elevated shadow-[var(--shadow-float)]">
        <div className="flex items-center gap-2 p-3">
          <LogoMark className="size-6" />
          <span className="text-xs font-bold">you</span>
        </div>
        <div className="aspect-[4/5] bg-[linear-gradient(135deg,#C6FF3D,#3CF0C8_45%,#A06BFF)]" />
        <div className="flex gap-3 p-3 text-fg">
          <Heart className="size-5 fill-pink text-pink" />
          <MessageCircle className="size-5" />
          <Send className="size-5" />
        </div>
      </div>
      {[0, 1, 2, 3].map((n) => (
        <motion.span
          key={n}
          className="absolute right-2 bottom-16 text-pink"
          initial={{ opacity: 0, y: 0, x: 0 }}
          animate={{ opacity: [0, 1, 0], y: -110 - n * 14, x: (n % 2 ? 1 : -1) * (10 + n * 6) }}
          transition={{ duration: 2.2, repeat: Infinity, delay: n * 0.45, ease: 'easeOut' }}
        >
          <Heart className="size-5 fill-current" />
        </motion.span>
      ))}
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
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3 }}
              >
                <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="motion-decorative absolute -top-1/4 -left-1/4 h-[80vmax] w-[80vmax] animate-drift rounded-full bg-[radial-gradient(closest-side,rgb(160_107_255/0.35),transparent)] blur-3xl" />
                  <div className="motion-decorative absolute -right-1/4 -bottom-1/3 h-[70vmax] w-[70vmax] animate-drift-slow rounded-full bg-[radial-gradient(closest-side,rgb(198_255_61/0.18),transparent)] blur-3xl" />
                </div>

                <header className="relative flex items-center justify-between px-5 pt-[max(20px,env(safe-area-inset-top))]">
                  <span className="flex items-center gap-2">
                    <LogoMark className="size-7" />
                    <span className="font-display text-lg font-extrabold tracking-[-0.04em]">stardeck</span>
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
                      initial={{ opacity: 0, x: direction * 60 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction * -60 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                      className="flex w-full flex-col items-center text-center"
                      aria-roledescription="slide"
                      aria-label={`Step ${step + 1} of ${STEPS.length}`}
                    >
                      <div className="flex min-h-[300px] w-full items-center justify-center">
                        <current.Visual />
                      </div>
                      <D.Title className="mt-8 font-display text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">
                        {current.title}
                      </D.Title>
                      <D.Description className="mt-3 max-w-sm text-[15px] leading-relaxed text-fg-muted">
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
                          'h-2 rounded-full transition-all duration-300',
                          i === step ? 'w-7 bg-accent' : 'w-2 bg-line-strong hover:bg-fg-subtle',
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
                      <Button variant="nova" size="lg" magnetic onClick={finish} iconRight={<ArrowRight className="size-4" />}>
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
