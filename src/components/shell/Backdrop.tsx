'use client';

import { useEffect, useRef } from 'react';
import { useSettings } from '@/settings/store';
import { useResolvedMotion, useResolvedTheme } from '@/hooks/usePreferences';

interface Particle {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  drift: number;
}

/** Twinkling "stardust" — capped particle count, ~30fps, pauses when hidden. */
function Stardust({ animate, color }: { animate: boolean; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let particles: Particle[] = [];
    let raf = 0;
    let last = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const count = Math.min(70, Math.round((w * h) / 24000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.2,
        drift: 4 + Math.random() * 10,
      }));
    };

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      for (const p of particles) {
        const tw = animate ? 0.35 + 0.65 * Math.abs(Math.sin(p.phase + (t / 1000) * p.speed)) : 0.6;
        const y = animate ? ((p.y - (((t / 1000) * p.drift) % (h + 20)) + h + 20) % (h + 20)) - 10 : p.y;
        ctx.globalAlpha = tw * 0.8;
        ctx.beginPath();
        ctx.arc(p.x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 33) return;
      last = t;
      draw(t);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && animate) raf = requestAnimationFrame(loop);
    };

    resize();
    draw(0);
    if (animate) raf = requestAnimationFrame(loop);
    const onResize = () => {
      resize();
      draw(performance.now());
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [animate, color]);

  return <canvas ref={ref} className="absolute inset-0 size-full" aria-hidden />;
}

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Ambient app background: aurora gradients, film grain and optional stardust. */
export function Backdrop() {
  const ambient = useSettings((s) => s.ambientEffects);
  const highContrast = useSettings((s) => s.highContrast);
  const motion = useResolvedMotion();
  const theme = useResolvedTheme();
  const showDust = ambient && !highContrast && motion !== 'off';

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{ opacity: 'var(--aurora-opacity)' }}>
        <div className="motion-decorative absolute -top-[25%] -left-[15%] h-[70vmax] w-[70vmax] animate-drift rounded-full bg-[radial-gradient(closest-side,rgb(160_107_255/0.55),transparent)] blur-3xl" />
        <div className="motion-decorative absolute top-[10%] -right-[20%] h-[60vmax] w-[60vmax] animate-drift-slow rounded-full bg-[radial-gradient(closest-side,rgb(60_240_200/0.32),transparent)] blur-3xl" />
        <div className="motion-decorative absolute -bottom-[30%] left-[25%] h-[55vmax] w-[55vmax] animate-drift rounded-full bg-[radial-gradient(closest-side,rgb(255_92_170/0.3),transparent)] blur-3xl [animation-delay:-12s]" />
      </div>
      {showDust && <Stardust animate={motion === 'full'} color={theme === 'light' ? '#6B4DFF' : '#FFFFFF'} />}
      <div className="absolute inset-0 mix-blend-overlay" style={{ backgroundImage: GRAIN, opacity: 'var(--grain-opacity)' }} />
    </div>
  );
}
