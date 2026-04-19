import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from 'date-fns';

export function formatDate(dateString: string): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  if (isToday(date)) return 'היום';
  if (isYesterday(date)) return 'אתמול';
  if (isTomorrow(date)) return 'מחר';
  return format(date, 'dd/MM/yyyy');
}

export function formatTime(dateString: string): string {
  return format(new Date(dateString), 'HH:mm');
}

export function formatRelative(dateString: string): string {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export const YEAR_LABELS: Record<number, string> = {
  1: 'שנה א\'',
  2: 'שנה ב\'',
  3: 'שנה ג\'',
  4: 'שנה ד\'',
  5: 'שנה ה\'',
  6: 'שנה ו\'',
};

export const INTEREST_OPTIONS = [
  'אנטומיה',
  'פיזיולוגיה',
  'ביוכימיה',
  'פרמקולוגיה',
  'פתולוגיה',
  'מיקרוביולוגיה',
  'כירורגיה',
  'פנימית',
  'ילדים',
  'נשים',
  'פסיכיאטריה',
  'רפואת משפחה',
  'אורתופדיה',
  'עור',
  'עיניים',
  'א.א.ג',
  'נוירולוגיה',
  'רדיולוגיה',
];

export const BRIDGE_TAGS = [
  'לימודים',
  'קליניקה',
  'מחקר',
  'חברתי',
  'ספורט',
  'התנדבות',
  'קריירה',
  'כללי',
];
