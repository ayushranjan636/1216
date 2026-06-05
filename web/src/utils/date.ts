import { differenceInDays, differenceInMonths, differenceInYears, format, isToday, isYesterday } from 'date-fns';

export function formatMessageTime(ts: number) {
  return format(new Date(ts), 'h:mm a');
}

export function formatDateSeparator(ts: number) {
  const d = new Date(ts);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}

export function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return format(new Date(ts), 'MMM d');
}

export function relationshipDuration(start: string) {
  const s = new Date(start);
  const now = new Date();
  return {
    years: differenceInYears(now, s),
    months: differenceInMonths(now, s) % 12,
    days: differenceInDays(now, s) % 30,
  };
}

export function formatCallDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatCallTime(ts: number) {
  return format(new Date(ts), 'MMM d, h:mm a');
}

export function groupByDate<T extends { createdAt: number }>(items: T[]) {
  const groups: { date: string; items: T[] }[] = [];
  let current = '';
  for (const item of items) {
    const key = format(new Date(item.createdAt), 'yyyy-MM-dd');
    if (key !== current) {
      current = key;
      groups.push({ date: formatDateSeparator(item.createdAt), items: [item] });
    } else {
      groups[groups.length - 1].items.push(item);
    }
  }
  return groups;
}
