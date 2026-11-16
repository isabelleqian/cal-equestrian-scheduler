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

---

## Setup (about 30 minutes, one time)

### 1. Upload the files to GitHub

1. Unzip `cal-equestrian-scheduler.zip` on your computer.
2. Open https://github.com/isabelleqian/cal-equestrian-scheduler and click **Add file > Upload files**
   (on an empty repo, click the "uploading an existing file" link).
3. Open the unzipped folder, select everything inside it (not the folder itself), and drag it onto the page.
4. Click **Commit changes** (commit directly to the `main` branch).
5. Check that the repo now shows a `.github` folder. GitHub's upload page often skips folders whose names start
   with a dot, and your computer may hide them too. If `.github` is missing:
   1. Click **Add file > Create new file**.
   2. In the file name box type exactly `.github/workflows/deploy.yml` (typing the slashes creates the folders).
   3. Open `.github/workflows/deploy.yml` from the unzipped folder in a text editor (on a Mac press
      Cmd+Shift+. in Finder to show hidden files), copy everything, and paste it into GitHub.
   4. Click **Commit changes**.

   The `.gitignore` and `.env.example` files are optional, so it is fine if they are skipped.

### 2. Create a free Supabase project

1. Go to https://supabase.com and sign up (signing in with GitHub is easiest).
2. Click **New project**. Name it `cal-equestrian`, choose a database password (save it somewhere), pick the
   West US region, and click **Create new project**. Wait a minute or two for it to finish.

### 3. Create the database tables

1. In your Supabase project, click **SQL Editor** in the left sidebar, then **New query**.
2. Open `supabase/schema.sql` from this repo, copy all of it, paste it into the editor, and click **Run**.
3. You should see "Success. No rows returned".

### 4. Make yourself an admin

In the SQL Editor, run this one line with your own email (the one you will sign in with):

```sql
insert into public.admins (email) values ('your.email@berkeley.edu') on conflict do nothing;
```

Run the same line again for any other officer who should see the admin pages. To remove someone, use
`delete from public.admins where email = 'their.email@berkeley.edu';`

### 5. Set the sign-in web address

1. In Supabase, open **Authentication > URL Configuration**.
2. Set **Site URL** to `https://isabelleqian.github.io/cal-equestrian-scheduler/`
3. Under **Redirect URLs**, click **Add URL** and add `https://isabelleqian.github.io/cal-equestrian-scheduler/`
   (optional for testing on your own computer: also add `http://localhost:5173/cal-equestrian-scheduler/`).
4. Click **Save**.

### 6. Enable Google Sign-In in Supabase

The scheduler uses Google sign-in for authentication (no email rate limits or SMTP configuration needed):

1. Follow Supabase's guide at https://supabase.com/docs/guides/auth/social-login/auth-google to create a Google
   OAuth client (OAuth 2.0 Client ID) in the Google Cloud Console.
2. In Supabase, open **Authentication > Providers > Google**, toggle **Enable Google provider**, paste your
   Client ID and Client Secret, and click **Save**.
3. Under **Authentication > URL Configuration**, ensure your Site URL and Redirect URLs include:
   `https://isabelleqian.github.io/cal-equestrian-scheduler/`

### 7. Add the two secrets to GitHub

1. In Supabase, open **Project Settings > API** (on newer dashboards: **Project Settings > Data API** for the URL
   and **API Keys** for the key).
2. Copy the **Project URL** (looks like `https://abcd1234.supabase.co`) and the **anon public** key (a long text
   starting with `eyJ`, or a "publishable" key starting with `sb_publishable_`). Do not use the `service_role` or
   secret key.
3. In GitHub, open the repo, then **Settings > Secrets and variables > Actions > New repository secret**.
4. Add a secret named `VITE_SUPABASE_URL` with the Project URL.
5. Add another secret named `VITE_SUPABASE_ANON_KEY` with the anon key.

The anon key is designed to be public. Your data stays protected by the Row Level Security rules in `schema.sql`.

### 8. Turn on GitHub Pages

1. In the repo, open **Settings > Pages**.
2. Under **Build and deployment > Source**, choose **GitHub Actions**.

### 9. Deploy

1. Open the **Actions** tab of the repo.
2. Click **Deploy to GitHub Pages** on the left, then **Run workflow > Run workflow**.
3. Wait for the green check mark (about 2 minutes). From now on, every change you commit to `main` redeploys
   automatically.
4. If it fails on the first try because Pages was not enabled yet, just click **Re-run all jobs**.

### 10. Try it, then share the link

1. Open https://isabelleqian.github.io/cal-equestrian-scheduler/ and sign in with your admin email.
2. Fill in your name and driver status, then paint a test schedule and save it.
3. You will see an **Admin** link at the top. Set the coach's hours under **Admin > Coach hours**.
4. Send the link to the team. Each member signs in with their email, enters their name and whether they drive,
   and paints their week.

If the site shows "Almost there", the two secrets from step 7 are missing or misspelled. Fix them and run the
workflow again.

---

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
