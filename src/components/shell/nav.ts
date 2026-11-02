import { Compass, FolderOpen, Home, LayoutTemplate, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  /** Shown in the phone tab bar (Settings lives behind the profile button there). */
  phone?: boolean;
  /** Shows a dot when a new trend drop has arrived since it was last opened. */
  trendDot?: boolean;
}

export const normalizePath = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, match: (p) => normalizePath(p) === '/', phone: true },
  {
    href: '/projects/',
    label: 'Projects',
    icon: FolderOpen,
    match: (p) => normalizePath(p).startsWith('/projects'),
    phone: true,
  },
  {
    href: '/templates/',
    label: 'Templates',
    icon: LayoutTemplate,
    match: (p) => normalizePath(p).startsWith('/templates'),
    phone: true,
  },
  {
    href: '/discover/',
    label: 'Discover',
    icon: Compass,
    match: (p) => normalizePath(p).startsWith('/discover'),
    phone: true,
    trendDot: true,
  },
  { href: '/settings/', label: 'Settings', icon: Settings, match: (p) => normalizePath(p).startsWith('/settings') },
];
