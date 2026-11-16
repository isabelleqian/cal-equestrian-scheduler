/**
 * Pure pairing engine. No React, no Supabase: easy to unit test.
 *
 * Rules
 *  - A lesson is 1 hour (2 cells) and starts on a 30-minute boundary.
 *  - Every member of a group must be free for the full 3-hour block:
 *    1 hour travel before, the lesson hour, 1 hour travel after.
 *  - The coach must be free for the lesson hour only.
 *  - Each group has exactly 1 driver and 1 to 3 non-drivers.
 *  - Each member has at most one lesson per week.
 *  - The coach teaches one group at a time, so lessons never overlap.
 *
 * Objective: place as many members as possible, then use fewer lessons
 * (fuller groups).
 *
 * Search: the hard part is choosing which driver teaches at which time.
 * For a fixed driver-to-time assignment, filling groups with non-drivers is
 * a bipartite matching problem that we solve exactly (first give every
 * lesson one non-driver, then fill up to 3), so each candidate is scored
 * optimally. Driver-to-time assignments are explored with randomized greedy
 * construction followed by local search (move, eject, drop moves), repeated
 * over many restarts. Every evaluated state goes into a top-K pool of
 * distinct solutions, which become the ranked options.
 */
import {
  BUFFER_CELLS,
  FIRST_START,
  LAST_START,
  LESSON_CELLS,
  NUM_DAYS,
  slotKey,
} from './time';

export interface Member {
  id: string;
  name: string;
  isDriver: boolean;
  slots: number[];
}

export interface Group {
  day: number;
  start: number; // start cell of the lesson hour
  driverId: string;
  memberIds: string[]; // non-drivers
}

export interface Unplaced {
  id: string;
  reason: string;
}

export interface PairingOption {
  rank: number;
  score: number;
  placedCount: number;
  lessonCount: number;
  totalMembers: number;
  groups: Group[];
  unplaced: Unplaced[];
}

export interface PairingParams {
  maxOptions?: number;
  restarts?: number;
  timeLimitMs?: number;
  seed?: number;
}

export interface LessonTime {
  day: number;
  start: number;
}

// ------------------------------------------------------------------
// Basic rule helpers
// ------------------------------------------------------------------

export function allLessonTimes(): LessonTime[] {
  const out: LessonTime[] = [];
  for (let day = 0; day < NUM_DAYS; day++)
    for (let start = FIRST_START; start <= LAST_START; start++) out.push({ day, start });
  return out;
}

export function isValidStart(start: number): boolean {
  return Number.isInteger(start) && start >= FIRST_START && start <= LAST_START;
}

/** Member free for the full 3-hour block around a lesson starting at `start`. */
export function memberFreeFor(slots: Set<number>, day: number, start: number): boolean {
  if (!isValidStart(start)) return false;
  for (let c = start - BUFFER_CELLS; c < start + LESSON_CELLS + BUFFER_CELLS; c++) {
    if (!slots.has(slotKey(day, c))) return false;
  }
  return true;
}

/** Coach free for the lesson hour only. */
export function coachFreeFor(coach: Set<number>, day: number, start: number): boolean {
  if (!isValidStart(start)) return false;
  for (let c = start; c < start + LESSON_CELLS; c++) if (!coach.has(slotKey(day, c))) return false;
  return true;
}

export function lessonsOverlap(a: LessonTime, b: LessonTime): boolean {
  return a.day === b.day && Math.abs(a.start - b.start) < LESSON_CELLS;
}

/** Higher is better: placed members dominate, then fewer lessons. */
export function scoreOf(placedCount: number, lessonCount: number): number {
  return placedCount * 1000 - lessonCount * 10;
}

/** Strict ordering used for ranking: a before b if a is better. */
export function compareOptions(
  a: { placedCount: number; lessonCount: number },
  b: { placedCount: number; lessonCount: number },
): number {
  if (a.placedCount !== b.placedCount) return b.placedCount - a.placedCount;
  return a.lessonCount - b.lessonCount;
}

function hasAnyThreeHourBlock(slots: Set<number>): boolean {
  for (let day = 0; day < NUM_DAYS; day++)
    for (let s = FIRST_START; s <= LAST_START; s++) if (memberFreeFor(slots, day, s)) return true;
  return false;
}

// ------------------------------------------------------------------
// Seeded RNG (mulberry32) so results are reproducible in tests
// ------------------------------------------------------------------
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ------------------------------------------------------------------
// Problem model
// ------------------------------------------------------------------
interface Model {
  members: Member[];
  drivers: number[]; // indices into members
  nonDrivers: number[];
  times: LessonTime[]; // lesson times inside coach hours
  timeDrivers: number[][]; // per time: driver positions (index into drivers)
  timeNDs: number[][]; // per time: non-driver positions (index into nonDrivers)
  conflicts: number[][]; // per time: other time indices that overlap
  driverOptions: number[][]; // per driver position: time indices usable (needs 1+ non-driver)
  ndTimes: Set<number>[]; // per non-driver position: usable time indices
}

