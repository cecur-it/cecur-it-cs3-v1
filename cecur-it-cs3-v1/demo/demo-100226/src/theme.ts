/**
 * CECUR-IT SOC Console Theme Tokens & Color System
 * Blueprint Specification: Blue, Light Blue, Cyan, Electric Blue Palette
 */

export const THEME_TOKENS = {
  // Brand & Interactive Colors
  electricBlue: '#0A84FF',
  cyan: '#00E5FF',
  
  // Surfaces & Backgrounds
  lightBlue: '#0C1B2B',
  lightBlueSubtle: '#12283E',
  deepBlue: '#0B1B32',
  darkCanvas: '#060B12',
  darkSurface: '#0C1B2B',
  darkSubtle: '#12283E',
  
  // Borders
  borderBlue: '#1A3959',
  borderDark: '#1A3959',
  borderLight: '#234970',
  
  // Text
  textNavy: '#FFFFFF',
  textWhite: '#FFFFFF',
  textSlate: '#94A3B8',
  textMutedDark: '#94A3B8',
  textDimDark: '#627D98',
} as const;

export type SeverityLevel = 'HIGH' | 'CRITICAL' | 'MEDIUM' | 'LOW' | 'INFO' | 'NOMINAL';

/**
 * Standardized Blueprint Severity Styles
 * High: Bright Electric Blue (#0A84FF)
 * Medium: Cyan (#00E5FF)
 * Low / Nominal: Light Blue (#E6F2FF / #4A90E2)
 */
export const getSeverityBadgeStyle = (severity: string): { bg: string; text: string; border: string } => {
  const norm = severity.toUpperCase();
  if (norm === 'CRITICAL' || norm === 'HIGH' || norm === 'P1' || norm === 'BLOCKER') {
    return {
      bg: 'bg-[#0A84FF]/20',
      text: 'text-[#0A84FF]',
      border: 'border-[#0A84FF]/50',
    };
  }
  if (norm === 'MEDIUM' || norm === 'MODERATE' || norm === 'P2' || norm === 'WARNING') {
    return {
      bg: 'bg-[#00E5FF]/20',
      text: 'text-[#00E5FF]',
      border: 'border-[#00E5FF]/50',
    };
  }
  // Low / Info / Nominal / Clean
  return {
    bg: 'bg-[#00E5FF]/10',
    text: 'text-[#BAE3FF]',
    border: 'border-[#1A3959]',
  };
};

/**
 * Standardized Role Styles for RBAC badges
 */
export const getRoleBadgeStyle = (role: string): { bg: string; text: string; border: string } => {
  const norm = role.toLowerCase();
  switch (norm) {
    case 'admin':
      return {
        bg: 'bg-[#0A84FF]/20',
        text: 'text-[#0A84FF]',
        border: 'border-[#0A84FF]/50',
      };
    case 'analyst':
      return {
        bg: 'bg-[#00E5FF]/20',
        text: 'text-[#00E5FF]',
        border: 'border-[#00E5FF]/50',
      };
    case 'auditor':
      return {
        bg: 'bg-[#0A84FF]/15',
        text: 'text-[#BAE3FF]',
        border: 'border-[#1A3959]',
      };
    case 'executive':
    default:
      return {
        bg: 'bg-[#00E5FF]/15',
        text: 'text-[#FFFFFF]',
        border: 'border-[#00E5FF]/40',
      };
  }
};
