import { Platform } from 'react-native';

export const C = {
  bg: '#F3F0E8',
  card: '#FFFFFF',
  ink: '#1D2620',
  muted: '#66706A',
  line: '#E2DDD1',
  accent: '#34502F',
  accentSoft: '#E4EBDD',
  danger: '#A63A2B',
  whatsapp: '#1C9E52',
  match: '#C27B0A',
  matchSoft: '#FCF0D9',
};

export const FONT = Platform.OS === 'web' ? 'Heebo, system-ui, -apple-system, sans-serif' : undefined;
