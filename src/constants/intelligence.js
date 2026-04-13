/** Shared color palette for intelligence pages — single source of truth. */
export const COLORS = {
  bg: '#0F172A',
  card: '#1B2330',
  cardBorder: 'rgba(255,255,255,0.1)',
  green: '#22C55E',
  greenDark: '#16A34A',
  greenLight: 'rgba(34,197,94,0.15)',
  red: '#EF4444',
  amber: '#F59E0B',
  blue: '#3B82F6',
  text: '#FFFFFF',
  subtext: '#94A3B8',
  muted: '#64748B',
};

/** Risk level → color mapping. */
export const RISK_COLORS = {
  low: '#22C55E',
  moderate: '#F59E0B',
  high: '#F97316',
  urgent: '#EF4444',
};

/** Shared inline spinner keyframes (inject once via a <style> tag or use CSS animation). */
export const SPINNER_STYLE = {
  display: 'inline-block',
  width: 20,
  height: 20,
  border: '2.5px solid rgba(255,255,255,0.15)',
  borderTopColor: '#22C55E',
  borderRadius: '50%',
  animation: 'spin 0.6s linear infinite',
};
