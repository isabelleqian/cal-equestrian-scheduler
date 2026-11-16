import { useEffect, useRef } from 'react';
import { CELLS_PER_DAY, DAYS, NUM_DAYS, cellLabel, slotKey } from '../lib/time';

interface GridProps {
  selected?: Set<number>;
  onChange?: (next: Set<number>) => void;
  /** Heatmap mode: number per slot. */
  counts?: number[];
  maxCount?: number;
  /** Slots outlined in gold (coach hours). */
  outline?: Set<number>;
  titleFor?: (slot: number) => string;
}

/**
 * when2meet-style weekly grid. Click or drag to paint. The first cell you
 * press decides whether the drag adds or removes. Works with mouse, pen and
 * touch (pointer events + elementFromPoint).
 */
export default function Grid({ selected, onChange, counts, maxCount, outline, titleFor }: GridProps) {
  const editable = Boolean(onChange && selected);
  const drag = useRef<{ add: boolean; working: Set<number>; last: number } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const end = () => {
      drag.current = null;
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  const slotAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const cell = el?.closest('[data-slot]') as HTMLElement | null;
    return cell ? Number(cell.dataset.slot) : null;
  };

  const paint = (slot: number) => {
    const d = drag.current;
    if (!d || d.last === slot) return;
    d.last = slot;
    if (d.add) d.working.add(slot);
    else d.working.delete(slot);
    onChangeRef.current?.(new Set(d.working));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editable || !selected) return;
    const slot = slotAt(e.clientX, e.clientY);
    if (slot === null) return;
    e.preventDefault();
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    drag.current = { add: !selected.has(slot), working: new Set(selected), last: -1 };
    paint(slot);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const slot = slotAt(e.clientX, e.clientY);
    if (slot !== null) paint(slot);
  };

  const toggleDay = (day: number) => {
    if (!editable || !selected || !onChange) return;
    const keys = Array.from({ length: CELLS_PER_DAY }, (_, c) => slotKey(day, c));
    const allOn = keys.every((k) => selected.has(k));
    const next = new Set(selected);
    keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
    onChange(next);
  };

  const max = maxCount ?? (counts ? Math.max(1, ...counts) : 1);

  return (
    <div className="grid-wrap">
      <table
        className={`grid ${editable ? 'editable' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <thead>
          <tr>
            <th className="time-col" />
            {DAYS.map((d, i) => (
              <th key={d} onClick={() => toggleDay(i)} title={editable ? 'Click to fill or clear the whole day' : ''}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: CELLS_PER_DAY }, (_, c) => (
            <tr key={c} className={c % 2 === 1 ? 'half' : ''}>
              <th className="time-col">{cellLabel(c)}</th>
              {Array.from({ length: NUM_DAYS }, (_, d) => {
                const k = slotKey(d, c);
                const on = selected?.has(k);
                let style: React.CSSProperties | undefined;
                let text = '';
                if (counts) {
                  const v = counts[k] ?? 0;
                  const a = v === 0 ? 0 : 0.12 + 0.88 * (v / max);
                  style = { background: `rgba(0, 50, 98, ${a})`, color: a > 0.55 ? '#fff' : '#003262' };
                  text = v ? String(v) : '';
                }
                const cls = ['cell', on ? 'on' : '', outline?.has(k) ? 'outline' : ''].join(' ');
                return (
                  <td key={d} data-slot={k} className={cls} style={style} title={titleFor?.(k)}>
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="end-row">
            <th className="time-col">5:00 PM</th>
            <td colSpan={NUM_DAYS} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
