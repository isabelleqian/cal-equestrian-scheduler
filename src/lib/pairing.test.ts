import { describe, expect, it } from 'vitest';
import {
  allLessonTimes,
  coachFreeFor,
  compareOptions,
  generatePairings,
  lessonsOverlap,
  memberFreeFor,
  validateGroups,
  type Member,
} from './pairing';
import { CELLS_PER_DAY, FIRST_START, LAST_START, cellStartMin, fmtMin, slotKey } from './time';

/** Cells for day `d` from hh:mm to hh:mm (end exclusive). */
function range(d: number, from: string, to: string): number[] {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const out: number[] = [];
  for (let c = 0; c < CELLS_PER_DAY; c++) {
    const m = cellStartMin(c);
    if (m >= toMin(from) && m < toMin(to)) out.push(slotKey(d, c));
  }
  return out;
}
const allWeek = () => Array.from({ length: 7 * CELLS_PER_DAY }, (_, i) => i);
const m = (id: string, isDriver: boolean, slots: number[]): Member => ({ id, name: id, isDriver, slots });
const opts = { restarts: 60, timeLimitMs: 60_000, seed: 7 };

/** Assert every hard rule on every generated option. */
function assertValid(members: Member[], coach: number[], options: ReturnType<typeof generatePairings>) {
  for (const o of options) {
    const errs = validateGroups(o.groups, members, coach);
    expect(errs).toEqual([]);
    const ids = o.groups.flatMap((g) => [g.driverId, ...g.memberIds]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(o.placedCount + o.unplaced.length).toBe(members.length);
  }
}

describe('grid bounds', () => {
  it('earliest lesson is 8:30 and latest is 3:00', () => {
    expect(fmtMin(cellStartMin(FIRST_START))).toBe('8:30 AM');
    expect(fmtMin(cellStartMin(LAST_START))).toBe('3:00 PM');
    expect(allLessonTimes()).toHaveLength(7 * (LAST_START - FIRST_START + 1));
  });
});

describe('3-hour travel buffer', () => {
  it('requires 1 hour before and after the lesson', () => {
    const s = new Set(range(0, '9:00', '12:00'));
    expect(memberFreeFor(s, 0, 5)).toBe(true); // 10:00 lesson, 9:00 to 12:00 block
    expect(memberFreeFor(s, 0, 6)).toBe(false); // 10:30 lesson needs until 12:30
    expect(memberFreeFor(s, 0, 4)).toBe(false); // 9:30 lesson needs from 8:30
  });

  it('does not place a group that is free only for the lesson hour', () => {
    const coach = allWeek();
    const members = [m('d', true, range(0, '10:00', '11:00')), m('n', false, range(0, '10:00', '11:00'))];
    const res = generatePairings(members, coach, opts);
    expect(res[0].groups).toHaveLength(0);
    expect(res[0].unplaced.map((u) => u.id).sort()).toEqual(['d', 'n']);
    expect(res[0].unplaced[0].reason).toMatch(/3-hour/);
  });

  it('places a group free for the full 3 hours at the only possible time', () => {
    const coach = allWeek();
    const members = [m('d', true, range(2, '13:00', '16:00')), m('n', false, range(2, '12:00', '17:00'))];
    const res = generatePairings(members, coach, opts);
    expect(res[0].groups).toHaveLength(1);
    expect(res[0].groups[0]).toMatchObject({ day: 2, driverId: 'd', memberIds: ['n'] });
    expect(fmtMin(cellStartMin(res[0].groups[0].start))).toBe('2:00 PM');
  });
});

describe('exactly one driver per group', () => {
  it('never forms a group without a driver', () => {
    const members = [m('a', false, allWeek()), m('b', false, allWeek()), m('c', false, allWeek())];
    const res = generatePairings(members, allWeek(), opts);
    expect(res[0].groups).toHaveLength(0);
    expect(res[0].unplaced[0].reason).toMatch(/No driver/);
  });

  it('never forms a driver-only group', () => {
    const members = [m('d1', true, allWeek()), m('d2', true, allWeek())];
    const res = generatePairings(members, allWeek(), opts);
    expect(res[0].groups).toHaveLength(0);
  });

  it('caps groups at 1 driver + 3 non-drivers', () => {
    const block = range(0, '9:00', '12:00');
    const members = [m('d', true, block), ...['a', 'b', 'c', 'e', 'f'].map((id) => m(id, false, block))];
    const res = generatePairings(members, allWeek(), opts);
    expect(res[0].groups).toHaveLength(1);
    expect(res[0].groups[0].memberIds).toHaveLength(3);
    expect(res[0].placedCount).toBe(4);
    assertValid(members, allWeek(), res);
  });

  it('validateGroups flags two drivers and zero non-drivers', () => {
    const members = [m('d1', true, allWeek()), m('d2', true, allWeek())];
    const w = validateGroups([{ day: 0, start: 4, driverId: 'd1', memberIds: ['d2'] }], members, allWeek());
    expect(w.join(' ')).toMatch(/more than 1 driver/);
    expect(w.join(' ')).toMatch(/at least 1 non-driver/);
  });
});

describe('one lesson per week per member', () => {
  it('uses each driver once even when they are free all week', () => {
    const members = [m('d', true, allWeek()), ...['a', 'b', 'c', 'e', 'f', 'g'].map((id) => m(id, false, allWeek()))];
    const res = generatePairings(members, allWeek(), opts);
    expect(res[0].groups).toHaveLength(1);
    expect(res[0].placedCount).toBe(4);
    assertValid(members, allWeek(), res);
  });

  it('validateGroups flags a member in two groups', () => {
    const members = [m('d1', true, allWeek()), m('d2', true, allWeek()), m('a', false, allWeek())];
    const w = validateGroups(
      [
        { day: 0, start: 4, driverId: 'd1', memberIds: ['a'] },
        { day: 1, start: 4, driverId: 'd2', memberIds: ['a'] },
      ],
      members,
      allWeek(),
    );
    expect(w.join(' ')).toMatch(/one lesson per week/);
  });
});

describe('coach availability and overlap', () => {
  it('coach only needs the lesson hour', () => {
    const coach = new Set(range(0, '10:00', '11:00'));
    expect(coachFreeFor(coach, 0, 5)).toBe(true);
    expect(coachFreeFor(coach, 0, 6)).toBe(false);
  });

  it('schedules only inside coach hours', () => {
    const coach = range(3, '11:00', '12:00');
    const members = [m('d', true, allWeek()), m('n', false, allWeek())];
    const res = generatePairings(members, coach, opts);
    expect(res[0].groups).toHaveLength(1);
    expect(res[0].groups[0].day).toBe(3);
    expect(fmtMin(cellStartMin(res[0].groups[0].start))).toBe('11:00 AM');
  });

  it('places nobody when the coach is never free for a full hour', () => {
    const coach = range(0, '10:00', '10:30');
    const members = [m('d', true, allWeek()), m('n', false, allWeek())];
    const res = generatePairings(members, coach, opts);
    expect(res[0].groups).toHaveLength(0);
    expect(res[0].unplaced[0].reason).toMatch(/coach/);
  });

  it('never overlaps lessons (coach teaches one group at a time)', () => {
    // Coach free 10:00 to 11:30 only: 10:00 and 10:30 starts overlap, so one group max.
    const coach = range(0, '10:00', '11:30');
    const members = [
      m('d1', true, allWeek()),
      m('d2', true, allWeek()),
      m('a', false, allWeek()),
      m('b', false, allWeek()),
    ];
    const res = generatePairings(members, coach, opts);
    expect(res[0].groups).toHaveLength(1);
    expect(res[0].placedCount).toBe(3);
    assertValid(members, coach, res);
    expect(lessonsOverlap({ day: 0, start: 5 }, { day: 0, start: 6 })).toBe(true);
    expect(lessonsOverlap({ day: 0, start: 5 }, { day: 0, start: 7 })).toBe(false);
    expect(lessonsOverlap({ day: 0, start: 5 }, { day: 1, start: 5 })).toBe(false);
  });

  it('back-to-back lessons are allowed', () => {
    const coach = range(0, '10:00', '12:00');
    const members = [m('d1', true, allWeek()), m('d2', true, allWeek()), m('a', false, allWeek()), m('b', false, allWeek())];
    const res = generatePairings(members, coach, opts);
    expect(res[0].groups).toHaveLength(2);
    expect(res[0].placedCount).toBe(4);
    assertValid(members, coach, res);
  });
});

describe('ranking and search quality', () => {
  it('compareOptions prefers more placed, then fewer lessons', () => {
    expect(compareOptions({ placedCount: 8, lessonCount: 3 }, { placedCount: 7, lessonCount: 2 })).toBeLessThan(0);
    expect(compareOptions({ placedCount: 8, lessonCount: 2 }, { placedCount: 8, lessonCount: 3 })).toBeLessThan(0);
  });

  it('returns distinct options sorted best first', () => {
    const members = [
      m('d1', true, allWeek()),
      m('d2', true, allWeek()),
      ...['a', 'b', 'c', 'e', 'f'].map((id) => m(id, false, allWeek())),
    ];
    const res = generatePairings(members, allWeek(), { ...opts, maxOptions: 5 });
    expect(res.length).toBe(5);
    for (let i = 1; i < res.length; i++) expect(res[i - 1].score).toBeGreaterThanOrEqual(res[i].score);
    const sigs = res.map((o) => JSON.stringify(o.groups));
    expect(new Set(sigs).size).toBe(res.length);
    expect(res[0].placedCount).toBe(7);
    expect(res[0].lessonCount).toBe(2);
    assertValid(members, allWeek(), res);
  });

  it('finds the placement where greedy choices would strand a member', () => {
    // n1 only matches d1 on Monday; d1 is also free Tuesday where n2 also fits with d2.
    const mon = range(0, '9:00', '12:00');
    const tue = range(1, '9:00', '12:00');
    const members = [
      m('d1', true, [...mon, ...tue]),
      m('d2', true, tue),
      m('n1', false, mon),
      m('n2', false, tue),
    ];
    const res = generatePairings(members, allWeek(), opts);
    expect(res[0].placedCount).toBe(4);
    assertValid(members, allWeek(), res);
  });

  it('handles ~60 members quickly and respects every rule', () => {
    let seed = 99;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const members: Member[] = [];
    for (let i = 0; i < 60; i++) {
      const slots: number[] = [];
      for (let d = 0; d < 7; d++) {
        if (rand() < 0.45) {
          const a = Math.floor(rand() * 10);
          const len = 4 + Math.floor(rand() * 10);
          for (let c = a; c < Math.min(CELLS_PER_DAY, a + len); c++) slots.push(slotKey(d, c));
        }
      }
      members.push(m(`m${i}`, i % 4 === 0, slots));
    }
    const coach: number[] = [];
    for (const d of [0, 1, 2, 3, 4, 5]) coach.push(...range(d, '9:00', '16:00'));
    const t0 = Date.now();
    const res = generatePairings(members, coach, { seed: 3, timeLimitMs: 3000 });
    expect(Date.now() - t0).toBeLessThan(6000);
    expect(res.length).toBeGreaterThan(1);
    assertValid(members, coach, res);
    expect(res[0].placedCount).toBeGreaterThan(20);
  });
});
