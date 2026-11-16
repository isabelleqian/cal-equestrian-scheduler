# Cal Equestrian Lesson Scheduler

A when2meet-style scheduler for the Cal Equestrian Team. Members sign in, color in the times they are free each week,
and can come back to change them anytime. Admins set the coach's hours, see who has submitted, view an availability
heatmap, and generate ranked lesson groups.

Live site (after setup): **https://isabelleqian.github.io/cal-equestrian-scheduler/**

## How the pairing works

- A lesson is 1 hour and can start on any half hour.
- Everyone in a group must be free for a 3-hour block: 1 hour of travel before, the lesson hour, and 1 hour of travel
  after. The grid covers 7:30 AM to 5:00 PM, so the earliest lesson is 8:30 to 9:30 AM and the latest is 3:00 to
  4:00 PM.
- The coach only needs to be free for the lesson hour itself.
- Each group has exactly 1 driver and 1 to 3 non-drivers (4 people max).
- Each member, driver or not, gets at most one lesson per week.
- The coach teaches one group at a time, so lessons never overlap.
- Options are ranked by most members placed, then by fewest lessons (fuller groups). Anyone who could not be placed
  is listed with a reason.

The site is free to run: GitHub Pages hosts the pages and a free Supabase project stores sign-ins and schedules.

## Using the site

### Members

- **My schedule**: click or drag to color the times you are free. Drag works with a finger on phones too. Click a
  day name to fill or clear the whole day. Click **Save availability**. The page shows when you last saved, and
  warns you about unsaved changes.
- **Profile**: change your name or driver status anytime.
- Open the sign-in link in the same browser you requested it from.

### Admins

- **Roster**: drivers and non-drivers, who has submitted and when. You can switch someone's driver status or remove
  a member who left the team.
- **Coach hours**: paint the coach's available times the same way.
- **Heatmap**: how many people are free in each half hour, with coach hours outlined in gold. Filter by drivers or
  non-drivers and hover to see names. Below it, a table lists every possible lesson time with how many drivers and
  non-drivers are free for the full 3-hour window.
- **Pairings**: click **Generate pairing options** to get up to 5 ranked options. Each shows the day and time of
  every group, the driver, the riders, and who could not be placed and why. You can **Choose and save** an option,
  **Edit by hand** (change days, times, drivers, add or remove riders, with live warnings if a rule is broken), or
  **Download CSV**. Click **Generate again** for a fresh search.
- **Saved results**: every saved option, with the chosen one marked in gold. View, edit, mark as chosen, download as
  CSV, or delete.
- **New semester**: type RESET to clear all member grids and the coach's hours. Accounts, names, driver status and
  saved results stay.

---

## For developers

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm run dev                  # http://localhost:5173/cal-equestrian-scheduler/
npm test                     # pairing engine unit tests (Vitest)
npm run build                # production build into dist/
```

Project layout:

- `src/lib/pairing.ts`: the pairing engine (pure TypeScript, no network). Group filling is solved exactly with a
  matching step, and driver time slots are explored with randomized greedy starts plus local search, keeping the
  best distinct options. About 60 members run in 1 to 3 seconds in the browser.
- `src/lib/pairing.test.ts`: tests for the travel buffer, exactly one driver, one lesson per week, coach hours,
  non-overlap, and ranking.
- `src/components/Grid.tsx`: the paintable weekly grid.
- `src/pages/`: member pages; `src/pages/admin/`: admin pages.
- `supabase/schema.sql`: tables, Row Level Security, `is_admin()` and `reset_semester()`.
- `.github/workflows/deploy.yml`: tests, builds and deploys to GitHub Pages on every push to `main`.

Availability is stored as cell numbers: `day * 19 + cell`, where day 0 is Monday and cell 0 is 7:30 AM.
