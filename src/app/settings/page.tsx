import type { Metadata } from 'next';
import { SettingsView } from '@/components/settings/SettingsView';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <>
      <header className="pb-6">
        <h1 className="text-display">Settings</h1>
      </header>
      <SettingsView />
    </>
  );
}
