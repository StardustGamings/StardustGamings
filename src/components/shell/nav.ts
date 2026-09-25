import { Compass, FolderOpen, Home, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

export const normalizePath = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, match: (p) => normalizePath(p) === '/' },
  { href: '/projects/', label: 'Projects', icon: FolderOpen, match: (p) => normalizePath(p).startsWith('/projects') },
  { href: '/discover/', label: 'Discover', icon: Compass, match: (p) => normalizePath(p).startsWith('/discover') },
  { href: '/settings/', label: 'Settings', icon: Settings, match: (p) => normalizePath(p).startsWith('/settings') },
];
