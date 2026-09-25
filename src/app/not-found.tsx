import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NotFound() {
  return (
    <div className="py-16">
      <EmptyState
        title="This page swiped away 👀"
        description="The link might be old, or the page moved. Your projects are all still safe on this device."
        action={
          <Link href="/" className={buttonClasses({ variant: 'primary' })}>
            Back home
          </Link>
        }
      />
    </div>
  );
}
