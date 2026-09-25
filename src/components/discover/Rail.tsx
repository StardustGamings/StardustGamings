'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils/cn';

/** Horizontal, snap-scrolling row with desktop arrow controls. */
export function Rail({ children, label, itemClassName }: { children: ReactNode[]; label: string; itemClassName?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [children]);

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
