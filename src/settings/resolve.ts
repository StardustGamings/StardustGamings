import type { MotionPreference, ResolvedMotion, ResolvedTheme, ThemePreference } from '@/types/settings';

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

export function resolveMotion(pref: MotionPreference, systemPrefersReduced: boolean): ResolvedMotion {
  if (pref === 'system') return systemPrefersReduced ? 'reduced' : 'full';
  return pref;
}

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: '#0A0A11',
  light: '#F5F3FA',
  oled: '#000000',
};

/**
 * Runs inline in <head> before first paint so the page never flashes the wrong
 * theme. It must stay dependency-free and mirror resolveTheme/resolveMotion.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,s={};try{var raw=localStorage.getItem('stardeck.settings');if(raw){s=(JSON.parse(raw)||{}).state||{};}}catch(e){}
var mq=function(q){return window.matchMedia&&window.matchMedia(q).matches;};
var t=s.theme||'dark';if(t==='system'){t=mq('(prefers-color-scheme: dark)')?'dark':'light';}if(['dark','light','oled'].indexOf(t)<0){t='dark';}
var m=s.motion||'system';if(m==='system'){m=mq('(prefers-reduced-motion: reduce)')?'reduced':'full';}if(['full','reduced','off'].indexOf(m)<0){m='full';}
d.dataset.theme=t;d.dataset.motion=m;d.dataset.contrast=s.highContrast?'high':'normal';d.dataset.glass=s.glass===false?'off':'on';d.dataset.ambient=s.ambientEffects===false?'off':'on';
var sc=Number(s.uiScale);if(sc>=0.875&&sc<=1.25){d.style.fontSize=(sc*100)+'%';}d.style.colorScheme=t==='light'?'light':'dark';}catch(e){}})();`;
