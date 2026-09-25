import type { Metadata } from 'next';
import { SettingsView } from '@/components/settings/SettingsView';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <>
      <header className="pt-4 pb-8">
        <p className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-accent-text uppercase">Make it yours</p>
        <h1 className="text-4xl font-extrabold sm:text-5xl">Settings</h1>
      </header>
      <SettingsView />
    </>
  );
}