function buildModel(members: Member[], coachSlots: number[]): Model {
  const coach = new Set(coachSlots);
  const sets = members.map((m) => new Set(m.slots));
  const drivers: number[] = [];
  const nonDrivers: number[] = [];
  members.forEach((m, i) => (m.isDriver ? drivers : nonDrivers).push(i));
  const times = allLessonTimes().filter((t) => coachFreeFor(coach, t.day, t.start));
  const timeDrivers = times.map((t) =>
    drivers.map((mi, p) => (memberFreeFor(sets[mi], t.day, t.start) ? p : -1)).filter((p) => p >= 0),
  );
  const timeNDs = times.map((t) =>
    nonDrivers.map((mi, p) => (memberFreeFor(sets[mi], t.day, t.start) ? p : -1)).filter((p) => p >= 0),
  );
  const conflicts = times.map((t, i) =>
    times.map((u, j) => (j !== i && lessonsOverlap(t, u) ? j : -1)).filter((j) => j >= 0),
  );
  const driverOptions: number[][] = drivers.map(() => []);
  const ndTimes: Set<number>[] = nonDrivers.map(() => new Set());
  times.forEach((_, ti) => {
    if (timeNDs[ti].length > 0) for (const p of timeDrivers[ti]) driverOptions[p].push(ti);
    if (timeDrivers[ti].length > 0) for (const q of timeNDs[ti]) ndTimes[q].add(ti);
  });
  return { members, drivers, nonDrivers, times, timeDrivers, timeNDs, conflicts, driverOptions, ndTimes };
}

interface Evaluated {
  placedCount: number;
  lessonCount: number;
  score: number;
  // per driver position: time index or -1 (only drivers with a non-empty group)
  groups: { driver: number; time: number; nds: number[] }[];
}

/**
 * Given driver -> time assignment (-1 = none), fill groups optimally with
 * non-drivers. Stage 1 maximizes the number of non-empty groups, stage 2
 * fills groups up to 3. Augmenting paths never empty a matched group, so
 * both counts end up maximal at once.
 */
function evaluate(model: Model, assign: Int32Array, r: (() => number) | null): Evaluated {
  const lessons: { driver: number; time: number }[] = [];
  for (let p = 0; p < assign.length; p++) if (assign[p] >= 0) lessons.push({ driver: p, time: assign[p] });
  const timeToLesson = new Map<number, number>();
  lessons.forEach((l, i) => timeToLesson.set(l.time, i));

  const nND = model.nonDrivers.length;
  const adj: number[][] = Array.from({ length: nND }, () => []);
  lessons.forEach((l, li) => {
    for (const q of model.timeNDs[l.time]) adj[q].push(li);
  });
  if (r) for (const a of adj) shuffle(a, r);

  const load: number[][] = lessons.map(() => []);
  const ndLesson = new Int32Array(nND).fill(-1);
  let visited = new Uint8Array(lessons.length);

  const tryAssign = (q: number, cap: number): boolean => {
    for (const li of adj[q]) {
      if (visited[li]) continue;
      visited[li] = 1;
      if (load[li].length < cap) {
        load[li].push(q);
        ndLesson[q] = li;
        return true;
      }
    }
    for (const li of adj[q]) {
      if (visited[li] === 2) continue;
      visited[li] = 2;
      const occ = load[li];
      for (let k = 0; k < occ.length; k++) {
        const other = occ[k];
        if (tryAssign(other, cap)) {
          occ[k] = q;
          ndLesson[q] = li;
          return true;
        }
      }
    }
    return false;
  };

  const order = Array.from({ length: nND }, (_, i) => i);
  if (r) shuffle(order, r);
  for (const cap of [1, 3]) {
    for (const q of order) {
      if (ndLesson[q] >= 0 || adj[q].length === 0) continue;
      visited = new Uint8Array(lessons.length);
      tryAssign(q, cap);
    }
  }

  const groups = lessons
    .map((l, li) => ({ driver: l.driver, time: l.time, nds: load[li].slice() }))
    .filter((g) => g.nds.length > 0);
  const placedCount = groups.reduce((s, g) => s + 1 + g.nds.length, 0);
  const lessonCount = groups.length;
  return { placedCount, lessonCount, score: scoreOf(placedCount, lessonCount), groups };
}

