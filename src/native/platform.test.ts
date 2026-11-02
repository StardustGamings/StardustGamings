import { afterEach, describe, expect, it } from 'vitest';
import { isDesktopApp, isInstalledApp, isNativeApp } from './platform';

type CapWindow = Window & { Capacitor?: { isNativePlatform: () => boolean } };

afterEach(() => {
  delete (window as CapWindow).Capacitor;
});

// The Windows app (app:// pages) is covered by desktop/smoke.mjs, which runs the real app.
describe('platform', () => {
  it('is a plain browser by default', () => {
    expect(isNativeApp()).toBe(false);
    expect(isDesktopApp()).toBe(false);
    expect(isInstalledApp()).toBe(false);
  });

  it('knows when it runs inside the Android app', () => {
    (window as CapWindow).Capacitor = { isNativePlatform: () => true };
    expect(isNativeApp()).toBe(true);
    expect(isInstalledApp()).toBe(true);
  });

  it('ignores a Capacitor web build', () => {
    (window as CapWindow).Capacitor = { isNativePlatform: () => false };
    expect(isInstalledApp()).toBe(false);
  });
});
