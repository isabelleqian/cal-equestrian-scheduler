// Grid geometry: Monday to Sunday, 7:30 AM to 5:00 PM, 30-minute cells.
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const NUM_DAYS = 7;
export const GRID_START_MIN = 7 * 60 + 30; // 7:30 AM
export const GRID_END_MIN = 17 * 60; // 5:00 PM
export const CELL_MIN = 30;
export const CELLS_PER_DAY = (GRID_END_MIN - GRID_START_MIN) / CELL_MIN; // 19
export const TOTAL_CELLS = NUM_DAYS * CELLS_PER_DAY;

/** Lesson length and travel buffers, in cells. */
export const LESSON_CELLS = 2; // 1 hour
export const BUFFER_CELLS = 2; // 1 hour before and 1 hour after

export const slotKey = (day: number, cell: number) => day * CELLS_PER_DAY + cell;
export const slotDay = (slot: number) => Math.floor(slot / CELLS_PER_DAY);
export const slotCell = (slot: number) => slot % CELLS_PER_DAY;

export const cellStartMin = (cell: number) => GRID_START_MIN + cell * CELL_MIN;

export function fmtMin(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ap = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ap}`;
}

export const cellLabel = (cell: number) => fmtMin(cellStartMin(cell));

/** Valid lesson start cells: leave room for the 1-hour buffer on both sides. */
export const FIRST_START = BUFFER_CELLS; // 8:30 AM
export const LAST_START = CELLS_PER_DAY - LESSON_CELLS - BUFFER_CELLS; // 3:00 PM

export function lessonTimeLabel(start: number): string {
  return `${fmtMin(cellStartMin(start))} to ${fmtMin(cellStartMin(start + LESSON_CELLS))}`;
}

export function travelWindowLabel(start: number): string {
  return `${fmtMin(cellStartMin(start - BUFFER_CELLS))} to ${fmtMin(
    cellStartMin(start + LESSON_CELLS + BUFFER_CELLS),
  )}`;
}

export function lessonLabel(day: number, start: number): string {
  return `${DAY_NAMES[day]} ${lessonTimeLabel(start)}`;
}
