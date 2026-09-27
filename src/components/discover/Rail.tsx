'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils/cn';

/** Horizontal, snap-scrolling row with desktop arrow controls. */
export function Rail({ children, label, itemClassName }: { children: ReactNode[]; label: string; itemClassName?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const count = children.length;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft < 8;
      const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    // Measured after the browser's own layout (and on scroll), never forced from a render.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (ro) ro.observe(el);
    else update();
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      ro?.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [count]);

  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <div className="group/rail relative">
      <ul
        ref={ref}
        aria-label={label}
        className="-mx-4 hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
      >
        {children.map((child, i) => (
          <li key={i} className={cn('shrink-0 snap-start', itemClassName)}>
            {child}
          </li>
        ))}
      </ul>
      <div className="pointer-events-none absolute -top-14 right-0 hidden gap-1 md:flex">
        <IconButton
          label="Scroll left"
          icon={<ChevronLeft />}
          size="sm"
          variant="solid"
          disabled={edges.start}
          onClick={() => scroll(-1)}
          className="pointer-events-auto"
        />
        <IconButton
          label="Scroll right"
          icon={<ChevronRight />}
          size="sm"
          variant="solid"
          disabled={edges.end}
          onClick={() => scroll(1)}
          className="pointer-events-auto"
        />
      </div>
    </div>
  );
}
