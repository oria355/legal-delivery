# Backend setup — Supabase (step by step)

The app runs in two modes:

| Mode | When | What you get |
|------|------|--------------|
| **Demo** | no environment variables | in-memory data, role switcher (nothing is saved) |
| **Cloud** | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set | login, real-time sync, role-based data access, evidence files in cloud storage |

## 1. Create the Supabase project
1. Go to <https://supabase.com> → **New project** (choose a region close to Israel, e.g. Frankfurt).
2. Wait until it finishes provisioning.

## 2. Create the database (tables, security, triggers, storage)
1. Open **SQL Editor → New query**.
2. Paste the entire contents of `supabase/schema.sql` and press **Run**.
3. This creates:
   - tables `profiles`, `orders`, `visits`, `notifications`, `settings`
   - Row Level Security policies (courier = only assigned orders, lawyer = only own orders, admin = everything)
   - triggers that create law-firm notifications on every visit and on completion
   - Realtime publication for all five tables
   - the public Storage bucket **`evidence`** (photos, video, audio, signatures) with upload policies

## 3. Configure authentication
1. **Authentication → Providers → Email**: keep *Email* enabled.
2. Keep **Confirm email** switched **ON** (recommended). Optional for quick tests: turn it off.
3. **Authentication → URL Configuration**: set *Site URL* to your deployed URL (or `http://localhost:5173` for local work).

## 4. Add the environment variables
Supabase → **Project Settings → API**: copy the **Project URL** and the **anon public** key.

Local development:
```bash
cp .env.example .env.local
# edit .env.local and paste the two values
npm install
npm run dev
```
Vercel/Netlify: add the same two variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the project's environment settings and redeploy.
Never use the `service_role` key in this app.

## 5. Create the first admin
1. Open the app and choose **"משרד עורכי דין חדש? פתיחת חשבון"** → sign up with your own email (confirm the email if required).
2. In **SQL Editor** run (replace the email):
   ```sql
   update public.profiles set role = 'admin' where lower(email) = lower('you@example.com');
   ```
3. Sign out and in again — you now see the admin dashboard.

## 6. Add couriers and lawyers
- **Couriers**: Admin dashboard → *ניהול שליחים* → register the courier (use their real email).
  The courier then opens the app, creates an account with **that same email**, and is linked automatically with role *courier*.
- **Lawyers**: they can create their own account from the login screen (role *lawyer*).
  To fill in the details printed in the affidavit's attorney-verification block, run per lawyer:
  ```sql
  update public.profiles
     set firm = 'ישראלי ושות'' — משרד עורכי דין', bar_license_no = '45821',
         office_address = 'שדרות רוטשילד 45, תל אביב', phone = '03-5551234'
   where lower(email) = lower('lawyer@example.com');
  ```
- To make someone an admin later, use the SQL from step 5.

## 7. How it works
- **Real time**: the app subscribes to `orders`, `visits`, `notifications`, `profiles` and `settings`. A courier's visit report, photo, signature or affidavit appears on the Admin and Lawyer screens within a fraction of a second; Realtime respects the same security rules, so each user only receives their own rows.
- **Files**: photos, videos, audio recordings and signature images are uploaded to the `evidence` bucket under `<ORDER-ID>/...`; the database stores only the public URLs (`visits.photo_url`, `audio_url`, `signature_url`, and the affidavit signature URL inside `orders.data`).
- **Evidence integrity**: `visits` rows can be inserted but never edited or deleted from the app, and storage files are never overwritten.
- **Notifications**: created by database triggers (a client cannot forge them). Lawyers can only mark their own as read.
- **Payroll**: courier payment flags and manual adjustments are stored per courier in `settings` (`payroll:<courierId>`); the admin writes them, each courier reads only their own.

## 8. Security notes
- The anon key is public by design; **Row Level Security is what protects the data** — keep it enabled on every table.
- Evidence URLs are public (unguessable names, but anyone holding a link can open it). If you need private files, switch the bucket to private and replace `getPublicUrl` with signed URLs.
- A courier can edit the orders assigned to them (needed to report visits). A database trigger keeps ownership, the assigned-courier name and the price override admin-only.
- Allowing public sign-up creates *lawyer* accounts that can open orders. To disable it: **Authentication → Providers → Email → disable "Allow new users to sign up"** and create lawyers from **Authentication → Users → Add user** instead.
- The browser stores nothing sensitive besides the Supabase session token.
