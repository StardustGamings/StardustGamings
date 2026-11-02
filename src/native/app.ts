import { App } from '@capacitor/app';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';

/**
 * Android-app glue, loaded on demand (browsers never download it).
 * The back button closes an open dialog or menu first, then goes back a page,
 * then leaves the app — the way Android apps are expected to behave.
 */
export function handleBackButton(): () => void {
  const listener = App.addListener('backButton', ({ canGoBack }) => {
    const layer = document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]',
    );
    if (layer) {
      // Dialogs and menus already close on Escape.
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });
  return () => void listener.then((l) => l.remove());
}

/** Keeps the status-bar icons readable on the current theme. */
export function matchSystemBars(theme: string): void {
  void SystemBars.setStyle({ style: theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark });
}
