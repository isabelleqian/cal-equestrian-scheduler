import { supabase } from './supabase';
import type { Group, Member, PairingOption, Unplaced } from './pairing';

export interface Profile {
  id: string;
  email: string;
  name: string;
  is_driver: boolean;
  updated_at?: string;
}

export interface AvailabilityRow {
  user_id: string;
  slots: number[];
  updated_at: string;
}

export interface SavedPairingData {
  groups: Group[];
  unplaced: Unplaced[];
  placedCount: number;
  lessonCount: number;
  score: number;
  names: Record<string, string>;
  emails: Record<string, string>;
}

export interface SavedPairing {
  id: number;
  created_at: string;
  created_by: string | null;
  label: string | null;
  is_selected: boolean;
  data: SavedPairingData;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function getMyProfile(uid: string): Promise<Profile | null> {
  return check(await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()) as Profile | null;
}

export async function saveMyProfile(p: { id: string; email: string; name: string; is_driver: boolean }) {
  check(await supabase.from('profiles').upsert(p));
}

export async function getMyAvailability(uid: string): Promise<AvailabilityRow | null> {
  return check(
    await supabase.from('availability').select('*').eq('user_id', uid).maybeSingle(),
  ) as AvailabilityRow | null;
}

export async function saveMyAvailability(uid: string, slots: number[]): Promise<AvailabilityRow> {
  return check(
    await supabase
      .from('availability')
      .upsert({ user_id: uid, slots, updated_at: new Date().toISOString() })
      .select()
      .single(),
  ) as AvailabilityRow;
}

export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return Boolean(data);
}

export interface CoachRow {
  slots: number[];
  updated_at: string;
  updated_by: string | null;
}

export async function getCoach(): Promise<CoachRow> {
  const row = check(await supabase.from('coach_availability').select('*').eq('id', 1).maybeSingle()) as CoachRow | null;
  return row ?? { slots: [], updated_at: '', updated_by: null };
}

export async function saveCoach(slots: number[], email: string) {
  check(await supabase.from('coach_availability').upsert({ id: 1, slots, updated_by: email }));
}

// ---------------- admin ----------------
export interface RosterEntry extends Profile {
  slots: number[];
  availability_updated_at: string | null;
}

export async function getRoster(): Promise<RosterEntry[]> {
  const profiles = check(await supabase.from('profiles').select('*').order('name')) as Profile[];
  const avail = check(await supabase.from('availability').select('*')) as AvailabilityRow[];
  const byId = new Map(avail.map((a) => [a.user_id, a]));
  return profiles.map((p) => ({
    ...p,
    slots: byId.get(p.id)?.slots ?? [],
    availability_updated_at: byId.get(p.id)?.updated_at ?? null,
  }));
}

export function rosterToMembers(roster: RosterEntry[]): Member[] {
  return roster.map((r) => ({ id: r.id, name: r.name, isDriver: r.is_driver, slots: r.slots }));
}

export async function adminUpdateProfile(id: string, patch: Partial<Pick<Profile, 'name' | 'is_driver'>>) {
  check(await supabase.from('profiles').update(patch).eq('id', id));
}

export async function adminDeleteProfile(id: string) {
  check(await supabase.from('profiles').delete().eq('id', id));
}

export async function listPairings(): Promise<SavedPairing[]> {
  return check(await supabase.from('pairings').select('*').order('created_at', { ascending: false })) as SavedPairing[];
}

export async function savePairing(label: string, data: SavedPairingData, email: string, select: boolean) {
  if (select) check(await supabase.from('pairings').update({ is_selected: false }).eq('is_selected', true));
  check(await supabase.from('pairings').insert({ label, data, created_by: email, is_selected: select }));
}

export async function selectPairing(id: number) {
  check(await supabase.from('pairings').update({ is_selected: false }).eq('is_selected', true));
  check(await supabase.from('pairings').update({ is_selected: true }).eq('id', id));
}

export async function deletePairing(id: number) {
  check(await supabase.from('pairings').delete().eq('id', id));
}

export async function resetSemester() {
  const { error } = await supabase.rpc('reset_semester');
  if (error) throw new Error(error.message);
}

export function toSavedData(
  option: Pick<PairingOption, 'groups' | 'unplaced' | 'placedCount' | 'lessonCount' | 'score'>,
  roster: RosterEntry[],
): SavedPairingData {
  const names: Record<string, string> = {};
  const emails: Record<string, string> = {};
  roster.forEach((r) => {
    names[r.id] = r.name;
    emails[r.id] = r.email;
  });
  return {
    groups: option.groups,
    unplaced: option.unplaced,
    placedCount: option.placedCount,
    lessonCount: option.lessonCount,
    score: option.score,
    names,
    emails,
  };
}
