export const THEMES = {
  nordic: {
    id: 'nordic',
    name: 'Nordic Frost',
    shortName: 'Frost',
    description: 'Nordic Frosted Glass with Swiss Signal Red Route Highlight',
    bgApp: '#0B0F17',
    drawerBg: 'bg-[#0E1626]/85 backdrop-blur-2xl',
    drawerBorder: 'border-white/15',
    cardBg: 'bg-[#0B1220]/75',
    cardBorder: 'border-white/10',
    inputBg: 'bg-[#0D1829]/80',
    inputBorder: 'border-white/15',
    inputFocus: 'focus-within:border-[#38BDF8]/70',
    accentPrimary: '#38BDF8', // Ice Aurora Sky Blue
    accentSecondary: '#E11D48', // Swiss Signal Red for destination & route
    accentTertiary: '#FDA4AF', // Rose accent for fares/timings
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
      routeHighlightGlow: '#E11D48', // Swiss Signal Red
      routeHighlightCore: '#FFFFFF', // Stark White core line
      stationDot: '#38BDF8',
      trainBeacon: '#E11D48',
    },
  },
};

export const DEFAULT_THEME = THEMES.nordic;

export function getStoredTheme() {
  return 'nordic';
}

export function saveTheme() {
  // No-op - Frost style is locked
}
