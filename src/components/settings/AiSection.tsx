'use client';

import { Bot, Cpu, Server } from 'lucide-react';
import { aiServerHost } from '@/ai/cloud';
import { aiServerConfigured } from '@/ai/service';
import { useSettings } from '@/settings/store';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { SettingRow, SettingsSection } from './SettingRow';

const ON_DEVICE = [
  'Captions & hashtags from the words in your design',
  'Colour palettes from your photos, plus harmonies',
  'Font pairings from the bundled fonts',
  'Background concepts in your colours',
  'Photos → carousel: cover, order and vibe',
  'Smart resize to 4:5, 1:1, 9:16, 16:9 and more',
];

/** What the AI tools do, where they run, and the opt-in for an AI server (only when this site has one). */
export function AiSection() {
  const cloud = useSettings((s) => s.privacy.cloudFeatures);
  const updatePrivacy = useSettings((s) => s.updatePrivacy);
  const configured = aiServerConfigured();
  const host = aiServerHost();
  return (
    <SettingsSection
      id="ai"
      title="AI tools"
      icon={<Bot />}
      description="Optional helpers in the editor’s Magic tool (M). Stardeck works fully without them."
    >
      <div className="rounded-[18px] border border-success/25 bg-success/8 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-success">
          <Cpu className="size-4" /> On your device — always available, nothing uploaded
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-[13px] text-fg-muted">
          {ON_DEVICE.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
      {configured ? (
        <SettingRow
          title="Use the AI server"
          description={`Captions, font pairings, background concepts and carousel plans ask ${host} first, for freer results. It receives your design’s text, colours and photo measurements (brightness, colour, size) — never your photos — and runs a Claude model. Off: everything stays on your device.`}
          control={({ descriptionId }) => (
            <Switch
              checked={cloud}
              onCheckedChange={(v) => updatePrivacy({ cloudFeatures: v })}
              aria-label="Use the AI server"
              aria-describedby={descriptionId}
            />
          )}
        />
      ) : (
        <SettingRow
          title="AI server"
          description="Not set up on this site, so every AI tool runs on your device. Whoever hosts Stardeck can add one (their own API key stays on their server) — see docs/AI.md."
          control={() => (
            <Badge>
              <Server className="mr-1 size-3" /> Not set up
            </Badge>
          )}
        />
      )}
    </SettingsSection>
  );
}
