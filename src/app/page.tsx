import Link from 'next/link';
import { Suspense } from 'react';
import { HomeHero } from '@/components/home/HomeHero';
import { NewFromQuery } from '@/components/home/NewFromQuery';
import { QuickCreate } from '@/components/home/QuickCreate';
import { PhotoMagic } from '@/components/home/PhotoMagic';
import { RecentProjects } from '@/components/home/RecentProjects';
import { SectionHeader } from '@/components/home/SectionHeader';
import { InspirationFeed } from '@/components/discover/InspirationFeed';
import { Trending } from '@/components/discover/Trending';

/** Home: your recent work first, then the ways to start something, then ideas. */
export default function HomePage() {
  return (
    <>
      <Suspense>
        <NewFromQuery />
      </Suspense>
      <HomeHero />
      <RecentProjects />
      <QuickCreate />
      <PhotoMagic />
      <Trending />
      <section aria-labelledby="inspiration" className="mt-12">
        <SectionHeader
          id="inspiration"
          title="Inspiration"
          description="Our templates, remixed in this month’s palettes. Tap Remix to make one yours."
          action={
            <Link href="/discover/#inspiration" className="text-[13.5px] font-medium text-accent-text hover:underline">
              See all
            </Link>
          }
        />
        <InspirationFeed limit={8} />
      </section>
    </>
  );
}
