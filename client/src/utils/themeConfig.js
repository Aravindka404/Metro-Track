export const THEMES = {
  dark: {
    id: 'dark',
    isLight: false,
    name: 'Obsidian Night',
    shortName: 'Dark',
    description: 'High-contrast Obsidian Night mode with luminous schematic traces',
    bgApp: '#0B0F17',
    drawerBg: 'bg-[#0E1626]/85 backdrop-blur-2xl',
    drawerBorder: 'border-white/15',
    cardBg: 'bg-[#0B1220]/75',
    cardBorder: 'border-white/10',
    headerBg: 'bg-[#0E1626]/90 border-white/15 text-white',
    inputBg: 'bg-[#0D1829]/80',
    inputBorder: 'border-white/15',
    inputFocus: 'focus-within:border-[#38BDF8]/70',
    textPrimary: 'text-white',
    textSecondary: 'text-slate-400',
    textMuted: 'text-slate-500',
    accentPrimary: '#38BDF8', // Ice Aurora Sky Blue
    accentSecondary: '#E11D48', // Swiss Signal Red
    accentTertiary: '#FDA4AF',
    pillActive: 'bg-[#38BDF8] text-[#0B0F17] shadow-md shadow-[#38BDF8]/30',
    pillInactive: 'text-slate-400 hover:text-white hover:bg-white/5',
    timeButton: 'bg-[#38BDF8]/20 text-[#38BDF8] border-[#38BDF8]/40 hover:bg-[#38BDF8]/30',
    fareBadgeBg: 'bg-[#2E121B]/80',
    fareBadgeText: 'text-[#FDA4AF]',
    fareBadgeBorder: 'border-[#E11D48]/40',
    expandedTrainBg: 'bg-gradient-to-b from-[#182032]/85 to-[#0D1626]/85',
    expandedTrainBorder: 'border-[#E11D48]/40',
    expandedTrainShadow: 'shadow-[0_8px_30px_rgba(225,29,72,0.18)]',
    glowDot: 'bg-[#E11D48]',
    activeBadgeBg: 'bg-[#2E121B]',
    activeBadgeText: 'text-[#FB7185]',
    activeBadgeBorder: 'border-[#E11D48]/50',
    statusBorder: 'border-[#E11D48]/50',
    hoverRow: 'hover:bg-white/[0.05] active:bg-white/[0.08]',
    swapBtn: 'bg-[#122035] border-white/20 text-white hover:border-white/40 hover:bg-[#162740]',
    map: {
      bg: '#0B0F17',
      waterFill: '#080C14',
      waterLine: '#131D2E',
      trackGlow: '#38BDF8',
      trackCore: '#67E8F9',
      routeHighlightGlow: '#E11D48',
      routeHighlightCore: '#FFFFFF',
      stationDot: '#FFFFFF',
      stationText: '#94A3B8',
      stationTextActive: '#FFFFFF',
      ringOffset: '#0B0F17',
      trainBeacon: '#E11D48',
    },
  },
  light: {
    id: 'light',
    isLight: true,
    name: 'Alabaster Day',
    shortName: 'Light',
    description: 'Apple Maps / Citymapper-style crisp alabaster day mode with deep KMRL teal tracks',
    bgApp: '#F8FAFC',
    drawerBg: 'bg-white/92 backdrop-blur-2xl',
    drawerBorder: 'border-slate-200/90 shadow-2xl',
    cardBg: 'bg-slate-50/90',
    cardBorder: 'border-slate-200',
    headerBg: 'bg-white/95 border-slate-200 text-slate-900 shadow-md',
    inputBg: 'bg-slate-100/90',
    inputBorder: 'border-slate-300',
    inputFocus: 'focus-within:border-teal-600',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-600',
    textMuted: 'text-slate-400',
    accentPrimary: '#0F766E', // Deep KMRL Teal
    accentSecondary: '#E11D48', // Crimson Red
    accentTertiary: '#9F1239',
    pillActive: 'bg-teal-600 text-white shadow-md shadow-teal-600/30',
    pillInactive: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
    timeButton: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
    fareBadgeBg: 'bg-rose-50',
    fareBadgeText: 'text-rose-700',
    fareBadgeBorder: 'border-rose-200',
    expandedTrainBg: 'bg-gradient-to-b from-white to-slate-50',
    expandedTrainBorder: 'border-rose-300',
    expandedTrainShadow: 'shadow-[0_8px_30px_rgba(225,29,72,0.12)]',
    glowDot: 'bg-[#E11D48]',
    activeBadgeBg: 'bg-rose-50',
    activeBadgeText: 'text-rose-700',
    activeBadgeBorder: 'border-rose-200',
    statusBorder: 'border-rose-300',
    hoverRow: 'hover:bg-slate-100/80 active:bg-slate-200/80',
    swapBtn: 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-sm',
    map: {
      bg: '#F8FAFC',
      waterFill: '#E2E8F0',
      waterLine: '#CBD5E1',
      trackGlow: '#0F766E',
      trackCore: '#0D9488',
      routeHighlightGlow: '#E11D48',
      routeHighlightCore: '#BE123C',
      stationDot: '#0F172A',
      stationText: '#334155',
      stationTextActive: '#0F172A',
      ringOffset: '#F8FAFC',
      trainBeacon: '#E11D48',
    },
  },
};

THEMES.nordic = THEMES.dark; // Backward compatibility alias

export const DEFAULT_THEME = THEMES.dark;

const THEME_STORAGE_KEY = 'kmrl_user_theme';

export function applyDocumentTheme(themeId) {
  if (typeof document === 'undefined') return;
  if (themeId === 'light') {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }
}

export function getStoredTheme() {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      applyDocumentTheme(stored);
      return stored;
    }
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      applyDocumentTheme('light');
      return 'light';
    }
    applyDocumentTheme('dark');
    return 'dark';
  } catch (e) {
    applyDocumentTheme('dark');
    return 'dark';
  }
}

export function saveTheme(themeId) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    applyDocumentTheme(themeId);
  } catch (e) {
    // Ignore storage quota or access errors
  }
}