// ------------------------------------------------------------------
// Reasons for unplaced members
// ------------------------------------------------------------------
export function unplacedReason(member: Member, members: Member[], coachSlots: number[]): string {
  const slots = new Set(member.slots);
  if (slots.size === 0) return 'No availability submitted yet.';
  if (!hasAnyThreeHourBlock(slots))
    return 'No 3-hour free block (1 hr travel, 1 hr lesson, 1 hr travel) between 7:30 AM and 5:00 PM.';
  const coach = new Set(coachSlots);
  const times = allLessonTimes().filter(
    (t) => coachFreeFor(coach, t.day, t.start) && memberFreeFor(slots, t.day, t.start),
  );
  if (times.length === 0) return 'Free 3-hour blocks never line up with the coach being free for the lesson hour.';
  const others = members.filter((m) => m.id !== member.id && m.isDriver !== member.isDriver);
  const otherSets = others.map((m) => new Set(m.slots));
  const shared = times.some((t) => otherSets.some((s) => memberFreeFor(s, t.day, t.start)));
  if (member.isDriver) {
    if (!shared) return 'No non-driver is free for the same 3-hour window.';
    return 'Compatible times were taken by other groups (the coach teaches one group at a time) or the non-drivers were placed elsewhere.';
  }
  if (!shared) return 'No driver is free for the same 3-hour window.';
  return 'Groups at compatible times were full, or those drivers were placed at other times.';
}

