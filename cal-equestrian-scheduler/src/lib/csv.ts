import type { Group, Unplaced } from './pairing';
import { DAY_NAMES, lessonTimeLabel, travelWindowLabel } from './time';

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function pairingCsv(
  groups: Group[],
  unplaced: Unplaced[],
  names: Record<string, string>,
  emails: Record<string, string>,
): string {
  const n = (id: string) => names[id] ?? 'Unknown';
  const rows: string[][] = [
    ['Group', 'Day', 'Lesson', 'Travel window', 'Driver', 'Driver email', 'Rider 1', 'Rider 2', 'Rider 3', 'Rider emails'],
  ];
  [...groups]
    .sort((a, b) => a.day - b.day || a.start - b.start)
    .forEach((g, i) => {
      const riders = [...g.memberIds];
      while (riders.length < 3) riders.push('');
      rows.push([
        String(i + 1),
        DAY_NAMES[g.day],
        lessonTimeLabel(g.start),
        travelWindowLabel(g.start),
        n(g.driverId),
        emails[g.driverId] ?? '',
        ...riders.slice(0, 3).map((id) => (id ? n(id) : '')),
        g.memberIds.map((id) => emails[id] ?? '').join('; '),
      ]);
    });
  rows.push([]);
  rows.push(['Not placed', 'Email', 'Reason']);
  unplaced.forEach((u) => rows.push([n(u.id), emails[u.id] ?? '', u.reason]));
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
