import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import { HomeHero } from '@/components/home/HomeHero';
import { NewFromQuery } from '@/components/home/NewFromQuery';
import { QuickCreate } from '@/components/home/QuickCreate';
import { PhotoMagic } from '@/components/home/PhotoMagic';
import { RecentProjects } from '@/components/home/RecentProjects';
import { SectionHeader } from '@/components/home/SectionHeader';
import { InspirationFeed } from '@/components/discover/InspirationFeed';
import { Trending } from '@/components/discover/Trending';
import { buttonClasses } from '@/components/ui/button-styles';

export default function HomePage() {
  return (
    <>
      <Suspense>
        <NewFromQuery />
      </Suspense>
      <HomeHero />
      <QuickCreate />
      <PhotoMagic />
      <RecentProjects />
      <Trending />
      <section aria-labelledby="inspiration" className="mt-14">
        <SectionHeader
          id="inspiration"
          eyebrow="Inspiration"
          title="Steal this energy"
          description="Remixes of our templates in this month’s palettes. Tap Remix to make one yours."
          action={
            <Link
              href="/discover/#inspiration"
              className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'hidden sm:inline-flex' })}
            >
              More <ArrowRight className="size-4" />
            </Link>
          }
        />
        <InspirationFeed limit={8} />
      </section>
    </>
  );
}