// ------------------------------------------------------------------
// Validation for manual edits
// ------------------------------------------------------------------
export function validateGroups(groups: Group[], members: Member[], coachSlots: number[]): string[] {
  const warnings: string[] = [];
  const byId = new Map(members.map((m) => [m.id, m]));
  const sets = new Map(members.map((m) => [m.id, new Set(m.slots)]));
  const coach = new Set(coachSlots);
  const seen = new Map<string, number>();
  const name = (id: string) => byId.get(id)?.name ?? 'Unknown member';

  groups.forEach((g, gi) => {
    const label = `Group ${gi + 1}`;
    if (!isValidStart(g.start)) {
      warnings.push(`${label}: lesson must start between 8:30 AM and 3:00 PM to fit the travel buffer.`);
    } else if (!coachFreeFor(coach, g.day, g.start)) {
      warnings.push(`${label}: the coach is not free for this lesson hour.`);
    }
    const driver = byId.get(g.driverId);
    if (!g.driverId || !driver) warnings.push(`${label}: needs exactly 1 driver.`);
    else if (!driver.isDriver) warnings.push(`${label}: ${driver.name} is not marked as a driver.`);
    const ids = [g.driverId, ...g.memberIds].filter(Boolean);
    const nonDriverCount = g.memberIds.filter((id) => !byId.get(id)?.isDriver).length;
    const extraDrivers = g.memberIds.filter((id) => byId.get(id)?.isDriver);
    if (extraDrivers.length) warnings.push(`${label}: has more than 1 driver (${extraDrivers.map(name).join(', ')}).`);
    if (nonDriverCount < 1) warnings.push(`${label}: needs at least 1 non-driver.`);
    if (ids.length > 4) warnings.push(`${label}: has ${ids.length} people; the maximum is 4.`);
    for (const id of ids) {
      if (isValidStart(g.start) && !memberFreeFor(sets.get(id) ?? new Set(), g.day, g.start))
        warnings.push(`${label}: ${name(id)} is not free for the full 3-hour window.`);
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
  });
  for (const [id, n] of seen) if (n > 1) warnings.push(`${name(id)} is in ${n} groups; members get one lesson per week.`);
  for (let i = 0; i < groups.length; i++)
    for (let j = i + 1; j < groups.length; j++)
      if (lessonsOverlap(groups[i], groups[j]))
        warnings.push(`Groups ${i + 1} and ${j + 1} overlap; the coach can only teach one group at a time.`);
  return warnings;
}

/** Summarize any set of groups (generated or hand-edited). */
export function summarize(groups: Group[], members: Member[], coachSlots: number[]) {
  const placed = new Set<string>();
  for (const g of groups) {
    if (g.driverId) placed.add(g.driverId);
    g.memberIds.forEach((id) => placed.add(id));
  }
  const unplaced = members
    .filter((m) => !placed.has(m.id))
    .map((m) => ({ id: m.id, reason: unplacedReason(m, members, coachSlots) }));
  const placedCount = members.filter((m) => placed.has(m.id)).length;
  return { placedCount, lessonCount: groups.length, score: scoreOf(placedCount, groups.length), unplaced };
}

// ------------------------------------------------------------------
// Main entry point
// ------------------------------------------------------------------
export function generatePairings(members: Member[], coachSlots: number[], params: PairingParams = {}): PairingOption[] {
  const maxOptions = params.maxOptions ?? 5;
  const restarts = params.restarts ?? 400;
  const timeLimitMs = params.timeLimitMs ?? 2000;
  const rand = rng(params.seed ?? 12345);
  const model = buildModel(members, coachSlots);
  const nDrivers = model.drivers.length;
  const deadline = Date.now() + timeLimitMs;

  // Pool of distinct solutions (top maxOptions, plus some slack for variety)
  const poolSize = maxOptions;
  const pool: { ev: Evaluated; sig: string }[] = [];
  const poolSigs = new Set<string>();
  const signature = (ev: Evaluated) =>
    ev.groups
      .map((g) => `${g.time}:${g.driver}:${g.nds.slice().sort((a, b) => a - b).join('.')}`)
      .sort()
      .join('|');
  const offer = (ev: Evaluated) => {
    if (ev.lessonCount === 0) return;
    if (pool.length >= poolSize && compareOptions(ev, pool[pool.length - 1].ev) >= 0) return;
    const sig = signature(ev);
    if (poolSigs.has(sig)) return;
    pool.push({ ev, sig });
    poolSigs.add(sig);
    pool.sort((a, b) => compareOptions(a.ev, b.ev));
    while (pool.length > poolSize) poolSigs.delete(pool.pop()!.sig);
  };

  if (nDrivers > 0 && model.times.length > 0) {
    const evalAssign = (a: Int32Array) => evaluate(model, a, rand);

    // Put driver p at time ti, ejecting drivers at overlapping times.
    const applyMove = (a: Int32Array, owner: Int32Array, p: number, ti: number) => {
      const old = a[p];
      if (old >= 0) owner[old] = -1;
      a[p] = ti;
      if (ti >= 0) {
        const clear = [ti, ...model.conflicts[ti]];
        for (const t of clear) {
          const q = owner[t];
          if (q >= 0 && q !== p) {
            a[q] = -1;
            owner[t] = -1;
          }
        }
        owner[ti] = p;
      }
    };

    for (let iter = 0; iter < restarts; iter++) {
      if (iter > 0 && Date.now() > deadline) break;
      const assign = new Int32Array(nDrivers).fill(-1);
      const owner = new Int32Array(model.times.length).fill(-1);
      const blocked = new Uint8Array(model.times.length);

      // Randomized greedy: most constrained drivers first.
      const key = Array.from({ length: nDrivers }, (_, p) => model.driverOptions[p].length + rand() * 4);
      const order = Array.from({ length: nDrivers }, (_, p) => p).sort((x, y) => key[x] - key[y]);
      const ndUse = new Int32Array(model.nonDrivers.length);
      for (const p of order) {
        const opts = model.driverOptions[p].filter((ti) => !blocked[ti]);
        if (!opts.length) continue;
        let best = -1;
        let bestW = -Infinity;
        for (const ti of opts) {
          // Prefer times with many non-drivers that are not already covered.
          let w = 0;
          for (const q of model.timeNDs[ti]) w += 1 / (1 + ndUse[q]);
          w = Math.min(w, 3) + rand() * 1.5;
          if (w > bestW) {
            bestW = w;
            best = ti;
          }
        }
        assign[p] = best;
        owner[best] = p;
        blocked[best] = 1;
        for (const t of model.conflicts[best]) blocked[t] = 1;
        for (const q of model.timeNDs[best]) ndUse[q]++;
      }

      let cur = evalAssign(assign);
      offer(cur);

      // Local search: first-improvement over move / eject / drop.
      let improved = true;
      let passes = 0;
      while (improved && passes < 25) {
        improved = false;
        passes++;
        const ps = shuffle(Array.from({ length: nDrivers }, (_, p) => p), rand);
        for (const p of ps) {
          const opts = shuffle([...model.driverOptions[p], -1], rand);
          for (const ti of opts) {
            if (ti === assign[p]) continue;
            const a2 = assign.slice();
            const o2 = owner.slice();
            applyMove(a2, o2, p, ti);
            const ev = evalAssign(a2);
            offer(ev);
            if (compareOptions(ev, cur) < 0) {
              assign.set(a2);
              owner.set(o2);
              cur = ev;
              improved = true;
              break;
            }
          }
          if (Date.now() > deadline && iter > 0) break;
        }
      }
    }
  }

  const options = pool.map(({ ev }, i): PairingOption => {
    const groups: Group[] = ev.groups
      .map((g) => ({
        day: model.times[g.time].day,
        start: model.times[g.time].start,
        driverId: members[model.drivers[g.driver]].id,
        memberIds: g.nds.map((q) => members[model.nonDrivers[q]].id),
      }))
      .sort((a, b) => a.day - b.day || a.start - b.start);
    const s = summarize(groups, members, coachSlots);
    return {
      rank: i + 1,
      score: s.score,
      placedCount: s.placedCount,
      lessonCount: s.lessonCount,
      totalMembers: members.length,
      groups,
      unplaced: s.unplaced,
    };
  });
  if (options.length === 0) {
    const s = summarize([], members, coachSlots);
    return [
      { rank: 1, score: s.score, placedCount: 0, lessonCount: 0, totalMembers: members.length, groups: [], unplaced: s.unplaced },
    ];
  }
  return options;
}

