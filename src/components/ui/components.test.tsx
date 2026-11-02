import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';
import { Segmented } from './Segmented';
import { Switch } from './Switch';
import { Toaster } from './Toaster';
import { toast, useToasts } from './toast-store';

function SegmentedHarness() {
  const [value, setValue] = useState<'a' | 'b' | 'c'>('a');
  return (
    <>
      <Segmented
        aria-label="Letters"
        value={value}
        onChange={setValue}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
        ]}
      />
      <output>{value}</output>
    </>
  );
}

describe('UI primitives', () => {
  it('Segmented selects with click and arrow keys', async () => {
    const user = userEvent.setup();
    render(<SegmentedHarness />);
    await user.click(screen.getByRole('radio', { name: 'B' }));
    expect(screen.getByRole('status')).toHaveTextContent('b');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'C' })).toHaveFocus();
  });

  it('Switch toggles and is labelled', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [on, setOn] = useState(false);
      return <Switch checked={on} onCheckedChange={setOn} aria-label="Grid" />;
    }
    render(<Harness />);
    const sw = screen.getByRole('switch', { name: 'Grid' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('EmptyState renders its message and action', () => {
    render(<EmptyState title="No designs yet 👀" description="One tap away." action={<button>Create Something</button>} />);
    expect(screen.getByRole('heading', { name: 'No designs yet 👀' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Something' })).toBeInTheDocument();
  });

  it('Toaster announces toasts and runs their action', async () => {
    const user = userEvent.setup();
    let undone = false;
    render(<Toaster />);
    act(() => {
      toast({ title: 'Moved to trash', action: { label: 'Undo', onClick: () => (undone = true) } });
    });
    expect(await screen.findByText('Moved to trash')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undone).toBe(true);
    expect(useToasts.getState().toasts).toHaveLength(0);
  });
});
